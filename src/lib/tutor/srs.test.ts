import test from "node:test";
import assert from "node:assert/strict";
import { formatInterval, isCardDue, reviewCard, summarizeDeck } from "./srs.ts";

const NOW = new Date("2026-11-23T12:00:00.000Z");

test("first good review schedules 1 day, second schedules 6 days, third scales by ease", () => {
  const r1 = reviewCard({ intervalDays: 0, ease: 2.5, reps: 0, lapses: 0 }, "good", NOW);
  assert.equal(r1.intervalDays, 1);
  assert.equal(r1.reps, 1);
  assert.equal(r1.nextLabel, "1d");

  const r2 = reviewCard(r1, "good", NOW);
  assert.equal(r2.intervalDays, 6);
  assert.equal(r2.reps, 2);
  assert.equal(r2.nextLabel, "6d");

  const r3 = reviewCard(r2, "good", NOW);
  assert.equal(r3.intervalDays, 15);
  assert.equal(r3.reps, 3);
  assert.equal(r3.nextLabel, "2w");
});

test("again resets reps, increments lapses, lowers ease, and schedules 10 minutes out", () => {
  const res = reviewCard({ intervalDays: 10, ease: 2.5, reps: 3, lapses: 1 }, "again", NOW);
  assert.equal(res.reps, 0);
  assert.equal(res.lapses, 2);
  assert.equal(res.intervalDays, 0);
  assert.equal(res.ease, 2.3);
  assert.equal(res.nextLabel, "10m");
  assert.equal(Date.parse(res.dueAt) - NOW.getTime(), 10 * 60 * 1000);
});

test("ease is clamped between 1.3 and 3.2", () => {
  const low = reviewCard({ intervalDays: 5, ease: 1.35, reps: 2, lapses: 0 }, "again", NOW);
  assert.equal(low.ease, 1.3);

  const high = reviewCard({ intervalDays: 5, ease: 3.15, reps: 2, lapses: 0 }, "easy", NOW);
  assert.equal(high.ease, 3.2);
});

test("formatInterval formats minutes, hours, days, weeks, and months cleanly", () => {
  assert.equal(formatInterval(0), "10m");
  assert.equal(formatInterval(0.5), "12h");
  assert.equal(formatInterval(5), "5d");
  assert.equal(formatInterval(21), "3w");
  assert.equal(formatInterval(90), "3mo");
});

test("isCardDue and summarizeDeck compute counts accurately", () => {
  const cards = [
    { dueAt: "2026-11-23T11:00:00.000Z", intervalDays: 1, reps: 1 },
    { dueAt: "2026-11-23T12:00:00.000Z", intervalDays: 20, reps: 4 },
    { dueAt: "2026-11-25T12:00:00.000Z", intervalDays: 30, reps: 5 },
  ];
  assert.equal(isCardDue(cards[0].dueAt, NOW), true);
  assert.equal(isCardDue(cards[2].dueAt, NOW), false);
  assert.deepEqual(summarizeDeck(cards, NOW), {
    total: 3,
    dueNow: 2,
    mastered: 2,
    learning: 1,
  });
});
