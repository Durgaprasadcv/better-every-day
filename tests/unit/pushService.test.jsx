import { afterEach, beforeEach, expect, test, vi } from "vitest";
vi.mock("../../src/shared/services/firebase.js", () => ({
  auth: { currentUser: { uid: "alice", getIdToken: async () => "test-token" } },
  db: null,
}));
beforeEach(() => {
  vi.resetModules();
  vi.stubEnv("VITE_PUSH_API_URL", "https://push.example/");
  localStorage.clear();
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});
test("Cloudflare scheduling sends only time, device ID and authorization", async () => {
  localStorage.setItem("bed-push-owner", "alice");
  const fetcher = vi.fn(async () => Response.json({ ok: true }));
  vi.stubGlobal("fetch", fetcher);
  const { schedulePush } =
    await import("../../src/features/reminders/pushService.js");
  const due = new Date(Date.now() + 120000).toISOString();
  await schedulePush("alice", due);
  const [url, options] = fetcher.mock.calls[0];
  expect(url).toBe("https://push.example/reminders");
  expect(options.headers.Authorization).toBe("Bearer test-token");
  expect(Object.keys(JSON.parse(options.body)).sort()).toEqual([
    "device",
    "dueAt",
    "id",
  ]);
});
test("Cloudflare cancellation rejects a different signed-in account", async () => {
  const fetcher = vi.fn();
  vi.stubGlobal("fetch", fetcher);
  const { cancelPush } =
    await import("../../src/features/reminders/pushService.js");
  await expect(cancelPush("bob", "nudge")).rejects.toThrow("Sign in again");
  expect(fetcher).not.toHaveBeenCalled();
});
test("Cloudflare service errors are shown instead of claiming success", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () =>
      Response.json({ error: "Service unavailable" }, { status: 503 }),
    ),
  );
  const { cancelPush } =
    await import("../../src/features/reminders/pushService.js");
  await expect(cancelPush("alice", "nudge")).rejects.toThrow(
    "Service unavailable",
  );
});
