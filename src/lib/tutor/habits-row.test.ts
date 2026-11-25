import { test } from "node:test";
import assert from "node:assert/strict";
import { applyPracticeDay, currentStreakDays, seedHabitsFromLegacy } from "./habits.ts";

test("streak is per person: practising different subjects on consecutive days continues it", () => {
  // Monday: maths (profile language "en"); Tuesday: Chinese ("zh"). The old per-language rows gave 1 and 1.
  const mon = applyPracticeDay(null, "2026-11-23", 60_000);
  const tue = applyPracticeDay(mon, "2026-11-24", 30_000);
  assert.equal(tue.streakDays, 2);
  assert.equal(tue.longestStreakDays, 2);
  assert.equal(tue.totalPracticeMs, 90_000);
});

test("same day is idempotent for the streak; a gap restarts it but keeps the longest", () => {
  const a = applyPracticeDay({ streakDays: 5, longestStreakDays: 5, lastPracticeDate: "2026-11-20", totalPracticeMs: 0 }, "2026-11-20", 0);
  assert.equal(a.streakDays, 5);
  const b = applyPracticeDay(a, "2026-11-25", -10);
  assert.equal(b.streakDays, 1);
  assert.equal(b.longestStreakDays, 5);
  assert.equal(b.totalPracticeMs, 0, "negative time is ignored");
});

test("seed from legacy rows: most recent language's streak, summed totals", () => {
  const seeded = seedHabitsFromLegacy([
    { streak_days: 7, last_practice_date: "2026-11-10", total_speaking_ms: 1000 },
    { streak_days: 2, last_practice_date: "2026-11-24", total_speaking_ms: 500 },
    { streak_days: 3, last_practice_date: "2026-11-24", total_speaking_ms: null },
  ])!;
  assert.equal(seeded.streakDays, 3);
  assert.equal(seeded.lastPracticeDate, "2026-11-24");
  assert.equal(seeded.longestStreakDays, 7);
  assert.equal(seeded.totalPracticeMs, 1500);
  assert.equal(seedHabitsFromLegacy([]), null);
  assert.equal(seedHabitsFromLegacy([{ streak_days: 4, last_practice_date: null, total_speaking_ms: 0 }])!.streakDays, 0);
});

test("current streak lapses after a missed day", () => {
  assert.equal(currentStreakDays({ streakDays: 4, lastPracticeDate: "2026-11-24" }, "2026-11-25"), 4);
  assert.equal(currentStreakDays({ streakDays: 4, lastPracticeDate: "2026-11-25" }, "2026-11-25"), 4);
  assert.equal(currentStreakDays({ streakDays: 4, lastPracticeDate: "2026-11-22" }, "2026-11-25"), 0);
  assert.equal(currentStreakDays({ streakDays: 4, lastPracticeDate: null }, "2026-11-25"), 0);
});
