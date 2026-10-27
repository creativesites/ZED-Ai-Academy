import { MODES, type Mode, type ScenarioVisibility, type SessionOrigin } from "./scenario.ts";

// Pure entitlement rules for starting a ZAI Tutor session (plan section 2.5).
// The server gathers the facts from Supabase; this file only decides. No I/O, no imports from "@/".

export type AccessDenyReason =
  | "scenario_not_found"
  | "scenario_not_published"
  | "not_tenant_member"
  | "tenant_inactive"
  | "not_enrolled"
  | "scenario_not_in_library"
  | "practice_disabled"
  | "free_minutes_exhausted"
  | "lesson_not_found"
  | "lesson_course_mismatch"
  | "assignment_not_found"
  | "assignment_scenario_mismatch"
  | "assignment_not_for_learner"
  | "persona_unavailable"
  | "no_modes_allowed";

export type TutorAccessFacts = {
  origin: SessionOrigin;
  scenario: {
    id: string;
    exists: boolean;
    status: "draft" | "published" | "archived";
    visibility: ScenarioVisibility;
    courseId: string | null;
    allowedModes: Mode[];
  };
  tenant: {
    /** Active membership in the tenant (company_members.status = active). */
    member: boolean;
    /** The tenant itself is active (companies.status = active). */
    active: boolean;
  };
  /**
   * Active enrollment in the course that governs this session: the lesson's course for lesson origin,
   * the scenario's course for assignment origin. null when no course is involved.
   */
  enrolledInCourse: boolean | null;
  lesson: null | { exists: boolean; courseId: string | null };
  assignment: null | {
    exists: boolean;
    scenarioId: string;
    companyId: string;
    groupId: string | null;
    learnerInGroup: boolean;
  };
  persona: null | { exists: boolean; active: boolean; id: string };
  settings: {
    practiceRoomEnabled: boolean;
    freePracticeMinutes: number;
    allowedModes: Mode[];
    enabledPersonaIds: string[] | null;
  };
  /** Learner speaking time (learner + teacher) in practice sessions this calendar month. */
  practiceUsedMs: number;
  /** Tenant the session would be recorded under. */
  companyId: string;
};

export type TutorAccessDecision =
  | { ok: true; allowedModes: Mode[]; liveMinutesLeft?: number }
  | { ok: false; reason: AccessDenyReason };

export const NOT_FOUND_REASONS: ReadonlySet<AccessDenyReason> = new Set<AccessDenyReason>([
  "scenario_not_found",
  "lesson_not_found",
  "assignment_not_found",
]);

/** Intersection of two mode lists, in canonical order (live, voice, text). */
export function intersectModes(a: readonly Mode[], b: readonly Mode[]): Mode[] {
  return MODES.filter((mode) => a.includes(mode) && b.includes(mode));
}

/** Free-practice minutes left this month. Never negative. */
export function remainingFreeMinutes(freeMinutesPerMonth: number, usedMs: number): number {
  const usedMinutes = Math.max(0, usedMs) / 60_000;
  return Math.max(0, freeMinutesPerMonth - usedMinutes);
}

/** ISO timestamp of 00:00:00 UTC on the first day of the month containing `now`. */
export function startOfMonthUtc(now: Date): string {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
}

export function decideTutorAccess(facts: TutorAccessFacts): TutorAccessDecision {
  const { origin, scenario, tenant, settings } = facts;

  if (!scenario.exists) return deny("scenario_not_found");
  if (scenario.status !== "published") return deny("scenario_not_published");
  if (!tenant.member) return deny("not_tenant_member");
  if (!tenant.active) return deny("tenant_inactive");

  let liveMinutesLeft: number | undefined;

  if (origin === "practice") {
    if (scenario.visibility === "course") return deny("scenario_not_in_library");
    if (!settings.practiceRoomEnabled) return deny("practice_disabled");
    const remaining = remainingFreeMinutes(settings.freePracticeMinutes, facts.practiceUsedMs);
    if (remaining <= 0) return deny("free_minutes_exhausted");
    liveMinutesLeft = remaining;
  } else if (origin === "lesson") {
    // Tutor-led lessons are part of the course the learner is enrolled in. Not capped by free practice.
    const lesson = facts.lesson;
    if (!lesson || !lesson.exists) return deny("lesson_not_found");
    if (scenario.visibility === "course" && scenario.courseId !== lesson.courseId) {
      return deny("lesson_course_mismatch");
    }
    if (lesson.courseId !== null && facts.enrolledInCourse !== true) return deny("not_enrolled");
  } else if (origin === "assignment") {
    const assignment = facts.assignment;
    if (!assignment || !assignment.exists) return deny("assignment_not_found");
    if (assignment.scenarioId !== scenario.id) {
      return deny("assignment_scenario_mismatch");
    }
    if (assignment.companyId !== facts.companyId) return deny("assignment_not_found");
    if (assignment.groupId !== null && !assignment.learnerInGroup) return deny("assignment_not_for_learner");
    if (scenario.courseId !== null && facts.enrolledInCourse !== true) return deny("not_enrolled");
  } else {
    return deny("scenario_not_in_library");
  }

  // Library and platform scenarios are open to any tenant member. Course scenarios are only reachable
  // through their lesson or assignment (handled above), and always need enrollment in their course.
  if (scenario.visibility === "course" && facts.enrolledInCourse !== true) return deny("not_enrolled");

  if (!facts.persona || !facts.persona.exists || !facts.persona.active) return deny("persona_unavailable");
  if (settings.enabledPersonaIds !== null && !settings.enabledPersonaIds.includes(facts.persona.id)) {
    return deny("persona_unavailable");
  }

  const allowedModes = intersectModes(scenario.allowedModes, settings.allowedModes);
  if (allowedModes.length === 0) return deny("no_modes_allowed");

  return liveMinutesLeft === undefined
    ? { ok: true, allowedModes }
    : { ok: true, allowedModes, liveMinutesLeft };
}

function deny(reason: AccessDenyReason): TutorAccessDecision {
  return { ok: false, reason };
}
