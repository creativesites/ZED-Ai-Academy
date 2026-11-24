import type { Scenario, ScenarioBeat, ScenarioTargetItem } from "../scenario.ts";
import type { EvidenceResult } from "./evidence.ts";

export type MasteryCandidate = {
  objectiveKey: string;
  objectiveText: string;
  level: number;
  lastResult?: EvidenceResult | null;
  lastEvidenceAt?: string | null;
  courseId?: string | null;
};

export type DailyPlanLessonCandidate = {
  courseId: string;
  courseTitle: string;
  courseSlug: string;
  lessonId: string;
  lessonTitle: string;
  moduleTitle?: string | null;
  teacherName?: string | null;
  hasAiTeacherBlock: boolean;
};

export type DailyPlanFlowCandidate = {
  scenarioId: string;
  title: string;
  goal: string;
  maxMinutes: number;
  teacherName?: string | null;
  courseId?: string | null;
};

export type DailyPlanItem =
  | {
      id: string;
      kind: "revision_sprint";
      title: string;
      subtitle: string;
      durationMinutes: number;
      objectiveTexts: string[];
      ctaLabel: string;
      href: string;
    }
  | {
      id: string;
      kind: "unfinished_lesson";
      title: string;
      subtitle: string;
      courseTitle: string;
      durationMinutes: number;
      ctaLabel: string;
      href: string;
    }
  | {
      id: string;
      kind: "untried_flow";
      title: string;
      subtitle: string;
      durationMinutes: number;
      ctaLabel: string;
      href: string;
    };

/**
 * Selects up to `limit` weakest objectives (level <= 2), lowest level first,
 * breaking ties with recent misconception first, then oldest evidence timestamp.
 */
export function selectWeakObjectives(
  candidates: ReadonlyArray<MasteryCandidate>,
  limit = 3,
): MasteryCandidate[] {
  return [...candidates]
    .filter((c) => c.level <= 2 && c.objectiveText.trim().length > 0)
    .sort((a, b) => {
      if (a.level !== b.level) return a.level - b.level;
      const aMis = a.lastResult === "misconception" ? 0 : 1;
      const bMis = b.lastResult === "misconception" ? 0 : 1;
      if (aMis !== bMis) return aMis - bMis;
      const aTime = a.lastEvidenceAt ? Date.parse(a.lastEvidenceAt) : 0;
      const bTime = b.lastEvidenceAt ? Date.parse(b.lastEvidenceAt) : 0;
      return aTime - bTime;
    })
    .slice(0, Math.max(1, limit));
}

/**
 * Builds a synthetic 5-minute revision sprint scenario focused on up to 3 weak objectives.
 * Never mutates persisted practice_scenarios; run directly via the revision-sprint session route.
 */
export function buildRevisionSprintScenario(input: {
  personaId: string;
  teacherName: string;
  weakObjectives: ReadonlyArray<Pick<MasteryCandidate, "objectiveText" | "level">>;
  courseTitle?: string | null;
  focusObjective?: string | null;
}): Scenario {
  const ordered = [...input.weakObjectives]
    .map((o) => ({
      objectiveText: o.objectiveText.trim(),
      level: o.level,
    }))
    .filter((o) => o.objectiveText.length > 0);

  if (input.focusObjective?.trim()) {
    const focus = input.focusObjective.trim();
    const existingIdx = ordered.findIndex(
      (o) => o.objectiveText.toLowerCase() === focus.toLowerCase(),
    );
    if (existingIdx >= 0) {
      const [item] = ordered.splice(existingIdx, 1);
      ordered.unshift(item);
    } else {
      ordered.unshift({ objectiveText: focus, level: 0 });
    }
  }

  const picked = ordered.slice(0, 3);
  const targets =
    picked.length > 0
      ? picked
      : [
          {
            objectiveText: input.courseTitle
              ? `Core concepts in ${input.courseTitle}`
              : "Key ideas from your recent lessons",
            level: 1,
          },
        ];

  const beats: ScenarioBeat[] = targets.map((obj, idx) => ({
    id: `sprint_${idx + 1}`,
    goal:
      `Quick 90-second check on "${obj.objectiveText}": ` +
      `show one short worked clue on the board, ask the learner to solve or explain it, ` +
      `record note_evidence (objective="${obj.objectiveText}"), and resolve any misconception before advancing.`,
    targetItems: [obj.objectiveText],
  }));

  const target_items: ScenarioTargetItem[] = targets.map((obj) => ({
    text: obj.objectiveText,
    meaning: `Mastery level ${obj.level}/3 — build accuracy with one crisp check`,
  }));

  const title = input.courseTitle
    ? `5-min Revision Sprint · ${input.courseTitle}`
    : `5-min Revision Sprint with ${input.teacherName}`;

  return {
    skill_pack: "general-tutor",
    persona_id: input.personaId,
    title,
    goal:
      `Run a brisk 5-minute revision sprint targeting ${targets.length} weak objective(s): ` +
      targets.map((t) => t.objectiveText).join("; "),
    beats,
    target_items,
    max_minutes: 5,
    allowed_modes: ["voice", "text"],
    scene: "Scene_Classroom",
    visibility: "platform",
    style: "guided_lesson",
  };
}

