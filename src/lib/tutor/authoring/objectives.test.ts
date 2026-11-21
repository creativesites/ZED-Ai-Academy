import { test } from "node:test";
import assert from "node:assert/strict";
import {
  OBJECTIVES_JSON_SCHEMA,
  buildObjectivesPrompt,
  parseExtractedObjectives,
  summarizeLessonMaterial,
} from "./objectives.ts";

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

test("OBJECTIVES_JSON_SCHEMA has no constraint bounds that could break Gemini serving", () => {
  const found: string[] = [];
  findBounds(OBJECTIVES_JSON_SCHEMA, "schema", found);
  assert.deepEqual(found, []);
});

test("summarizeLessonMaterial extracts text, glossary, video title/description, and quiz questions", () => {
  const summary = summarizeLessonMaterial({
    lessonTitle: "Mobile Money Safety",
    blocks: [
      { type: "text", content: { html: "<p>Never share your <strong>PIN</strong> with anyone.</p>" } },
      {
        type: "video",
        content: { youtube_id: "dQw4w9WgXcQ", title: "Spotting Scam Calls", description: "How scammers pose as agents." },
      },
      {
        type: "glossary",
        content: {
          title: "Key Terms",
          terms: [{ term: "Phishing", definition: "Fake messages asking for your PIN" }],
        },
      },
      { type: "tutor_session", content: { scenarioId: "abc", title: "Existing AI Teacher" } },
    ],
    quizQuestions: [
      {
        question: "What should you do if an agent asks for your PIN?",
        options: ["Give it", "Hang up immediately"],
        correct_indices: [1],
        explanation: "Real agents never ask for your PIN.",
      },
    ],
  });

  assert.match(summary, /Never share your PIN/);
  assert.match(summary, /Video title: Spotting Scam Calls/);
  assert.match(summary, /Video description: How scammers pose as agents/);
  assert.match(summary, /Phishing: Fake messages asking for your PIN/);
  assert.match(summary, /What should you do if an agent asks for your PIN/);
  assert.match(summary, /Hang up immediately \[correct\]/);
  assert.doesNotMatch(summary, /Existing AI Teacher/);
});

test("buildObjectivesPrompt includes course, lesson, and material", () => {
  const { systemInstruction, prompt } = buildObjectivesPrompt({
    courseTitle: "Digital Finance 101",
    moduleTitle: "Module 1",
    lessonTitle: "Protecting Your Wallet",
    materialText: "Keep your PIN secret.",
  });
  assert.match(systemInstruction, /Learner can/);
  assert.match(prompt, /Digital Finance 101/);
  assert.match(prompt, /Protecting Your Wallet/);
  assert.match(prompt, /Keep your PIN secret/);
});

test("parseExtractedObjectives validates 2-5 objectives and normalizes ids", () => {
  const ok = parseExtractedObjectives(
    JSON.stringify({
      objectives: [
        { id: "obj 1", text: "Learner can explain why PINs stay private", evidence: "States two risks of sharing a PIN" },
        { id: "", text: "Learner can spot a fake agent message", evidence: "Identifies red flags in a sample SMS" },
        { id: "obj-3", text: "Learner can report fraud quickly", evidence: "Names the steps to freeze an account" },
      ],
    }),
  );
  assert.equal(ok.ok, true);
  if (ok.ok) {
    assert.equal(ok.objectives.length, 3);
    assert.equal(ok.objectives[0].id, "obj-1");
    assert.equal(ok.objectives[1].id, "obj-2");
  }

  const tooFew = parseExtractedObjectives({
    objectives: [{ id: "obj-1", text: "Learner can do one thing", evidence: "Shows it once" }],
  });
  assert.equal(tooFew.ok, false);
});
