import { expect, test } from "vitest";
import {
  dayXP,
  growthStats,
} from "../../src/features/progress/gamification.js";
import { emptyDay } from "../../src/shared/model/tracker.js";
test("XP is derived from saved completion and caps task rewards", () => {
  const day = {
    ...emptyDay(),
    checked: ["home"],
    tasks: Array.from({ length: 10 }, () => ({ done: true })),
    wins: "One win",
    journal: "Reflection",
  };
  expect(dayXP(day)).toBe(50);
  expect(dayXP({ ...day, checked: [] })).toBe(40);
  expect(dayXP(day)).toBe(50);
});
test("streaks allow today to remain unfinished and exclude future entries", () => {
  const active = { ...emptyDay(), checked: ["home"] };
  const data = {
    days: {
      "2026-11-05": active,
      "2026-11-06": active,
      "2026-11-07": active,
      "2026-11-09": active,
    },
  };
  const result = growthStats(data, "2026-11-08");
  expect(result.streak).toBe(3);
  expect(result.best).toBe(3);
  expect(result.xp).toBe(30);
  expect(result.badges.find((b) => b.name === "Finding rhythm").earned).toBe(
    true,
  );
  expect(growthStats(data, "2026-11-10").streak).toBe(1);
});
