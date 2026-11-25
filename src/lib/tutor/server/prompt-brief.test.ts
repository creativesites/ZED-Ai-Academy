import { test } from "node:test";
import assert from "node:assert/strict";
import { buildSystemPrompt, type BuildSystemPromptInput } from "./prompt.ts";
import { buildLearnerBrief } from "../learner/memory.ts";

function input(brief: string | null): BuildSystemPromptInput {
  return {
    scenario: { title: "Fractions", goal: "Compare fractions", beats: [], targetItems: [], maxMinutes: 6 },
    persona: { name: "Tinashe", languages: ["en"], personalityPrompt: "Warm." },
    skillPack: "general-tutor",
    learnerProfile: {
      levelEstimate: null,
      recentMistakes: [{ said: "LEGACY-SAID", correct: "x", category: "y" }],
      memoryNotes: ["LEGACY-NOTE"],
      brief,
    },
    lessonText: "",
    mode: "text",
  };
}

test("the learner brief replaces legacy memory lines and sits in the memory layer, fenced", () => {
  const brief = buildLearnerBrief({
    memories: [
      {
        id: "1", companyId: "c", kind: "goal", content: "Pass the exam", source: "learner_stated", sourceRef: null,
        sessionId: null, courseId: null, objectiveKey: null, confidence: 1, visibleToStaff: false, status: "active",
        expiresAt: null, createdAt: "2026-11-01T00:00:00Z",
      },
    ],
    objectiveStates: [],
    courseId: null,
    now: "2026-11-25T00:00:00Z",
  }).text;
  const prompt = buildSystemPrompt(input(brief));
  assert.match(prompt, /<learner_brief>[\s\S]*Goal: Pass the exam[\s\S]*<\/learner_brief>/);
  assert.doesNotMatch(prompt, /LEGACY-SAID|LEGACY-NOTE/);
  assert.ok(prompt.indexOf("Learner memory:") < prompt.indexOf("<learner_brief>"));
});

test("without a brief the legacy memory lines are used (schema unavailable fallback)", () => {
  for (const brief of [null, "", "   "]) {
    const prompt = buildSystemPrompt(input(brief));
    assert.match(prompt, /LEGACY-SAID/);
    assert.match(prompt, /LEGACY-NOTE/);
  }
});
