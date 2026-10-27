import { test } from "node:test";
import assert from "node:assert/strict";
import { estimateCostUsd } from "./usage-rates.ts";

test("zero or invalid units cost nothing", () => {
  assert.equal(estimateCostUsd("llm", 0), 0);
  assert.equal(estimateCostUsd("tts", -5), 0);
  assert.equal(estimateCostUsd("tts", Number.NaN), 0);
});

test("token and second units are priced and rounded to five decimals", () => {
  assert.equal(estimateCostUsd("tts", 1_000_000), 10);
  assert.equal(estimateCostUsd("llm", 2000), 0.001);
  assert.equal(estimateCostUsd("live_audio_in", 60), 0.006);
});
