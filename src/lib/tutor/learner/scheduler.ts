// Review scheduler (P2-07, Architecture §4.5): one queue for concepts and vocab.
//
// Objectives are due by `learner_mastery.next_review_at` (set by the knowledge rule from stability) or by a
// pending retention check (7 / 30 days after first reaching secure). Vocab cards are due by
// `learner_vocab.due_at` (SM-2, srs.ts). `planReviews` picks due items within a time budget, interleaves 2–3
// objectives (different lessons first), prefers prerequisites of what the learner is studying now, and returns a
// `revision` session spec. It replaces the "3 weakest objectives" sprint selection when the v2 columns exist.
//
// Pure: no I/O, relative imports only (node:test).

import { retention } from "./knowledge.ts";
import { nextRetentionCheckAt, pendingRetentionCheck, type RetentionCheckpoint } from "./retention.ts";

export type ReviewObjective = {
  objectiveKey: string;
  /** Registered objective id; null for legacy free-text objectives. */
  objectiveId: string | null;
  text: string;
  courseId: string | null;
  lessonId?: string | null;
  /** null = unseen (never scheduled). */
  pMastery: number | null;
  stabilityDays: number;
  lastEvidenceAt: string | null;
  nextReviewAt: string | null;
  securedAt: string | null;
  /** Stored status (unseen | learning | practising | secure | needs_review). */
  status: string;
};

export type ReviewVocab = {
  vocabId: string;
  term: string;
  meaning?: string | null;
  dueAt: string;
  lapses?: number;
};

export type ReviewReason = "retention_check" | "needs_review" | "due" | "prerequisite" | "weak";

export type PlannedObjective = {
  objectiveKey: string;
  objectiveId: string | null;
  text: string;
  courseId: string | null;
  lessonId: string | null;
  reason: ReviewReason;
  /** Set when this review is a delayed retention check. */
  retentionCheckpoint: RetentionCheckpoint | null;
  /** True when the item was due (false for a weak objective added to fill the interleave). */
  due: boolean;
  /** Effective p (retention decay applied) at plan time. */
  pEffective: number | null;
};

export type RevisionStep =
  | { kind: "objective"; objectiveKey: string; minutes: number }
  | { kind: "vocab"; vocabIds: string[]; minutes: number };

export type RevisionSessionSpec = {
  origin: "revision";
  objectives: PlannedObjective[];
  vocab: ReviewVocab[];
  /** Objectives and vocab interleaved in the order the session runs them. */
  steps: RevisionStep[];
  estimatedMinutes: number;
  /** Everything due now, before budget cuts (Learning Home "due reviews"). */
  dueObjectiveCount: number;
  dueVocabCount: number;
  /** Earliest future due time among objectives not due now (for "next review on Friday"). */
  nextDueAt: string | null;
};

export type PlanReviewsInput = {
  now: string;
  objectives: ReadonlyArray<ReviewObjective>;
  vocab?: ReadonlyArray<ReviewVocab>;
  /** objective_id requires requires_id. */
  prerequisites?: ReadonlyArray<{ objectiveId: string; requiresId: string }>;
  /** Registered objective ids the learner is studying now (recent lessons / recent evidence). */
  currentObjectiveIds?: ReadonlyArray<string>;
};

export const SCHEDULER_PARAMS = {
  objectiveMinutes: 2,
  vocabMinutesPerCard: 1 / 3,
  maxObjectives: 3,
  /** Interleaving needs at least two objectives when there is time for them. */
  minObjectivesToInterleave: 2,
  maxVocab: 15,
  prerequisiteDepth: 3,
  defaultBudgetMinutes: 6,
} as const;

const DAY_MS = 86_400_000;

function ms(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  return Number.isFinite(t) ? t : null;
}

function pEffectiveOf(o: ReviewObjective, now: number): number | null {
  if (o.pMastery === null || !Number.isFinite(o.pMastery)) return null;
  const last = ms(o.lastEvidenceAt);
  const days = last === null ? 0 : Math.max(0, (now - last) / DAY_MS);
  return Math.round(o.pMastery * retention(days, o.stabilityDays) * 1e6) / 1e6;
}

/** Transitive prerequisites of the current objectives (excluding the current ones), cycle-safe. */
export function prerequisitesOf(
  current: ReadonlyArray<string>,
  edges: ReadonlyArray<{ objectiveId: string; requiresId: string }>,
  depth: number = SCHEDULER_PARAMS.prerequisiteDepth,
): Set<string> {
  const requires = new Map<string, string[]>();
  for (const e of edges) {
    const list = requires.get(e.objectiveId) ?? [];
    list.push(e.requiresId);
    requires.set(e.objectiveId, list);
  }
  const currentSet = new Set(current);
  const found = new Set<string>();
  let frontier = [...currentSet];
  for (let d = 0; d < depth && frontier.length > 0; d++) {
    const next: string[] = [];
    for (const id of frontier) {
      for (const req of requires.get(id) ?? []) {
        if (currentSet.has(req) || found.has(req)) continue;
        found.add(req);
        next.push(req);
      }
    }
    frontier = next;
  }
  return found;
}

