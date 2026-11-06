import { emptyDay, localDay, offsetDay } from "../../shared/model/tracker.js";
export function dayXP(day = emptyDay()) {
  return (
    day.checked.length * 10 +
    Math.min(5, day.tasks.filter((t) => t.done).length) * 5 +
    (day.wins.trim() ? 5 : 0) +
    (day.journal.trim() ? 10 : 0)
  );
}
export function growthStats(data, today = localDay()) {
  const entries = Object.entries(data.days)
    .filter(([date]) => date <= today)
    .sort(([a], [b]) => a.localeCompare(b));
  const xp = entries.reduce((sum, [, day]) => sum + dayXP(day), 0);
  const active = new Set(
    entries.filter(([, day]) => dayXP(day) > 0).map(([date]) => date),
  );
  let streak = 0,
    cursor = active.has(today) ? today : offsetDay(today, -1);
  while (active.has(cursor)) {
    streak++;
    cursor = offsetDay(cursor, -1);
  }
  let best = 0,
    run = 0,
    previous = null;
  for (const date of [...active].sort()) {
    run = previous && offsetDay(previous, 1) === date ? run + 1 : 1;
    best = Math.max(best, run);
    previous = date;
  }
  const complete = entries.filter(([, day]) => day.checked.length === 8).length;
  return {
    xp,
    level: Math.floor(xp / 250) + 1,
    levelXP: xp % 250,
    streak,
    best,
    activeDays: active.size,
    complete,
    badges: [
      {
        name: "First step",
        hint: "Check in on your first day",
        earned: active.size >= 1,
        icon: "🌱",
      },
      {
        name: "Finding rhythm",
        hint: "Build a 3-day streak",
        earned: best >= 3,
        icon: "🔥",
      },
      {
        name: "Steady week",
        hint: "Build a 7-day streak",
        earned: best >= 7,
        icon: "☀️",
      },
      {
        name: "Full foundation",
        hint: "Complete all 8 habits in a day",
        earned: complete >= 1,
        icon: "⭐",
      },
      {
        name: "Showing up",
        hint: "Be active on 30 days",
        earned: active.size >= 30,
        icon: "🌳",
      },
    ],
  };
}
