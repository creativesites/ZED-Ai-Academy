import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildStudyNotesMarkdown, slugifyFilename } from "./study-export.ts";

describe("tutor/study-export", () => {
  it("formats report, takeaways, and transcript into clean Markdown", () => {
    const md = buildStudyNotesMarkdown({
      title: "Executive Email Clarity",
      teacherName: "Tinashe",
      dateIso: "2026-11-24T12:00:00Z",
      report: {
        scores: { task: 88, clarity: 85 } as never,
        strengths: ["Clear call to action"],
        mistakes: [{ said: "Free tomorrow?", correct: "Are you free Tuesday at 2pm?", category: "clarity" }],
        nextStep: "Practice summarizing decisions in 2 bullets.",
      },
      savedTakeaways: [{ text: "BLUF", meaning: "Bottom Line Up Front" }],
      transcript: [
        { role: "teacher", text: "Let's tighten your opening line." },
        { role: "learner", text: "Sure, let's start with the decision." },
      ],
    });

    assert.match(md, /# Executive Email Clarity/);
    assert.match(md, /with Tinashe/);
    assert.match(md, /## What Went Well/);
    assert.match(md, /~~Free tomorrow\?~~ → \*\*Are you free Tuesday at 2pm\?\*\*/);
    assert.match(md, /\*\*BLUF\*\* — Bottom Line Up Front/);
    assert.match(md, /\*\*You:\*\* Sure, let's start with the decision\./);
  });

  it("creates clean safe filenames", () => {
    assert.equal(slugifyFilename("Gross Margin & Cashflow 101!"), "gross-margin-cashflow-101.md");
    assert.equal(slugifyFilename("   "), "ai-teacher-notes.md");
  });
});
