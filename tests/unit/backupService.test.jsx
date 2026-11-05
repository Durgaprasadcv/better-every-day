import { beforeEach, expect, test, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  getDocFromServer: vi.fn(),
  runTransaction: vi.fn(),
  doc: vi.fn(() => "private-ref"),
  set: vi.fn(),
  get: vi.fn(),
}));
vi.mock("firebase/firestore", () => ({
  ...mocks,
  serverTimestamp: () => "server-time",
}));
vi.mock("../../src/shared/services/firebase.js", () => ({ db: {} }));
import { backup, restore } from "../../src/features/sync/backupService.js";
import { emptyData } from "../../src/shared/model/tracker.js";
beforeEach(() => {
  vi.clearAllMocks();
  mocks.runTransaction.mockImplementation(async (db, callback) =>
    callback({ get: mocks.get, set: mocks.set }),
  );
});
test("new cloud backups use a transaction and revision one", async () => {
  mocks.get.mockResolvedValue({ exists: () => false });
  expect(await backup("user-a", emptyData(), 0)).toBe(1);
  expect(mocks.doc).toHaveBeenCalledWith(
    {},
    "users",
    "user-a",
    "app",
    "tracker",
  );
  expect(mocks.set).toHaveBeenCalledWith("private-ref", {
    ...emptyData(),
    revision: 1,
    updatedAt: "server-time",
  });
});
test("a remote edit rejects stale uploads without writing", async () => {
  mocks.get.mockResolvedValue({
    exists: () => true,
    data: () => ({ revision: 3 }),
  });
  await expect(backup("user-a", emptyData(), 2)).rejects.toThrow(
    "changed on another device",
  );
  expect(mocks.set).not.toHaveBeenCalled();
});
test("network failures do not acknowledge a backup", async () => {
  mocks.runTransaction.mockRejectedValue(Error("offline"));
  await expect(backup("user-a", emptyData(), 0)).rejects.toThrow("offline");
  expect(mocks.set).not.toHaveBeenCalled();
});
test("restore validates server data and reports missing backup", async () => {
  mocks.getDocFromServer.mockResolvedValue({ exists: () => false });
  await expect(restore("user-a")).rejects.toThrow("No cloud backup");
  mocks.getDocFromServer.mockResolvedValue({
    exists: () => true,
    data: () => ({ schemaVersion: 2, days: [], revision: 1 }),
  });
  await expect(restore("user-a")).rejects.toThrow("Unsupported backup");
  mocks.getDocFromServer.mockResolvedValue({
    exists: () => true,
    data: () => ({ ...emptyData(), revision: 4 }),
  });
  expect(await restore("user-a")).toEqual({ data: emptyData(), revision: 4 });
});
