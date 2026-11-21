import { test } from "node:test";
import assert from "node:assert/strict";
import {
  FLOW_DRAFT_JSON_SCHEMA,
  buildDraftFlowPrompt,
  buildReviseFlowPrompt,
  computeFlowDiff,
  defaultSceneForLesson,
  parseDraftedFlow,
  pickSkillPackForLesson,
  type DraftedFlow,
} from "./flow.ts";

const BOUND_KEYS = ["minimum", "maximum", "minItems", "maxItems", "minLength", "maxLength", "pattern", "format"];

function findBounds(node: unknown, path: string, found: string[]): void {
  if (Array.isArray(node)) {
    node.forEach((child, i) => findBounds(child, `${path}[${i}]`, found));
    return;
  }
  if (typeof node !== "object" || node === null) return;
  for (const [key, value] of Object.entries(node)) {
    if (BOUND_KEYS.includes(key)) found.push(`${path}.${key}`);
    findBounds(value, `${path}.${key}`, found);
  }
}

test("FLOW_DRAFT_JSON_SCHEMA has no constraint bounds that break Gemini serving", () => {
  const found: string[] = [];
  findBounds(FLOW_DRAFT_JSON_SCHEMA, "schema", found);
  assert.deepEqual(found, []);
});

test("pickSkillPackForLesson picks general-tutor for non-language lessons", () => {
  assert.equal(pickSkillPackForLesson({ courseTitle: "Fractions & Business Maths", category: "Maths" }), "general-tutor");
  assert.equal(pickSkillPackForLesson({ courseTitle: "AI Skills for Teams", category: "AI Skills" }), "general-tutor");
  assert.equal(pickSkillPackForLesson({ courseTitle: "HSK 1 Mandarin Chinese", category: "Languages" }), "language-zh");
  assert.equal(pickSkillPackForLesson({ courseTitle: "Conversational Spanish" }), "language-es");
  assert.equal(pickSkillPackForLesson({ courseTitle: "DELF A2 French" }), "language-fr");
});

test("defaultSceneForLesson selects Scene_Studio for coaching/viva/tech and Scene_Classroom otherwise", () => {
  assert.equal(defaultSceneForLesson({ templateId: "explain_check", category: "Maths" }), "Scene_Classroom");
  assert.equal(defaultSceneForLesson({ templateId: "oral_check", category: "Maths" }), "Scene_Studio");
  assert.equal(defaultSceneForLesson({ templateId: "explain_check", category: "AI Skills" }), "Scene_Studio");
});

test("parseDraftedFlow validates a drafted flow and builds prompts cleanly", () => {
  const { prompt } = buildDraftFlowPrompt({
    courseTitle: "AI Teacher Test Drive",
    lessonTitle: "Fractions, explained out loud",
    objectives: [
      { id: "obj-1", text: "Learner can explain numerator and denominator", evidence: "Names top and bottom parts" },
      { id: "obj-2", text: "Learner can split K100 equally", evidence: "Calculates K25 per person" },
    ],
    templateId: "worked_example",
    skillPack: "general-tutor",
    defaultScene: "Scene_Classroom",
    materialText: "A fraction shows parts of a whole.",
    teacherName: "Tinashe",
  });
  assert.match(prompt, /Worked example/);
  assert.match(prompt, /Tinashe/);

  const parsed = parseDraftedFlow({
    title: "Sharing bills with fractions",
    goal: "Explain fractions and split a kwacha bill equally.",
    style: "guided_lesson",
    scene: "Scene_Classroom",
    maxMinutes: 7,
    skillPack: "general-tutor",
    steps: [
      { id: "step-1", goal: "Explain top and bottom", boardContent: "1/4 = 1 part out of 4", checkQuestion: "What does the 4 mean?" },
      { id: "step-2", goal: "Compare 1/2 and 1/4", boardContent: "1/2 > 1/4", checkQuestion: "Which share is bigger?" },
      { id: "step-3", goal: "Split K100 by 4", boardContent: "K100 / 4 = ?", checkQuestion: "How much does each friend get?" },
    ],
    targetItems: [{ text: "numerator", meaning: "parts taken" }],
  });

  assert.equal(parsed.ok, true);
  if (parsed.ok) {
    assert.equal(parsed.flow.steps.length, 3);
    assert.equal(parsed.flow.skillPack, "general-tutor");
  }
});

test("computeFlowDiff detects step and metadata edits for undo UI", () => {
  const before: DraftedFlow = {
    title: "Fractions",
    goal: "Understand fractions.",
    style: "guided_lesson",
    scene: "Scene_Classroom",
    maxMinutes: 7,
    skillPack: "general-tutor",
    steps: [
      { id: "step-1", goal: "Intro", boardContent: "1/2", checkQuestion: "What is 1/2?" },
      { id: "step-2", goal: "Divide", boardContent: "100 / 4", checkQuestion: "How much?" },
      { id: "step-3", goal: "Recap", boardContent: "Summary", checkQuestion: "Ready?" },
    ],
    targetItems: [],
  };
  const after: DraftedFlow = {
    ...before,
    steps: [
      before.steps[0],
      { ...before.steps[1], boardContent: "K100 shared among 4 friends", checkQuestion: "How many kwacha each?" },
      before.steps[2],
    ],
  };

  const revisePrompt = buildReviseFlowPrompt({ currentFlow: before, instruction: "add a kwacha example" });
  assert.match(revisePrompt.prompt, /add a kwacha example/);

  const diff = computeFlowDiff(before, after);
  assert.equal(diff.length, 1);
  assert.equal(diff[0].kind, "step_updated");
  assert.match(diff[0].label, /Step 2 updated \(board, check question\)/);
});
