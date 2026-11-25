import "server-only";
import { createServiceClient } from "@/lib/supabase/server";
import { isSchemaUnavailableError } from "../mastery/server.ts";
import { loose, type DbError, type LooseDb } from "./loose-db.ts";
import {
  dueReviewsLabel,
  planReviews,
  SCHEDULER_PARAMS,
  type PlanReviewsInput,
  type ReviewObjective,
  type ReviewVocab,
  type RevisionSessionSpec,
} from "./scheduler.ts";
import { summariseRetention, type RetentionSummary } from "./retention.ts";

// DB glue for the review scheduler (P2-07). Reads only; the scheduler is pure (scheduler.ts).
// Every read degrades: when the evidence v2 columns are missing the loaders report `available: false` and
// callers fall back to the legacy "3 weakest objectives" path (sprint.ts / mastery/server.ts).
// Callers pass the verified Clerk user id; reads are always scoped to that user (and tenant when given).

const MASTERY_COLUMNS =
  "objective_key, objective_id, objective_text, course_id, p_mastery, stability_days, last_evidence_at, next_review_at, secured_at, status";

function db(client?: unknown): LooseDb {
  return loose(client ?? createServiceClient());
}

function warn(where: string, error: DbError) {
  console.warn(`[tutor/scheduler] ${where}:`, error.message ?? error.code);
}

