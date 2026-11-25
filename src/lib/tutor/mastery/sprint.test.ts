import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildDailyPlan,
  buildRevisionSprintScenario,
  isPlanScenarioVisible,
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

describe("isPlanScenarioVisible", () => {
  const learner = {
    memberCompanyIds: new Set(["orgA"]),
    enrolledCourseIds: new Set(["courseA"]),
  };

  it("offers platform flows to everyone", () => {
    assert.equal(isPlanScenarioVisible({ companyId: "orgZ", visibility: "platform", courseId: null }, learner), true);
  });

  it("offers academy-library flows only to members", () => {
    assert.equal(isPlanScenarioVisible({ companyId: "orgA", visibility: "tenant_library", courseId: null }, learner), true);
    assert.equal(isPlanScenarioVisible({ companyId: "orgB", visibility: "tenant_library", courseId: null }, learner), false);
  });

  it("offers course flows only to enrolled learners", () => {
    assert.equal(isPlanScenarioVisible({ companyId: "orgA", visibility: "course", courseId: "courseA" }, learner), true);
    assert.equal(isPlanScenarioVisible({ companyId: "orgA", visibility: "course", courseId: "courseX" }, learner), false);
    assert.equal(isPlanScenarioVisible({ companyId: "orgA", visibility: "course", courseId: null }, learner), false);
  });

  it("keeps an academy-scoped plan inside that academy", () => {
    const scoped = { ...learner, scopeCompanyId: "orgA" };
    assert.equal(isPlanScenarioVisible({ companyId: "orgZ", visibility: "platform", courseId: null }, scoped), false);
    assert.equal(isPlanScenarioVisible({ companyId: "orgA", visibility: "tenant_library", courseId: null }, scoped), true);
  });

  it("rejects unknown visibility", () => {
    assert.equal(isPlanScenarioVisible({ companyId: "orgA", visibility: null, courseId: null }, learner), false);
  });
});

describe("buildDailyPlan with the review scheduler (P2-07)", () => {
  const weakObjectives = [{ objectiveKey: "k", objectiveText: "Weak legacy", level: 0, courseId: "c1" }];
  const dueReviews = {
    available: true,
    count: 4,
    label: "2 reviews due · 2 cards due",
    href: "/academy/a/practice/sprint?courseId=c1",
    estimatedMinutes: 5,
    objectives: [{ text: "Equivalent fractions" }, { text: "Ratios" }],
  };

  it("uses due reviews instead of the 3 weakest when the scheduler is available", () => {
    const plan = buildDailyPlan({
      teacherName: "Tinashe",
      weakObjectives,
      unfinishedLessons: [],
      untriedFlows: [],
      dueReviews,
    });
    assert.equal(plan[0].kind, "revision_sprint");
    assert.equal(plan[0].href, dueReviews.href);
    assert.equal(plan[0].title, "5-min revision with Tinashe");
    assert.deepEqual(plan[0].kind === "revision_sprint" ? plan[0].objectiveTexts : [], ["Equivalent fractions", "Ratios"]);
  });

  it("shows no revision item when the scheduler says nothing is due", () => {
    const plan = buildDailyPlan({
      teacherName: "Tinashe",
      weakObjectives,
      unfinishedLessons: [],
      untriedFlows: [],
      dueReviews: { ...dueReviews, count: 0, objectives: [] },
    });
    assert.equal(plan.length, 0);
  });

  it("falls back to the weakest objectives when the scheduler is unavailable", () => {
    const plan = buildDailyPlan({
      teacherName: "Tinashe",
      weakObjectives,
      unfinishedLessons: [],
      untriedFlows: [],
      dueReviews: { ...dueReviews, available: false },
    });
    assert.equal(plan[0].kind, "revision_sprint");
    assert.match(plan[0].subtitle, /Weak legacy/);
  });
});
