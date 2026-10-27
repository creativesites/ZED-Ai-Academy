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
    /** The tenant that owns the scenario row (companies.id). */
    companyId?: string;
    allowedModes: Mode[];
  };
  tenant: {
    /** Active membership in the session tenant (company_members.status = active). */
    member: boolean;
    /** The tenant itself is active (companies.status = active). */
    active: boolean;
    /** Active company_admin, teacher or instructor of the session tenant. Lesson origin only. */
    staff?: boolean;
    /**
     * The learner has no active membership anywhere, so a practice session runs under the platform
     * tenant (companies.slug = 'zedai') with its settings. Only platform scenarios are allowed then.
     */
    fallback?: boolean;
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

  let liveMinutesLeft: number | undefined;

  if (origin === "lesson") {
    // Tutor-led lesson. The session tenant is the lesson's course tenant (facts.companyId). An enrolled
    // learner needs no company_members row; active staff of that tenant may preview without enrolling.
    // Not capped by free practice.
    const lesson = facts.lesson;
    if (!lesson || !lesson.exists) return deny("lesson_not_found");
    if (facts.enrolledInCourse !== true && tenant.staff !== true) return deny("not_enrolled");
    if (!tenant.active) return deny("tenant_inactive");
    if (scenario.visibility === "course" && scenario.courseId !== lesson.courseId) {
      return deny("lesson_course_mismatch");
    }
    // A tenant library scenario must belong to the course's tenant. Platform scenarios are open to all.
    if (scenario.visibility === "tenant_library" && scenario.companyId !== facts.companyId) {
      return deny("scenario_not_in_library");
    }
  } else if (origin === "practice") {
    if (!tenant.member) return deny("not_tenant_member");
    if (!tenant.active) return deny("tenant_inactive");
    // Without any membership, only the platform starter packs are open (on the platform tenant's settings).
    if (tenant.fallback === true && scenario.visibility !== "platform") return deny("not_tenant_member");
    if (scenario.visibility === "course") return deny("scenario_not_in_library");
    if (!settings.practiceRoomEnabled) return deny("practice_disabled");
    const remaining = remainingFreeMinutes(settings.freePracticeMinutes, facts.practiceUsedMs);
    if (remaining <= 0) return deny("free_minutes_exhausted");
    liveMinutesLeft = remaining;
  } else if (origin === "assignment") {
    if (!tenant.member) return deny("not_tenant_member");
    if (!tenant.active) return deny("tenant_inactive");
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
