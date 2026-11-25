import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";
import { DEFAULT_TEACHER_NAME, safeTeacherName } from "../course-teacher";
import {
  applyEvidenceBatch,
  formatMasteryMemoryNotes,
  type CollectedEvidence,
  type EvidenceResult,
  type MasteryState,
} from "./evidence";
import {
  buildDailyPlan,
  isPlanScenarioVisible,
  type DailyPlanFlowCandidate,
  type DailyPlanItem,
  type DailyPlanLessonCandidate,
  type MasteryCandidate,
} from "./sprint";

type LooseQueryResult = {
  data: unknown;
  error: { code?: string; message?: string } | null;
};

type LooseFilter = PromiseLike<LooseQueryResult> & {
  eq: (col: string, val: unknown) => LooseFilter;
  in: (col: string, vals: unknown[]) => LooseFilter;
  lte: (col: string, val: unknown) => LooseFilter;
  order: (col: string, opts?: { ascending?: boolean }) => LooseFilter;
  limit: (n: number) => LooseFilter;
};

type LooseSupabase = {
  rpc: (fn: string, args?: Record<string, unknown>) => PromiseLike<LooseQueryResult>;
  from: (table: string) => {
    select: (columns: string) => LooseFilter;
    insert: (rows: unknown) => Promise<{ error: { code?: string; message?: string } | null }>;
    upsert: (
      rows: unknown,
      opts?: { onConflict?: string },
    ) => Promise<{ error: { code?: string; message?: string } | null }>;
  };
};

type LearnerMasteryDbRow = {
  objective_key: string;
  objective_text: string;
  level: number;
  evidence_count: number;
  last_result: EvidenceResult | null;
  last_evidence_at: string | null;
  course_id: string | null;
};

/** True when Postgres/PostgREST reports an un-migrated table or column. */
export function isSchemaUnavailableError(
  error: { code?: string | null; message?: string | null } | null | undefined,
): boolean {
  if (!error) return false;
  const code = error.code ?? "";
  if (
    code === "42P01" ||
    code === "42703" ||
    code === "PGRST204" ||
    code === "PGRST205"
  ) {
    return true;
  }
  const msg = (error.message ?? "").toLowerCase();
  return (
    msg.includes("does not exist") ||
    msg.includes("could not find the") ||
    msg.includes("schema cache")
  );
}

const MASTERY_READBACK_COLUMNS =
  "objective_key, objective_text, level, evidence_count, last_result, last_evidence_at, course_id";
const MASTERY_V2_COLUMNS = `${MASTERY_READBACK_COLUMNS}, objective_id, p_mastery, status, next_review_at`;

type MasteryV2DbRow = LearnerMasteryDbRow & {
  objective_id?: string | null;
  p_mastery?: number | string | null;
  status?: string | null;
  next_review_at?: string | null;
};

function masteryStateFromRow(row: MasteryV2DbRow): MasteryState {
  const p = row.p_mastery === null || row.p_mastery === undefined ? null : Number(row.p_mastery);
  return {
    objectiveKey: row.objective_key,
    objectiveText: row.objective_text,
    level: row.level,
    evidenceCount: row.evidence_count,
    lastResult: row.last_result,
    lastEvidenceAt: row.last_evidence_at,
    ...(row.objective_id !== undefined ? { objectiveId: row.objective_id } : {}),
    ...(row.p_mastery !== undefined ? { pMastery: Number.isFinite(p) ? p : null } : {}),
    ...(row.status !== undefined ? { status: row.status } : {}),
    ...(row.next_review_at !== undefined ? { nextReviewAt: row.next_review_at } : {}),
  };
}

/** Last state per objective key, in first-seen order of the keys. */
function lastPerKey(rows: ReadonlyArray<MasteryV2DbRow>): MasteryState[] {
  const byKey = new Map<string, MasteryState>();
  for (const r of rows) byKey.set(r.objective_key, masteryStateFromRow(r));
  return Array.from(byKey.values());
}

