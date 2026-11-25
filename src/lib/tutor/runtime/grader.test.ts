import { test } from "node:test";
import assert from "node:assert/strict";
import {
  editDistance,
  fillBlanksFromAnswer,
  gradeInteraction,
  isGradeError,
  normaliseAnswer,
  numericTolerance,
  pairwiseOrderScore,
  parseLearnerNumber,
  resolveChoiceAnswer,
  type AnswerSpec,
  type GradeResult,
} from "./grader.ts";

function ok(r: ReturnType<typeof gradeInteraction>): GradeResult {
  assert.ok(!isGradeError(r), `unexpected grade error: ${JSON.stringify(r)}`);
  return r as GradeResult;
}

test("normaliseAnswer folds case, accents, quotes and edge punctuation", () => {
  assert.equal(normaliseAnswer("  Café!  "), "cafe");
  assert.equal(normaliseAnswer("“Hello,   World.”"), "hello, world");
  assert.equal(normaliseAnswer("It’s"), "it's");
});

test("resolveChoiceAnswer maps text, letters and numbers; refuses unknown answers", () => {
  const opts = ["Lusaka", "Ndola", "Kitwe"];
  assert.deepEqual(resolveChoiceAnswer(opts, ["lusaka"]), [0]);
  assert.deepEqual(resolveChoiceAnswer(opts, ["B"]), [1]);
  assert.deepEqual(resolveChoiceAnswer(opts, ["3"]), [2]);
  assert.deepEqual(resolveChoiceAnswer(opts, ["Kitwe", "Lusaka"]), [0, 2]);
  assert.equal(resolveChoiceAnswer(opts, ["Livingstone"]), null);
  assert.equal(resolveChoiceAnswer(opts, ["E"]), null, "letter beyond the options");
  assert.equal(resolveChoiceAnswer(opts, [""]), null);
  assert.deepEqual(resolveChoiceAnswer(["A) Red", "B) Blue"], ["Blue"]), [1]);
});

test("choice: exact match, wrong pick, multi-answer partial credit, malformed values", () => {
  const spec: AnswerSpec = { kind: "choice", options: ["3", "4", "5"], correct: [1] };
  assert.equal(ok(gradeInteraction(spec, 1)).result, "correct");
  assert.equal(ok(gradeInteraction(spec, "4")).result, "correct");
  const wrong = ok(gradeInteraction(spec, 0));
  assert.equal(wrong.result, "misconception");
  assert.equal(wrong.expected, "4");
  assert.equal(wrong.given, "3");
  assert.ok(isGradeError(gradeInteraction(spec, 7)));
  assert.ok(isGradeError(gradeInteraction(spec, "seven")));
  assert.ok(isGradeError(gradeInteraction(spec, { a: 1 })));

  const multi: AnswerSpec = { kind: "choice", options: ["a", "b", "c", "d"], correct: [0, 2] };
  assert.equal(ok(gradeInteraction(multi, [2, 0])).result, "correct");
  const half = ok(gradeInteraction(multi, [0]));
  assert.equal(half.score, 0.5);
  assert.equal(half.result, "partial");
  assert.equal(ok(gradeInteraction(multi, [0, 1])).result, "misconception", "a wrong pick earns nothing");
});

test("order: exact, partial credit by pairwise agreement, reversed, malformed", () => {
  const spec: AnswerSpec = { kind: "order", items: ["c", "a", "d", "b"], correct: ["a", "b", "c", "d"] };
  assert.equal(ok(gradeInteraction(spec, ["a", "b", "c", "d"])).result, "correct");
  assert.equal(ok(gradeInteraction(spec, [1, 3, 0, 2])).result, "correct", "indexes into the shown items");
  const swapped = ok(gradeInteraction(spec, ["b", "a", "c", "d"]));
  assert.equal(swapped.result, "partial");
  assert.ok(swapped.score > 0.8 && swapped.score < 1);
  assert.equal(ok(gradeInteraction(spec, ["d", "c", "b", "a"])).score, 0);
  assert.ok(isGradeError(gradeInteraction(spec, ["a", "b", "c"])), "every item is required");
  assert.ok(isGradeError(gradeInteraction(spec, ["a", "a", "b", "c"])), "no duplicates");
  assert.ok(isGradeError(gradeInteraction(spec, "abcd")));
  assert.equal(pairwiseOrderScore(["x"], ["x"]), 1);
});

