import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildDailyPlan,
  buildRevisionSprintScenario,
  selectWeakObjectives,
} from "./sprint.ts";

describe("mastery/sprint", () => {
  it("picks up to 3 weakest objectives sorted by lowest level and misconception priority", () => {
    const picked = selectWeakObjectives([
      { objectiveKey: "k1", objectiveText: "Mastered", level: 3 },
      {
        objectiveKey: "k2",
        objectiveText: "Nearly there",
        level: 2,
        lastResult: "partial",
      },
      {
        objectiveKey: "k3",
        objectiveText: "Mixes up prompts",
        level: 1,
        lastResult: "misconception",
      },
      {
        objectiveKey: "k4",
        objectiveText: "Fractions basics",
        level: 0,
        lastResult: "misconception",
      },
      {
        objectiveKey: "k5",
        objectiveText: "Loop bounds",
        level: 1,
        lastResult: "partial",
      },
    ]);

    assert.equal(picked.length, 3);
    assert.equal(picked[0].objectiveText, "Fractions basics");
    assert.equal(picked[1].objectiveText, "Mixes up prompts");
    assert.equal(picked[2].objectiveText, "Loop bounds");
  });

  it("builds a 5-minute Scene_Classroom revision sprint with focusObjective pinned first", () => {
    const scenario = buildRevisionSprintScenario({
      personaId: "persona-tinashe",
      teacherName: "Tinashe",
      courseTitle: "AI Teacher Test Drive",
      focusObjective: "Use few-shot examples",
      weakObjectives: [
        { objectiveText: "Write clear constraints", level: 1 },
        { objectiveText: "Verify AI output", level: 0 },
      ],
    });

    assert.equal(scenario.skill_pack, "general-tutor");
    assert.equal(scenario.style, "guided_lesson");
    assert.equal(scenario.scene, "Scene_Classroom");
    assert.equal(scenario.max_minutes, 5);
    assert.equal(scenario.beats.length, 3);
    assert.deepEqual(scenario.beats[0].targetItems, ["Use few-shot examples"]);
    assert.ok(scenario.beats[0].goal.includes("note_evidence"));
  });

  it("builds a 1-3 item daily plan with tenant basePath support", () => {
    const plan = buildDailyPlan({
      teacherName: "Tinashe",
      basePath: "/academy/glory-academy",
      weakObjectives: [
        {
          objectiveKey: "course:c1:fractions",
          objectiveText: "Compare fractions",
          level: 0,
          courseId: "c1",
        },
      ],
      unfinishedLessons: [
        {
          courseId: "c1",
          courseTitle: "AI Teacher Test Drive",
          courseSlug: "ai-teacher-test-drive",
          lessonId: "l1",
          lessonTitle: "Lesson 1: Fractions",
          hasAiTeacherBlock: false,
        },
        {
          courseId: "c1",
          courseTitle: "AI Teacher Test Drive",
          courseSlug: "ai-teacher-test-drive",
          lessonId: "l2",
          lessonTitle: "Lesson 2: Practice",
          hasAiTeacherBlock: true,
        },
      ],
      untriedFlows: [
        {
          scenarioId: "sc-1",
          title: "Oral check: what is AI?",
          goal: "Explain AI in plain words",
          maxMinutes: 5,
        },
      ],
    });

    assert.equal(plan.length, 3);
    assert.equal(plan[0].kind, "revision_sprint");
    assert.equal(
      plan[0].href,
      "/academy/glory-academy/practice/sprint?courseId=c1",
    );
    assert.equal(plan[1].kind, "unfinished_lesson");
    assert.equal(plan[1].title, "Lesson 2: Practice");
    assert.equal(plan[2].kind, "untried_flow");
    assert.equal(plan[2].href, "/academy/glory-academy/practice/sc-1");
  });
});
