import { test } from "node:test";
import assert from "node:assert/strict";
import {
  buildTranscript,
  collectNoteMistakes,
  hasLearnerSpeech,
  parseTutorReport,
  toneStats,
  type StoredTurn,
} from "./report-model.ts";

const turns: StoredTurn[] = [
  {
    learner_text: null,
    events: [{ type: "say", text: "你好！欢迎来到茶馆。" }],
  },
  {
    learner_text: "你号",
    events: [
      { type: "note_mistake", said: "你号", correct: "你好", category: "tone" },
      { type: "say", text: "很好，再说一次：你好。" },
    ],
  },
  {
    learner_text: "你好",
    events: [
      { type: "note_mistake", said: "你号", correct: "你好", category: "tone" },
      { type: "note_mistake", said: "谢谢", correct: "谢谢你", category: "vocabulary" },
      { type: "bogus", whatever: true },
    ],
  },
];

test("parseTutorReport accepts a valid report and rounds scores", () => {
  const text = JSON.stringify({
    scores: { fluency: 72.4, accuracy: 60 },
    strengths: ["Clear greeting"],
    mistakes: [{ said: "你号", correct: "你好", category: "tone" }],
    nextStep: "Practise third tone pairs.",
  });
  const result = parseTutorReport(text);
  assert.equal(result.ok, true);
  if (result.ok) assert.equal(result.report.scores.fluency, 72);
});

test("parseTutorReport rejects bad JSON, empty text and out-of-range scores", () => {
  assert.equal(parseTutorReport("not json").ok, false);
  assert.equal(parseTutorReport(undefined).ok, false);
  const outOfRange = JSON.stringify({
    scores: { fluency: 140 },
    strengths: [],
    mistakes: [],
    nextStep: "x",
  });
  assert.equal(parseTutorReport(outOfRange).ok, false);
});

test("collectNoteMistakes de-duplicates across turns and skips invalid events", () => {
  assert.deepEqual(collectNoteMistakes(turns), [
    { said: "你号", correct: "你好", category: "tone" },
    { said: "谢谢", correct: "谢谢你", category: "vocabulary" },
  ]);
});

test("collectNoteMistakes respects the limit", () => {
  assert.equal(collectNoteMistakes(turns, 1).length, 1);
});

test("hasLearnerSpeech looks only at learner text", () => {
  assert.equal(hasLearnerSpeech([{ learner_text: null, events: [] }]), false);
  assert.equal(hasLearnerSpeech([{ learner_text: "  ", events: [] }]), false);
  assert.equal(hasLearnerSpeech(turns), true);
});

test("buildTranscript interleaves learner text and teacher say lines", () => {
  const transcript = buildTranscript(turns);
  assert.equal(
    transcript,
    [
      "Teacher: 你好！欢迎来到茶馆。",
      "Learner: 你号",
      "Teacher: 很好，再说一次：你好。",
      "Learner: 你好",
    ].join("\n"),
  );
});

test("buildTranscript keeps the most recent characters when truncating", () => {
  const transcript = buildTranscript(turns, 20);
  assert.equal(transcript.length, 20);
  assert.ok(transcript.endsWith("Learner: 你好"));
});

test("toneStats only applies to Mandarin and counts tone mistakes", () => {
  const mistakes = collectNoteMistakes(turns);
  assert.deepEqual(toneStats("zh", mistakes), { toneMistakes: 1, totalMistakes: 2 });
  assert.deepEqual(toneStats("es", mistakes), {});
});
