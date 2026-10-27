import { test } from "node:test";
import assert from "node:assert/strict";
import { nextStreak, profileLanguage, utcDateString } from "./progress.ts";

test("first practice starts a streak of 1", () => {
  assert.deepEqual(nextStreak({ lastPracticeDate: null, streakDays: 0, today: "2026-10-27" }), {
    streakDays: 1,
    lastPracticeDate: "2026-10-27",
  });
});

test("practising on consecutive days extends the streak", () => {
  assert.deepEqual(nextStreak({ lastPracticeDate: "2026-10-26", streakDays: 4, today: "2026-10-27" }), {
    streakDays: 5,
    lastPracticeDate: "2026-10-27",
  });
});

test("a second session on the same day does not double-count", () => {
  const once = nextStreak({ lastPracticeDate: "2026-10-26", streakDays: 4, today: "2026-10-27" });
  const twice = nextStreak({ lastPracticeDate: once.lastPracticeDate, streakDays: once.streakDays, today: "2026-10-27" });
  assert.deepEqual(twice, once);
  assert.equal(twice.streakDays, 5);
});

test("a gap of a day or more restarts the streak", () => {
  assert.deepEqual(nextStreak({ lastPracticeDate: "2026-10-24", streakDays: 9, today: "2026-10-27" }), {
    streakDays: 1,
    lastPracticeDate: "2026-10-27",
  });
});

test("streak works across month and year boundaries", () => {
  assert.equal(nextStreak({ lastPracticeDate: "2026-10-31", streakDays: 2, today: "2026-11-01" }).streakDays, 3);
  assert.equal(nextStreak({ lastPracticeDate: "2026-12-31", streakDays: 2, today: "2027-01-01" }).streakDays, 3);
});

test("a clock-skewed earlier day leaves the streak and date unchanged", () => {
  assert.deepEqual(nextStreak({ lastPracticeDate: "2026-10-27", streakDays: 3, today: "2026-10-26" }), {
    streakDays: 3,
    lastPracticeDate: "2026-10-27",
  });
});

test("utcDateString formats the UTC calendar day", () => {
  assert.equal(utcDateString(new Date("2026-10-27T23:30:00-02:00")), "2026-10-28");
});

test("profileLanguage prefers the language pack, then the persona language", () => {
  assert.equal(profileLanguage("zh", ["es"]), "zh");
  assert.equal(profileLanguage(null, ["fr", "en"]), "fr");
  assert.equal(profileLanguage(null, []), "en");
});
