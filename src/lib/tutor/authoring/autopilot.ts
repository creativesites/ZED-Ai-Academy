import type { AuthoringTemplateId } from "./templates.ts";

export const AUTOPILOT_MAX_BATCH = 6;

export type AutopilotLessonCandidate = {
  lessonId: string;
  lessonTitle: string;
  moduleTitle: string;
  hasExistingTutorBlock: boolean;
  materialBlockCount: number;
};

export type AutopilotPlan = {
  selected: AutopilotLessonCandidate[];
  skippedAlreadyConfigured: number;
  skippedEmpty: number;
  remainingPendingCount: number;
};

/**
 * Selects up to `maxBatch` lessons that contain teachable material and do not yet
 * have an AI Teacher flow (`tutor_session` block or `teacher_moments`).
 */
export function selectAutopilotLessons(
  candidates: ReadonlyArray<AutopilotLessonCandidate>,
  options: {
    requestedLessonIds?: ReadonlyArray<string>;
    maxBatch?: number;
  } = {},
): AutopilotPlan {
  const cap = Math.max(1, Math.min(options.maxBatch ?? AUTOPILOT_MAX_BATCH, 12));
  const requestedSet = options.requestedLessonIds?.length
    ? new Set(options.requestedLessonIds)
    : null;

  let skippedAlreadyConfigured = 0;
  let skippedEmpty = 0;
  const eligible: AutopilotLessonCandidate[] = [];

  for (const c of candidates) {
    if (requestedSet && !requestedSet.has(c.lessonId)) continue;
    if (c.hasExistingTutorBlock) {
      skippedAlreadyConfigured += 1;
      continue;
    }
    if (c.materialBlockCount === 0) {
      skippedEmpty += 1;
      continue;
    }
    eligible.push(c);
  }

  return {
    selected: eligible.slice(0, cap),
    skippedAlreadyConfigured,
    skippedEmpty,
    remainingPendingCount: Math.max(0, eligible.length - cap),
  };
}

/**
 * Picks a sensible template when running autopilot if the creator leaves it on auto.
 */
export function resolveAutopilotTemplate(
  preferred: AuthoringTemplateId | "auto" | undefined,
  lessonTitle: string,
): AuthoringTemplateId {
  if (preferred && preferred !== "auto") return preferred;
  const lower = lessonTitle.toLowerCase();
  if (/(example|walkthrough|formula|calc|budget|math)/.test(lower)) return "worked_example";
  if (/(role|practice|customer|patient|interview|call)/.test(lower)) return "role_play";
  if (/(review|revision|recap|summary)/.test(lower)) return "revision_sprint";
  if (/(viva|oral|assess|defense|defend)/.test(lower)) return "oral_check";
  return "explain_check";
}