/**
 * Picks 1-3 concrete items for the "Today with <teacher>" dashboard card.
 */
export function buildDailyPlan(input: {
  teacherName: string;
  basePath?: string;
  weakObjectives: ReadonlyArray<MasteryCandidate>;
  unfinishedLessons: ReadonlyArray<DailyPlanLessonCandidate>;
  untriedFlows: ReadonlyArray<DailyPlanFlowCandidate>;
}): DailyPlanItem[] {
  const base = (input.basePath ?? "").replace(/\/$/, "");
  const items: DailyPlanItem[] = [];

  const weak = selectWeakObjectives(
    input.weakObjectives.filter((o) => o.level <= 2),
    3,
  );
  if (weak.length > 0) {
    const firstCourseId = weak.find((w) => w.courseId)?.courseId;
    const sprintHref = firstCourseId
      ? `${base}/practice/sprint?courseId=${encodeURIComponent(firstCourseId)}`
      : `${base}/practice/sprint`;
    items.push({
      id: "daily-sprint",
      kind: "revision_sprint",
      title: `5-min revision sprint with ${input.teacherName}`,
      subtitle:
        weak.length === 1
          ? `Focus: ${weak[0].objectiveText}`
          : `${weak.length} objectives to sharpen, starting with ${weak[0].objectiveText}`,
      durationMinutes: 5,
      objectiveTexts: weak.map((w) => w.objectiveText),
      ctaLabel: "Start sprint",
      href: sprintHref,
    });
  }

  const preferredLesson =
    input.unfinishedLessons.find((l) => l.hasAiTeacherBlock) ??
    input.unfinishedLessons[0];
  if (preferredLesson) {
    items.push({
      id: `lesson-${preferredLesson.lessonId}`,
      kind: "unfinished_lesson",
      title: preferredLesson.lessonTitle,
      subtitle: preferredLesson.hasAiTeacherBlock
        ? `${preferredLesson.courseTitle} · Includes ${input.teacherName} check-in`
        : `${preferredLesson.courseTitle} · Continue where you left off`,
      courseTitle: preferredLesson.courseTitle,
      durationMinutes: 10,
      ctaLabel: "Continue lesson",
      href: `${base}/courses/${preferredLesson.courseSlug}/learn`,
    });
  }

  const nextFlow = input.untriedFlows[0];
  if (nextFlow && items.length < 3) {
    items.push({
      id: `flow-${nextFlow.scenarioId}`,
      kind: "untried_flow",
      title: nextFlow.title,
      subtitle: nextFlow.goal,
      durationMinutes: Math.max(3, Math.min(nextFlow.maxMinutes || 5, 15)),
      ctaLabel: "Try flow",
      href: `${base}/practice/${nextFlow.scenarioId}`,
    });
  }

  // If there's still room and a second untried flow, include it so up to 3 items show
  if (items.length < 3 && input.untriedFlows[1]) {
    const second = input.untriedFlows[1];
    items.push({
      id: `flow-${second.scenarioId}`,
      kind: "untried_flow",
      title: second.title,
      subtitle: second.goal,
      durationMinutes: Math.max(3, Math.min(second.maxMinutes || 5, 15)),
      ctaLabel: "Try flow",
      href: `${base}/practice/${second.scenarioId}`,
    });
  }

  return items.slice(0, 3);
}

export type PlanScenarioFacts = {
  companyId: string;
  visibility: string | null;
  courseId: string | null;
};

/**
 * Whether a published flow may be suggested to this learner in the daily plan. Platform flows are open to
 * everyone; academy-library flows only to members of that academy; course flows only to learners enrolled
 * in that course. When the plan is scoped to one academy, flows from other academies are never suggested.
 */
export function isPlanScenarioVisible(
  scenario: PlanScenarioFacts,
  learner: { memberCompanyIds: ReadonlySet<string>; enrolledCourseIds: ReadonlySet<string>; scopeCompanyId?: string | null },
): boolean {
  if (learner.scopeCompanyId && scenario.companyId !== learner.scopeCompanyId) return false;
  switch (scenario.visibility) {
    case "platform":
      return true;
    case "tenant_library":
      return learner.memberCompanyIds.has(scenario.companyId);
    case "course":
      return !!scenario.courseId && learner.enrolledCourseIds.has(scenario.courseId);
    default:
      return false;
  }
}