export type ObjectiveDue = {
  due: boolean;
  reason: Exclude<ReviewReason, "prerequisite" | "weak"> | null;
  retentionCheckpoint: RetentionCheckpoint | null;
  /** When it became / becomes due. */
  dueAt: string | null;
};

/** Whether one objective is due for review now, and why. Unseen objectives are never due. */
export function objectiveDue(o: ReviewObjective, nowIso: string): ObjectiveDue {
  const now = ms(nowIso) ?? Date.now();
  if (o.pMastery === null || o.status === "unseen") {
    return { due: false, reason: null, retentionCheckpoint: null, dueAt: null };
  }
  const check = pendingRetentionCheck(o, nowIso);
  const next = ms(o.nextReviewAt);
  const reviewDue = next !== null && next <= now;
  if (check || reviewDue) {
    const p = pEffectiveOf(o, now);
    // Below the keep-secure threshold (knowledge rule hysteresis): the objective has slipped.
    const slipped = o.status === "needs_review" || (o.securedAt !== null && p !== null && p < 0.7);
    const dueAt = check ? check.dueAt : new Date(next as number).toISOString();
    return {
      due: true,
      reason: slipped ? "needs_review" : check ? "retention_check" : "due",
      // A retention check stays a retention check for accuracy reporting even when the objective slipped.
      retentionCheckpoint: check ? check.checkpoint : null,
      dueAt,
    };
  }
  // Not due: the earliest of the stability-based review and the next retention checkpoint.
  const retentionAt = ms(nextRetentionCheckAt(o, nowIso));
  const candidates = [next, retentionAt].filter((t): t is number => t !== null && t > now);
  return {
    due: false,
    reason: null,
    retentionCheckpoint: null,
    dueAt: candidates.length > 0 ? new Date(Math.min(...candidates)).toISOString() : null,
  };
}

const REASON_RANK: Record<Exclude<ReviewReason, "prerequisite" | "weak">, number> = {
  needs_review: 4,
  retention_check: 3,
  due: 2,
};

/**
 * Orders `picked` so that consecutive objectives come from different lessons where possible, keeping the
 * priority order otherwise (interleaving).
 */
function interleaveByLesson<T extends { lessonId: string | null; courseId: string | null }>(items: T[]): T[] {
  const out: T[] = [];
  const rest = [...items];
  while (rest.length > 0) {
    const prev = out[out.length - 1];
    const prevTopic = prev ? `${prev.courseId ?? ""}:${prev.lessonId ?? ""}` : null;
    let idx = rest.findIndex((r) => `${r.courseId ?? ""}:${r.lessonId ?? ""}` !== prevTopic || !r.lessonId);
    if (idx < 0) idx = 0;
    out.push(rest.splice(idx, 1)[0]);
  }
  return out;
}

/** Picks up to `limit` items, preferring different lessons, in priority order. */
function pickSpread<T extends { lessonId: string | null; courseId: string | null }>(ranked: T[], limit: number): T[] {
  const picked: T[] = [];
  const topics = new Set<string>();
  for (const r of ranked) {
    if (picked.length >= limit) break;
    const topic = r.lessonId ? `${r.courseId ?? ""}:${r.lessonId}` : null;
    if (topic && topics.has(topic)) continue;
    picked.push(r);
    if (topic) topics.add(topic);
  }
  for (const r of ranked) {
    if (picked.length >= limit) break;
    if (!picked.includes(r)) picked.push(r);
  }
  return picked;
}

/**
 * Plans one revision session within `budgetMinutes`.
 *   - due objectives ranked: prerequisite of current study first, then needs_review > retention check > due,
 *     then most overdue relative to stability, then lowest effective p;
 *   - 2–3 objectives picked from different lessons where possible; if fewer than 2 are due and there is time,
 *     the weakest learning/practising objectives fill the interleave (marked `due: false`);
 *   - due vocab (oldest first, most lapses first on ties) fills the remaining time and is interleaved between
 *     the objectives.
 */
