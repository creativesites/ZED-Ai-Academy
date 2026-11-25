import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { MasteryState } from "../mastery/evidence.ts";
import { buildQuizEvidence, isQuizAnswerCorrect, revisionObjectiveIds } from "./quiz-evidence.ts";

const A = "11111111-1111-4111-8111-111111111111";
const B = "22222222-2222-4222-8222-222222222222";
const FOREIGN = "99999999-9999-4999-8999-999999999999";
const objectives = [
  { id: A, text: "Learner can add fractions" },
  { id: B, text: "学习者能够数到十" },
];

const state = (key: string, over: Partial<MasteryState>): MasteryState => ({
  objectiveKey: key,
  objectiveText: "t",
  level: 1,
  evidenceCount: 1,
  lastResult: "misconception",
  lastEvidenceAt: null,
  ...over,
});

describe("learner/quiz-evidence", () => {
  it("grades by exact option set", () => {
    assert.equal(isQuizAnswerCorrect([2, 0], [0, 2]), true);
    assert.equal(isQuizAnswerCorrect([0], [0, 1]), false);
    assert.equal(isQuizAnswerCorrect([1], undefined), false);
    assert.equal(isQuizAnswerCorrect([10, 9], [9, 10]), true, "numeric, not lexicographic, sort");
  });

  it("turns objective-linked questions into server-verified quiz evidence keyed by objective id", () => {
    const items = buildQuizEvidence(
      [
        { id: "q1", objectiveId: A.toUpperCase(), correct: true },
        { id: "q2", objectiveId: B, correct: false },
        { id: "q3", objectiveId: null, correct: false },
        { id: "q4", objectiveId: FOREIGN, correct: false },
      ],
      objectives,
    );
    assert.equal(items.length, 2);
    assert.deepEqual(
      items.map((i) => [i.objectiveKey, i.result, i.source, i.serverVerified, i.score, i.itemRef]),
      [
        [A, "correct", "quiz", true, 1, "quiz_question:q1"],
        [B, "misconception", "quiz", true, 0, "quiz_question:q2"],
      ],
    );
    assert.equal(items[1].objectiveText, "学习者能够数到十");
  });

  it("offers revision for missed objectives that are now weak", () => {
    const evidence = buildQuizEvidence(
      [
        { id: "q1", objectiveId: A, correct: false },
        { id: "q2", objectiveId: B, correct: false },
        { id: "q3", objectiveId: A, correct: false },
      ],
      objectives,
    );
    assert.deepEqual(revisionObjectiveIds(evidence, [state(A, { status: "learning" }), state(B, { status: "practising", level: 2 })]), [A]);
    assert.deepEqual(revisionObjectiveIds(evidence, [state(A, { status: "needs_review" }), state(B, { status: "learning" })]), [A, B]);
    // Legacy (pre-v2) states: level ≤ 1 is weak.
    assert.deepEqual(revisionObjectiveIds(evidence, [state(A, { level: 2 }), state(B, { level: 0 })]), [B]);
    // No stored state (write failed / schema pending): still offer.
    assert.deepEqual(revisionObjectiveIds(evidence, []), [A, B]);
    assert.deepEqual(revisionObjectiveIds(evidence, [], 1), [A]);
  });

  it("never offers revision for correct answers", () => {
    const evidence = buildQuizEvidence([{ id: "q1", objectiveId: A, correct: true }], objectives);
    assert.deepEqual(revisionObjectiveIds(evidence, [state(A, { status: "learning" })]), []);
  });
});
