import "server-only";
import { createServiceClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";
import { getLessonAccess } from "@/lib/courses/course-auth-server";
import { ZEDAI_TENANT_ID } from "@/lib/tenants/constants";
import { courseTenantId } from "../../authz/refs.ts";
import { isSchemaUnavailableError } from "../mastery/server.ts";
import {
  ASK_MAX_MINUTES,
  askResumeDecision,
  buildAskScenario,
  clientTurnsFromRows,
  type AskClientTurn,
} from "../runtime/ask.ts";
import { countRecentSessionStarts, SESSION_STARTS_PER_HOUR } from "./session-store.ts";

// The lesson Ask dock on the Teacher Runtime (P1-06): one `ask` session per learner + lesson, created or resumed
// here; and the synthetic scenario an `ask` session runs (it has no authored flow). Service-role reads; every rule
// is applied in code: lesson access via the dock's existing rule (`getLessonAccess`: active enrollment, the first
// module while payment is pending, or course staff), tenant from the course, never from the client.

type Tables = Database["public"]["Tables"];
type TutorSessionRow = Tables["tutor_sessions"]["Row"];
type ScenarioRow = Tables["practice_scenarios"]["Row"];
type PersonaRow = Tables["ai_personas"]["Row"];
type Db = ReturnType<typeof createServiceClient>;

const RATE_WINDOW_MS = 60 * 60_000;

export type AskSessionResult =
  | { ok: true; session: TutorSessionRow; turns: AskClientTurn[]; created: boolean }
  | { ok: false; status: 403 | 404 | 429 | 500 | 503; reason: string };

/** True when an error means the `ask` origin cannot be stored yet (table/column missing or the origin check fails). */
export function isAskSchemaUnavailable(error: { code?: string | null; message?: string | null } | null | undefined): boolean {
  if (!error) return false;
  if (isSchemaUnavailableError(error)) return true;
  return error.code === "23514" && /origin/i.test(error.message ?? "");
}

async function latestActiveAskSession(db: Db, userId: string, lessonId: string) {
  return db
    .from("tutor_sessions")
    .select("*")
    .eq("user_id", userId)
    .eq("lesson_id", lessonId)
    .eq("origin", "ask")
    .eq("status", "active")
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();
}

async function loadTurns(db: Db, sessionId: string) {
  return db.from("tutor_turns").select("idx, learner_text, events").eq("session_id", sessionId).order("idx", { ascending: true });
}

/**
 * Every turn of an `ask` session re-checks lesson access (an enrollment can end while the conversation is open).
 * Other origins are not affected.
 */
export async function askTurnAllowed(session: Pick<TutorSessionRow, "origin" | "lesson_id">, userId: string): Promise<boolean> {
  if (session.origin !== "ask") return true;
  if (!session.lesson_id) return false;
  const access = await getLessonAccess(createServiceClient(), session.lesson_id, userId);
  return access.allowed;
}

/** Finds the learner's open Ask conversation for a lesson, or starts one. `restart` closes the open one first. */
export async function findOrCreateAskSession(input: {
  userId: string;
  lessonId: string;
  restart?: boolean;
}): Promise<AskSessionResult> {
  const db = createServiceClient();

  const access = await getLessonAccess(db, input.lessonId, input.userId);
  if (!access.courseId) return { ok: false, status: 404, reason: "lesson_not_found" };
  if (!access.allowed) return { ok: false, status: 403, reason: "not_enrolled" };

  const { data: course } = await db.from("courses").select("company_id").eq("id", access.courseId).maybeSingle();
  if (!course) return { ok: false, status: 404, reason: "course_not_found" };
  const tenantId = courseTenantId(course.company_id, ZEDAI_TENANT_ID);

  const existing = await latestActiveAskSession(db, input.userId, input.lessonId);
  if (existing.error) {
    if (isAskSchemaUnavailable(existing.error)) return { ok: false, status: 503, reason: "schema_unavailable" };
    console.error("[tutor/ask] could not load ask session:", existing.error.message);
    return { ok: false, status: 500, reason: "load_failed" };
  }

  let session: TutorSessionRow | null = existing.data ?? null;
  if (session) {
    const { data: turnRows, error: turnsError } = await loadTurns(db, session.id);
    if (turnsError) {
      console.error("[tutor/ask] could not load ask turns:", turnsError.message);
      return { ok: false, status: 500, reason: "load_failed" };
    }
    const decision = askResumeDecision({
      session: { status: session.status, startedAtMs: Date.parse(session.started_at), companyId: session.company_id },
      turnCount: turnRows?.length ?? 0,
      nowMs: Date.now(),
      tenantId,
      restart: input.restart,
    });
    if (decision === "resume") {
      return { ok: true, session, turns: clientTurnsFromRows(turnRows ?? []), created: false };
    }
    await db
      .from("tutor_sessions")
      .update({ status: "completed", ended_at: new Date().toISOString() })
      .eq("id", session.id)
      .eq("status", "active");
    session = null;
  }

  if ((await countRecentSessionStarts(input.userId, RATE_WINDOW_MS)) >= SESSION_STARTS_PER_HOUR) {
    return { ok: false, status: 429, reason: "rate_limited" };
  }

  const inserted = await db
    .from("tutor_sessions")
    .insert({
      company_id: tenantId,
      user_id: input.userId,
      scenario_id: null,
      origin: "ask",
      lesson_id: input.lessonId,
      mode: "text",
      status: "active",
    })
    .select("*")
    .single();

  if (inserted.error) {
    // Another tab created it first (partial unique index from 20261125000600): resume that one.
    if (inserted.error.code === "23505") {
      const again = await latestActiveAskSession(db, input.userId, input.lessonId);
      if (again.data) {
        const { data: turnRows } = await loadTurns(db, again.data.id);
        return { ok: true, session: again.data, turns: clientTurnsFromRows(turnRows ?? []), created: false };
      }
    }
    if (isAskSchemaUnavailable(inserted.error)) return { ok: false, status: 503, reason: "schema_unavailable" };
    console.error("[tutor/ask] could not create ask session:", inserted.error.message);
    return { ok: false, status: 500, reason: "create_failed" };
  }

  return { ok: true, session: inserted.data, turns: [], created: true };
}

/**
 * The scenario, persona and role notes of an `ask` session, built from its lesson (it has no authored flow).
 * Persona: the teacher of the lesson's (else the course's) newest published flow, so the dock and the lesson's
 * teacher moments are the same character; else the tenant default (`resolveDefaultPersona`, injected to avoid an
 * import cycle with session-context.ts).
 */
export async function loadAskContext(
  db: Db,
  session: TutorSessionRow,
  resolveDefaultPersona: (db: Db, companyId: string) => Promise<PersonaRow>,
): Promise<{ scenario: ScenarioRow; persona: PersonaRow; courseId: string | null; roleNotes: string }> {
  const lessonId = session.lesson_id;
  const { data: lesson } = lessonId
    ? await db.from("lessons").select("title, module_id").eq("id", lessonId).maybeSingle()
    : { data: null };
  const { data: mod } = lesson?.module_id
    ? await db.from("modules").select("course_id").eq("id", lesson.module_id).maybeSingle()
    : { data: null };
  const courseId = mod?.course_id ?? null;

  const [{ data: course }, { data: blocks }, { data: lessonFlow }, { data: courseFlow }] = await Promise.all([
    courseId
      ? db.from("courses").select("title").eq("id", courseId).maybeSingle()
      : Promise.resolve({ data: null as { title: string } | null }),
    lessonId
      ? db.from("content_blocks").select("id, type, content").eq("lesson_id", lessonId).order("position", { ascending: true })
      : Promise.resolve({ data: [] as { id: string; type: string; content: unknown }[] }),
    lessonId
      ? db
          .from("practice_scenarios")
          .select("persona_id")
          .eq("lesson_id", lessonId)
          .eq("status", "published")
          .not("persona_id", "is", null)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle()
      : Promise.resolve({ data: null as { persona_id: string | null } | null }),
    courseId
      ? db
          .from("practice_scenarios")
          .select("persona_id")
          .eq("course_id", courseId)
          .eq("status", "published")
          .not("persona_id", "is", null)
          .order("created_at", { ascending: true })
          .limit(1)
          .maybeSingle()
      : Promise.resolve({ data: null as { persona_id: string | null } | null }),
  ]);

  let persona: PersonaRow | null = null;
  const personaId = lessonFlow?.persona_id ?? courseFlow?.persona_id ?? null;
  if (personaId) {
    const { data } = await db.from("ai_personas").select("*").eq("id", personaId).maybeSingle();
    persona = data ?? null;
  }
  if (!persona) persona = await resolveDefaultPersona(db, session.company_id);

  const built = buildAskScenario({
    lessonTitle: lesson?.title ?? null,
    courseTitle: course?.title ?? null,
    blocks: (blocks ?? []).map((b) => {
      const content = (b.content ?? {}) as Record<string, unknown>;
      return { id: b.id, type: b.type, title: typeof content.title === "string" ? content.title : null };
    }),
  });

  const now = new Date().toISOString();
  const scenario: ScenarioRow = {
    id: `ask-${session.id}`,
    company_id: session.company_id,
    course_id: courseId,
    lesson_id: lessonId,
    persona_id: persona.id,
    skill_pack: "general-tutor",
    title: built.title,
    goal: built.goal,
    beats: [] as unknown as ScenarioRow["beats"],
    target_items: [] as unknown as ScenarioRow["target_items"],
    level: null,
    exam_task: null,
    max_minutes: ASK_MAX_MINUTES,
    allowed_modes: ["text", "voice"],
    scene: "Scene_Classroom",
    visibility: "course",
    style: "guided_lesson",
    status: "published",
    created_by: session.user_id,
    created_at: now,
    updated_at: now,
  };

  return { scenario, persona, courseId, roleNotes: built.roleNotes };
}
