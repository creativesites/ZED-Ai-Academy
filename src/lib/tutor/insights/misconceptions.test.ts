import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildTeacherInsightsSummary } from "./misconceptions.ts";

describe("insights/misconceptions", () => {
  it("ranks recurring misconceptions and aggregates mastery & session health", () => {
    const summary = buildTeacherInsightsSummary({
      mastery: [
        {
          userId: "u1",
          courseId: "c1",
          objectiveKey: "course:c1:fractions",
          objectiveText: "Compare unlike fractions",
          level: 0,
          evidenceCount: 2,
        },
        {
          userId: "u2",
          courseId: "c1",
          objectiveKey: "course:c1:fractions",
          objectiveText: "Compare unlike fractions",
          level: 1,
          evidenceCount: 2,
        },
        {
          userId: "u1",
          courseId: "c1",
          objectiveKey: "course:c1:prompts",
          objectiveText: "Include context in prompts",
          level: 3,
          evidenceCount: 3,
        },
      ],
      evidence: [
        {
          userId: "u1",
          courseId: "c1",
          scenarioId: "s1",
          objectiveKey: "course:c1:fractions",
          objectiveText: "Compare unlike fractions",
          result: "misconception",
          detail: "Treated larger denominator as larger fraction.",
          createdAt: "2026-11-22T10:00:00Z",
        },
        {
          userId: "u2",
          courseId: "c1",
          scenarioId: "s1",
          objectiveKey: "course:c1:fractions",
          objectiveText: "Compare unlike fractions",
          result: "misconception",
          detail: "Forgot to find common denominator first.",
          createdAt: "2026-11-23T08:00:00Z",
        },
        {
          userId: "u1",
          courseId: "c1",
          scenarioId: "s1",
          objectiveKey: "course:c1:prompts",
          objectiveText: "Include context in prompts",
          result: "correct",
          detail: "Added clear role and output format.",
          createdAt: "2026-11-23T09:00:00Z",
        },
      ],
      sessions: [
        { id: "ses1", status: "completed", learnerSpeakingMs: 120_000, teacherSpeakingMs: 120_000 },
        { id: "ses2", status: "abandoned", learnerSpeakingMs: 60_000, teacherSpeakingMs: 0 },
      ],
    });

    assert.equal(summary.totalSessions, 2);
    assert.equal(summary.completedSessions, 1);
    assert.equal(summary.completionRatePct, 50);
    assert.equal(summary.totalSpeakingMinutes, 5);
    assert.equal(summary.uniqueLearners, 2);
    assert.equal(summary.trackedObjectives, 2);
    assert.equal(summary.topMisconceptions.length, 1);
    assert.equal(summary.topMisconceptions[0].objectiveText, "Compare unlike fractions");
    assert.equal(summary.topMisconceptions[0].misconceptionCount, 2);
    assert.equal(summary.topMisconceptions[0].sampleDetails.length, 2);
    assert.equal(summary.objectives[0].objectiveText, "Compare unlike fractions");
  });
});
