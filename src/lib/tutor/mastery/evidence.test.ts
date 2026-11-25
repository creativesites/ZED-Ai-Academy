import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  applyEvidenceBatch,
  collectNoteEvidence,
  formatMasteryMemoryNotes,
  nextMasteryLevel,
  normalizeObjectiveKey,
  summarizeSessionObjectives,
  type MasteryState,
} from "./evidence.ts";

describe("mastery/evidence", () => {
  it("normalizes objective keys deterministically within course or scenario scope", () => {
    const k1 = normalizeObjectiveKey("Compare Two Fractions!", {
      courseId: "c-1",
      scenarioId: "s-1",
    });
    const k2 = normalizeObjectiveKey("  compare   two fractions  ", {
      courseId: "c-1",
    });
    assert.equal(k1, "course:c-1:compare-two-fractions");
    assert.equal(k1, k2);

    const kScenario = normalizeObjectiveKey("Explain prompts", {
      scenarioId: "sc-9",
    });
    assert.equal(kScenario, "scenario:sc-9:explain-prompts");
  });

  it("updates mastery level (+1 correct, 0 partial, -1 misconception) clamped 0..3", () => {
    assert.equal(nextMasteryLevel(0, "correct"), 1);
    assert.equal(nextMasteryLevel(3, "correct"), 3);
    assert.equal(nextMasteryLevel(2, "partial"), 2);
    assert.equal(nextMasteryLevel(2, "misconception"), 1);
    assert.equal(nextMasteryLevel(0, "misconception"), 0);
  });

  it("collects note_evidence across turns and ignores non-evidence events", () => {
    const turns = [
      {
        eventsJson: [
          { type: "board", title: "Fractions", body: "1/2 = 2/4" },
          {
            type: "note_evidence",
            objective: "Find equivalent fractions",
            result: "partial",
            detail: "Recognised 1/2 = 2/4, hesitated on 2/3.",
          },
        ],
      },
      {
        eventsJson: [
          {
            type: "note_evidence",
            objective: "Find equivalent fractions",
            result: "correct",
            detail: "Solved 2/3 = 4/6 cleanly.",
          },
          {
            type: "note_evidence",
            objective: "Compare unlike denominators",
            result: "misconception",
            detail: "Compared denominators without finding a common unit.",
          },
        ],
      },
    ];

    const collected = collectNoteEvidence(turns, { courseId: "course-1" });
    assert.equal(collected.length, 3);
    assert.equal(collected[0].result, "partial");
    assert.equal(collected[1].result, "correct");
    assert.equal(collected[2].result, "misconception");
  });

  it("applies evidence batches sequentially onto prior mastery rows and summarizes outcomes", () => {
    const prior = new Map<string, MasteryState>([
      [
        "course:c-1:find-equivalent-fractions",
        {
          objectiveKey: "course:c-1:find-equivalent-fractions",
          objectiveText: "Find equivalent fractions",
          level: 1,
          evidenceCount: 2,
          lastResult: "partial",
          lastEvidenceAt: "2026-11-20T09:00:00Z",
        },
      ],
    ]);

    const batch = collectNoteEvidence(
      [
        {
          eventsJson: [
            {
              type: "note_evidence",
              objective: "Find equivalent fractions",
              result: "correct",
              detail: "Got 3/4 = 6/8 on first try.",
            },
            {
              type: "note_evidence",
              objective: "Compare unlike denominators",
              result: "misconception",
              detail: "Picked 1/5 > 1/3 because 5 > 3.",
            },
          ],
        },
      ],
      { courseId: "c-1" },
    );

    const updated = applyEvidenceBatch(prior, batch, "2026-11-21T10:00:00Z");
    assert.equal(updated.length, 2);
    const eq = updated.find((u) => u.objectiveText === "Find equivalent fractions");
    const cmp = updated.find((u) => u.objectiveText === "Compare unlike denominators");
    assert.equal(eq?.level, 2);
    assert.equal(eq?.evidenceCount, 3);
    assert.equal(cmp?.level, 0);
    assert.equal(cmp?.evidenceCount, 1);

    const summaries = summarizeSessionObjectives(batch, updated);
    assert.equal(summaries.length, 2);
    assert.equal(summaries[0].status, "met");
    assert.equal(summaries[0].masteryLevel, 2);
    assert.equal(summaries[1].status, "review");
    assert.equal(summaries[1].masteryLevel, 0);
    assert.ok(summaries[1].nextStep?.includes("Compare unlike denominators"));
  });

  it("formats memory notes prioritizing lowest mastery levels", () => {
    const notes = formatMasteryMemoryNotes([
      { objectiveText: "Strong skill", level: 3 },
      { objectiveText: "Almost there", level: 2 },
      { objectiveText: "Shaky concept", level: 0 },
    ]);
    assert.equal(notes.length, 2);
    assert.ok(notes[0].includes("Shaky concept"));
    assert.ok(notes[1].includes("Almost there"));
  });

  it("gives non-Latin objectives distinct, stable legacy keys (no more shared general-objective)", () => {
    const a = normalizeObjectiveKey("学习者能够用中文问候", { courseId: "c-1" });
    const b = normalizeObjectiveKey("学习者能够数到十", { courseId: "c-1" });
    assert.notEqual(a, b);
    assert.match(a, /^course:c-1:u-[0-9a-z]+$/);
    assert.equal(a, normalizeObjectiveKey("  学习者能够用中文问候！ ", { courseId: "c-1" }));
    // ASCII keys are unchanged, so existing mastery rows keep matching.
    assert.equal(normalizeObjectiveKey("Compare Two Fractions!", { courseId: "c-1" }), "course:c-1:compare-two-fractions");
    assert.equal(normalizeObjectiveKey("!!!", { courseId: "c-1" }), "course:c-1:general-objective");
  });

  it("maps note_evidence citing a registered objective id to that id (P2-01)", () => {
    const id = "11111111-1111-4111-8111-111111111111";
    const collected = collectNoteEvidence(
      [
        {
          eventsJson: [
            { type: "note_evidence", objective: id, result: "correct" },
            { type: "note_evidence", objective: "学习者能够数到十", result: "partial" },
            { type: "note_evidence", objective: "Something unlisted", result: "misconception" },
          ],
        },
      ],
      { courseId: "c-1" },
      [
        { id, text: "Learner can greet" },
        { id: "22222222-2222-4222-8222-222222222222", text: "学习者能够数到十" },
      ],
    );
    assert.equal(collected[0].objectiveKey, id);
    assert.equal(collected[0].objectiveId, id);
    assert.equal(collected[0].objectiveText, "Learner can greet");
    assert.equal(collected[0].source, "teacher_judgement");
    assert.equal(collected[0].serverVerified, false);
    assert.equal(collected[1].objectiveId, "22222222-2222-4222-8222-222222222222");
    assert.equal(collected[2].objectiveId, null);
    assert.equal(collected[2].objectiveKey, "course:c-1:something-unlisted");
  });
});