type PersistMasteryInput = {
  supabase?: SupabaseClient<Database>;
  companyId: string;
  userId: string;
  courseId: string | null;
  scenarioId: string | null;
  sessionId: string | null;
  evidence: ReadonlyArray<CollectedEvidence>;
  timestampIso?: string;
};

/**
 * Evidence v2 write path (P2-02): one `record_evidence_batch` call inserts every evidence row and updates
 * mastery in a single transaction with row locks, applying the Architecture §4.2 rule and dual-writing the
 * legacy `level`. Returns the mastery rows as stored, or `{ ok: false, missing: true }` when the function
 * is not deployed yet (migration 20261125000201 pending).
 */
async function recordEvidenceViaRpc(
  supabase: LooseSupabase,
  input: PersistMasteryInput,
  nowIso: string,
): Promise<{ ok: true; states: MasteryState[] } | { ok: false; missing: boolean }> {
  const items = input.evidence.map((ev) => ({
    user_id: input.userId,
    company_id: input.companyId,
    objective_key: ev.objectiveKey,
    objective_text: ev.objectiveText,
    objective_id: ev.objectiveId ?? null,
    result: ev.result,
    source: ev.source ?? "teacher_judgement",
    server_verified: ev.serverVerified ?? false,
    score: ev.score ?? null,
    difficulty: ev.difficulty ?? null,
    course_id: input.courseId,
    scenario_id: input.scenarioId,
    session_id: input.sessionId,
    item_ref: ev.itemRef ?? null,
    detail: ev.detail,
    at: nowIso,
  }));
  const res = (await supabase.rpc("record_evidence_batch", { p_items: items })) as {
    data: MasteryV2DbRow[] | null;
    error: { code?: string; message?: string } | null;
  };
  if (res.error) {
    if (isSchemaUnavailableError(res.error)) return { ok: false, missing: true };
    console.warn("[tutor/mastery] record_evidence_batch failed:", res.error.message);
    return { ok: false, missing: false };
  }
  return { ok: true, states: lastPerKey(res.data ?? []) };
}

/**
 * Persists evidence and returns the learner's mastery for every touched objective as stored in the database.
 *
 * Preferred path: `record_evidence_batch` (transactional, weighted rule, P2-02). Before that migration is
 * applied, falls back to today's path: insert `learner_evidence` rows and upsert rolled-up `learner_mastery`
 * (+1 correct, 0 partial, -1 misconception, clamped 0..3), then read the rows back. Before the Phase 2 mastery
 * migration exists at all it returns the computed states without failing.
 */
export async function persistSessionMastery(input: PersistMasteryInput): Promise<MasteryState[]> {
  if (input.evidence.length === 0) return [];
  const supabase = (input.supabase ?? createServiceClient()) as unknown as LooseSupabase;
  const nowIso = input.timestampIso ?? new Date().toISOString();

  const rpc = await recordEvidenceViaRpc(supabase, input, nowIso);
  if (rpc.ok) return rpc.states;
  if (!rpc.missing) {
    // The v2 function exists but refused the batch (e.g. an objective outside the tenant). Do not bypass
    // its checks through the legacy path; report the computed view only.
    return applyEvidenceBatch(new Map(), input.evidence, nowIso);
  }

  return persistLegacyMastery(supabase, input, nowIso);
}

