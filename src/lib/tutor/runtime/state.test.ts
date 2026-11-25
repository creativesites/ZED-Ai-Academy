import { test } from "node:test";
import assert from "node:assert/strict";
import type { TutorEvent } from "../contract/index.ts";
import { prepareAnswerableEvents } from "./interactions.ts";
import {
  confidenceFromReply,
  initialSessionState,
  isLikelyOffTopic,
  parseSessionState,
  recomputeSessionState,
  reduceSessionState,
  type SessionState,
} from "./state.ts";
import { chooseBaseStrategy, maxHintsFor, parseTeachingPhilosophy, strategyPromptBlock, STRATEGIES, STRATEGY_IDS } from "./strategies.ts";

const base = () => initialSessionState({ objectiveIds: ["obj-1", "obj-2"], strategy: "guided" });
const obj = (s: SessionState, id: string) => s.objectives.find((o) => o.id === id)!;
const graded = (result: "correct" | "partial" | "misconception", objectiveId: string | null = "obj-1") => ({
  learner: { text: "I choose: x", graded: { objectiveId, result, checkId: "t1-0" } },
  events: [] as TutorEvent[],
});

test("initial state: every objective pending, the first one current", () => {
  const s = base();
  assert.equal(s.v, 1);
  assert.equal(s.currentObjectiveId, "obj-1");
  assert.deepEqual(s.objectives.map((o) => o.status), ["pending", "pending"]);
  assert.equal(initialSessionState({ objectiveIds: [], strategy: "guided" }).currentObjectiveId, null);
});

test("two misconceptions count consecutively; three flag review; a correct answer resets", () => {
  let s = reduceSessionState(base(), graded("misconception"));
  s = reduceSessionState(s, graded("misconception"));
  assert.equal(obj(s, "obj-1").misses, 2);
  assert.equal(obj(s, "obj-1").status, "teaching");
  s = reduceSessionState(s, graded("misconception"));
  assert.equal(obj(s, "obj-1").status, "review");
  s = reduceSessionState(s, graded("correct"));
  assert.equal(obj(s, "obj-1").misses, 0);
  assert.equal(obj(s, "obj-1").attempts, 4);
});

test("correct with low confidence needs one more check before met; then the next objective becomes current", () => {
  let s = reduceSessionState(base(), { learner: null, events: [{ type: "ask_confidence" }] });
  assert.equal(s.awaitingConfidence, true);
  s = reduceSessionState(s, { learner: { text: "Unsure" }, events: [] });
  assert.equal(s.confidence, 2);
  s = reduceSessionState(s, graded("correct"));
  assert.equal(obj(s, "obj-1").status, "checking");
  assert.equal(obj(s, "obj-1").needsConfirm, true);
  assert.equal(s.currentObjectiveId, "obj-1");
  s = reduceSessionState(s, graded("correct"));
  assert.equal(obj(s, "obj-1").status, "met");
  assert.equal(s.currentObjectiveId, "obj-2");
});

test("confidence replies only count right after ask_confidence", () => {
  const s = reduceSessionState(base(), { learner: { text: "Got it" }, events: [] });
  assert.equal(s.confidence, undefined);
  assert.equal(confidenceFromReply("Lost"), 1);
  assert.equal(confidenceFromReply("got it!"), 4);
  assert.equal(confidenceFromReply("maybe"), null);
});

test("teacher events: checks hold the pending key and reset the check counter; note_evidence resolves objectives", () => {
  const prepared = prepareAnswerableEvents(
    [{ type: "ask_choice", question: "q", options: ["a", "b"], answer: ["a"], objective: "OBJ-2" }],
    1,
  );
  let s = { ...base(), turnsSinceCheck: 3 };
  s = reduceSessionState(s, {
    learner: { text: "hello" },
    events: prepared.client,
    checks: prepared.checks,
    resolveObjective: (raw) => raw.toLowerCase(),
  });
  assert.equal(s.turnsSinceCheck, 0);
  assert.equal(s.currentObjectiveId, "obj-2");
  assert.equal(obj(s, "obj-2").status, "checking");
  assert.equal(s.pendingCheck?.id, "t1-0");

  s = reduceSessionState(s, {
    learner: { text: "answer", graded: { objectiveId: "obj-2", result: "correct", checkId: "t1-0" } },
    events: [{ type: "note_evidence", objective: "unknown thing", result: "misconception" }],
    resolveObjective: () => null,
  });
  assert.equal(s.pendingCheck, undefined, "graded check is cleared");
  assert.equal(obj(s, "obj-2").status, "met");
  assert.equal(s.objectives.length, 2, "unresolved evidence does not invent objectives");
});

