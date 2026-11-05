import { act, renderHook, cleanup } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import { useReminders } from "../../src/features/reminders/useReminders.js";
import { localDay } from "../../src/shared/model/tracker.js";
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});
test("due task alarms can snooze and dismiss without alerting again", async () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(2026, 10, 6, 9, 0, 0));
  const date = localDay(),
    notify = vi.fn();
  const days = {
    [date]: {
      tasks: [{ id: "one", name: "Take a walk", time: "09:00", done: false }],
    },
  };
  const { result } = renderHook(() => useReminders(days, notify));
  await act(async () => {
    await result.current.enable();
  });
  expect(result.current.alarm.name).toBe("Take a walk");
  act(() => result.current.snooze());
  expect(result.current.alarm).toBe(null);
  act(() => vi.advanceTimersByTime(4 * 60000));
  expect(result.current.alarm).toBe(null);
  act(() => vi.advanceTimersByTime(60000));
  expect(result.current.alarm.name).toBe("Take a walk");
  act(() => result.current.dismiss());
  act(() => vi.advanceTimersByTime(60000));
  expect(result.current.alarm).toBe(null);
  expect(notify).toHaveBeenCalledTimes(2);
});
test("completed, future, and stale tasks never trigger a foreground alarm", async () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(2026, 10, 6, 9, 0, 0));
  const days = {
    [localDay()]: {
      tasks: [
        { id: "a", name: "Old", time: "08:00", done: false },
        { id: "b", name: "Future", time: "10:00", done: false },
        { id: "c", name: "Done", time: "09:00", done: true },
      ],
    },
  };
  const { result } = renderHook(() => useReminders(days, vi.fn()));
  await act(async () => {
    await result.current.enable();
  });
  expect(result.current.alarm).toBe(null);
});
