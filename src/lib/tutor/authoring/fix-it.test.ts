import { test } from "node:test";
import assert from "node:assert/strict";
import { buildFixItFlowFromMisconception } from "./fix-it.ts";

test("buildFixItFlowFromMisconception creates a focused 3-minute 3-step remediation flow", () => {
  const flow = buildFixItFlowFromMisconception({
    objectiveText: "Distinguish gross margin from markup",
    sampleDetails: [
      "Divided profit by cost instead of revenue",
      "Assumed 25% markup equals 25% margin",
    ],
    misconceptionCount: 5,
    partialCount: 2,
  });

  assert.equal(flow.maxMinutes, 3);
  assert.equal(flow.beats.length, 3);
  assert.match(flow.title, /^Fix-It \(3m\): Distinguish gross margin from markup/);
  assert.match(flow.goal, /Divided profit by cost/);
  assert.equal(flow.beats[0].id, "spot_trap");
  assert.equal(flow.beats[2].id, "verify_mastery");
  assert.ok(flow.targetItems.length === 1);
});
