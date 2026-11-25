import "server-only";
import { createServiceClient } from "@/lib/supabase/server";
import { ZEDAI_TENANT_ID } from "@/lib/tenants/constants";
import { courseTenantId } from "@/lib/authz/refs";
import { isSchemaUnavailableError } from "../mastery/server";
import { normalizeStoredReportContent } from "../report-model";
import { scenarioViewFromRow, type TutorScenarioRow, type TutorScenarioView } from "../tutor-session-block";
import { effectiveState, knowledgeStateFromRow } from "../learner/knowledge";
import { loose, type DbError } from "../learner/loose-db";
import {
  canRequestVivaReview,
  cleanAppealNote,
  decideVivaGate,
  decideVivaOutcome,
  DEFAULT_VIVA_RUBRIC,
  LEGACY_VIVA_RUBRIC,
  normalizeVivaRubric,
  summariseVivaMastery,
  transitionVivaReview,
  VIVA_REVIEW_KINDS,
  VIVA_REVIEW_STATUSES,
  type VivaAttempt,
  type VivaGate,
  type VivaGateState,
  type VivaMasterySummary,
  type VivaOutcome,
  type VivaReviewDecision,
  type VivaReviewRecord,
  type VivaRubric,
} from "../viva-v2";

// DB glue for the certificate oral check v2 (P2-08). Rules live in ../viva-v2.ts.
// No fail-open: a course that requires a viva never passes because a table or column is missing — the gate
// reports `misconfigured` / `unavailable` instead. A course that does not require one is never blocked.

export type CourseVivaStatus = {
  required: boolean;
  passed: boolean;
  scenarioId: string | null;
  scenario: TutorScenarioView | null;
  reason: string | null;
  /** P2-08 additions. */
  state: VivaGateState;
  outcome: VivaOutcome | null;
  canRequestReview: boolean;
};

export type CourseVivaContext = {
  companyId: string;
  scenarioId: string | null;
  scenario: TutorScenarioView | null;
  rubric: VivaRubric;
  gate: VivaGate;
  latestAttempt: VivaAttempt | null;
};

function db() {
  return loose(createServiceClient());
}

function warn(where: string, error: DbError) {
  console.warn(`[tutor/viva] ${where}:`, error.message ?? error.code);
}

type CourseVivaRow = {
  company_id: string | null;
  require_certificate_viva?: boolean | null;
  viva_scenario_id?: string | null;
  viva_rubric?: unknown;
};

/** Reads the course's viva config. `required: null` = the config columns are not migrated. */
export async function loadCourseVivaConfig(courseId: string): Promise<{
  exists: boolean;
  companyId: string;
  required: boolean | null;
  scenarioId: string | null;
  rubric: VivaRubric;
  rubricStored: boolean;
  rubricAvailable: boolean;
}> {
  const client = db();
  const read = (cols: string) => client.from("courses").select(cols).eq("id", courseId).maybeSingle();
  let rubricAvailable = true;
  let res = await read("company_id, require_certificate_viva, viva_scenario_id, viva_rubric");
  if (res.error && isSchemaUnavailableError(res.error)) {
    rubricAvailable = false;
    res = await read("company_id, require_certificate_viva, viva_scenario_id");
  }
  if (res.error && isSchemaUnavailableError(res.error)) {
    const base = await read("company_id");
    const row = base.data as { company_id: string | null } | null;
    return {
      exists: !!row,
      companyId: courseTenantId(row?.company_id ?? null, ZEDAI_TENANT_ID),
      required: null,
      scenarioId: null,
      rubric: LEGACY_VIVA_RUBRIC,
      rubricStored: false,
      rubricAvailable: false,
    };
  }
  if (res.error) throw new Error(res.error.message ?? "Could not read course");
  const row = res.data as CourseVivaRow | null;
  const stored = rubricAvailable && row?.viva_rubric !== null && row?.viva_rubric !== undefined;
  return {
    exists: !!row,
    companyId: courseTenantId(row?.company_id ?? null, ZEDAI_TENANT_ID),
    required: row ? Boolean(row.require_certificate_viva) : false,
    scenarioId: row?.viva_scenario_id ?? null,
    // Before the rubric column exists the legacy rule applies unchanged; afterwards null = default rubric.
    rubric: rubricAvailable ? normalizeVivaRubric(row?.viva_rubric ?? null, DEFAULT_VIVA_RUBRIC) : LEGACY_VIVA_RUBRIC,
    rubricStored: stored,
    rubricAvailable,
  };
}

