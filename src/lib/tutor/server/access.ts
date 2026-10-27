import "server-only";
import { createServiceClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";
import {
  decideTutorAccess,
  NOT_FOUND_REASONS,
  startOfMonthUtc,
  type AccessDenyReason,
  type TutorAccessFacts,
} from "../entitlements.ts";
import type { Mode, SessionOrigin } from "../scenario.ts";

// Loads the facts for entitlements.ts and applies them. All DB reads use the service client;
// the authorization decision is made here, from the verified Clerk user id.

type ScenarioRow = Database["public"]["Tables"]["practice_scenarios"]["Row"];
type PersonaRow = Database["public"]["Tables"]["ai_personas"]["Row"];
type SettingsRow = Database["public"]["Tables"]["tutor_settings"]["Row"];

export type ResolvedTutorAccess =
  | {
      ok: true;
      companyId: string;
      scenario: ScenarioRow;
      persona: PersonaRow;
      allowedModes: Mode[];
      /** Free-practice minutes left this month. Only set for the practice origin. */
      liveMinutesLeft?: number;
      lessonId: string | null;
      assignmentId: string | null;
    }
  | { ok: false; reason: AccessDenyReason; status: 403 | 404 };

export type ResolveTutorAccessInput = {
  userId: string;
  scenarioId?: string;
  origin: SessionOrigin;
  lessonId?: string;
  assignmentId?: string;
};

const STAFF_ROLES = ["company_admin", "teacher", "instructor"];

export const DEFAULT_TUTOR_SETTINGS = {
  practice_room_enabled: true,
  free_practice_minutes_per_month: 60,
  allowed_modes: ["live", "voice", "text"] as Mode[],
  enabled_persona_ids: null as string[] | null,
};

export async function resolveTutorAccess(input: ResolveTutorAccessInput): Promise<ResolvedTutorAccess> {
  const supabase = createServiceClient();
  const deny = (reason: AccessDenyReason): ResolvedTutorAccess => ({
    ok: false,
    reason,
    status: NOT_FOUND_REASONS.has(reason) ? 404 : 403,
  });

  // 1. Assignment and lesson context.
  const { data: assignment } = input.assignmentId
    ? await supabase
        .from("tutor_assignments")
        .select("id, company_id, scenario_id, group_id")
        .eq("id", input.assignmentId)
        .maybeSingle()
    : { data: null };

  let learnerInGroup = false;
  if (assignment?.group_id) {
    const { data: membership } = await supabase
      .from("classroom_group_members")
      .select("group_id")
      .eq("group_id", assignment.group_id)
      .eq("profile_id", input.userId)
      .maybeSingle();
    learnerInGroup = !!membership;
  }

  let lesson: { exists: boolean; courseId: string | null } | null = null;
  if (input.lessonId) {
    const { data: lessonRow } = await supabase
      .from("lessons")
      .select("id, module_id")
      .eq("id", input.lessonId)
      .maybeSingle();
    if (!lessonRow) {
      lesson = { exists: false, courseId: null };
    } else {
      const { data: moduleRow } = await supabase
        .from("modules")
        .select("course_id")
        .eq("id", lessonRow.module_id)
        .maybeSingle();
      lesson = { exists: true, courseId: moduleRow?.course_id ?? null };
    }
  }

  // 2. Scenario: explicit, else the assignment's, else the newest published one for the lesson.
  let scenarioId = input.scenarioId ?? assignment?.scenario_id ?? null;
  if (!scenarioId && input.lessonId) {
    const { data: latest } = await supabase
      .from("practice_scenarios")
      .select("id")
      .eq("lesson_id", input.lessonId)
      .eq("status", "published")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    scenarioId = latest?.id ?? null;
  }
  if (!scenarioId) return deny("scenario_not_found");

  const { data: scenario } = await supabase.from("practice_scenarios").select("*").eq("id", scenarioId).maybeSingle();
  if (!scenario) return deny("scenario_not_found");

  // 3. Tenant the session runs under.
  //  - lesson: the lesson's course tenant (learners need no membership row; staff may preview).
  //  - practice/assignment with a platform scenario: the learner's profile tenant when active, else any
  //    active membership, else (practice only) the platform tenant, on its settings.
  //  - otherwise: the scenario's own tenant, which the learner must be an active member of.
  const [{ data: profile }, { data: memberships }, { data: platform }] = await Promise.all([
    supabase.from("profiles").select("company_id").eq("id", input.userId).maybeSingle(),
    supabase.from("company_members").select("company_id, role").eq("profile_id", input.userId).eq("status", "active"),
    supabase.from("companies").select("id").eq("slug", "zedai").maybeSingle(),
  ]);
  const platformId = platform?.id ?? null;
  const activeRoles = new Map((memberships ?? []).map((m) => [m.company_id, m.role as string]));

  let companyId: string | null;
  let fallback = false;
  if (input.origin === "lesson") {
    const { data: course } = lesson?.courseId
      ? await supabase.from("courses").select("company_id").eq("id", lesson.courseId).maybeSingle()
      : { data: null };
    companyId = course?.company_id ?? platformId;
  } else if (scenario.visibility === "platform") {
    if (profile?.company_id && activeRoles.has(profile.company_id)) companyId = profile.company_id;
    else if (memberships && memberships.length > 0) companyId = memberships[0].company_id;
    else if (input.origin === "practice") {
      companyId = platformId;
      fallback = true;
    } else companyId = profile?.company_id ?? null;
  } else {
    companyId = scenario.company_id;
  }
  if (!companyId) return deny("not_tenant_member");

  const member = fallback || activeRoles.has(companyId);
  const staff = STAFF_ROLES.includes(activeRoles.get(companyId) ?? "");
  const { data: company } = await supabase.from("companies").select("status").eq("id", companyId).maybeSingle();

  // 4. Enrollment in the course that governs this session.
  const governingCourseId =
    input.origin === "lesson" ? lesson?.courseId ?? null : input.origin === "assignment" ? scenario.course_id : null;
  let enrolledInCourse: boolean | null = null;
  if (governingCourseId) {
    const { data: enrollment } = await supabase
      .from("enrollments")
      .select("id")
      .eq("user_id", input.userId)
      .eq("course_id", governingCourseId)
      .eq("status", "active")
      .maybeSingle();
    enrolledInCourse = !!enrollment;
  }

  // 5. Persona and tenant settings.
  const { data: persona } = scenario.persona_id
    ? await supabase
        .from("ai_personas")
        .select("*")
        .eq("id", scenario.persona_id)
        .maybeSingle()
    : { data: null };

  const { data: settingsRow } = await supabase
    .from("tutor_settings")
    .select("*")
    .eq("company_id", companyId)
    .maybeSingle();
  const settings = resolveSettings(settingsRow);

  // 6. Free-practice usage this calendar month (practice origin only).
  let practiceUsedMs = 0;
  if (input.origin === "practice") {
    const { data: sessions } = await supabase
      .from("tutor_sessions")
      .select("learner_speaking_ms, teacher_speaking_ms")
      .eq("company_id", companyId)
      .eq("user_id", input.userId)
      .eq("origin", "practice")
      .gte("started_at", startOfMonthUtc(new Date()));
    practiceUsedMs = (sessions ?? []).reduce(
      (sum, s) => sum + s.learner_speaking_ms + s.teacher_speaking_ms,
      0,
    );
  }

  const facts: TutorAccessFacts = {
    origin: input.origin,
    scenario: {
      id: scenario.id,
      exists: true,
      status: scenario.status,
      visibility: scenario.visibility,
      courseId: scenario.course_id,
      companyId: scenario.company_id,
      allowedModes: scenario.allowed_modes,
    },
    tenant: {
      member,
      active: company?.status === "active",
      staff,
      fallback,
    },
    enrolledInCourse,
    lesson,
    assignment: assignment
      ? {
          exists: true,
          scenarioId: assignment.scenario_id,
          companyId: assignment.company_id,
          groupId: assignment.group_id,
          learnerInGroup,
        }
      : input.assignmentId
        ? { exists: false, scenarioId: "", companyId: "", groupId: null, learnerInGroup: false }
        : null,
    persona: persona ? { exists: true, active: persona.is_active, id: persona.id } : null,
    settings,
    practiceUsedMs,
    companyId,
  };

  const decision = decideTutorAccess(facts);
  if (!decision.ok) return deny(decision.reason);

  return {
    ok: true,
    companyId,
    scenario,
    persona: persona as PersonaRow,
    allowedModes: decision.allowedModes,
    liveMinutesLeft: decision.liveMinutesLeft,
    lessonId: input.lessonId ?? null,
    assignmentId: assignment?.id ?? null,
  };
}

/** Tenant settings with defaults applied when the tenant has no row. */
export function resolveSettings(row: SettingsRow | null): TutorAccessFacts["settings"] {
  return {
    practiceRoomEnabled: row?.practice_room_enabled ?? DEFAULT_TUTOR_SETTINGS.practice_room_enabled,
    freePracticeMinutes: row?.free_practice_minutes_per_month ?? DEFAULT_TUTOR_SETTINGS.free_practice_minutes_per_month,
    allowedModes: (row?.allowed_modes as Mode[] | undefined) ?? DEFAULT_TUTOR_SETTINGS.allowed_modes,
    enabledPersonaIds: row?.enabled_persona_ids ?? DEFAULT_TUTOR_SETTINGS.enabled_persona_ids,
  };
}
