import { test } from "node:test";
import assert from "node:assert/strict";
import { scenarioSchema, SESSION_ORIGINS, SKILL_PACKS } from "./scenario.ts";

const validScenario = {
  skill_pack: "language-zh",
  persona_id: "7d1f0c52-3c1a-4d9e-9a64-1f2b3c4d5e6f",
  title: "Greetings at the tea house",
  goal: "Greet the teahouse owner and order tea",
  beats: [
    { id: "greet", goal: "Say hello", targetItems: ["你好"] },
    { id: "order", goal: "Order a cup of tea" },
  ],
  target_items: [{ text: "茶", pron: "chá", meaning: "tea" }, { text: "你好" }],
  level: "HSK1",
  exam_task: "HSKK-beginner-repeat",
  max_minutes: 6,
  allowed_modes: ["live", "voice", "text"],
  scene: "Scene_TeaHouse",
  visibility: "tenant_library",
  style: "scene",
};

test("scenario schema accepts a valid sample", () => {
  const result = scenarioSchema.safeParse(validScenario);
  assert.equal(result.success, true);
});

test("scenario schema accepts a minimal sample without optional fields", () => {
  const { level, exam_task, scene, ...minimal } = validScenario;
  void level;
  void exam_task;
  void scene;
  assert.equal(scenarioSchema.safeParse({ ...minimal, beats: [], target_items: [] }).success, true);
});

test("scenario schema rejects max_minutes outside 1-30", () => {
  assert.equal(scenarioSchema.safeParse({ ...validScenario, max_minutes: 0 }).success, false);
  assert.equal(scenarioSchema.safeParse({ ...validScenario, max_minutes: 31 }).success, false);
  assert.equal(scenarioSchema.safeParse({ ...validScenario, max_minutes: 2.5 }).success, false);
  assert.equal(scenarioSchema.safeParse({ ...validScenario, max_minutes: 30 }).success, true);
});

test("scenario schema rejects unknown modes, empty and repeated modes", () => {
  assert.equal(scenarioSchema.safeParse({ ...validScenario, allowed_modes: ["video"] }).success, false);
  assert.equal(scenarioSchema.safeParse({ ...validScenario, allowed_modes: [] }).success, false);
  assert.equal(scenarioSchema.safeParse({ ...validScenario, allowed_modes: ["text", "text"] }).success, false);
});

test("scenario schema rejects unknown visibility, style and skill pack", () => {
  assert.equal(scenarioSchema.safeParse({ ...validScenario, visibility: "public" }).success, false);
  assert.equal(scenarioSchema.safeParse({ ...validScenario, style: "lecture" }).success, false);
  assert.equal(scenarioSchema.safeParse({ ...validScenario, skill_pack: "language-de" }).success, false);
});

test("SESSION_ORIGINS and SKILL_PACKS match the plan", () => {
  assert.deepEqual([...SESSION_ORIGINS], ["lesson", "assignment", "practice", "ask", "placement"]);
  assert.deepEqual([...SKILL_PACKS], ["language-zh", "language-es", "language-fr", "health-sim", "general-tutor"]);
});