async function persistLegacyMastery(
  supabase: LooseSupabase,
  input: PersistMasteryInput,
  nowIso: string,
): Promise<MasteryState[]> {
  const keys = Array.from(new Set(input.evidence.map((e) => e.objectiveKey)));

  const existingRes = (await supabase
    .from("learner_mastery")
    .select(MASTERY_READBACK_COLUMNS)
    .eq("user_id", input.userId)
    .in("objective_key", keys)) as {
    data: LearnerMasteryDbRow[] | null;
    error: { code?: string; message?: string } | null;
  };

  if (existingRes.error) {
    if (isSchemaUnavailableError(existingRes.error)) {
      return applyEvidenceBatch(new Map(), input.evidence, nowIso);
    }
    console.warn("[tutor/mastery] could not load existing mastery:", existingRes.error.message);
  }

  const existingByKey = new Map<string, MasteryState>();
  for (const row of existingRes.data ?? []) {
    existingByKey.set(row.objective_key, masteryStateFromRow(row));
  }

  const updated = applyEvidenceBatch(existingByKey, input.evidence, nowIso);

  const evidenceRows = input.evidence.map((ev) => ({
    user_id: input.userId,
    company_id: input.companyId,
    course_id: input.courseId,
    scenario_id: input.scenarioId,
    session_id: input.sessionId,
    objective_key: ev.objectiveKey,
    objective_text: ev.objectiveText,
    result: ev.result,
    detail: ev.detail,
  }));

  const insertRes = await supabase.from("learner_evidence").insert(evidenceRows);
  if (insertRes.error && !isSchemaUnavailableError(insertRes.error)) {
    console.warn("[tutor/mastery] could not insert learner_evidence:", insertRes.error.message);
  }

  const masteryUpserts = updated.map((m) => ({
    user_id: input.userId,
    company_id: input.companyId,
    course_id: input.courseId,
    objective_key: m.objectiveKey,
    objective_text: m.objectiveText,
    level: m.level,
    evidence_count: m.evidenceCount,
    last_result: m.lastResult,
    last_evidence_at: m.lastEvidenceAt,
  }));

  let upsertRes = await supabase
    .from("learner_mastery")
    .upsert(masteryUpserts, { onConflict: "user_id,objective_key" });
  if (upsertRes.error?.code === "42P10") {
    // The unique key already moved to (company_id, user_id, objective_key) (D-05).
    upsertRes = await supabase
      .from("learner_mastery")
      .upsert(masteryUpserts, { onConflict: "company_id,user_id,objective_key" });
  }

  if (upsertRes.error) {
    if (!isSchemaUnavailableError(upsertRes.error)) {
      console.warn("[tutor/mastery] could not upsert learner_mastery:", upsertRes.error.message);
    }
    return updated;
  }

  // Read back so callers (session reports) show exactly what is stored.
  const readBack = (await supabase
    .from("learner_mastery")
    .select(MASTERY_READBACK_COLUMNS)
    .eq("user_id", input.userId)
    .eq("company_id", input.companyId)
    .in("objective_key", keys)) as {
    data: LearnerMasteryDbRow[] | null;
    error: { code?: string; message?: string } | null;
  };
  if (readBack.error || !readBack.data || readBack.data.length === 0) return updated;
  const stored = new Map(readBack.data.map((r) => [r.objective_key, masteryStateFromRow(r)]));
  return updated.map((m) => stored.get(m.objectiveKey) ?? m);
}

/** Reads mastery rows (v2 columns when available) for the given objective keys of one learner in one tenant. */
export async function loadMasteryStates(input: {
  supabase?: SupabaseClient<Database>;
  userId: string;
  companyId: string;
  objectiveKeys: ReadonlyArray<string>;
}): Promise<MasteryState[]> {
  if (input.objectiveKeys.length === 0) return [];
  const supabase = (input.supabase ?? createServiceClient()) as unknown as LooseSupabase;
  const run = (columns: string) =>
    supabase
      .from("learner_mastery")
      .select(columns)
      .eq("user_id", input.userId)
      .eq("company_id", input.companyId)
      .in("objective_key", [...input.objectiveKeys]) as unknown as Promise<{
      data: MasteryV2DbRow[] | null;
      error: { code?: string; message?: string } | null;
    }>;
  let res = await run(MASTERY_V2_COLUMNS);
  if (res.error && isSchemaUnavailableError(res.error)) res = await run(MASTERY_READBACK_COLUMNS);
  if (res.error) {
    if (!isSchemaUnavailableError(res.error)) console.warn("[tutor/mastery] loadMasteryStates:", res.error.message);
    return [];
  }
  return (res.data ?? []).map(masteryStateFromRow);
}

/**
 * Loads weak mastery rows (`level <= 2`) for a learner, sorted weakest first.
 * Returns `[]` safely when the Phase 2 migration is not applied yet.
 */
