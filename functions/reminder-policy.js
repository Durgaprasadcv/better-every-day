const hosts = new Set([
  "web.push.apple.com",
  "fcm.googleapis.com",
  "updates.push.services.mozilla.com",
]);
export function validSubscription(value) {
  try {
    const url = new URL(value.endpoint);
    return (
      url.protocol === "https:" &&
      hosts.has(url.hostname) &&
      !url.port &&
      !url.username &&
      !url.password &&
      /^[A-Za-z0-9_-]{87,88}$/.test(value.keys.p256dh) &&
      /^[A-Za-z0-9_-]{22,24}$/.test(value.keys.auth)
    );
  } catch {
    return false;
  }
}
export function claimable(reminder, now) {
  if (!reminder || typeof reminder.dueAt?.toMillis !== "function") return false;
  if (reminder.dueAt.toMillis() > now) return false;
  if (reminder.status === "pending") return true;
  return (
    reminder.status === "sending" && reminder.leaseUntil?.toMillis() <= now
  );
}
export const expired = (reminder, now) =>
  now - reminder.dueAt.toMillis() > 24 * 60 * 60 * 1000;
export const retryable = (status) => status === 429 || status >= 500 || !status;
