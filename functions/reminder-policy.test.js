import test from "node:test";
import assert from "node:assert/strict";
import {
  claimable,
  expired,
  retryable,
  validSubscription,
} from "./reminder-policy.js";
const stamp = (ms) => ({ toMillis: () => ms });
const subscription = (endpoint) => ({
  endpoint,
  keys: { p256dh: "A".repeat(87), auth: "B".repeat(22) },
});
test("only known HTTPS push services are eligible for server requests", () => {
  for (const host of [
    "web.push.apple.com",
    "fcm.googleapis.com",
    "updates.push.services.mozilla.com",
  ])
    assert.equal(
      validSubscription(subscription(`https://${host}/push/abc`)),
      true,
    );
  for (const url of [
    "http://web.push.apple.com/x",
    "https://web.push.apple.com.attacker.test/x",
    "https://127.0.0.1/x",
    "https://169.254.169.254/x",
    "https://user:pass@web.push.apple.com/x",
    "https://web.push.apple.com:444/x",
  ])
    assert.equal(validSubscription(subscription(url)), false);
  assert.equal(
    validSubscription({ endpoint: "https://web.push.apple.com", keys: {} }),
    false,
  );
});
test("only due pending or expired-lease reminders can be claimed", () => {
  assert.equal(claimable({ status: "pending", dueAt: stamp(100) }, 200), true);
  assert.equal(claimable({ status: "pending", dueAt: stamp(300) }, 200), false);
  assert.equal(claimable({ status: "sent", dueAt: stamp(100) }, 200), false);
  assert.equal(
    claimable(
      { status: "sending", dueAt: stamp(100), leaseUntil: stamp(300) },
      200,
    ),
    false,
  );
  assert.equal(
    claimable(
      { status: "sending", dueAt: stamp(100), leaseUntil: stamp(150) },
      200,
    ),
    true,
  );
});
test("expired reminders are skipped and transient errors can retry", () => {
  assert.equal(expired({ dueAt: stamp(100) }, 100 + 86400001), true);
  assert.equal(expired({ dueAt: stamp(100) }, 200), false);
  assert.equal(retryable(410), false);
  assert.equal(retryable(429), true);
  assert.equal(retryable(503), true);
  assert.equal(retryable(undefined), true);
});
