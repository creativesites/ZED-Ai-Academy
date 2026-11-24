import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { computeLearnerHabits, computeLearnerTier } from "./habits.ts";

describe("tutor/habits", () => {
  it("computes learner tiers and progress percentages accurately", () => {
    assert.equal(computeLearnerTier(0).title, "Explorer");
    assert.equal(computeLearnerTier(0).level, 1);

    const mid = computeLearnerTier(300);
    assert.equal(mid.title, "Builder");
    assert.equal(mid.level, 2);
    assert.equal(mid.levelProgressPct, 50);

    const master = computeLearnerTier(5000);
    assert.equal(master.title, "Master");
    assert.equal(master.levelProgressPct, 100);
  });

  it("prioritizes due Study Deck cards as next best action", () => {
    const res = computeLearnerHabits({
      streakDays: 3,
      completedSessionsCount: 4,
      totalPracticeMinutes: 25,
      weeklyMinutes: 10,
      weeklyGoalMinutes: 15,
      deckDueCount: 4,
      deckMasteredCount: 6,
    });
    assert.equal(res.nextBestAction.kind, "deck");
    assert.match(res.nextBestAction.label, /4 Study Deck cards/);
    assert.equal(res.weeklyGoalPct, 67);
    assert.equal(res.weeklyGoalMet, false);
  });

  it("suggests closing the weekly goal when no cards are due", () => {
    const res = computeLearnerHabits({
      streakDays: 0,
      completedSessionsCount: 1,
      totalPracticeMinutes: 6,
      weeklyMinutes: 6,
      weeklyGoalMinutes: 15,
      deckDueCount: 0,
      deckMasteredCount: 0,
    });
    assert.equal(res.nextBestAction.kind, "goal");
    assert.match(res.nextBestAction.label, /9 min left/);
  });

  it("celebrates when the weekly goal is met", () => {
    const res = computeLearnerHabits({
      streakDays: 5,
      completedSessionsCount: 8,
      totalPracticeMinutes: 40,
      weeklyMinutes: 18,
      weeklyGoalMinutes: 15,
      deckDueCount: 0,
      deckMasteredCount: 10,
    });
    assert.equal(res.weeklyGoalMet, true);
    assert.equal(res.weeklyGoalPct, 100);
    assert.equal(res.nextBestAction.kind, "streak");
  });
});
