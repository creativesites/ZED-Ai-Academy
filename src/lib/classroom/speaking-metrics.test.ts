import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  aggregateSpeakingMetricsByUser,
  extractReportAverageScore,
  speakingMsToMinutes,
} from "./speaking-metrics.ts";

describe("speaking-metrics", () => {
  it("extractReportAverageScore averages valid 0..100 numeric dimensions", () => {
    assert.equal(
      extractReportAverageScore({ fluency: 80, accuracy: 70, vocabulary: 90 }),
      80,
    );
    assert.equal(extractReportAverageScore({ fluency: 75, extra: "ignored", bad: 200 }), 75);
    assert.equal(extractReportAverageScore(null), null);
    assert.equal(extractReportAverageScore({}), null);
  });

  it("speakingMsToMinutes rounds properly and floors non-zero speaking to 1m", () => {
    assert.equal(speakingMsToMinutes(0), 0);
    assert.equal(speakingMsToMinutes(null), 0);
    assert.equal(speakingMsToMinutes(12_000), 1);
    assert.equal(speakingMsToMinutes(185_000), 3);
  });

  it("aggregateSpeakingMetricsByUser rolls up per-student and academy metrics", () => {
    const { byUser, summary } = aggregateSpeakingMetricsByUser(
      [
        {
          id: "sess-1",
          user_id: "u1",
          learner_speaking_ms: 120_000,
          status: "completed",
          started_at: "2026-11-20T10:00:00Z",
        },
        {
          id: "sess-2",
          user_id: "u1",
          learner_speaking_ms: 60_000,
          status: "flagged",
          started_at: "2026-11-21T10:00:00Z",
        },
        {
          id: "sess-3",
          user_id: "u2",
          learner_speaking_ms: 300_000,
          status: "completed",
          started_at: "2026-11-22T09:00:00Z",
        },
      ],
      [
        { session_id: "sess-1", scores: { fluency: 80, accuracy: 90 } },
        { session_id: "sess-2", scores: { fluency: 60, accuracy: 70 } },
        { session_id: "sess-3", scores: { fluency: 92, task: 88 } },
      ],
    );

    const u1 = byUser.get("u1");
    assert.ok(u1);
    assert.equal(u1.speakingMinutes, 3);
    assert.equal(u1.scenariosCompleted, 1);
    assert.equal(u1.flaggedSessionsCount, 1);
    assert.equal(u1.avgSpeakingScore, 75); // (85 + 65) / 2
    assert.equal(u1.lastSpeakingAt, "2026-11-21T10:00:00Z");

    const u2 = byUser.get("u2");
    assert.ok(u2);
    assert.equal(u2.speakingMinutes, 5);
    assert.equal(u2.scenariosCompleted, 1);
    assert.equal(u2.avgSpeakingScore, 90);

    assert.equal(summary.totalSpeakingMinutes, 8);
    assert.equal(summary.totalScenariosCompleted, 2);
    assert.equal(summary.avgSpeakingScore, 80); // Math.round((85 + 65 + 90) / 3)
  });
});
