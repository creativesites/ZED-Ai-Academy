import { test } from "node:test";
import assert from "node:assert/strict";
import {
  previewHistoryToTurns,
  previewLimitReason,
  previewTurnJsonSchema,
  toPromptScenarioFromDraft,
} from "./preview.ts";

test("toPromptScenarioFromDraft includes boardContent and checkQuestion in beat goals", () => {
  const scenario = toPromptScenarioFromDraft({
    title: "Fractions",
    goal: "Compare fractions",
    style: "guided_lesson",
    scene: "Scene_Classroom",
    maxMinutes: 6,
    skillPack: "general-tutor",
    steps: [
      {
        id: "step-1",
        goal: "Explain halves and quarters",
        boardContent: "1/2 > 1/4",
        checkQuestion: "Which is larger, 1/2 or 1/4?",
      },
    ],
    targetItems: [{ text: "numerator" }],
  });

  assert.equal(scenario.beats.length, 1);
  assert.match(scenario.beats[0].goal, /Explain halves and quarters/);
  assert.match(scenario.beats[0].goal, /Board: 1\/2 > 1\/4/);
  assert.match(scenario.beats[0].goal, /Check: Which is larger, 1\/2 or 1\/4\?/);
});

test("previewHistoryToTurns pairs learner and tutor entries cleanly", () => {
  const turns = previewHistoryToTurns([
    { role: "tutor", text: "Hello! Ready to look at fractions?" },
    { role: "learner", text: "Yes!" },
    { role: "tutor", text: "Great, what is the top number called?" },
  ]);
  assert.equal(turns.length, 2);
  assert.equal(turns[0].learner_text, null);
  assert.equal(turns[1].learner_text, "Yes!");
});

test("previewLimitReason enforces time_box and turn_limit", () => {
  assert.equal(
    previewLimitReason({ history: [], learnerTurn: false, elapsedMs: 1000, maxMinutes: 5 }),
    null,
  );
  assert.equal(
    previewLimitReason({ history: [], learnerTurn: true, elapsedMs: 5 * 60_000, maxMinutes: 5 }),
    "time_box",
  );
  const fullHistory = Array.from({ length: 20 }, () => ({ role: "learner" as const, text: "hi" }));
  assert.equal(
    previewLimitReason({ history: fullHistory, learnerTurn: true, elapsedMs: 1000, maxMinutes: 5 }),
    "turn_limit",
  );
});

test("previewTurnJsonSchema validates minimal payload", () => {
  const parsed = previewTurnJsonSchema.safeParse({
    flow: {
      title: "Draft flow",
      goal: "Test goal",
      steps: [{ id: "s1", goal: "Step 1" }],
      targetItems: [],
    },
    history: [],
    elapsedMs: 0,
  });
  assert.equal(parsed.success, true);
});