test("fill: synonyms, normalisation, typo half credit, multi-blank, empty", () => {
  const spec: AnswerSpec = { kind: "fill", blanks: fillBlanksFromAnswer(["photosynthesis|photo-synthesis"]) };
  assert.equal(ok(gradeInteraction(spec, "Photosynthesis.")).result, "correct");
  assert.equal(ok(gradeInteraction(spec, "photo-synthesis")).result, "correct");
  const typo = ok(gradeInteraction(spec, "photosynthesls"));
  assert.equal(typo.score, 0.5);
  assert.equal(ok(gradeInteraction(spec, "respiration")).result, "misconception");
  assert.equal(ok(gradeInteraction(spec, "")).result, "misconception");

  const short: AnswerSpec = { kind: "fill", blanks: [["cat"]] };
  assert.equal(ok(gradeInteraction(short, "car")).score, 0, "short words get no typo credit");

  const two: AnswerSpec = { kind: "fill", blanks: [["Lusaka"], ["Zambezi"]] };
  assert.equal(ok(gradeInteraction(two, ["lusaka", "zambezi"])).result, "correct");
  assert.equal(ok(gradeInteraction(two, "Lusaka, Kafue")).score, 0.5);
  assert.ok(isGradeError(gradeInteraction(two, [1, 2])));
  assert.deepEqual(fillBlanksFromAnswer(["a | b", " ", "c"]), [["a", "b"], ["c"]]);
});

test("numeric: explicit tolerance, rounding-aware default, units and separators", () => {
  const g: AnswerSpec = { kind: "numeric", value: 9.81, tolerance: 0.05, unit: "m/s²" };
  assert.equal(ok(gradeInteraction(g, "9.8 m/s²")).result, "correct");
  assert.equal(ok(gradeInteraction(g, 9.9)).result, "misconception");

  const pi: AnswerSpec = { kind: "numeric", value: 3.14159 };
  assert.equal(ok(gradeInteraction(pi, "3.14")).result, "correct");
  assert.equal(ok(gradeInteraction(pi, "3.1")).result, "misconception", "too coarse");
  assert.equal(ok(gradeInteraction(pi, "3.14159")).result, "correct");
  assert.equal(ok(gradeInteraction(pi, "3.15")).result, "misconception");

  const tenth: AnswerSpec = { kind: "numeric", value: 3.4 };
  assert.equal(ok(gradeInteraction(tenth, "3")).result, "misconception", "rounding to an integer is not accepted");

  const big: AnswerSpec = { kind: "numeric", value: 1234.5 };
  assert.equal(ok(gradeInteraction(big, "1,234.5")).result, "correct");
  assert.equal(ok(gradeInteraction(big, "1 234,5")).result, "correct");
  assert.ok(isGradeError(gradeInteraction(big, "about a thousand")));
  assert.ok(isGradeError(gradeInteraction(big, Number.NaN)));
});

test("parseLearnerNumber handles signs, percent and grouping", () => {
  assert.deepEqual(parseLearnerNumber("−3"), { value: -3, decimals: 0 });
  assert.deepEqual(parseLearnerNumber("45%"), { value: 45, decimals: 0 });
  assert.deepEqual(parseLearnerNumber("12,345,678"), { value: 12345678, decimals: 0 });
  assert.deepEqual(parseLearnerNumber("3,5"), { value: 3.5, decimals: 1 });
  assert.deepEqual(parseLearnerNumber("1.234.567"), { value: 1234567, decimals: 0 });
  assert.equal(parseLearnerNumber("none"), null);
  assert.equal(parseLearnerNumber(null), null);
});

test("numericTolerance: explicit wins; full precision is exact", () => {
  assert.ok(numericTolerance({ value: 2, tolerance: 0.5 }, 0) >= 0.5);
  assert.ok(numericTolerance({ value: 0.6667 }, 4) < 1e-6);
  assert.ok(Math.abs(numericTolerance({ value: 0.6667 }, 2) - 0.005) < 1e-6);
});

test("editDistance caps early", () => {
  assert.equal(editDistance("kitten", "sitten", 2), 1);
  assert.equal(editDistance("abc", "abcdef", 2), 3);
});
