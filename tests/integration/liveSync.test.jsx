import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
const mock = vi.hoisted(() => ({
  listener: null,
  backup: vi.fn(),
  restore: vi.fn(),
  unsubscribe: vi.fn(),
}));
vi.mock("firebase/firestore", () => ({
  doc: vi.fn(),
  onSnapshot: vi.fn((ref, options, next) => {
    mock.listener = next;
    return mock.unsubscribe;
  }),
}));
vi.mock("../../src/shared/services/firebase.js", () => ({ db: {} }));
vi.mock("../../src/features/sync/backupService.js", () => ({
  backup: mock.backup,
  restore: mock.restore,
}));
import {
  decideRemote,
  serialize,
  useLiveSync,
} from "../../src/features/sync/useLiveSync.js";
import { emptyData, emptyDay } from "../../src/shared/model/tracker.js";
const data = (checked) => ({
  schemaVersion: 2,
  days: { "2026-11-06": { ...emptyDay(), checked } },
});
const emit = (value, revision) =>
  mock.listener({
    exists: () => value !== null,
    data: () => ({ ...value, revision }),
    metadata: { fromCache: false, hasPendingWrites: false },
  });
beforeEach(() => {
  vi.useFakeTimers();
  localStorage.clear();
  vi.clearAllMocks();
  mock.backup.mockResolvedValue(1);
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
});
test("sync decisions preserve concurrent edits and recognize own acknowledgements", () => {
  expect(decideRemote("local", "base", "other", 2, 1)).toBe("conflict");
  expect(decideRemote("local", "base", "base", 1, 1)).toBe("upload");
  expect(decideRemote("base", "base", "other", 2, 1)).toBe("download");
  expect(
    decideRemote("latest", "base", "sent", 2, 1, { json: "sent", revision: 1 }),
  ).toBe("acknowledge");
  expect(decideRemote("base", "base", serialize(emptyData()), 0, 2)).toBe(
    "conflict",
  );
});
test("live saving is opt-in and debounces a new local snapshot", async () => {
  const payload = data(["home"]),
    applyRemote = vi.fn(() => true);
  const { result } = renderHook(() =>
    useLiveSync({
      user: { uid: "a" },
      data: payload,
      applyRemote,
      paused: false,
    }),
  );
  expect(mock.listener).toBe(null);
  act(() => result.current.enable());
  act(() => emit(null, 0));
  expect(mock.backup).not.toHaveBeenCalled();
  await act(async () => {
    vi.advanceTimersByTime(701);
    await Promise.resolve();
  });
  expect(mock.backup).toHaveBeenCalledWith("a", payload, 0);
  expect(result.current.status).toContain("All changes saved");
});
test("typing while an upload is in flight queues the latest state", async () => {
  let finish;
  mock.backup
    .mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    )
    .mockResolvedValue(2);
  const first = data(["home"]),
    second = data(["home", "walking"]);
  const { result, rerender } = renderHook(
    ({ value }) =>
      useLiveSync({
        user: { uid: "a" },
        data: value,
        applyRemote: () => true,
        paused: false,
      }),
    { initialProps: { value: first } },
  );
  act(() => result.current.enable());
  act(() => emit(null, 0));
  await act(async () => {
    vi.advanceTimersByTime(701);
  });
  rerender({ value: second });
  await act(async () => {
    finish(1);
    await Promise.resolve();
  });
  await act(async () => {
    vi.advanceTimersByTime(701);
    await Promise.resolve();
  });
  expect(mock.backup).toHaveBeenCalledTimes(2);
  expect(mock.backup).toHaveBeenLastCalledWith("a", second, 1);
});
test("different device snapshots require explicit conflict resolution", () => {
  const local = data(["home"]),
    remote = data(["walking"]),
    applyRemote = vi.fn(() => true);
  const { result } = renderHook(() =>
    useLiveSync({
      user: { uid: "a" },
      data: local,
      applyRemote,
      paused: false,
    }),
  );
  act(() => result.current.enable());
  act(() => emit(remote, 4));
  expect(result.current.conflict.data).toEqual(remote);
  expect(applyRemote).not.toHaveBeenCalled();
  act(() => result.current.chooseCloud());
  expect(applyRemote).toHaveBeenCalledWith(remote);
  expect(result.current.conflict).toBe(null);
});
test("storage conflicts pause cloud changes too", () => {
  const applyRemote = vi.fn(() => true);
  const { result } = renderHook(() =>
    useLiveSync({
      user: { uid: "a" },
      data: emptyData(),
      applyRemote,
      paused: true,
    }),
  );
  act(() => result.current.enable());
  act(() => emit(data(["home"]), 2));
  expect(applyRemote).not.toHaveBeenCalled();
  expect(mock.backup).not.toHaveBeenCalled();
});
test("Firestore map key ordering does not create a false conflict", () => {
  const first = data(["home"]);
  const day = first.days["2026-11-06"];
  const reordered = {
    days: { "2026-11-06": Object.fromEntries(Object.entries(day).reverse()) },
    schemaVersion: 2,
  };
  expect(serialize(first)).toBe(serialize(reordered));
});
