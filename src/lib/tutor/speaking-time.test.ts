import { test } from "node:test";
import assert from "node:assert/strict";
import { MAX_SPEAKING_MS, secondsToMs, SpeakingTimeAccumulator } from "./speaking-time.ts";

test("learner and teacher time add up separately", () => {
  const acc = new SpeakingTimeAccumulator();
  acc.addLearnerMs(4_200);
  acc.addLearnerMs(3_000.4);
  acc.addTeacherMs(1_500);
  assert.deepEqual(acc.totals(), { learnerSpeakingMs: 7_200, teacherSpeakingMs: 1_500 });
});

test("bad durations are ignored", () => {
  const acc = new SpeakingTimeAccumulator();
  acc.addLearnerMs(Number.NaN);
  acc.addLearnerMs(-400);
  acc.addLearnerMs(Number.POSITIVE_INFINITY);
  acc.addTeacherMs(-1);
  assert.deepEqual(acc.totals(), { learnerSpeakingMs: 0, teacherSpeakingMs: 0 });
});

test("totals are capped at the server limit", () => {
  const acc = new SpeakingTimeAccumulator();
  acc.addLearnerMs(MAX_SPEAKING_MS);
  acc.addLearnerMs(60_000);
  assert.equal(acc.totals().learnerSpeakingMs, MAX_SPEAKING_MS);
});

test("secondsToMs converts media durations and rejects unknown ones", () => {
  assert.equal(secondsToMs(2.5), 2_500);
  assert.equal(secondsToMs(Number.NaN), 0);
  assert.equal(secondsToMs(Number.POSITIVE_INFINITY), 0);
  assert.equal(secondsToMs(0), 0);
});
