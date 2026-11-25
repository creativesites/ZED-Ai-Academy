import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { applyEvidenceSequence, type EvidenceInput } from "./knowledge.ts";
import {
  dueReviewsLabel,
  objectiveDue,
  planReviews,
  prerequisitesOf,
  type ReviewObjective,
  type ReviewVocab,
} from "./scheduler.ts";

const NOW = "2026-11-25T12:00:00.000Z";
const day = (n: number) => new Date(Date.parse(NOW) + n * 86_400_000).toISOString();

function obj(key: string, over: Partial<ReviewObjective> = {}): ReviewObjective {
  return {
    objectiveKey: key,
    objectiveId: key,
    text: `Objective ${key}`,
    courseId: "c1",
    lessonId: `lesson-${key}`,
    pMastery: 0.6,
    stabilityDays: 4,
    lastEvidenceAt: day(-3),
    nextReviewAt: day(-1),
    securedAt: null,
    status: "practising",
    ...over,
  };
}

function card(id: string, dueDaysAgo: number, lapses = 0): ReviewVocab {
  return { vocabId: id, term: `term-${id}`, dueAt: day(-dueDaysAgo), lapses };
}

describe("objectiveDue", () => {
  it("never schedules unseen objectives", () => {
    assert.equal(objectiveDue(obj("a", { pMastery: null, status: "unseen", nextReviewAt: day(-5) }), NOW).due, false);
  });

  it("is due when next_review_at has passed and not due before", () => {
    assert.equal(objectiveDue(obj("a", { nextReviewAt: day(-1) }), NOW).reason, "due");
    const later = objectiveDue(obj("a", { nextReviewAt: day(2) }), NOW);
    assert.equal(later.due, false);
    assert.equal(later.dueAt, day(2));
  });

  it("flags decayed secure objectives as needs_review", () => {
    const d = objectiveDue(
      obj("a", { pMastery: 0.85, stabilityDays: 2, lastEvidenceAt: day(-6), nextReviewAt: day(-5), securedAt: day(-10), status: "secure" }),
      NOW,
    );
    assert.equal(d.reason, "needs_review");
  });

  it("schedules a retention check 7 days after first reaching secure even if next_review_at is later", () => {
    const o = obj("a", {
      pMastery: 0.9,
      stabilityDays: 60,
      status: "secure",
      securedAt: day(-8),
      lastEvidenceAt: day(-8),
      nextReviewAt: day(2),
    });
    const d = objectiveDue(o, NOW);
    assert.equal(d.due, true);
    assert.equal(d.reason, "retention_check");
    assert.equal(d.retentionCheckpoint, 7);
  });

  it("schedules the 30-day check after the 7-day one was answered", () => {
    const base = { pMastery: 0.9, stabilityDays: 120, status: "secure", securedAt: day(-31), nextReviewAt: day(10) };
    const answered7 = objectiveDue(obj("a", { ...base, lastEvidenceAt: day(-23) }), NOW);
    assert.equal(answered7.retentionCheckpoint, 30);
    const answered30 = objectiveDue(obj("a", { ...base, lastEvidenceAt: day(-0.5) }), NOW);
    assert.equal(answered30.due, false);
  });

  it("reports the next retention checkpoint as the due date when it comes before next_review_at", () => {
    const d = objectiveDue(
      obj("a", { pMastery: 0.9, stabilityDays: 60, status: "secure", securedAt: day(-2), lastEvidenceAt: day(-2), nextReviewAt: day(40) }),
      NOW,
    );
    assert.equal(d.due, false);
    assert.equal(d.dueAt, day(5));
  });

  it("secure objectives reappear on schedule from the knowledge rule", () => {
    // Three verified successes from two sources → secure; the knowledge rule sets next_review_at.
    const ev: EvidenceInput[] = [
      { source: "quiz", serverVerified: true, result: "correct", at: day(-20) },
      { source: "interaction", serverVerified: true, result: "correct", at: day(-19.9) },
      { source: "quiz", serverVerified: true, result: "correct", at: day(-19) },
      { source: "interaction", serverVerified: true, result: "correct", at: day(-18) },
      { source: "quiz", serverVerified: true, result: "correct", at: day(-17) },
    ];
    const s = applyEvidenceSequence(ev);
    assert.ok(s.securedAt, "reached secure");
    const o = obj("a", {
      pMastery: s.pMastery,
      stabilityDays: s.stabilityDays,
      lastEvidenceAt: s.lastEvidenceAt,
      nextReviewAt: s.nextReviewAt,
      securedAt: s.securedAt,
      status: s.status,
    });
    assert.equal(objectiveDue(o, s.lastEvidenceAt!).due, false, "not due right after evidence");
    assert.equal(objectiveDue(o, NOW).due, true, "due again later");
  });
});

