import test from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";
import { createECDH } from "node:crypto";
import webpush from "web-push";
import { handle, deliver } from "./worker.js";
import { validDue } from "./policy.js";

function setup() {
  const db = new DatabaseSync(":memory:");
  db.exec(
    readFileSync(
      new URL("./migrations/0001_reminders.sql", import.meta.url),
      "utf8",
    ),
  );
  const wrap = (sql, args = []) => ({
    bind: (...values) => wrap(sql, values),
    async run() {
      const r = db.prepare(sql).run(...args);
      return { meta: { changes: r.changes } };
    },
    async all() {
      return { results: db.prepare(sql).all(...args) };
    },
    async first() {
      return db.prepare(sql).get(...args) || null;
    },
  });
  return {
    db,
    env: {
      APP_ORIGIN: "https://app.example",
      FIREBASE_PROJECT_ID: "test",
      DB: {
        prepare: wrap,
        async batch(statements) {
          db.exec("BEGIN");
          try {
            for (const statement of statements) await statement.run();
            db.exec("COMMIT");
          } catch (e) {
            db.exec("ROLLBACK");
            throw e;
          }
        },
      },
    },
  };
}
const subscription = {
  endpoint: "https://web.push.apple.com/test",
  keys: { p256dh: "a".repeat(87), auth: "b".repeat(22) },
};
const verify = async (token) => ({
  payload: {
    sub: token,
    exp: Date.now() / 1000 + 3600,
    auth_time: Date.now() / 1000 - 10,
  },
});
const req = (env, path, method = "GET", body, uid = "alice") =>
  new Request(`https://worker.example${path}`, {
    method,
    headers: { Origin: env.APP_ORIGIN, Authorization: `Bearer ${uid}` },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
test("rejects untrusted origins and unauthenticated requests before database access", async () => {
  const { env } = setup();
  assert.equal(
    (await handle(new Request("https://worker.example/reminders"), env)).status,
    403,
  );
  assert.equal(
    (
      await handle(
        new Request("https://worker.example/reminders", {
          headers: { Origin: env.APP_ORIGIN },
        }),
        env,
      )
    ).status,
    401,
  );
});
test("owner isolation, duplicate endpoint protection, scheduling and device cancellation", async () => {
  const { env, db } = setup();
  assert.equal(
    (
      await handle(
        req(env, "/devices", "POST", { id: "phone", subscription }),
        env,
        verify,
      )
    ).status,
    200,
  );
  assert.equal(
    (
      await handle(
        req(env, "/devices", "POST", { id: "other", subscription }, "bob"),
        env,
        verify,
      )
    ).status,
    503,
  );
  assert.equal(
    (
      await handle(
        req(env, "/reminders", "POST", {
          id: "nudge",
          device: "phone",
          dueAt: Date.now() + 120000,
        }),
        env,
        verify,
      )
    ).status,
    200,
  );
  const other = await handle(
    req(env, "/reminders", "GET", null, "bob"),
    env,
    verify,
  );
  assert.deepEqual((await other.json()).items, []);
  await handle(
    req(env, "/reminders/nudge", "DELETE", null, "bob"),
    env,
    verify,
  );
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM reminders").get().n, 1);
  await handle(req(env, "/devices/phone", "DELETE"), env, verify);
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM reminders").get().n, 0);
});
test("rejects unsafe endpoints, stale times and oversized bodies", async () => {
  const { env } = setup();
  assert.equal(validDue(Date.now() - 1), false);
  assert.equal(
    (
      await handle(
        req(env, "/devices", "POST", {
          id: "phone",
          subscription: {
            ...subscription,
            endpoint: "https://localhost/private",
          },
        }),
        env,
        verify,
      )
    ).status,
    400,
  );
  assert.equal(
    (
      await handle(
        req(env, "/reminders", "POST", { id: "x", extra: "x".repeat(9000) }),
        env,
        verify,
      )
    ).status,
    413,
  );
});
test("scheduler expires old nudges and bounds failed attempts without a device", async () => {
  const { env, db } = setup();
  for (const [id, time] of [
    ["old", Date.now() - 2 * 86400000],
    ["missing", Date.now() - 1000],
  ])
    db.prepare(
      "INSERT INTO reminders(uid,id,device,due_at) VALUES(?,?,?,?)",
    ).run("alice", id, "gone", time);
  await deliver(env);
  assert.equal(
    db.prepare("SELECT status FROM reminders WHERE id=?").get("old").status,
    "expired",
  );
  assert.equal(
    db.prepare("SELECT status FROM reminders WHERE id=?").get("missing").status,
    "failed",
  );
  await deliver(env);
  assert.equal(
    db.prepare("SELECT attempts FROM reminders WHERE id=?").get("missing")
      .attempts,
    1,
  );
});
test("scheduler sends encrypted generic push, retries transient failure and stops after success", async () => {
  const { env, db } = setup();
  const pair = webpush.generateVAPIDKeys();
  Object.assign(env, {
    WEB_PUSH_PUBLIC_KEY: pair.publicKey,
    WEB_PUSH_PRIVATE_KEY: pair.privateKey,
    WEB_PUSH_SUBJECT: "mailto:test@example.invalid",
  });
  const ecdh = createECDH("prime256v1");
  ecdh.generateKeys();
  const sub = {
    ...subscription,
    keys: {
      p256dh: ecdh.getPublicKey().toString("base64url"),
      auth: Buffer.alloc(16, 1).toString("base64url"),
    },
  };
  db.prepare("INSERT INTO devices VALUES(?,?,?,?)").run(
    "alice",
    "phone",
    sub.endpoint,
    JSON.stringify(sub),
  );
  db.prepare("INSERT INTO reminders(uid,id,device,due_at) VALUES(?,?,?,?)").run(
    "alice",
    "nudge",
    "phone",
    Date.now() - 1000,
  );
  const original = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async (endpoint, options) => {
    calls++;
    assert.equal(endpoint, sub.endpoint);
    assert.equal(options.headers["Content-Encoding"], "aes128gcm");
    assert.equal(options.redirect, "error");
    assert.ok(options.body.length > 0);
    return new Response(null, { status: calls === 1 ? 503 : 201 });
  };
  try {
    await deliver(env);
    assert.equal(
      db.prepare("SELECT status FROM reminders").get().status,
      "pending",
    );
    await deliver(env);
    assert.equal(
      db.prepare("SELECT status FROM reminders").get().status,
      "sent",
    );
    await deliver(env);
    assert.equal(calls, 2);
  } finally {
    globalThis.fetch = original;
  }
});
test("active leases prevent duplicate claims", async () => {
  const { env, db } = setup();
  db.prepare(
    "INSERT INTO reminders(uid,id,device,due_at,status,lease_until) VALUES(?,?,?,?,?,?)",
  ).run(
    "alice",
    "leased",
    "phone",
    Date.now() - 1000,
    "sending",
    Date.now() + 60000,
  );
  await deliver(env);
  assert.equal(db.prepare("SELECT attempts FROM reminders").get().attempts, 0);
});
