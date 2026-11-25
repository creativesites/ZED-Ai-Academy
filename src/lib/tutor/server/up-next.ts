import "server-only";
import { createServiceClient } from "@/lib/supabase/server";
import { ZEDAI_TENANT_ID } from "@/lib/tenants/constants";
import { courseTeacher, DEFAULT_TEACHER_NAME, safeTeacherName } from "../course-teacher.ts";
import { loadDashboardDailyPlan } from "../mastery/server.ts";
import { personaLookFromVariant, type TutorPersonaLook, type TutorScenarioView } from "../tutor-session-block.ts";
import { pickUpNext, type UpNext, type UpNextSession } from "../up-next.ts";
import type { LearnerTutorOverview } from "./learner-overview.ts";

// Gathers the inputs for the "Up next with <Teacher>" card (P1-09). Server code uses the service role, so
// every query is scoped to the signed-in learner (and to the academy when one is given). Any failure
// degrades to fewer actions, never to an error page.

export type UpNextTeacher = {
  name: string;
  /** Persona look; undefined when we only know the name (the card then shows initials). */
  look?: Partial<TutorPersonaLook>;
  isDefault: boolean;
};

export type TeacherUpNextData = {
  teacher: UpNextTeacher;
  upNext: UpNext;
};

type PersonaRow = { name: string; display_name: string | null; rive_variant: unknown } | null;

async function loadDefaultPersona(companyId: string): Promise<PersonaRow> {
  const db = createServiceClient();
  const settings = await db
    .from("tutor_settings")
    .select("default_persona_id")
    .eq("company_id", companyId)
    .limit(1)
    .maybeSingle();
  const personaId = (settings.data as { default_persona_id?: string | null } | null)?.default_persona_id;
  if (settings.error || !personaId) return null;
  const persona = await db
    .from("ai_personas")
    .select("name, display_name, rive_variant, company_id")
    .eq("id", personaId)
    .maybeSingle();
  const row = persona.data as (PersonaRow & { company_id?: string | null }) | null;
  // Settings point at a persona of this academy (or a platform persona); never show another academy's.
  if (persona.error || !row) return null;
  if (row.company_id && row.company_id !== companyId && row.company_id !== ZEDAI_TENANT_ID) return null;
  return { name: row.name, display_name: row.display_name, rive_variant: row.rive_variant };
}

async function loadActiveSessions(userId: string, companyId: string | null, since: Date): Promise<UpNextSession[]> {
  const db = createServiceClient();
  let query = db
    .from("tutor_sessions")
    .select("id, scenario_id, started_at, practice_scenarios(title)")
    .eq("user_id", userId)
    .eq("status", "active")
    .gte("started_at", since.toISOString())
    .order("started_at", { ascending: false })
    .limit(5);
  if (companyId) query = query.eq("company_id", companyId);
  const { data, error } = await query;
  if (error || !data) return [];
  return (data as unknown as Array<{
    id: string;
    scenario_id: string | null;
    started_at: string;
    practice_scenarios: { title: string | null } | Array<{ title: string | null }> | null;
  }>).map((row) => {
    const scenario = Array.isArray(row.practice_scenarios) ? row.practice_scenarios[0] : row.practice_scenarios;
    return {
      sessionId: row.id,
      scenarioId: row.scenario_id,
      title: scenario?.title?.trim() || "Your last session",
      startedAt: row.started_at,
    };
  });
}

export async function loadTeacherUpNext(input: {
  userId: string;
  /** Academy scope; null on the platform hub. */
  companyId: string | null;
  academySlug: string | null;
  /** Already loaded by the page; pass it to avoid a second load. */
  overview?: LearnerTutorOverview | null;
  now?: Date;
}): Promise<TeacherUpNextData> {
  const now = input.now ?? new Date();
  const since = new Date(now.getTime() - 48 * 60 * 60 * 1000);

  const [plan, activeSessions, defaultPersona] = await Promise.all([
    // No basePath: pickUpNext scopes every href with academyHref.
    loadDashboardDailyPlan({ userId: input.userId, companyId: input.companyId }).catch(() => ({
      teacherName: DEFAULT_TEACHER_NAME,
      items: [],
    })),
    loadActiveSessions(input.userId, input.companyId, since).catch(() => [] as UpNextSession[]),
    input.companyId ? loadDefaultPersona(input.companyId).catch(() => null) : Promise.resolve(null),
  ]);

  const personaViews: Array<Pick<TutorScenarioView, "persona">> = defaultPersona
    ? [
        {
          persona: {
            name: defaultPersona.name,
            displayName: defaultPersona.display_name,
            look: personaLookFromVariant(defaultPersona.rive_variant),
          },
        },
      ]
    : [];
  const configured = courseTeacher(personaViews as TutorScenarioView[]);
  const configuredName = configured.isDefault ? null : safeTeacherName(configured.name);

  let teacher: UpNextTeacher;
  if (configuredName) {
    teacher = { name: configuredName, look: configured.look, isDefault: false };
  } else {
    const planName = safeTeacherName(plan.teacherName) ?? DEFAULT_TEACHER_NAME;
    // The plan may name a flow's persona; we have no look for it, so the card shows initials, not a wrong face.
    teacher = { name: planName, look: undefined, isDefault: planName === DEFAULT_TEACHER_NAME };
  }

  const overview = input.overview ?? null;
  const upNext = pickUpNext({
    academySlug: input.academySlug,
    teacherName: teacher.name,
    planItems: plan.items,
    activeSessions,
    assignments: (overview?.assignments ?? []).map((a) => ({
      assignmentId: a.assignmentId,
      scenarioId: a.scenarioId,
      title: a.title,
      dueAt: a.dueAt,
      completed: a.completed,
      maxMinutes: a.maxMinutes,
    })),
    dueCards: overview?.deck.dueNow ?? 0,
    now,
  });

  return { teacher, upNext };
}