function num(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

type MasteryRow = {
  objective_key: string;
  objective_id: string | null;
  objective_text: string;
  course_id: string | null;
  p_mastery: number | string | null;
  stability_days: number | string | null;
  last_evidence_at: string | null;
  next_review_at: string | null;
  secured_at: string | null;
  status: string | null;
};

export type ReviewQueueResult = { available: false } | { available: true; input: PlanReviewsInput };

/**
 * Loads everything the scheduler needs for one learner: scheduled objectives (v2 mastery rows), due vocab,
 * the prerequisite graph and what the learner is studying now. `companyId` null = all of the learner's tenants
 * (platform dashboard); `courseId` narrows objectives to one course (vocab is then left out).
 */
export async function loadReviewQueue(input: {
  userId: string;
  companyId: string | null;
  courseId?: string | null;
  client?: unknown;
  now?: string;
}): Promise<ReviewQueueResult> {
  const client = db(input.client);
  const now = input.now ?? new Date().toISOString();

  let mq = client
    .from("learner_mastery")
    .select(MASTERY_COLUMNS)
    .eq("user_id", input.userId)
    .neq("status", "unseen");
  if (input.companyId) mq = mq.eq("company_id", input.companyId);
  if (input.courseId) mq = mq.eq("course_id", input.courseId);
  const mres = await mq.order("next_review_at", { ascending: true }).limit(300);
  if (mres.error) {
    if (!isSchemaUnavailableError(mres.error)) warn("mastery", mres.error);
    return { available: false };
  }
  const rows = (Array.isArray(mres.data) ? mres.data : []) as MasteryRow[];

  // Registered objectives: lesson (for interleaving) and status (retired objectives are not reviewed).
  const objectiveIds = Array.from(new Set(rows.map((r) => r.objective_id).filter((id): id is string => !!id)));
  const objectiveMeta = new Map<string, { lessonId: string | null; retired: boolean }>();
  if (objectiveIds.length > 0) {
    const ores = await client
      .from("learning_objectives")
      .select("id, lesson_id, status")
      .in("id", objectiveIds.slice(0, 300));
    if (!ores.error) {
      for (const o of (ores.data ?? []) as Array<{ id: string; lesson_id: string | null; status: string }>) {
        objectiveMeta.set(o.id, { lessonId: o.lesson_id, retired: o.status === "retired" });
      }
    }
  }

  const objectives: ReviewObjective[] = rows
    .filter((r) => !(r.objective_id && objectiveMeta.get(r.objective_id)?.retired))
    .map((r) => ({
      objectiveKey: r.objective_key,
      objectiveId: r.objective_id,
      text: r.objective_text,
      courseId: r.course_id,
      lessonId: r.objective_id ? (objectiveMeta.get(r.objective_id)?.lessonId ?? null) : null,
      pMastery: num(r.p_mastery),
      stabilityDays: num(r.stability_days) ?? 1,
      lastEvidenceAt: r.last_evidence_at,
      nextReviewAt: r.next_review_at,
      securedAt: r.secured_at,
      status: r.status ?? "unseen",
    }));

  const [vocab, prerequisites, currentObjectiveIds] = await Promise.all([
    input.courseId ? Promise.resolve([] as ReviewVocab[]) : loadDueVocab(client, input.userId, input.companyId, now),
    loadPrerequisites(client, input.companyId, objectiveIds),
    loadCurrentObjectiveIds(client, input.userId, input.companyId, rows, now),
  ]);

  return { available: true, input: { now, objectives, vocab, prerequisites, currentObjectiveIds } };
}

async function loadDueVocab(client: LooseDb, userId: string, companyId: string | null, now: string): Promise<ReviewVocab[]> {
  let q = client
    .from("learner_vocab")
    .select("vocab_id, due_at, lapses, vocab_items(term, meaning)")
    .eq("user_id", userId);
  if (companyId) q = q.eq("company_id", companyId);
  // PostgREST lte through the loose type: filter in code (the list is small and ordered by due_at).
  const res = await q.order("due_at", { ascending: true }).limit(60);
  if (res.error) {
    if (!isSchemaUnavailableError(res.error)) warn("vocab", res.error);
    return [];
  }
  const nowMs = Date.parse(now);
  return ((res.data ?? []) as Array<{
    vocab_id: string;
    due_at: string;
    lapses: number | null;
    vocab_items: { term?: string; meaning?: string | null } | Array<{ term?: string; meaning?: string | null }> | null;
  }>)
    .filter((r) => Date.parse(r.due_at) <= nowMs)
    .map((r) => {
      const item = Array.isArray(r.vocab_items) ? r.vocab_items[0] : r.vocab_items;
      return {
        vocabId: r.vocab_id,
        term: item?.term ?? "",
        meaning: item?.meaning ?? null,
        dueAt: r.due_at,
        lapses: r.lapses ?? 0,
      };
    });
}

async function loadPrerequisites(
  client: LooseDb,
  companyId: string | null,
  objectiveIds: string[],
): Promise<Array<{ objectiveId: string; requiresId: string }>> {
  if (objectiveIds.length === 0) return [];
  let q = client.from("objective_prerequisites").select("objective_id, requires_id");
  if (companyId) q = q.eq("company_id", companyId);
  // Edges whose prerequisite is one of the learner's scheduled objectives; the walk starts at current study.
  const res = await q.in("requires_id", objectiveIds.slice(0, 300)).limit(2000);
  if (res.error) {
    if (!isSchemaUnavailableError(res.error)) warn("prerequisites", res.error);
    return [];
  }
  return ((res.data ?? []) as Array<{ objective_id: string; requires_id: string }>).map((e) => ({
    objectiveId: e.objective_id,
    requiresId: e.requires_id,
  }));
}

/**
 * "What the learner is studying now": registered objectives of the three most recently completed lessons, plus
 * objectives with evidence in the last 7 days that are not secure yet.
 */
async function loadCurrentObjectiveIds(
  client: LooseDb,
  userId: string,
  companyId: string | null,
  rows: MasteryRow[],
  now: string,
): Promise<string[]> {
  const weekAgo = Date.parse(now) - 7 * 86_400_000;
  const ids = new Set(
    rows
      .filter(
        (r) =>
          r.objective_id &&
          r.status !== "secure" &&
          r.last_evidence_at &&
          Date.parse(r.last_evidence_at) >= weekAgo,
      )
      .map((r) => r.objective_id as string),
  );
  const pres = await client
    .from("lesson_progress")
    .select("lesson_id, completed_at")
    .eq("user_id", userId)
    .eq("completed", true)
    .order("completed_at", { ascending: false })
    .limit(3);
  const lessonIds = ((pres.data ?? []) as Array<{ lesson_id: string }>).map((p) => p.lesson_id);
  if (!pres.error && lessonIds.length > 0) {
    let oq = client.from("learning_objectives").select("id").in("lesson_id", lessonIds).eq("status", "active");
    if (companyId) oq = oq.eq("company_id", companyId);
    const ores = await oq.limit(100);
    if (!ores.error) for (const o of (ores.data ?? []) as Array<{ id: string }>) ids.add(o.id);
  }
  return [...ids];
}

/** Plans a revision session for the learner, or null when the scheduler's columns are not migrated. */
export async function planRevisionForLearner(input: {
  userId: string;
  companyId: string | null;
  courseId?: string | null;
  budgetMinutes?: number;
  client?: unknown;
}): Promise<RevisionSessionSpec | null> {
  const queue = await loadReviewQueue(input);
  if (!queue.available) return null;
  return planReviews(queue.input, input.budgetMinutes ?? SCHEDULER_PARAMS.defaultBudgetMinutes);
}

export type DueReviews = {
  /** False when the scheduler columns are missing (callers keep the legacy weak-objective path). */
  available: boolean;
  /** Objectives due now + vocab cards due now (one queue). */
  count: number;
  objectiveCount: number;
  vocabCount: number;
  /** Where "Start revision" goes: the revision session, or the card deck when only vocab is due. */
  href: string;
  /** Short line for the card, e.g. "3 reviews due · 12 cards due"; null when nothing is due. */
  label: string | null;
  estimatedMinutes: number;
  /** The objectives the next revision session will run (due first; at most 3). */
  objectives: Array<{
    id: string | null;
    key: string;
    text: string;
    courseId: string | null;
    reason: string;
    retentionCheckpoint: number | null;
    due: boolean;
  }>;
  nextDueAt: string | null;
};

/**
 * Learning Home "due reviews" (UX spec §3, Up-next card). Contract for TeacherUpNextCard:
 *   const due = await loadDueReviews(userId, companyId, { basePath });
 *   if (due.available && due.count > 0) → show "<label>" with a "<estimatedMinutes>-minute revision" CTA to due.href.
 * Never throws; `{ available: false, count: 0 }` before migration 20261125000201 is applied.
 */
export async function loadDueReviews(
  userId: string,
  companyId: string | null,
  options: { basePath?: string | null; budgetMinutes?: number; client?: unknown; now?: string } = {},
): Promise<DueReviews> {
  const base = (options.basePath ?? "").replace(/\/$/, "");
  const empty: DueReviews = {
    available: false,
    count: 0,
    objectiveCount: 0,
    vocabCount: 0,
    href: `${base}/practice/sprint`,
    label: null,
    estimatedMinutes: 0,
    objectives: [],
    nextDueAt: null,
  };
  try {
    const queue = await loadReviewQueue({ userId, companyId, client: options.client, now: options.now });
    if (!queue.available) return empty;
    const spec = planReviews(queue.input, options.budgetMinutes ?? SCHEDULER_PARAMS.defaultBudgetMinutes);
    const courseIds = new Set(spec.objectives.map((o) => o.courseId).filter(Boolean));
    let href = `${base}/practice/sprint`;
    if (spec.dueObjectiveCount === 0 && spec.dueVocabCount > 0) {
      href = `${base}/practice/deck`;
    } else if (courseIds.size === 1) {
      const params = new URLSearchParams({ courseId: [...courseIds][0] as string });
      const ids = spec.objectives.map((o) => o.objectiveId).filter((id): id is string => !!id);
      if (ids.length === spec.objectives.length && ids.length > 0) params.set("objectives", ids.join(","));
      href = `${base}/practice/sprint?${params.toString()}`;
    }
    return {
      available: true,
      count: spec.dueObjectiveCount + spec.dueVocabCount,
      objectiveCount: spec.dueObjectiveCount,
      vocabCount: spec.dueVocabCount,
      href,
      label: dueReviewsLabel(spec),
      estimatedMinutes: Math.max(1, Math.ceil(spec.estimatedMinutes)),
      objectives: spec.objectives.map((o) => ({
        id: o.objectiveId,
        key: o.objectiveKey,
        text: o.text,
        courseId: o.courseId,
        reason: o.reason,
        retentionCheckpoint: o.retentionCheckpoint,
        due: o.due,
      })),
      nextDueAt: spec.nextDueAt,
    };
  } catch (err) {
    console.warn("[tutor/scheduler] loadDueReviews:", err instanceof Error ? err.message : err);
    return empty;
  }
}

/**
 * Retention accuracy for staff insights: share of answered 7/30-day retention checks that passed, from the
 * `learner_retention_checks` view. Callers must authorise the staff member for `companyId` first.
 */
export async function loadRetentionAccuracy(input: {
  companyId: string;
  courseId?: string | null;
  client?: unknown;
}): Promise<{ available: false } | { available: true; summary: RetentionSummary }> {
  let q = db(input.client)
    .from("learner_retention_checks")
    .select("checkpoint_days, passed")
    .eq("company_id", input.companyId);
  if (input.courseId) q = q.eq("course_id", input.courseId);
  const res = await q.limit(10000);
  if (res.error) {
    if (!isSchemaUnavailableError(res.error)) warn("retention", res.error);
    return { available: false };
  }
  const rows = (res.data ?? []) as Array<{ checkpoint_days: number; passed: boolean | null }>;
  return {
    available: true,
    summary: summariseRetention(rows.map((r) => ({ checkpoint: r.checkpoint_days, passed: r.passed }))),
  };
}
