import { createRemoteJWKSet, jwtVerify } from "jose";
import webpush from "web-push";
import { validSubscription, validId, validDue, retryable } from "./policy.js";

const keys = createRemoteJWKSet(
  new URL(
    "https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com",
  ),
);
const json = (value, status = 200) => Response.json(value, { status });

// No service-account key or access to planner/journal data is required.
export async function handle(request, env, verify = jwtVerify) {
  const origin = request.headers.get("Origin");
  if (origin !== env.APP_ORIGIN)
    return json({ error: "Origin not allowed." }, 403);
  const headers = {
    "Access-Control-Allow-Origin": origin,
    Vary: "Origin",
    "Cache-Control": "no-store",
  };
  const respond = (response) => {
    for (const [key, value] of Object.entries(headers))
      response.headers.set(key, value);
    return response;
  };
  if (request.method === "OPTIONS")
    return respond(
      new Response(null, {
        status: 204,
        headers: {
          "Access-Control-Allow-Methods": "GET,POST,DELETE,OPTIONS",
          "Access-Control-Allow-Headers": "Authorization,Content-Type",
        },
      }),
    );
  let uid;
  try {
    const token = request.headers
      .get("Authorization")
      ?.match(/^Bearer (\S+)$/)?.[1];
    if (!token) throw Error();
    const { payload } = await verify(token, keys, {
      algorithms: ["RS256"],
      audience: env.FIREBASE_PROJECT_ID,
      issuer: `https://securetoken.google.com/${env.FIREBASE_PROJECT_ID}`,
    });
    if (
      !payload.sub ||
      payload.sub.length > 128 ||
      !Number.isFinite(payload.exp) ||
      !Number.isFinite(payload.auth_time) ||
      payload.auth_time > Date.now() / 1000
    )
      throw Error();
    uid = payload.sub;
  } catch {
    return respond(json({ error: "Sign in again to manage reminders." }, 401));
  }
  try {
    const path = new URL(request.url).pathname;
    if (request.method === "GET" && path === "/reminders") {
      const rows = await env.DB.prepare(
        "SELECT id,due_at,status FROM reminders WHERE uid=? ORDER BY due_at DESC LIMIT 30",
      )
        .bind(uid)
        .all();
      return respond(json({ items: rows.results }));
    }
    const parts = path.split("/").filter(Boolean);
    if (
      request.method === "DELETE" &&
      parts.length === 2 &&
      validId(parts[1])
    ) {
      const [kind, id] = parts;
      if (kind === "devices") {
        await env.DB.batch([
          env.DB.prepare("DELETE FROM reminders WHERE uid=? AND device=?").bind(
            uid,
            id,
          ),
          env.DB.prepare("DELETE FROM devices WHERE uid=? AND id=?").bind(
            uid,
            id,
          ),
        ]);
      } else if (kind === "reminders")
        await env.DB.prepare("DELETE FROM reminders WHERE uid=? AND id=?")
          .bind(uid, id)
          .run();
      else return respond(json({ error: "Not found." }, 404));
      return respond(json({ ok: true }));
    }
    if (request.method !== "POST" || !["/devices", "/reminders"].includes(path))
      return respond(json({ error: "Not found." }, 404));
    // Bound streamed input too; do not trust Content-Length.
    const reader = request.body?.getReader();
    let size = 0,
      chunks = [];
    if (!reader) return respond(json({ error: "Body required." }, 400));
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > 8192) {
        await reader.cancel();
        return respond(json({ error: "Request too large." }, 413));
      }
      chunks.push(value);
    }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.length;
    }
    let body;
    try {
      body = JSON.parse(new TextDecoder().decode(bytes));
    } catch {
      return respond(json({ error: "Invalid JSON." }, 400));
    }
    if (!validId(body.id))
      return respond(json({ error: "Invalid identifier." }, 400));
    if (path === "/devices") {
      if (!validSubscription(body.subscription))
        return respond(json({ error: "Invalid push subscription." }, 400));
      // The unique endpoint prevents silently enrolling one browser in two accounts.
      const result = await env.DB.prepare(
        `INSERT INTO devices(uid,id,endpoint,subscription)
        SELECT ?,?,?,? WHERE (SELECT COUNT(*) FROM devices WHERE uid=?) < 3
        OR EXISTS(SELECT 1 FROM devices WHERE uid=? AND id=?)
        ON CONFLICT(uid,id) DO UPDATE SET endpoint=excluded.endpoint,subscription=excluded.subscription`,
      )
        .bind(
          uid,
          body.id,
          body.subscription.endpoint,
          JSON.stringify(body.subscription),
          uid,
          uid,
          body.id,
        )
        .run();
      if (!result.meta.changes)
        return respond(
          json(
            {
              error:
                "Limit of three phones reached. Disable an existing phone first.",
            },
            409,
          ),
        );
    } else {
      if (!validId(body.device) || !validDue(body.dueAt))
        return respond(
          json(
            {
              error:
                "Choose a time at least one minute ahead and within 30 days.",
            },
            400,
          ),
        );
      const result = await env.DB.prepare(
        `INSERT INTO reminders(uid,id,device,due_at)
        SELECT ?,?,?,? WHERE EXISTS(SELECT 1 FROM devices WHERE uid=? AND id=?)
        AND (SELECT COUNT(*) FROM reminders WHERE uid=? AND status IN ('pending','sending')) < 30`,
      )
        .bind(uid, body.id, body.device, body.dueAt, uid, body.device, uid)
        .run();
      if (!result.meta.changes)
        return respond(
          json(
            {
              error:
                "Enable this phone first, or cancel a pending reminder (limit 30).",
            },
            409,
          ),
        );
    }
    return respond(json({ ok: true }));
  } catch {
    // No subscription, JWT, or personal data is logged or returned.
    return respond(
      json(
        {
          error:
            "Reminder service unavailable or device already belongs to another account. Try again later.",
        },
        503,
      ),
    );
  }
}

