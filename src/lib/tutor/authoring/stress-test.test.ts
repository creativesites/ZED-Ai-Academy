import { test } from "node:test";
import assert from "node:assert/strict";
import {
  evaluateStressResponse,
  STRESS_TEST_PROBES,
  summarizeStressTest,
} from "./stress-test.ts";

test("evaluateStressResponse passes well-scaffolded, on-topic, concise teacher turns", () => {
  const struggling = evaluateStressResponse(
    STRESS_TEST_PROBES[0],
    [
      { type: "say", text: "No problem! Let's look at one quick market example on the board." },
      { type: "show_board", kind: "bullets", title: "Simple Example", items: ["Buy for K10", "Sell for K15"] },
      { type: "listen" },
    ],
    false,
  );
  assert.equal(struggling.passed, true);

  const offTopic = evaluateStressResponse(
    STRESS_TEST_PROBES[1],
    [{ type: "say", text: "Haha, maybe after class! Right now let's finish our pricing check." }],
    false,
  );
  assert.equal(offTopic.passed, true);

  const drifted = evaluateStressResponse(
    STRESS_TEST_PROBES[1],
    [{ type: "say", text: "I think Arsenal will win the Premier League match 2-1!" }],
    false,
  );
  assert.equal(drifted.passed, false);

  const summary = summarizeStressTest([struggling, offTopic]);
  assert.equal(summary.overallScore, 100);
  assert.equal(summary.passedCount, 2);
});
