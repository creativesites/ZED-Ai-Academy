// Quizzes feed the knowledge model (P2-03, Architecture §4.3, §9.3). Pure: no I/O, no "@/" imports.
//
// Each graded question linked to a registered objective becomes one server-verified `quiz` evidence item.
// Guests never get here: their quiz is graded in the browser and nothing is recorded (SEC-13).

import type { CollectedEvidence, MasteryState } from "../mastery/evidence.ts";
import { objectiveKeyForId, type ObjectiveRef } from "./objectives.ts";

export type GradedQuizQuestion = {
  id: string;
  objectiveId: string | null;
  correct: boolean;
};

/** Same grading rule as saveQuizAttempt: the chosen option set must equal the correct set. */
export function isQuizAnswerCorrect(correctIndices: ReadonlyArray<number>, given: ReadonlyArray<number> | undefined): boolean {
  const expected = [...correctIndices].sort((a, b) => a - b).join(",");
  const actual = [...(given ?? [])].sort((a, b) => a - b).join(",");
  return expected === actual;
}

/**
 * Evidence items for the graded questions that link to one of the given (tenant- and course-checked)
 * objectives. Questions without an objective, or linked to an unknown/foreign objective, are skipped.
 */
export function buildQuizEvidence(
  questions: ReadonlyArray<GradedQuizQuestion>,
  objectives: ReadonlyArray<ObjectiveRef>,
): CollectedEvidence[] {
  const byId = new Map(objectives.map((o) => [o.id.toLowerCase(), o]));
  const items: CollectedEvidence[] = [];
  for (const q of questions) {
    if (!q.objectiveId) continue;
    const objective = byId.get(q.objectiveId.toLowerCase());
    if (!objective) continue;
    items.push({
      objectiveKey: objectiveKeyForId(objective.id),
      objectiveText: objective.text,
      objectiveId: objective.id,
      result: q.correct ? "correct" : "misconception",
      detail: q.correct ? "Answered the quiz question correctly." : "Missed this in the lesson quiz.",
      source: "quiz",
      serverVerified: true,
      score: q.correct ? 1 : 0,
      difficulty: null,
      itemRef: `quiz_question:${q.id}`,
    });
  }
  return items;
}

const WEAK_STATUSES = new Set(["learning", "needs_review"]);

/**
 * Objectives to offer a "Go through these with <Teacher>" revision for: missed in this attempt and now
 * weak (status learning / needs_review; legacy level ≤ 1 when v2 status is unavailable; no stored state
 * at all counts as weak). At most `limit`, in question order.
 */
export function revisionObjectiveIds(
  evidence: ReadonlyArray<CollectedEvidence>,
  states: ReadonlyArray<MasteryState>,
  limit = 3,
): string[] {
  const stateByKey = new Map(states.map((s) => [s.objectiveKey, s]));
  const out: string[] = [];
  for (const ev of evidence) {
    if (ev.result === "correct" || !ev.objectiveId) continue;
    if (out.includes(ev.objectiveId)) continue;
    const state = stateByKey.get(ev.objectiveKey);
    const weak = !state
      ? true
      : typeof state.status === "string" && state.status
        ? WEAK_STATUSES.has(state.status)
        : state.level <= 1;
    if (weak) out.push(ev.objectiveId);
    if (out.length >= limit) break;
  }
  return out;
}