export async function deliver(env) {
  const now = Date.now();
  await env.DB.prepare("DELETE FROM reminders WHERE due_at < ?")
    .bind(now - 7 * 86400000)
    .run();
  const rows = await env.DB.prepare(
    `SELECT uid,id FROM reminders WHERE due_at<=? AND attempts<3
    AND (status='pending' OR (status='sending' AND lease_until<=?)) ORDER BY due_at LIMIT 10`,
  )
    .bind(now, now)
    .all();
  for (const row of rows.results) {
    const lease = now + 300000;
    const r = await env.DB.prepare(
      `UPDATE reminders SET status='sending',attempts=attempts+1,lease_until=?
      WHERE uid=? AND id=? AND attempts<3 AND (status='pending' OR (status='sending' AND lease_until<=?)) RETURNING *`,
    )
      .bind(lease, row.uid, row.id, now)
      .first();
    if (!r) continue;
    const device = await env.DB.prepare(
      "SELECT subscription FROM devices WHERE uid=? AND id=?",
    )
      .bind(r.uid, r.device)
      .first();
    let status = "failed";
    if (now - r.due_at > 86400000) status = "expired";
    else if (device) {
      const subscription = JSON.parse(device.subscription);
      if (validSubscription(subscription))
        try {
          const details = webpush.generateRequestDetails(
            subscription,
            JSON.stringify({ id: r.id }),
            {
              TTL: 300,
              urgency: "high",
              vapidDetails: {
                subject: env.WEB_PUSH_SUBJECT,
                publicKey: env.WEB_PUSH_PUBLIC_KEY,
                privateKey: env.WEB_PUSH_PRIVATE_KEY,
              },
            },
          );
          const response = await fetch(details.endpoint, {
            method: details.method,
            headers: details.headers,
            body: details.body,
            redirect: "error",
            signal: AbortSignal.timeout(5000),
          });
          if (response.ok) status = "sent";
          else if ([404, 410].includes(response.status))
            await env.DB.prepare("DELETE FROM devices WHERE uid=? AND id=?")
              .bind(r.uid, r.device)
              .run();
          else if (retryable(response.status) && r.attempts < 3)
            status = "pending";
        } catch {
          if (r.attempts < 3) status = "pending";
        }
    }
    // Deleted/canceled records are never recreated. A push already dispatched cannot be recalled.
    await env.DB.prepare(
      "UPDATE reminders SET status=?,lease_until=0 WHERE uid=? AND id=? AND status='sending' AND lease_until=? AND attempts=?",
    )
      .bind(status, r.uid, r.id, lease, r.attempts)
      .run();
  }
  await env.DB.prepare(
    "UPDATE reminders SET status='failed' WHERE status='sending' AND attempts>=3 AND lease_until<=?",
  )
    .bind(now)
    .run();
}
export default {
  fetch: (request, env) => handle(request, env),
  scheduled: (_event, env, ctx) => ctx.waitUntil(deliver(env)),
};
