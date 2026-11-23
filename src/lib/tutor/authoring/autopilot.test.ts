import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { resolveAutopilotTemplate, selectAutopilotLessons } from "./autopilot.ts";

describe("authoring/autopilot", () => {
  it("skips lessons that already have AI teacher blocks or are empty, and respects batch limit", () => {
    const plan = selectAutopilotLessons(
      [
        { lessonId: "l1", lessonTitle: "Already done", moduleTitle: "M1", hasExistingTutorBlock: true, materialBlockCount: 3 },
        { lessonId: "l2", lessonTitle: "Empty", moduleTitle: "M1", hasExistingTutorBlock: false, materialBlockCount: 0 },
        { lessonId: "l3", lessonTitle: "Prompting 101", moduleTitle: "M1", hasExistingTutorBlock: false, materialBlockCount: 4 },
        { lessonId: "l4", lessonTitle: "Budget walkthrough", moduleTitle: "M2", hasExistingTutorBlock: false, materialBlockCount: 2 },
        { lessonId: "l5", lessonTitle: "Customer roleplay", moduleTitle: "M2", hasExistingTutorBlock: false, materialBlockCount: 2 },
      ],
      { maxBatch: 2 },
    );

    assert.equal(plan.skippedAlreadyConfigured, 1);
    assert.equal(plan.skippedEmpty, 1);
    assert.equal(plan.selected.length, 2);
    assert.equal(plan.selected[0].lessonId, "l3");
    assert.equal(plan.selected[1].lessonId, "l4");
    assert.equal(plan.remainingPendingCount, 1);
  });

  it("picks topic-appropriate templates when set to auto", () => {
    assert.equal(resolveAutopilotTemplate("auto", "Kwacha budget calculation"), "worked_example");
    assert.equal(resolveAutopilotTemplate("auto", "Customer support roleplay"), "role_play");
    assert.equal(resolveAutopilotTemplate("auto", "Oral check & defense"), "oral_check");
    assert.equal(resolveAutopilotTemplate("auto", "Module summary"), "revision_sprint");
    assert.equal(resolveAutopilotTemplate("auto", "What is AI?"), "explain_check");
    assert.equal(resolveAutopilotTemplate("debate_defend", "What is AI?"), "debate_defend");
  });
});