export function planReviews(input: PlanReviewsInput, budgetMinutes: number): RevisionSessionSpec {
  const P = SCHEDULER_PARAMS;
  const nowIso = input.now;
  const now = ms(nowIso) ?? Date.now();
  const budget = Number.isFinite(budgetMinutes) && budgetMinutes > 0 ? budgetMinutes : 0;
  const prereqs = prerequisitesOf(input.currentObjectiveIds ?? [], input.prerequisites ?? []);

  type Ranked = PlannedObjective & { rank: number[] };
  const dueRanked: Ranked[] = [];
  const weak: Ranked[] = [];
  let nextDue: number | null = null;
  const seenKeys = new Set<string>();

  for (const o of input.objectives) {
    if (!o.objectiveKey || !o.text.trim() || seenKeys.has(o.objectiveKey)) continue;
    seenKeys.add(o.objectiveKey);
    const d = objectiveDue(o, nowIso);
    const pEff = pEffectiveOf(o, now);
    const isPrereq = !!o.objectiveId && prereqs.has(o.objectiveId);
    const base = {
      objectiveKey: o.objectiveKey,
      objectiveId: o.objectiveId,
      text: o.text.trim(),
      courseId: o.courseId,
      lessonId: o.lessonId ?? null,
      pEffective: pEff,
    };
    if (d.due && d.reason) {
      const dueAt = ms(d.dueAt) ?? now;
      const overdue = Math.max(0, (now - dueAt) / DAY_MS) / Math.max(1, o.stabilityDays);
      dueRanked.push({
        ...base,
        reason: isPrereq ? "prerequisite" : d.reason,
        retentionCheckpoint: d.retentionCheckpoint,
        due: true,
        rank: [isPrereq ? 1 : 0, REASON_RANK[d.reason], Math.min(overdue, 10), 1 - (pEff ?? 0)],
      });
    } else {
      const at = ms(d.dueAt);
      if (at !== null && (nextDue === null || at < nextDue)) nextDue = at;
      if (pEff !== null && (o.status === "learning" || o.status === "practising")) {
        weak.push({
          ...base,
          reason: "weak",
          retentionCheckpoint: null,
          due: false,
          rank: [isPrereq ? 1 : 0, 0, 0, 1 - pEff],
        });
      }
    }
  }

  const byRank = (a: Ranked, b: Ranked) => {
    for (let i = 0; i < a.rank.length; i++) {
      if (a.rank[i] !== b.rank[i]) return b.rank[i] - a.rank[i];
    }
    return a.objectiveKey.localeCompare(b.objectiveKey);
  };
  dueRanked.sort(byRank);
  weak.sort(byRank);

  const slots = Math.min(P.maxObjectives, Math.floor(budget / P.objectiveMinutes));
  let picked: Ranked[] = pickSpread(dueRanked, slots);
  if (picked.length < Math.min(P.minObjectivesToInterleave, slots)) {
    const fill = pickSpread(
      weak.filter((w) => !picked.some((p) => p.objectiveKey === w.objectiveKey)),
      Math.min(P.minObjectivesToInterleave, slots) - picked.length,
    );
    picked = [...picked, ...fill];
  }
  const objectives: PlannedObjective[] = interleaveByLesson(picked).map((p) => {
    const { rank: _rank, ...rest } = p;
    void _rank;
    return rest;
  });

  const dueVocab = (input.vocab ?? [])
    .filter((v) => {
      const t = ms(v.dueAt);
      return t !== null && t <= now && !!v.vocabId;
    })
    .sort((a, b) => (ms(a.dueAt) ?? 0) - (ms(b.dueAt) ?? 0) || (b.lapses ?? 0) - (a.lapses ?? 0));
  const vocabMinutes = Math.max(0, budget - objectives.length * P.objectiveMinutes);
  const vocabCount = Math.min(P.maxVocab, dueVocab.length, Math.floor(vocabMinutes / P.vocabMinutesPerCard + 1e-9));
  const vocab = dueVocab.slice(0, vocabCount);

  // Interleave: objective, vocab chunk, objective, vocab chunk, ...
  const steps: RevisionStep[] = [];
  const gaps = Math.max(1, objectives.length);
  const chunkSize = Math.ceil(vocab.length / gaps);
  let v = 0;
  const pushVocab = () => {
    if (v >= vocab.length) return;
    const chunk = vocab.slice(v, v + chunkSize);
    v += chunk.length;
    steps.push({
      kind: "vocab",
      vocabIds: chunk.map((c) => c.vocabId),
      minutes: Math.round(chunk.length * P.vocabMinutesPerCard * 100) / 100,
    });
  };
  for (const o of objectives) {
    steps.push({ kind: "objective", objectiveKey: o.objectiveKey, minutes: P.objectiveMinutes });
    pushVocab();
  }
  while (v < vocab.length) pushVocab();

  const estimatedMinutes = Math.round(steps.reduce((s, x) => s + x.minutes, 0) * 100) / 100;

  return {
    origin: "revision",
    objectives,
    vocab,
    steps,
    estimatedMinutes,
    dueObjectiveCount: dueRanked.length,
    dueVocabCount: dueVocab.length,
    nextDueAt: nextDue === null ? null : new Date(nextDue).toISOString(),
  };
}

/** Learning Home copy for the due-reviews line: "3 reviews due · 12 cards". */
export function dueReviewsLabel(spec: Pick<RevisionSessionSpec, "dueObjectiveCount" | "dueVocabCount">): string | null {
  const parts: string[] = [];
  if (spec.dueObjectiveCount > 0) {
    parts.push(`${spec.dueObjectiveCount} ${spec.dueObjectiveCount === 1 ? "review" : "reviews"} due`);
  }
  if (spec.dueVocabCount > 0) {
    parts.push(`${spec.dueVocabCount} ${spec.dueVocabCount === 1 ? "card" : "cards"} due`);
  }
  return parts.length > 0 ? parts.join(" · ") : null;
}
