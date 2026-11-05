export { validSubscription, retryable } from "../functions/reminder-policy.js";
export const validId = (id) =>
  typeof id === "string" && /^[a-zA-Z0-9_-]{1,128}$/.test(id);
export const validDue = (due, now = Date.now()) =>
  Number.isSafeInteger(due) && due >= now + 60000 && due <= now + 30 * 86400000;