async function loadCourseMastery(courseId: string, companyId: string, userId: string): Promise<VivaMasterySummary | null> {
  const client = db();
  const ores = await client
    .from("learning_objectives")
    .select("id")
    .eq("course_id", courseId)
    .eq("company_id", companyId)
    .eq("status", "active")
    .limit(500);
  if (ores.error) {
    if (!isSchemaUnavailableError(ores.error)) warn("objectives", ores.error);
    return null;
  }
  const ids = ((ores.data ?? []) as Array<{ id: string }>).map((o) => o.id);
  if (ids.length === 0) return { total: 0, secure: 0, practising: 0 };
  const mres = await client
    .from("learner_mastery")
    .select(
      "objective_id, p_mastery, confidence, evidence_mass, stability_days, evidence_count, evidence_sources, spaced_reviews, last_evidence_at, secured_at, next_review_at, status, last_result, level",
    )
    .eq("user_id", userId)
    .eq("company_id", companyId)
    .in("objective_id", ids);
  if (mres.error) {
    if (!isSchemaUnavailableError(mres.error)) warn("mastery", mres.error);
    return null;
  }
  const now = new Date().toISOString();
  const statuses = ((mres.data ?? []) as Array<Record<string, unknown>>).map(
    (r) => effectiveState(knowledgeStateFromRow(r as Parameters<typeof knowledgeStateFromRow>[0]), now).status,
  );
  return summariseVivaMastery(ids.length, statuses);
}

function parseReview(row: Record<string, unknown>): VivaReviewRecord | null {
  const kind = row.kind as string;
  const status = row.status as string;
  if (!(VIVA_REVIEW_KINDS as readonly string[]).includes(kind)) return null;
  if (!(VIVA_REVIEW_STATUSES as readonly string[]).includes(status)) return null;
  return {
    id: String(row.id),
    kind: kind as VivaReviewRecord["kind"],
    status: status as VivaReviewRecord["status"],
    sessionId: (row.session_id as string | null) ?? null,
    reviewerNote: (row.reviewer_note as string | null) ?? null,
    createdAt: String(row.created_at ?? ""),
    decidedAt: (row.decided_at as string | null) ?? null,
  };
}

/** Reviews of one learner on one course; null when the reviews table is not migrated. */
async function loadLearnerReviews(courseId: string, userId: string): Promise<VivaReviewRecord[] | null> {
  const res = await db()
    .from("viva_reviews")
    .select("id, kind, status, session_id, reviewer_note, created_at, decided_at")
    .eq("course_id", courseId)
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(50);
  if (res.error) {
    if (!isSchemaUnavailableError(res.error)) warn("reviews", res.error);
    return null;
  }
  return ((res.data ?? []) as Array<Record<string, unknown>>)
    .map(parseReview)
    .filter((r): r is VivaReviewRecord => r !== null);
}

async function loadVivaScenario(scenarioId: string): Promise<TutorScenarioView | null> {
  const service = createServiceClient();
  const { data: scenarioRow } = await service
    .from("practice_scenarios")
    .select("id, title, goal, style, scene, max_minutes, allowed_modes, status, persona_id")
    .eq("id", scenarioId)
    .maybeSingle();
  if (!scenarioRow || scenarioRow.status !== "published") return null;
  const personaRow = scenarioRow.persona_id
    ? (
        await service
          .from("ai_personas")
          .select("name, display_name, rive_variant")
          .eq("id", scenarioRow.persona_id)
          .maybeSingle()
      ).data
    : null;
  return scenarioViewFromRow({ ...scenarioRow, ai_personas: personaRow } as unknown as TutorScenarioRow);
}

