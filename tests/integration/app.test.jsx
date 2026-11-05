import React from "react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { cleanup, render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
vi.mock("../../src/shared/services/firebase.js", () => ({
  configured: false,
  auth: null,
  db: null,
}));
import App from "../../src/app/App.jsx";
import { KEY } from "../../src/shared/services/localStorage.js";
beforeEach(() => localStorage.clear());
afterEach(() => cleanup());
test("daily habits, timed responsibilities, and journal persist after reload", async () => {
  const user = userEvent.setup();
  const view = render(<App />);
  await user.click(screen.getByRole("checkbox", { name: /Own a household/ }));
  await user.type(
    screen.getByRole("textbox", { name: "Task name" }),
    "Prepare lunch",
  );
  fireEvent.change(screen.getByLabelText("Time"), {
    target: { value: "12:30" },
  });
  await user.selectOptions(
    screen.getByLabelText("Responsibility"),
    "Childcare",
  );
  await user.click(screen.getByRole("button", { name: "Add task" }));
  expect(screen.getByText("12:30 · Childcare")).toBeTruthy();
  await user.click(screen.getByRole("checkbox", { name: /Prepare lunch/ }));
  await user.click(screen.getByRole("button", { name: "Reflect" }));
  await user.type(
    screen.getByRole("textbox", { name: "What went well today?" }),
    "A little progress",
  );
  view.unmount();
  render(<App />);
  expect(
    screen.getByRole("checkbox", { name: /Own a household/ }).checked,
  ).toBe(true);
  expect(screen.getByRole("checkbox", { name: /Prepare lunch/ }).checked).toBe(
    true,
  );
  await user.click(screen.getByRole("button", { name: "Reflect" }));
  expect(
    screen.getByRole("textbox", { name: "What went well today?" }).value,
  ).toBe("A little progress");
});
test("challenge navigation isolates dates and includes final day", async () => {
  const user = userEvent.setup();
  render(<App />);
  await user.click(screen.getByRole("button", { name: "Challenge" }));
  await user.click(
    screen.getByRole("button", { name: "Day 30, 0 habits complete" }),
  );
  expect(screen.getByText("Day 30 of 30")).toBeTruthy();
  await user.click(screen.getByRole("checkbox", { name: /Take a walk/ }));
  fireEvent.change(screen.getByLabelText("View date"), {
    target: { value: "2026-11-06" },
  });
  expect(screen.getByRole("checkbox", { name: /Take a walk/ }).checked).toBe(
    false,
  );
});
test("malformed stored entries show recovery action and are not overwritten", () => {
  localStorage.setItem(KEY, "broken");
  render(<App />);
  expect(screen.getByRole("alert").textContent).toContain(
    "Saved data could not be read",
  );
  expect(localStorage.getItem(KEY)).toBe("broken");
  expect(
    screen.getByRole("button", { name: "Add task" }).matches(":disabled"),
  ).toBe(true);
});
test("a change in another tab pauses edits instead of replacing that tab", () => {
  render(<App />);
  fireEvent(
    window,
    new StorageEvent("storage", { key: KEY, newValue: "changed" }),
  );
  expect(
    screen.getByRole("button", { name: "Add task" }).matches(":disabled"),
  ).toBe(true);
  expect(screen.getByRole("status").textContent).toContain(
    "Another tab changed",
  );
});
