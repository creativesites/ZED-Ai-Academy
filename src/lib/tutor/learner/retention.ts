// Delayed retention checks (P2-07, Architecture §4.5).
//
// A retention check is just a review scheduled 7 and 30 days after an objective first reached `secure`
// (`learner_mastery.secured_at`). The first evidence at or after a checkpoint is the check: it passes when the
// outcome is a successful review under the knowledge rule (score ≥ KNOWLEDGE_PARAMS.successAtLeast).
//
// Pure: no I/O. The SQL view `public.learner_retention_checks` (migration 20261125000500) grades the same way so
// staff insights can aggregate in the database; keep the two in step.

import { KNOWLEDGE_PARAMS } from "./knowledge.ts";

export const RETENTION_CHECK_DAYS = [7, 30] as const;
export type RetentionCheckpoint = (typeof RETENTION_CHECK_DAYS)[number];

const DAY_MS = 86_400_000;

function ms(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  return Number.isFinite(t) ? t : null;
}

export function retentionCheckAt(securedAt: string, checkpoint: RetentionCheckpoint): string {
  return new Date(Date.parse(securedAt) + checkpoint * DAY_MS).toISOString();
}

/**
 * The retention check that is due now, if any: a checkpoint that has elapsed with no evidence since it.
 * When the learner was away past both checkpoints, the later one is reported (one review answers both).
 */
export function pendingRetentionCheck(
  state: { securedAt: string | null; lastEvidenceAt: string | null },
  nowIso: string,
): { checkpoint: RetentionCheckpoint; dueAt: string } | null {
  const secured = ms(state.securedAt);
  const now = ms(nowIso);
  if (secured === null || now === null) return null;
  const last = ms(state.lastEvidenceAt);
  let pending: { checkpoint: RetentionCheckpoint; dueAt: string } | null = null;
  for (const checkpoint of RETENTION_CHECK_DAYS) {
    const at = secured + checkpoint * DAY_MS;
    if (at <= now && (last === null || last < at)) {
      pending = { checkpoint, dueAt: new Date(at).toISOString() };
    }
  }
  return pending;
}

/** The next retention checkpoint still in the future and not yet answered, for scheduling. */
export function nextRetentionCheckAt(
  state: { securedAt: string | null; lastEvidenceAt: string | null },
  nowIso: string,
): string | null {
  const secured = ms(state.securedAt);
  const now = ms(nowIso);
  if (secured === null || now === null) return null;
  for (const checkpoint of RETENTION_CHECK_DAYS) {
    const at = secured + checkpoint * DAY_MS;
    if (at > now) return new Date(at).toISOString();
  }
  return null;
}

export type RetentionEvidence = { at: string; score: number };

export type RetentionCheckResult = {
  checkpoint: RetentionCheckpoint;
  dueAt: string;
  /** not_due: checkpoint in the future; pending: due, unanswered; passed/failed: answered by `checkedAt`. */
  status: "not_due" | "pending" | "passed" | "failed";
  checkedAt: string | null;
  score: number | null;
};

/** Grades both retention checkpoints of one secured objective from its evidence (any order). */
export function gradeRetentionChecks(
  securedAt: string | null,
  evidence: ReadonlyArray<RetentionEvidence>,
  nowIso: string,
): RetentionCheckResult[] {
  const secured = ms(securedAt);
  const now = ms(nowIso);
  if (secured === null || now === null) return [];
  const sorted = evidence
    .map((e) => ({ t: ms(e.at), at: e.at, score: e.score }))
    .filter((e): e is { t: number; at: string; score: number } => e.t !== null && Number.isFinite(e.score))
    .sort((a, b) => a.t - b.t);
  return RETENTION_CHECK_DAYS.map((checkpoint) => {
    const due = secured + checkpoint * DAY_MS;
    const dueAt = new Date(due).toISOString();
    const first = sorted.find((e) => e.t >= due);
    if (first) {
      return {
        checkpoint,
        dueAt,
        status: first.score >= KNOWLEDGE_PARAMS.successAtLeast ? "passed" : "failed",
        checkedAt: first.at,
        score: first.score,
      };
    }
    return { checkpoint, dueAt, status: due <= now ? "pending" : "not_due", checkedAt: null, score: null };
  });
}

export type RetentionSummary = {
  /** Answered checks. */
  checks: number;
  passed: number;
  /** passed / checks, or null when no check was answered yet. */
  accuracy: number | null;
  byCheckpoint: Record<`d${RetentionCheckpoint}`, { checks: number; passed: number; accuracy: number | null }>;
};

/** Share of answered retention checks that passed, overall and per checkpoint. */
export function summariseRetention(
  results: ReadonlyArray<{ checkpoint: number; passed: boolean | null }>,
): RetentionSummary {
  const acc = (checks: number, passed: number) => (checks > 0 ? Math.round((passed / checks) * 1000) / 1000 : null);
  const by = { d7: { checks: 0, passed: 0 }, d30: { checks: 0, passed: 0 } };
  let checks = 0;
  let passed = 0;
  for (const r of results) {
    if (r.passed === null) continue;
    const bucket = r.checkpoint === 7 ? by.d7 : r.checkpoint === 30 ? by.d30 : null;
    if (!bucket) continue;
    checks += 1;
    bucket.checks += 1;
    if (r.passed) {
      passed += 1;
      bucket.passed += 1;
    }
  }
  return {
    checks,
    passed,
    accuracy: acc(checks, passed),
    byCheckpoint: {
      d7: { ...by.d7, accuracy: acc(by.d7.checks, by.d7.passed) },
      d30: { ...by.d30, accuracy: acc(by.d30.checks, by.d30.passed) },
    },
  };
}