export async function loadWeakMasteryRows(input: {
  supabase?: SupabaseClient<Database>;
  userId: string;
  companyId?: string | null;
  courseId?: string | null;
  limit?: number;
}): Promise<MasteryCandidate[]> {
  const client = (input.supabase ?? createClient()) as unknown as LooseSupabase;
  let query = client
    .from("learner_mastery")
    .select("objective_key, objective_text, level, last_result, last_evidence_at, course_id")
    .eq("user_id", input.userId)
    .lte("level", 2);

  if (input.companyId) {
    query = query.eq("company_id", input.companyId);
  }
  if (input.courseId) {
    query = query.eq("course_id", input.courseId);
  }

  const res = (await query
    .order("level", { ascending: true })
    .order("last_evidence_at", { ascending: true })
    .limit(input.limit ?? 12)) as {
    data: LearnerMasteryDbRow[] | null;
    error: { code?: string; message?: string } | null;
  };

  if (res.error) {
    if (!isSchemaUnavailableError(res.error)) {
      console.warn("[tutor/mastery] loadWeakMasteryRows error:", res.error.message);
    }
    return [];
  }

  return (res.data ?? []).map((r) => ({
    objectiveKey: r.objective_key,
    objectiveText: r.objective_text,
    level: r.level,
    lastResult: r.last_result,
    lastEvidenceAt: r.last_evidence_at,
    courseId: r.course_id,
  }));
}

/**
 * Combines existing persona memory notes with the learner's weakest mastery
 * objectives so every turn stays grounded in persistent cross-session memory.
 */
export async function loadSessionMemoryNotes(input: {
  supabase?: SupabaseClient<Database>;
  userId: string;
  companyId: string;
  courseId?: string | null;
  existingNotes: string[];
}): Promise<string[]> {
  const rows = await loadWeakMasteryRows({
    supabase: input.supabase,
    userId: input.userId,
    companyId: input.companyId,
    courseId: input.courseId,
    limit: 6,
  });
  const masteryNotes = formatMasteryMemoryNotes(rows, 6);
  const merged = [...masteryNotes, ...input.existingNotes];
  return Array.from(new Set(merged)).slice(0, 12);
}

/**
 * Builds the 1-3 item "Today with <teacher>" daily plan for a learner's dashboard.
 * Uses the provided Supabase client and degrades cleanly before Phase 1/2 migrations apply.
 */
