import test from "node:test";
import assert from "node:assert/strict";
import {
  START,
  dayNumber,
  offsetDay,
  phaseIndex,
  emptyDay,
  emptyData,
  validateData,
  weeklyStats,
  assertRevision,
} from "../../src/shared/model/tracker.js";
import {
  readLocal,
  writeLocal,
  KEY,
} from "../../src/shared/services/localStorage.js";
const sample = () => ({
  schemaVersion: 2,
  days: {
    [START]: {
      ...emptyDay(),
      checked: ["home"],
      tasks: [
        {
          id: "1",
          name: "Tidy a room",
          group: "Home",
          time: "09:00",
          done: true,
        },
      ],
      minutes: 20,
    },
  },
});
test("challenge dates and phases include all thirty days", () => {
  assert.equal(dayNumber("2026-11-05"), 0);
  assert.equal(dayNumber(START), 1);
  assert.equal(offsetDay(START, 29), "2026-12-05");
  assert.equal(dayNumber("2026-12-06"), 31);
  assert.deepEqual(
    [1, 7, 8, 14, 15, 21, 22, 30].map(phaseIndex),
    [0, 0, 1, 1, 2, 2, 3, 3],
  );
});
test("weekly statistics include only the seven-day window ending on selected date", () => {
  const data = sample();
  data.days["2026-10-30"] = { ...emptyDay(), minutes: 500 };
  const stats = weeklyStats(data, "2026-11-06");
  assert.equal(stats.length, 7);
  assert.equal(stats[0].date, "2026-10-31");
  assert.equal(
    stats.reduce((s, d) => s + d.minutes, 0),
    20,
  );
  assert.equal(stats[6].tasks, 1);
});
test("backup validation rejects malformed, oversized, and unsafe metric data", () => {
  assert.deepEqual(validateData(sample()), sample());
  for (const bad of [
    null,
    { schemaVersion: 2, days: [] },
    { schemaVersion: 1, days: {} },
  ])
    assert.throws(() => validateData(bad));
  for (const patch of [
    { sleep: -1 },
    { minutes: NaN },
    { checked: ["unknown"] },
    { checked: ["home", "home"] },
    { tasks: [{ id: "1" }] },
    { journal: "x".repeat(10001) },
  ]) {
    const data = sample();
    Object.assign(data.days[START], patch);
    assert.throws(() => validateData(data));
  }
  const invalid = sample();
  invalid.days["2026-02-30"] = emptyDay();
  assert.throws(() => validateData(invalid));
});
test("local save and reload round-trip while failures preserve existing content", () => {
  const map = new Map(),
    storage = {
      getItem: (k) => map.get(k) || null,
      setItem: (k, v) => map.set(k, v),
    };
  assert.deepEqual(readLocal(storage), emptyData());
  writeLocal(sample(), storage);
  assert.deepEqual(readLocal(storage), sample());
  const original = map.get(KEY);
  assert.throws(() => writeLocal({ schemaVersion: 2, days: [] }, storage));
  assert.equal(map.get(KEY), original);
  assert.throws(() =>
    writeLocal(sample(), {
      setItem() {
        throw Error("Quota exceeded");
      },
    }),
  );
  map.set(KEY, "invalid");
  assert.throws(() => readLocal(storage));
});
test("changed remote revisions block overwrites", () => {
  assert.doesNotThrow(() => assertRevision(0, 0));
  assert.doesNotThrow(() => assertRevision(3, 3));
  assert.throws(() => assertRevision(3, 0), /changed on another device/);
  assert.throws(() => assertRevision(4, 3), /changed on another device/);
});