describe("prerequisitesOf", () => {
  it("walks transitive prerequisites, skips the current ones and survives cycles", () => {
    const edges = [
      { objectiveId: "c", requiresId: "b" },
      { objectiveId: "b", requiresId: "a" },
      { objectiveId: "a", requiresId: "c" },
      { objectiveId: "x", requiresId: "y" },
    ];
    assert.deepEqual([...prerequisitesOf(["c"], edges)].sort(), ["a", "b"]);
    assert.deepEqual([...prerequisitesOf(["c"], edges, 1)], ["b"]);
    assert.equal(prerequisitesOf([], edges).size, 0);
  });
});

describe("planReviews", () => {
  it("selects only due objectives and counts everything due", () => {
    const spec = planReviews(
      {
        now: NOW,
        objectives: [obj("a"), obj("b"), obj("c", { nextReviewAt: day(3) }), obj("u", { pMastery: null, status: "unseen" })],
      },
      6,
    );
    assert.equal(spec.origin, "revision");
    assert.deepEqual(spec.objectives.map((o) => o.objectiveKey).sort(), ["a", "b"]);
    assert.ok(spec.objectives.every((o) => o.due));
    assert.equal(spec.dueObjectiveCount, 2);
    assert.equal(spec.nextDueAt, day(3));
  });

  it("caps objectives at 3 and respects the time budget", () => {
    const many = ["a", "b", "c", "d", "e"].map((k) => obj(k));
    assert.equal(planReviews({ now: NOW, objectives: many }, 10).objectives.length, 3);
    assert.equal(planReviews({ now: NOW, objectives: many }, 4).objectives.length, 2);
    assert.equal(planReviews({ now: NOW, objectives: many }, 1).objectives.length, 0);
    assert.equal(planReviews({ now: NOW, objectives: many }, 0).steps.length, 0);
    const spec = planReviews({ now: NOW, objectives: many, vocab: [card("v1", 1), card("v2", 2)] }, 6.5);
    assert.ok(spec.estimatedMinutes <= 6.5, `estimate ${spec.estimatedMinutes}`);
    assert.equal(spec.dueObjectiveCount, 5, "count is before budget cuts");
  });

  it("interleaves objectives from different lessons", () => {
    const objectives = [
      obj("a1", { lessonId: "L1" }),
      obj("a2", { lessonId: "L1" }),
      obj("a3", { lessonId: "L1" }),
      obj("b1", { lessonId: "L2", pMastery: 0.5 }),
    ];
    const spec = planReviews({ now: NOW, objectives }, 6);
    const lessons = spec.objectives.map((o) => o.lessonId);
    assert.equal(spec.objectives.length, 3);
    assert.ok(lessons.includes("L2"), "picks the second lesson rather than three from one lesson");
    for (let i = 1; i < lessons.length; i++) {
      if (lessons[i] === lessons[i - 1]) {
        // only allowed when no other lesson is left
        assert.ok(lessons.slice(i).every((l) => l === lessons[i]));
      }
    }
  });

  it("fills to two objectives with the weakest non-due ones so the session interleaves", () => {
    const spec = planReviews(
      {
        now: NOW,
        objectives: [
          obj("due"),
          obj("weak-high", { nextReviewAt: day(2), pMastery: 0.55, status: "practising" }),
          obj("weak-low", { nextReviewAt: day(2), pMastery: 0.2, status: "learning" }),
          obj("secure", { nextReviewAt: day(9), pMastery: 0.9, status: "secure", securedAt: day(-1), lastEvidenceAt: day(-1) }),
        ],
      },
      6,
    );
    assert.deepEqual(spec.objectives.map((o) => o.objectiveKey).sort(), ["due", "weak-low"]);
    assert.equal(spec.objectives.find((o) => o.objectiveKey === "weak-low")?.due, false);
    assert.equal(spec.dueObjectiveCount, 1);
  });

  it("prefers prerequisites of what the learner is studying now", () => {
    const objectives = [
      obj("frac", { pMastery: 0.2, status: "learning" }),
      obj("needs", { pMastery: 0.3, status: "needs_review", securedAt: day(-40) }),
      obj("other", { pMastery: 0.1, status: "learning" }),
      obj("prereq", { pMastery: 0.65, lessonId: "lesson-p" }),
    ];
    const spec = planReviews(
      {
        now: NOW,
        objectives,
        prerequisites: [{ objectiveId: "current", requiresId: "prereq" }],
        currentObjectiveIds: ["current"],
      },
      2,
    );
    assert.equal(spec.objectives.length, 1);
    assert.equal(spec.objectives[0].objectiveKey, "prereq");
    assert.equal(spec.objectives[0].reason, "prerequisite");
  });

  it("ranks needs_review above retention checks above plain due", () => {
    const spec = planReviews(
      {
        now: NOW,
        objectives: [
          obj("plain", { lessonId: "L1" }),
          obj("retain", {
            lessonId: "L2",
            pMastery: 0.95,
            stabilityDays: 60,
            status: "secure",
            securedAt: day(-8),
            lastEvidenceAt: day(-8),
            nextReviewAt: day(5),
          }),
          obj("needs", { lessonId: "L3", status: "needs_review", securedAt: day(-50) }),
        ],
      },
      4,
    );
    assert.deepEqual(spec.objectives.map((o) => o.objectiveKey), ["needs", "retain"]);
    assert.equal(spec.objectives[1].retentionCheckpoint, 7);
    assert.equal(spec.objectives[1].reason, "retention_check");
  });

  it("puts vocab and concepts in one interleaved queue", () => {
    const spec = planReviews(
      {
        now: NOW,
        objectives: [obj("a", { lessonId: "L1" }), obj("b", { lessonId: "L2" })],
        vocab: [card("v1", 1), card("v2", 5, 2), card("v3", 5, 0), card("future", -1)],
      },
      6,
    );
    assert.equal(spec.dueVocabCount, 3);
    assert.deepEqual(spec.vocab.map((v) => v.vocabId), ["v2", "v3", "v1"], "oldest first, more lapses first on ties");
    assert.deepEqual(
      spec.steps.map((s) => s.kind),
      ["objective", "vocab", "objective", "vocab"],
    );
  });

  it("runs a vocab-only session when no objectives are due", () => {
    const spec = planReviews({ now: NOW, objectives: [], vocab: [card("v1", 1)] }, 3);
    assert.equal(spec.objectives.length, 0);
    assert.deepEqual(spec.steps, [{ kind: "vocab", vocabIds: ["v1"], minutes: 0.33 }]);
  });

  it("limits vocab to the remaining budget", () => {
    const vocab = Array.from({ length: 30 }, (_, i) => card(`v${i}`, 1));
    const spec = planReviews({ now: NOW, objectives: [obj("a")], vocab }, 3);
    // 2 minutes for the objective, 1 minute left = 3 cards
    assert.equal(spec.vocab.length, 3);
    assert.equal(planReviews({ now: NOW, objectives: [], vocab }, 60).vocab.length, 15, "hard cap");
  });

  it("ignores duplicate keys and blank text", () => {
    const spec = planReviews({ now: NOW, objectives: [obj("a"), obj("a"), obj("b", { text: "  " })] }, 6);
    assert.deepEqual(spec.objectives.map((o) => o.objectiveKey), ["a"]);
  });
});

describe("dueReviewsLabel", () => {
  it("formats counts and returns null when nothing is due", () => {
    assert.equal(dueReviewsLabel({ dueObjectiveCount: 1, dueVocabCount: 12 }), "1 review due · 12 cards due");
    assert.equal(dueReviewsLabel({ dueObjectiveCount: 0, dueVocabCount: 0 }), null);
  });
});