test("hint requests, off-topic streaks, steps, moves and learner turns", () => {
  let s = reduceSessionState(base(), { learner: { text: "Can I get a hint?" }, events: [], move: "explain" });
  assert.equal(obj(s, "obj-1").hints, 1);
  assert.equal(s.lastMove, "explain");
  s = reduceSessionState(s, { learner: { text: "x", offTopic: true }, events: [] });
  s = reduceSessionState(s, { learner: { text: "y", offTopic: true }, events: [], strategy: "socratic" });
  assert.equal(s.offTopicStreak, 2);
  assert.equal(s.strategy, "socratic");
  assert.equal(s.lastMove, undefined);
  s = reduceSessionState(s, { learner: { text: "z" }, events: [{ type: "advance_step", step: "B2" }], beatIds: ["b1", "b2"] });
  assert.equal(s.offTopicStreak, 0);
  assert.equal(s.stepIdx, 1);
  assert.equal(s.learnerTurns, 4);
});

test("reducer never mutates its input", () => {
  const s = base();
  const frozen = JSON.stringify(s);
  reduceSessionState(s, graded("misconception"));
  assert.equal(JSON.stringify(s), frozen);
});

test("parseSessionState round-trips and rejects foreign shapes", () => {
  const s = reduceSessionState(base(), graded("partial"));
  assert.deepEqual(parseSessionState(JSON.parse(JSON.stringify(s))), s);
  assert.equal(parseSessionState(null), null);
  assert.equal(parseSessionState({ v: 2, strategy: "guided" }), null);
  assert.equal(parseSessionState({ v: 1, strategy: "nonsense" }), null);
  const odd = parseSessionState({ v: 1, strategy: "guided", objectives: [{ id: "o", status: "weird", misses: -4 }, 5], confidence: 9 });
  assert.equal(odd?.objectives[0].status, "pending");
  assert.equal(odd?.objectives[0].misses, 0);
  assert.equal(odd?.objectives.length, 1);
  assert.equal(odd?.confidence, undefined);
});

test("recomputeSessionState rebuilds from stored turns (teacher judgement only)", () => {
  const s = recomputeSessionState(base(), [
    { idx: 0, learner_text: null, events: [{ type: "say", text: "hi" }] },
    { idx: 1, learner_text: "a", events: [{ type: "note_evidence", objective: "obj-1", result: "misconception" }] },
    { idx: 2, learner_text: "b", events: [{ type: "note_evidence", objective: "obj-1", result: "misconception" }, "junk"] },
  ]);
  assert.equal(obj(s, "obj-1").misses, 2);
  assert.equal(s.learnerTurns, 2);
});

test("off-topic heuristic is conservative", () => {
  const vocab = ["Add fractions with unlike denominators", "Find a common denominator"];
  assert.equal(isLikelyOffTopic("Who won the football match between Zambia and Ghana yesterday evening", vocab), true);
  assert.equal(isLikelyOffTopic("Why do we need a common denominator for these fractions", vocab), false);
  assert.equal(isLikelyOffTopic("football tonight?", vocab), false, "short messages never count");
  assert.equal(isLikelyOffTopic("Can you explain the football analogy differently please mate", vocab), false, "learning requests");
  assert.equal(isLikelyOffTopic("Who won the football match between Zambia and Ghana", []), false, "no vocabulary, no judgement");
});

test("strategies: data shape, base choice, philosophy parsing, prompt block", () => {
  for (const id of STRATEGY_IDS) {
    const st = STRATEGIES[id];
    assert.equal(st.id, id);
    assert.ok(st.prompt.length > 0 && st.prompt.length < 600, `${id} prompt ≤ ~150 tokens`);
  }
  assert.equal(chooseBaseStrategy({ origin: "viva", skillPack: "general-tutor" }), "viva");
  assert.equal(chooseBaseStrategy({ origin: "revision", skillPack: "general-tutor" }), "retrieval");
  assert.equal(chooseBaseStrategy({ origin: "lesson", skillPack: "general-tutor", style: "exam_drill" }), "exam_prep");
  assert.equal(
    chooseBaseStrategy({ origin: "lesson", skillPack: "general-tutor", philosophy: { defaultStrategy: "socratic" } }),
    "socratic",
  );
  assert.equal(chooseBaseStrategy({ origin: "practice", skillPack: "language-zh" }), "role_play");
  assert.equal(chooseBaseStrategy({ origin: "lesson", skillPack: "general-tutor" }), "guided");

  assert.deepEqual(parseTeachingPhilosophy({ defaultStrategy: "nope", hintGenerosity: "high", strictness: 3, languageMix: "English <b>with</b> Bemba" }), {
    hintGenerosity: "high",
    languageMix: "English bwith/b Bemba",
  });
  assert.deepEqual(parseTeachingPhilosophy(null), {});
  assert.equal(maxHintsFor("viva", { hintGenerosity: "high" }), 0);
  assert.equal(maxHintsFor("guided", { hintGenerosity: "low" }), 1);

  const block = strategyPromptBlock({ origin: "lesson", skillPack: "general-tutor", philosophy: { formality: "formal" } });
  assert.match(block, /Worked example/);
  assert.match(block, /formality: formal/);
  assert.doesNotMatch(strategyPromptBlock({ origin: "viva", skillPack: "x" }), /Worked example/);
});