/** Completed viva attempts (newest first) decided under the rubric with current course mastery. */
async function loadAttempts(input: {
  scenarioId: string;
  userId: string;
  rubric: VivaRubric;
  mastery: VivaMasterySummary | null;
}): Promise<VivaAttempt[]> {
  const service = createServiceClient();
  const { data: sessionRows } = await service
    .from("tutor_sessions")
    .select("id, ended_at")
    .eq("user_id", input.userId)
    .eq("scenario_id", input.scenarioId)
    .eq("status", "completed")
    .order("ended_at", { ascending: false })
    .limit(10);
  const sessions = (sessionRows ?? []) as Array<{ id: string; ended_at: string | null }>;
  if (sessions.length === 0) return [];
  const ids = sessions.map((s) => s.id);

  const [{ data: reports }, evidenceRes] = await Promise.all([
    service.from("tutor_reports").select("*").in("session_id", ids),
    db().from("learner_evidence").select("session_id, result").in("session_id", ids).limit(500),
  ]);
  const reportBySession = new Map<string, Record<string, unknown>>();
  for (const r of (reports ?? []) as unknown as Array<Record<string, unknown>>) {
    reportBySession.set(String(r.session_id), r);
  }
  const evidenceBySession = new Map<string, { correct: number; partial: number; misconception: number }>();
  if (!evidenceRes.error) {
    for (const e of (evidenceRes.data ?? []) as Array<{ session_id: string; result: string }>) {
      const c = evidenceBySession.get(e.session_id) ?? { correct: 0, partial: 0, misconception: 0 };
      if (e.result === "correct") c.correct += 1;
      else if (e.result === "partial") c.partial += 1;
      else if (e.result === "misconception") c.misconception += 1;
      evidenceBySession.set(e.session_id, c);
    }
  }

  return sessions.map((s) => {
    const raw = reportBySession.get(s.id);
    const content = raw ? normalizeStoredReportContent(raw) : null;
    const decision = decideVivaOutcome({
      rubric: input.rubric,
      session: {
        objectives: content?.objectives ?? null,
        taskScore: typeof content?.scores?.task === "number" ? content.scores.task : null,
        evidence: evidenceBySession.get(s.id) ?? null,
      },
      mastery: input.mastery,
    });
    return { sessionId: s.id, endedAt: s.ended_at, decision };
  });
}

async function writeAudit(event: {
  companyId: string;
  courseId: string;
  userId: string;
  reviewId?: string | null;
  sessionId?: string | null;
  actorId: string | null;
  action: "review_queued" | "review_requested" | "review_approved" | "review_returned" | "certificate_issued";
  outcome?: VivaOutcome | null;
  note?: string | null;
  details?: Record<string, unknown>;
}): Promise<void> {
  const res = await db()
    .from("viva_audit_events")
    .insert({
      company_id: event.companyId,
      course_id: event.courseId,
      user_id: event.userId,
      review_id: event.reviewId ?? null,
      session_id: event.sessionId ?? null,
      actor_id: event.actorId,
      action: event.action,
      outcome: event.outcome ?? null,
      note: event.note ?? null,
      details: event.details ?? {},
    });
  if (res.error && !isSchemaUnavailableError(res.error)) warn("audit", res.error);
}

/** Loads everything the gate needs and decides it. Queues an automatic review when the gate asks for one. */
export async function loadCourseVivaContext(courseId: string, userId: string): Promise<CourseVivaContext> {
  const config = await loadCourseVivaConfig(courseId);
  const empty = (gate: VivaGate): CourseVivaContext => ({
    companyId: config.companyId,
    scenarioId: config.scenarioId,
    scenario: null,
    rubric: config.rubric,
    gate,
    latestAttempt: null,
  });
  if (config.required !== true) {
    return empty(decideVivaGate({ required: config.required, scenarioReady: false, attempts: [], reviews: [], rubric: config.rubric }));
  }

  const [scenario, reviews, mastery] = await Promise.all([
    config.scenarioId ? loadVivaScenario(config.scenarioId) : Promise.resolve(null),
    loadLearnerReviews(courseId, userId),
    config.rubric.minMasteryShare > 0 ? loadCourseMastery(courseId, config.companyId, userId) : Promise.resolve(null),
  ]);
  // Attempts on the configured flow count even if it was unpublished later (an earlier pass stays a pass).
  const attempts =
    config.scenarioId
      ? await loadAttempts({ scenarioId: config.scenarioId, userId, rubric: config.rubric, mastery })
      : [];

  let gate = decideVivaGate({
    required: true,
    scenarioReady: !!scenario,
    attempts,
    reviews,
    rubric: config.rubric,
  });

  if (gate.queueReviewForSessionId) {
    const attempt = attempts.find((a) => a.sessionId === gate.queueReviewForSessionId) ?? null;
    const ins = await db()
      .from("viva_reviews")
      .insert({
        company_id: config.companyId,
        course_id: courseId,
        user_id: userId,
        session_id: gate.queueReviewForSessionId,
        kind: "needs_review",
        status: "pending",
        evaluation: { decision: attempt?.decision ?? null, rubric: config.rubric },
      })
      .select("id")
      .single();
    if (!ins.error) {
      await writeAudit({
        companyId: config.companyId,
        courseId,
        userId,
        reviewId: (ins.data as { id: string } | null)?.id ?? null,
        sessionId: gate.queueReviewForSessionId,
        actorId: null,
        action: "review_queued",
        outcome: "needs_review",
        details: { decision: attempt?.decision ?? null },
      });
    } else if (ins.error.code !== "23505") {
      warn("queue review", ins.error);
      if (isSchemaUnavailableError(ins.error)) {
        // Explicitly unavailable rather than pretending the review exists.
        gate = decideVivaGate({ required: true, scenarioReady: !!scenario, attempts, reviews: null, rubric: config.rubric });
      }
    }
    gate = { ...gate, queueReviewForSessionId: null };
  }

  return {
    companyId: config.companyId,
    scenarioId: config.scenarioId,
    scenario,
    rubric: config.rubric,
    gate,
    latestAttempt: attempts[0] ?? null,
  };
}

