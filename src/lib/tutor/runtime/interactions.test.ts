import { test } from "node:test";
import assert from "node:assert/strict";
import { SERVER_ONLY_FIELDS, type TutorEvent } from "../contract/index.ts";
import {
  clientEventsForReplay,
  gradePendingCheck,
  interactionInputSchema,
  interactionLearnerText,
  isCheckOpen,
  parseAnswerSpec,
  prepareAnswerableEvents,
  shuffleForDisplay,
  teacherNoteForGrade,
  type GradedInteraction,
} from "./interactions.ts";

const MODEL_TURN: TutorEvent[] = [
  { type: "say", text: "Quick check." },
  { type: "ask_choice", question: "Capital of Zambia?", options: ["Ndola", "Lusaka", "Kitwe"], answer: ["Lusaka"], objective: "obj-1" },
  { type: "ask_order", prompt: "Order the steps", items: ["plan", "build", "test", "ship"] },
  { type: "ask_fill", prompt: "Plants make food by ___.", answer: ["photosynthesis|photo-synthesis"] },
  { type: "ask_numeric", prompt: "g on Earth?", unit: "m/s²", value: 9.81, tolerance: 0.05 },
];

/** Any key that may hold an answer, anywhere in a JSON payload. */
function containsAnswerKey(payload: unknown): string | null {
  const keys = new Set(Object.values(SERVER_ONLY_FIELDS).flat());
  let found: string | null = null;
  JSON.stringify(payload, (k, v) => {
    if (keys.has(k) && v !== undefined) found = k;
    return v;
  });
  return found;
}

test("answer keys never appear in the client (= stored) events; they move into held checks", () => {
  const prepared = prepareAnswerableEvents(MODEL_TURN, 3);
  assert.equal(containsAnswerKey(prepared.client), null, "client payload leaked a key");
  assert.equal(containsAnswerKey({ events: prepared.client, turnIdx: 3 }), null);
  assert.equal(prepared.checks.length, 4);
  assert.equal(prepared.ungraded, 0);
  assert.deepEqual(
    prepared.client.filter((e) => "checkId" in e).map((e) => (e as { checkId: string }).checkId),
    ["t3-0", "t3-1", "t3-2", "t3-3"],
  );
  assert.deepEqual(prepared.checks[0].spec, { kind: "choice", options: ["Ndola", "Lusaka", "Kitwe"], correct: [1] });
  assert.equal(prepared.checks[0].objective, "obj-1");
  assert.deepEqual(prepared.checks[3].spec, { kind: "numeric", value: 9.81, tolerance: 0.05, unit: "m/s²" });
});

test("replay strips keys from any stored turn (old rows, forged rows) and leaves other entries alone", () => {
  const legacy = [...MODEL_TURN, { type: "debug_raw_output", raw: '{"answer":["4"]' }, "junk"];
  const replay = clientEventsForReplay(legacy) as unknown[];
  assert.equal(containsAnswerKey(replay), null);
  assert.equal(replay.length, 6, "debug entry dropped");
  assert.equal(replay[5], "junk");
  assert.doesNotMatch(JSON.stringify(replay), /debug_raw_output/);
  assert.equal(clientEventsForReplay(null), null);
});

test("ask_order: the learner sees a shuffled order; the key is the model's order", () => {
  const prepared = prepareAnswerableEvents(MODEL_TURN, 1);
  const order = prepared.client.find((e) => e.type === "ask_order") as { items: string[] };
  assert.notDeepEqual(order.items, ["plan", "build", "test", "ship"]);
  assert.deepEqual([...order.items].sort(), ["build", "plan", "ship", "test"]);
  const check = prepared.checks.find((c) => c.kind === "order")!;
  assert.deepEqual((check.spec as { correct: string[] }).correct, ["plan", "build", "test", "ship"]);
  assert.deepEqual((check.spec as { items: string[] }).items, order.items);
  assert.deepEqual(shuffleForDisplay(["a", "b", "c"], "s"), shuffleForDisplay(["a", "b", "c"], "s"), "deterministic");
  assert.notDeepEqual(shuffleForDisplay(["a", "b"], "any"), ["a", "b"]);
});

test("a missing or unusable key is shown ungraded and counted", () => {
  const prepared = prepareAnswerableEvents(
    [
      { type: "ask_choice", question: "Pick", options: ["a", "b"] },
      { type: "ask_choice", question: "Pick", options: ["a", "b"], answer: ["zebra"] },
      { type: "ask_numeric", prompt: "How many?" },
    ],
    2,
  );
  assert.equal(prepared.ungraded, 3);
  assert.equal(prepared.checks.length, 0);
  assert.equal(containsAnswerKey(prepared.client), null);
  assert.ok(prepared.client.every((e) => !("checkId" in e)));
});

test("fill: synonyms written as separate entries for a single blank are merged", () => {
  const prepared = prepareAnswerableEvents([{ type: "ask_fill", prompt: "The ___ is big.", answer: ["sea", "ocean"] }], 0);
  assert.deepEqual(prepared.checks[0].spec, { kind: "fill", blanks: [["sea", "ocean"]] });
});

test("only an unanswered check of the latest turn is open", () => {
  const history = [{ idx: 0 }, { idx: 1 }];
  assert.equal(isCheckOpen({ turnIdx: 1 }, history), true);
  assert.equal(isCheckOpen({ turnIdx: 0 }, history), false, "the learner already replied after it");
  assert.equal(isCheckOpen({ turnIdx: 1, answeredAt: "2026-11-25T00:00:00Z" }, history), false, "single use");
  assert.equal(isCheckOpen({ turnIdx: 0 }, []), false);
});

test("held specs round-trip through jsonb and malformed rows are refused", () => {
  for (const c of prepareAnswerableEvents(MODEL_TURN, 0).checks) {
    assert.deepEqual(parseAnswerSpec(JSON.parse(JSON.stringify(c.spec))), c.spec);
  }
  assert.equal(parseAnswerSpec(null), null);
  assert.equal(parseAnswerSpec({ kind: "choice", options: ["a"], correct: ["x"] }), null);
  assert.equal(parseAnswerSpec({ kind: "numeric", value: "3" }), null);
  assert.equal(parseAnswerSpec({ kind: "fill", blanks: [[1]] }), null);
  assert.equal(parseAnswerSpec({ kind: "eval" }), null);
});

test("grading a held check and telling the model", () => {
  const check = prepareAnswerableEvents(MODEL_TURN, 4).checks[0];
  const graded = gradePendingCheck(check, 0) as GradedInteraction;
  assert.equal(graded.grade.result, "misconception");
  const note = teacherNoteForGrade(graded);
  assert.match(note, /not correct/);
  assert.match(note, /Expected: Lusaka/);
  assert.match(note, /do not add note_evidence/);
  assert.equal(interactionLearnerText(check, 1), "I choose: Lusaka");
  assert.ok("error" in gradePendingCheck(check, "Paris"));
});

test("interaction input schema bounds the value", () => {
  assert.ok(interactionInputSchema.safeParse({ id: "t1-0", value: 2 }).success);
  assert.ok(interactionInputSchema.safeParse({ id: "t1-0", value: ["a", 1] }).success);
  assert.ok(!interactionInputSchema.safeParse({ id: "", value: 2 }).success);
  assert.ok(!interactionInputSchema.safeParse({ id: "t1-0", value: Array(9).fill("a") }).success);
  assert.ok(!interactionInputSchema.safeParse({ id: "t1-0", value: { a: 1 } }).success);
  assert.ok(!interactionInputSchema.safeParse({ id: "t1-0", value: "x".repeat(401) }).success);
});
