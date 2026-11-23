import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildCourseVivaPrompt, evaluateVivaOutcome } from "./viva.ts";

describe("tutor/viva", () => {
  it("passes viva when there are zero review objectives and majority are met", () => {
    const res = evaluateVivaOutcome({
      objectives: [
        { status: "met" },
        { status: "met" },
        { status: "partial" },
      ],
    });
    assert.equal(res.passed, true);
    assert.equal(res.metCount, 2);
  });

  it("fails viva when any objective still needs review", () => {
    const res = evaluateVivaOutcome({
      objectives: [
        { status: "met" },
        { status: "review" },
      ],
    });
    assert.equal(res.passed, false);
    assert.ok(res.reason.includes("review"));
  });

  it("falls back cleanly to task score >= 65 when no note_evidence objectives exist", () => {
    assert.equal(evaluateVivaOutcome({ scores: { task: 70 } }).passed, true);
    assert.equal(evaluateVivaOutcome({ scores: { task: 50 } }).passed, false);
    assert.equal(evaluateVivaOutcome({}).passed, false);
  });

  it("builds a structured course viva drafting prompt", () => {
    const prompt = buildCourseVivaPrompt({
      courseTitle: "Practical AI for Farmers",
      courseDescription: "Use AI tools for planning & pricing.",
      teacherName: "Tinashe",
      lessonSummaries: [{ title: "Crop planning", summary: "Prompt with season & soil" }],
    });
    assert.ok(prompt.includes("oral_check"));
    assert.ok(prompt.includes("Tinashe"));
    assert.ok(prompt.includes("Crop planning"));
  });
});