export async function loadDashboardDailyPlan(input: {
  userId: string;
  companyId?: string | null;
  basePath?: string;
}): Promise<{ teacherName: string; items: DailyPlanItem[] }> {
  const supabase = createClient();

  const [weakObjectives, dueReviews] = await Promise.all([
    loadWeakMasteryRows({
      supabase,
      userId: input.userId,
      companyId: input.companyId,
      limit: 6,
    }),
    // P2-07: the review scheduler replaces "3 weakest" when its columns exist (unavailable → legacy path).
    import("../learner/scheduler-server").then((m) =>
      m.loadDueReviews(input.userId, input.companyId ?? null, { basePath: input.basePath, client: supabase }),
    ),
  ]);

  // 1. Enrolled courses & unfinished lessons
  const { data: enrollmentRows } = await supabase
    .from("enrollments")
    .select("course_id")
    .eq("user_id", input.userId)
    .eq("status", "active")
    .limit(20);

  const enrolledCourseIds = Array.from(
    new Set(
      (enrollmentRows ?? [])
        .map((r) => r.course_id)
        .filter((id): id is string => typeof id === "string" && id.length > 0),
    ),
  );

  let enrolledCourses: Array<{ id: string; title: string; slug: string; company_id: string | null }> = [];
  if (enrolledCourseIds.length > 0) {
    let coursesQuery = supabase
      .from("courses")
      .select("id, title, slug, company_id")
      .in("id", enrolledCourseIds)
      .eq("status", "published");
    if (input.companyId) {
      coursesQuery = coursesQuery.eq("company_id", input.companyId);
    }
    const { data: coursesData } = await coursesQuery.limit(10);
    enrolledCourses = (coursesData ?? []).map((c) => ({
      id: c.id,
      title: c.title,
      slug: c.slug,
      company_id: c.company_id ?? null,
    }));
  }

  const courseIds = enrolledCourses.map((c) => c.id);
  const courseById = new Map(enrolledCourses.map((c) => [c.id, c]));

  const unfinishedLessons: DailyPlanLessonCandidate[] = [];
  if (courseIds.length > 0) {
    const [{ data: moduleRows }, { data: progressRows }] = await Promise.all([
      supabase
        .from("modules")
        .select("id, course_id, title, position")
        .in("course_id", courseIds)
        .order("position", { ascending: true }),
      supabase
        .from("lesson_progress")
        .select("lesson_id")
        .eq("user_id", input.userId)
        .eq("completed", true),
    ]);

    const moduleIds = (moduleRows ?? []).map((m) => m.id);
    const { data: lessonRows } =
      moduleIds.length > 0
        ? await supabase
            .from("lessons")
            .select("id, module_id, title, position")
            .in("module_id", moduleIds)
            .order("position", { ascending: true })
        : { data: [] as Array<{ id: string; module_id: string; title: string; position: number }> };

    const lessonsByModule = new Map<string, Array<{ id: string; title: string; position: number }>>();
    for (const l of lessonRows ?? []) {
      const list = lessonsByModule.get(l.module_id) ?? [];
      list.push(l);
      lessonsByModule.set(l.module_id, list);
    }

    const completedSet = new Set((progressRows ?? []).map((p) => p.lesson_id));
    const orderedUnfinished: Array<{
      courseId: string;
      lessonId: string;
      lessonTitle: string;
      moduleTitle: string;
    }> = [];

    for (const mod of moduleRows ?? []) {
      const modLessons = [...(lessonsByModule.get(mod.id) ?? [])].sort(
        (a, b) => a.position - b.position,
      );
      for (const lesson of modLessons) {
        if (!completedSet.has(lesson.id)) {
          orderedUnfinished.push({
            courseId: mod.course_id,
            lessonId: lesson.id,
            lessonTitle: lesson.title,
            moduleTitle: mod.title,
          });
        }
      }
    }

    const candidateLessonIds = orderedUnfinished.slice(0, 12).map((l) => l.lessonId);
    const aiBlockLessonIds = new Set<string>();

    if (candidateLessonIds.length > 0) {
      const { data: tutorBlocks } = await supabase
        .from("content_blocks")
        .select("lesson_id")
        .in("lesson_id", candidateLessonIds)
        .eq("type", "tutor_session");
      for (const b of tutorBlocks ?? []) {
        aiBlockLessonIds.add(b.lesson_id);
      }

      // Check published teacher_moments (Phase 1 table; safe if not migrated yet)
      const loose = supabase as unknown as LooseSupabase;
      const momentRes = (await loose
        .from("teacher_moments")
        .select("lesson_id, course_id, scenario_id")
        .in("lesson_id", candidateLessonIds)
        .eq("status", "published")) as {
        data: Array<{ lesson_id: string; course_id: string; scenario_id: string | null }> | null;
        error: { code?: string; message?: string } | null;
      };
      if (!momentRes.error && momentRes.data) {
        for (const m of momentRes.data) {
          aiBlockLessonIds.add(m.lesson_id);
        }
      }
    }

    for (const item of orderedUnfinished) {
      const course = courseById.get(item.courseId);
      if (!course) continue;
      unfinishedLessons.push({
        courseId: course.id,
        courseTitle: course.title,
        courseSlug: course.slug,
        lessonId: item.lessonId,
        lessonTitle: item.lessonTitle,
        moduleTitle: item.moduleTitle,
        teacherName: null,
        hasAiTeacherBlock: aiBlockLessonIds.has(item.lessonId),
      });
    }
  }

  // 2. Untried published flows the learner may actually open (server code bypasses RLS, so visibility is
  // enforced here): platform flows, library flows of the learner's academies, flows of enrolled courses.
  let scenariosQuery = supabase
    .from("practice_scenarios")
    .select("id, company_id, title, goal, max_minutes, course_id, persona_id, visibility")
    .eq("status", "published")
    .order("created_at", { ascending: false })
    .limit(40);

  if (input.companyId) {
    scenariosQuery = scenariosQuery.eq("company_id", input.companyId);
  }

  const [{ data: scenarioRows }, { data: completedSessionRows }, { data: membershipRows }] = await Promise.all([
    scenariosQuery,
    supabase
      .from("tutor_sessions")
      .select("scenario_id")
      .eq("user_id", input.userId)
      .in("status", ["completed", "active"]),
    supabase
      .from("company_members")
      .select("company_id")
      .eq("profile_id", input.userId)
      .eq("status", "active"),
  ]);

  const memberCompanyIds = new Set(
    (membershipRows ?? []).map((m) => m.company_id).filter((id): id is string => typeof id === "string"),
  );
  const enrolledCourseIdSet = new Set(enrolledCourseIds);
  const scenariosData = (scenarioRows ?? [])
    .filter((s) =>
      isPlanScenarioVisible(
        { companyId: s.company_id, visibility: s.visibility ?? null, courseId: s.course_id ?? null },
        { memberCompanyIds, enrolledCourseIds: enrolledCourseIdSet, scopeCompanyId: input.companyId ?? null },
      ),
    )
    .slice(0, 15);

  const personaIds = Array.from(
    new Set(
      (scenariosData ?? [])
        .map((s) => s.persona_id)
        .filter((id): id is string => typeof id === "string" && id.length > 0),
    ),
  );
  const personaNameById = new Map<string, string>();
  if (personaIds.length > 0) {
    const { data: personasData } = await supabase
      .from("ai_personas")
      .select("id, name, display_name")
      .in("id", personaIds);
    for (const p of personasData ?? []) {
      const label = safeTeacherName(p.display_name) ?? safeTeacherName(p.name);
      if (label) personaNameById.set(p.id, label);
    }
  }

  const triedScenarioIds = new Set(
    (completedSessionRows ?? [])
      .map((s) => s.scenario_id)
      .filter((id): id is string => typeof id === "string"),
  );

  const untriedFlows: DailyPlanFlowCandidate[] = [];
  let resolvedTeacherName: string | null = null;

  for (const row of scenariosData ?? []) {
    const pName = row.persona_id ? (personaNameById.get(row.persona_id) ?? null) : null;
    if (!resolvedTeacherName && pName) {
      resolvedTeacherName = pName;
    }
    if (triedScenarioIds.has(row.id)) continue;
    untriedFlows.push({
      scenarioId: row.id,
      title: row.title,
      goal: row.goal,
      maxMinutes: row.max_minutes,
      teacherName: pName,
      courseId: row.course_id,
    });
  }

  let configuredTeacherName: string | null = null;
  if (input.companyId) {
    const loose = supabase as unknown as LooseSupabase;
    const settingsRes = (await loose
      .from("tutor_settings")
      .select("default_persona_id")
      .eq("company_id", input.companyId)
      .limit(1)) as {
      data: Array<{ default_persona_id?: string | null }> | null;
      error: { code?: string; message?: string } | null;
    };
    const defaultPersonaId =
      !settingsRes.error && settingsRes.data?.[0]?.default_persona_id
        ? settingsRes.data[0].default_persona_id
        : null;
    if (defaultPersonaId) {
      const { data: defaultPersona } = await supabase
        .from("ai_personas")
        .select("name, display_name")
        .eq("id", defaultPersonaId)
        .maybeSingle();
      configuredTeacherName =
        safeTeacherName(defaultPersona?.display_name) ?? safeTeacherName(defaultPersona?.name);
    }
  }

  const teacherName =
    configuredTeacherName ?? safeTeacherName(resolvedTeacherName) ?? DEFAULT_TEACHER_NAME;

  const items = buildDailyPlan({
    teacherName,
    basePath: input.basePath,
    weakObjectives,
    unfinishedLessons,
    untriedFlows,
    dueReviews,
  });

  return { teacherName, items };
}