/**
 * Whether `userId` may receive a certificate for `courseId` as far as the oral check is concerned.
 * Kept compatible with the pre-P2-08 shape (required / passed / reason / scenario) used by the course player.
 */
export async function getCourseVivaStatus(courseId: string, userId: string): Promise<CourseVivaStatus> {
  const ctx = await loadCourseVivaContext(courseId, userId);
  const g = ctx.gate;
  return {
    required: g.state !== "not_required",
    passed: g.allowCertificate,
    scenarioId: ctx.scenarioId,
    scenario: ctx.scenario,
    reason: g.allowCertificate && g.state !== "approved" ? null : g.reason,
    state: g.state,
    outcome: g.outcome,
    canRequestReview: canRequestVivaReview(g),
  };
}

/** Learner asks for a human review (once per course). Re-decides the gate with fresh state first. */
export async function requestVivaReview(input: {
  courseId: string;
  userId: string;
  note?: unknown;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const ctx = await loadCourseVivaContext(input.courseId, input.userId);
  if (!canRequestVivaReview(ctx.gate)) {
    return { ok: false, error: "A teacher review can't be requested for this course right now." };
  }
  const note = cleanAppealNote(input.note);
  const ins = await db()
    .from("viva_reviews")
    .insert({
      company_id: ctx.companyId,
      course_id: input.courseId,
      user_id: input.userId,
      session_id: ctx.latestAttempt?.sessionId ?? null,
      kind: "appeal",
      status: "pending",
      learner_note: note,
      evaluation: {
        gateState: ctx.gate.state,
        decision: ctx.latestAttempt?.decision ?? null,
        rubric: ctx.rubric,
      },
    })
    .select("id")
    .single();
  if (ins.error) {
    if (ins.error.code === "23505") return { ok: false, error: "You have already asked for a teacher review on this course." };
    if (isSchemaUnavailableError(ins.error)) return { ok: false, error: "Teacher reviews aren't available yet." };
    warn("appeal", ins.error);
    return { ok: false, error: "Could not send your request. Please try again." };
  }
  await writeAudit({
    companyId: ctx.companyId,
    courseId: input.courseId,
    userId: input.userId,
    reviewId: (ins.data as { id: string } | null)?.id ?? null,
    sessionId: ctx.latestAttempt?.sessionId ?? null,
    actorId: input.userId,
    action: "review_requested",
    outcome: ctx.gate.outcome,
    note,
    details: { gateState: ctx.gate.state },
  });
  return { ok: true };
}

export type VivaReviewQueueItem = {
  id: string;
  kind: VivaReviewRecord["kind"];
  status: VivaReviewRecord["status"];
  courseId: string;
  courseTitle: string;
  userId: string;
  learnerName: string;
  sessionId: string | null;
  learnerNote: string | null;
  reviewerNote: string | null;
  evaluation: Record<string, unknown>;
  createdAt: string;
  decidedAt: string | null;
};

/**
 * The staff review queue of one academy. Callers MUST authorise the caller as staff of `companyId` first.
 * Returns `{ available: false }` when the reviews table is not migrated.
 */
export async function listVivaReviewQueue(input: {
  companyId: string;
  status?: VivaReviewRecord["status"] | "all";
  limit?: number;
}): Promise<{ available: false } | { available: true; items: VivaReviewQueueItem[] }> {
  let q = db()
    .from("viva_reviews")
    .select("id, kind, status, course_id, user_id, session_id, learner_note, reviewer_note, evaluation, created_at, decided_at")
    .eq("company_id", input.companyId);
  if (input.status && input.status !== "all") q = q.eq("status", input.status);
  const res = await q.order("created_at", { ascending: false }).limit(input.limit ?? 100);
  if (res.error) {
    if (!isSchemaUnavailableError(res.error)) warn("queue", res.error);
    return { available: false };
  }
  const rows = (res.data ?? []) as Array<Record<string, unknown>>;
  const courseIds = Array.from(new Set(rows.map((r) => String(r.course_id))));
  const userIds = Array.from(new Set(rows.map((r) => String(r.user_id))));
  const service = createServiceClient();
  const [{ data: courses }, { data: profiles }] = await Promise.all([
    courseIds.length > 0
      ? service.from("courses").select("id, title").in("id", courseIds)
      : Promise.resolve({ data: [] as Array<{ id: string; title: string }> }),
    userIds.length > 0
      ? service.from("profiles").select("id, full_name").in("id", userIds)
      : Promise.resolve({ data: [] as Array<{ id: string; full_name: string | null }> }),
  ]);
  const courseTitle = new Map((courses ?? []).map((c) => [c.id, c.title]));
  const learnerName = new Map((profiles ?? []).map((p) => [p.id, p.full_name ?? "Learner"]));
  return {
    available: true,
    items: rows.map((r) => ({
      id: String(r.id),
      kind: r.kind as VivaReviewRecord["kind"],
      status: r.status as VivaReviewRecord["status"],
      courseId: String(r.course_id),
      courseTitle: courseTitle.get(String(r.course_id)) ?? "Course",
      userId: String(r.user_id),
      learnerName: learnerName.get(String(r.user_id)) ?? "Learner",
      sessionId: (r.session_id as string | null) ?? null,
      learnerNote: (r.learner_note as string | null) ?? null,
      reviewerNote: (r.reviewer_note as string | null) ?? null,
      evaluation: (r.evaluation as Record<string, unknown>) ?? {},
      createdAt: String(r.created_at),
      decidedAt: (r.decided_at as string | null) ?? null,
    })),
  };
}

/** Loads a review's tenant so the caller can authorise against it (tenant derived from the resource). */
export async function loadVivaReviewTenant(reviewId: string): Promise<{ companyId: string; courseId: string } | null> {
  const res = await db().from("viva_reviews").select("company_id, course_id").eq("id", reviewId).maybeSingle();
  if (res.error || !res.data) return null;
  const row = res.data as { company_id: string; course_id: string };
  return { companyId: row.company_id, courseId: row.course_id };
}

/**
 * Staff decision on a review. Callers MUST authorise the staff member against `loadVivaReviewTenant(reviewId)`.
 * The update only applies to a still-pending row (concurrent decisions cannot both win).
 */
export async function decideVivaReview(input: {
  reviewId: string;
  staffUserId: string;
  decision: VivaReviewDecision;
}): Promise<{ ok: true; status: "approved" | "returned" } | { ok: false; error: string }> {
  const client = db();
  const res = await client
    .from("viva_reviews")
    .select("id, company_id, course_id, user_id, session_id, status")
    .eq("id", input.reviewId)
    .maybeSingle();
  if (res.error || !res.data) return { ok: false, error: "Review not found." };
  const row = res.data as {
    id: string;
    company_id: string;
    course_id: string;
    user_id: string;
    session_id: string | null;
    status: VivaReviewRecord["status"];
  };
  const t = transitionVivaReview({ status: row.status }, input.decision);
  if (!t.ok) return t;
  const decidedAt = new Date().toISOString();
  const upd = await client
    .from("viva_reviews")
    .update({ status: t.status, reviewer_id: input.staffUserId, reviewer_note: t.note, decided_at: decidedAt })
    .eq("id", row.id)
    .eq("status", "pending")
    .select("id");
  if (upd.error) {
    warn("decide", upd.error);
    return { ok: false, error: "Could not save the decision." };
  }
  if (!Array.isArray(upd.data) || upd.data.length === 0) {
    return { ok: false, error: "This review has already been decided." };
  }
  await writeAudit({
    companyId: row.company_id,
    courseId: row.course_id,
    userId: row.user_id,
    reviewId: row.id,
    sessionId: row.session_id,
    actorId: input.staffUserId,
    action: t.status === "approved" ? "review_approved" : "review_returned",
    outcome: t.status === "approved" ? "pass" : "not_yet",
    note: t.note,
  });
  return { ok: true, status: t.status };
}

/** Audit row when a certificate is issued for a course that required an oral check. */
export async function recordVivaCertificateIssued(input: {
  courseId: string;
  userId: string;
  status: CourseVivaStatus;
}): Promise<void> {
  if (input.status.state === "not_required") return;
  const config = await loadCourseVivaConfig(input.courseId).catch(() => null);
  if (!config) return;
  await writeAudit({
    companyId: config.companyId,
    courseId: input.courseId,
    userId: input.userId,
    actorId: input.userId,
    action: "certificate_issued",
    outcome: input.status.outcome,
    details: { gateState: input.status.state },
  });
}
