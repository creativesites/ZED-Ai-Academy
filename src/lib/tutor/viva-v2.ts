// Certificate oral check ("viva") v2 rules (P2-08, D-14).
//
//   * Outcome `pass | needs_review | not_yet` from the session evidence (report objectives, graded evidence or
//     task score) AND the learner's mastery of the course objectives, under a per-course rubric.
//   * Certificate gate: issuance requires `pass` or a staff approval. A course that never required a viva is
//     never blocked; a course that requires one never silently passes (misconfigured / unavailable are explicit
//     states, not passes).
//   * Human route: `needs_review` goes to a staff queue; a learner may request one human review per course.
//
// Pure: no I/O, relative imports only (node:test). DB glue: src/lib/tutor/server/viva.ts.

export const VIVA_OUTCOMES = ["pass", "needs_review", "not_yet"] as const;
export type VivaOutcome = (typeof VIVA_OUTCOMES)[number];

// ─── Rubric ──────────────────────────────────────────────────────────────────

export type VivaRubric = {
  version: 1;
  /** Share of viva objectives that must be "met" (0..1). Legacy rule: half, rounded up. */
  minMetShare: number;
  /** How many objectives may still be "review" for a pass. Legacy rule: 0. */
  maxReviewObjectives: number;
  /** Task score (0..100) that passes when the session recorded no objectives. Legacy rule: 65. */
  minTaskScore: number;
  /** Within this margin below the pass line the session is borderline → human review instead of not_yet. */
  borderlineMargin: number;
  /**
   * Share of the course's registered objectives the learner must hold at practising or secure (0 = off).
   * A strong session with weaker course evidence goes to human review, never to an automatic not_yet.
   */
  minMasteryShare: number;
  /** Every AI pass is confirmed by staff before a certificate is issued. */
  requireHumanApproval: boolean;
  /** Learners may request one human review of a not_yet. */
  allowAppeal: boolean;
};

export const DEFAULT_VIVA_RUBRIC: VivaRubric = {
  version: 1,
  minMetShare: 0.5,
  maxReviewObjectives: 0,
  minTaskScore: 65,
  borderlineMargin: 0.2,
  minMasteryShare: 0.5,
  requireHumanApproval: false,
  allowAppeal: true,
};

/** The rule before rubrics existed. Used while the rubric column is not migrated, so behaviour is unchanged. */
export const LEGACY_VIVA_RUBRIC: VivaRubric = { ...DEFAULT_VIVA_RUBRIC, minMasteryShare: 0 };

function clampNum(v: unknown, min: number, max: number, fallback: number): number {
  const n = typeof v === "number" ? v : typeof v === "string" && v.trim() !== "" ? Number(v) : NaN;
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, n));
}

/** Parses a stored `courses.viva_rubric` (any shape) into a safe rubric; unknown/missing fields → fallback. */
export function normalizeVivaRubric(raw: unknown, fallback: VivaRubric = DEFAULT_VIVA_RUBRIC): VivaRubric {
  const r = raw && typeof raw === "object" && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
  return {
    version: 1,
    minMetShare: clampNum(r.minMetShare, 0.1, 1, fallback.minMetShare),
    maxReviewObjectives: Math.round(clampNum(r.maxReviewObjectives, 0, 10, fallback.maxReviewObjectives)),
    minTaskScore: Math.round(clampNum(r.minTaskScore, 1, 100, fallback.minTaskScore)),
    borderlineMargin: clampNum(r.borderlineMargin, 0, 0.5, fallback.borderlineMargin),
    minMasteryShare: clampNum(r.minMasteryShare, 0, 1, fallback.minMasteryShare),
    requireHumanApproval:
      typeof r.requireHumanApproval === "boolean" ? r.requireHumanApproval : fallback.requireHumanApproval,
    allowAppeal: typeof r.allowAppeal === "boolean" ? r.allowAppeal : fallback.allowAppeal,
  };
}

// ─── Outcome ─────────────────────────────────────────────────────────────────

export type VivaSessionEvidence = {
  /** Report objective outcomes (met | partial | review). */
  objectives?: ReadonlyArray<{ status: string }> | null;
  /** Report task score 0..100. */
  taskScore?: number | null;
  /** Evidence rows the session recorded (note_evidence / graded checks). */
  evidence?: { correct: number; partial: number; misconception: number } | null;
};

export type VivaMasterySummary = {
  /** Active registered objectives of the course. */
  total: number;
  secure: number;
  practising: number;
};

export type VivaDecision = {
  outcome: VivaOutcome;
  reason: string;
  session: "pass" | "borderline" | "fail" | "none";
  mastery: "ok" | "low" | "not_applicable";
  metCount: number;
  totalObjectives: number;
  /** (secure + practising) / total, when the course has registered objectives and mastery was readable. */
  masteryShare: number | null;
};

function sessionSignal(
  rubric: VivaRubric,
  s: VivaSessionEvidence,
): { signal: VivaDecision["session"]; metCount: number; total: number; detail: string } {
  const objectives = Array.isArray(s.objectives) ? s.objectives : [];
  if (objectives.length > 0) {
    const met = objectives.filter((o) => o.status === "met").length;
    const review = objectives.filter((o) => o.status === "review").length;
    const share = met / objectives.length;
    const detail = `${met} of ${objectives.length} viva objectives met${review > 0 ? `, ${review} to review` : ""}`;
    if (review <= rubric.maxReviewObjectives && share >= rubric.minMetShare - 1e-9) {
      return { signal: "pass", metCount: met, total: objectives.length, detail };
    }
    const borderline = share >= rubric.minMetShare - rubric.borderlineMargin - 1e-9 && review <= rubric.maxReviewObjectives + 1;
    return { signal: borderline ? "borderline" : "fail", metCount: met, total: objectives.length, detail };
  }
  const ev = s.evidence;
  const evTotal = ev ? ev.correct + ev.partial + ev.misconception : 0;
  if (ev && evTotal > 0) {
    const share = (ev.correct + 0.5 * ev.partial) / evTotal;
    const detail = `${ev.correct} correct, ${ev.partial} partial, ${ev.misconception} misconception checks`;
    if (share >= rubric.minMetShare - 1e-9 && ev.misconception <= rubric.maxReviewObjectives) {
      return { signal: "pass", metCount: ev.correct, total: evTotal, detail };
    }
    const borderline = share >= rubric.minMetShare - rubric.borderlineMargin - 1e-9;
    return { signal: borderline ? "borderline" : "fail", metCount: ev.correct, total: evTotal, detail };
  }
  if (typeof s.taskScore === "number" && Number.isFinite(s.taskScore)) {
    const detail = `task score ${s.taskScore}/100`;
    if (s.taskScore >= rubric.minTaskScore) return { signal: "pass", metCount: 0, total: 0, detail };
    const borderline = s.taskScore >= rubric.minTaskScore - rubric.borderlineMargin * 100;
    return { signal: borderline ? "borderline" : "fail", metCount: 0, total: 0, detail };
  }
  return { signal: "none", metCount: 0, total: 0, detail: "no checks recorded" };
}

/**
 * Combines the session signal with course mastery:
 *   session pass  + mastery ok / n.a.      → pass (needs_review when the rubric requires human approval)
 *   session pass  + mastery low            → needs_review (conflicting evidence goes to a person)
 *   borderline    + mastery ok / n.a.      → needs_review
 *   otherwise                              → not_yet
 * Mastery is "not applicable" when the rubric does not use it, the course has no registered objectives, or
 * mastery could not be read (then the session alone decides, exactly as before P2-08).
 */
export function decideVivaOutcome(input: {
  rubric: VivaRubric;
  session: VivaSessionEvidence;
  mastery: VivaMasterySummary | null;
}): VivaDecision {
  const { rubric } = input;
  const s = sessionSignal(rubric, input.session);
  let mastery: VivaDecision["mastery"] = "not_applicable";
  let masteryShare: number | null = null;
  if (input.mastery && input.mastery.total > 0) {
    masteryShare = Math.round(((input.mastery.secure + input.mastery.practising) / input.mastery.total) * 1000) / 1000;
    if (rubric.minMasteryShare > 0) mastery = masteryShare >= rubric.minMasteryShare - 1e-9 ? "ok" : "low";
  }
  const base = { session: s.signal, mastery, metCount: s.metCount, totalObjectives: s.total, masteryShare };

  if (s.signal === "none") {
    return { ...base, outcome: "not_yet", reason: "Finish the oral check with your teacher so your understanding can be checked." };
  }
  if (s.signal === "pass" && mastery !== "low") {
    if (rubric.requireHumanApproval) {
      return { ...base, outcome: "needs_review", reason: `Passed the oral check (${s.detail}). Your teacher confirms every pass.` };
    }
    return { ...base, outcome: "pass", reason: `Passed the oral check (${s.detail}).` };
  }
  if (s.signal === "pass") {
    return {
      ...base,
      outcome: "needs_review",
      reason: `Strong oral check (${s.detail}), but your course work shows fewer objectives secure yet. Your teacher will review.`,
    };
  }
  if (s.signal === "borderline" && mastery !== "low") {
    return { ...base, outcome: "needs_review", reason: `Close to the pass line (${s.detail}). Your teacher will review.` };
  }
  return { ...base, outcome: "not_yet", reason: `Almost there (${s.detail}). Revise and try the oral check again.` };
}

/** Counts the learner's course objectives at practising/secure for `decideVivaOutcome`. */
export function summariseVivaMastery(
  totalActiveObjectives: number,
  effectiveStatuses: ReadonlyArray<string>,
): VivaMasterySummary {
  const total = Math.max(0, Math.floor(totalActiveObjectives));
  const secure = effectiveStatuses.filter((s) => s === "secure").length;
  const practising = effectiveStatuses.filter((s) => s === "practising").length;
  return { total, secure: Math.min(secure, total), practising: Math.min(practising, Math.max(0, total - secure)) };
}

// ─── Reviews and appeals ─────────────────────────────────────────────────────

export const VIVA_REVIEW_KINDS = ["needs_review", "appeal"] as const;
export type VivaReviewKind = (typeof VIVA_REVIEW_KINDS)[number];
export const VIVA_REVIEW_STATUSES = ["pending", "approved", "returned"] as const;
export type VivaReviewStatus = (typeof VIVA_REVIEW_STATUSES)[number];

export type VivaReviewRecord = {
  id: string;
  kind: VivaReviewKind;
  status: VivaReviewStatus;
  sessionId: string | null;
  reviewerNote: string | null;
  createdAt: string;
  decidedAt: string | null;
};

export type VivaReviewDecision = { type: "approve"; note?: string | null } | { type: "return"; note: string };

export const MAX_REVIEWER_NOTE = 2000;
export const MAX_APPEAL_NOTE = 1000;

/**
 * Staff decision on a review: only a pending review can be decided; returning requires a note for the learner.
 * Decisions are final (a returned learner retakes the oral check; an approval unlocks the certificate).
 */
export function transitionVivaReview(
  review: { status: VivaReviewStatus },
  decision: VivaReviewDecision,
): { ok: true; status: Exclude<VivaReviewStatus, "pending">; note: string | null } | { ok: false; error: string } {
  if (review.status !== "pending") return { ok: false, error: "This review has already been decided." };
  const note = (decision.note ?? "").trim().slice(0, MAX_REVIEWER_NOTE);
  if (decision.type === "approve") return { ok: true, status: "approved", note: note || null };
  if (decision.type === "return") {
    if (!note) return { ok: false, error: "Add a note telling the learner what to work on." };
    return { ok: true, status: "returned", note };
  }
  return { ok: false, error: "Unknown decision." };
}

// ─── Certificate gate ────────────────────────────────────────────────────────

export type VivaGateState =
  | "not_required"
  | "misconfigured"
  | "unavailable"
  | "not_started"
  | "needs_review"
  | "not_yet"
  | "pass"
  | "approved";

export type VivaAttempt = { sessionId: string; endedAt: string | null; decision: VivaDecision };

export type VivaGateInput = {
  /** courses.require_certificate_viva; null when the column is not migrated (then no course can require it). */
  required: boolean | null;
  /** The configured viva flow exists and is published. */
  scenarioReady: boolean;
  /** Completed viva sessions, newest first. */
  attempts: ReadonlyArray<VivaAttempt>;
  /** Reviews for this learner and course; null when the reviews table is not migrated. */
  reviews: ReadonlyArray<VivaReviewRecord> | null;
  rubric: VivaRubric;
};

export type VivaGate = {
  state: VivaGateState;
  allowCertificate: boolean;
  outcome: VivaOutcome | null;
  reason: string | null;
  /** The learner may ask for a human review now. */
  canRequestReview: boolean;
  /** A needs_review outcome with no review row yet: the caller queues one for this session. */
  queueReviewForSessionId: string | null;
  latestSessionId: string | null;
};

function hasAppeal(reviews: ReadonlyArray<VivaReviewRecord>): boolean {
  return reviews.some((r) => r.kind === "appeal");
}

/**
 * Decides whether a certificate may be issued for a course that may require an oral check.
 * Order: not required → staff approval → any passing attempt → pending review → misconfigured → no attempt →
 * latest attempt's outcome. Only `not_required`, `pass` and `approved` allow a certificate.
 */
export function decideVivaGate(input: VivaGateInput): VivaGate {
  const latest = input.attempts[0] ?? null;
  const gate = (g: Partial<VivaGate> & Pick<VivaGate, "state" | "reason">): VivaGate => ({
    allowCertificate: false,
    outcome: null,
    canRequestReview: false,
    queueReviewForSessionId: null,
    latestSessionId: latest?.sessionId ?? null,
    ...g,
  });

  if (input.required !== true) return gate({ state: "not_required", reason: null, allowCertificate: true });

  const reviews = input.reviews;
  const approved = reviews?.find((r) => r.status === "approved");
  if (approved) {
    return gate({ state: "approved", reason: "Your teacher approved your oral check.", allowCertificate: true, outcome: "pass" });
  }

  const passing = input.attempts.find((a) => a.decision.outcome === "pass");
  if (passing) return gate({ state: "pass", reason: passing.decision.reason, allowCertificate: true, outcome: "pass" });

  const pending = reviews?.find((r) => r.status === "pending");
  if (pending) {
    return gate({
      state: "needs_review",
      outcome: "needs_review",
      reason: "Sent to your teacher for review. You'll be able to claim your certificate once they approve it.",
    });
  }

  const appealOpen = reviews !== null && input.rubric.allowAppeal && !hasAppeal(reviews);

  if (!input.scenarioReady) {
    return gate({
      state: "misconfigured",
      reason:
        "This course needs an oral check before the certificate, but it isn't ready yet. " +
        (appealOpen ? "You can ask your teacher to review your course work instead." : "Your teacher has been told."),
      canRequestReview: appealOpen,
    });
  }

  if (!latest) {
    return gate({ state: "not_started", reason: "Last step: a short oral check with your teacher to unlock your certificate." });
  }

  const decision = latest.decision;
  const returnedFor = (sessionId: string | null) =>
    reviews?.find((r) => r.status === "returned" && (r.kind === "appeal" || r.sessionId === sessionId)) ?? null;

  if (decision.outcome === "needs_review") {
    if (reviews === null) {
      return gate({
        state: "unavailable",
        outcome: "needs_review",
        reason:
          "Your oral check needs a teacher's review, but reviews aren't switched on yet. Your certificate stays locked until a teacher can review it.",
      });
    }
    const returned = reviews.find((r) => r.kind === "needs_review" && r.sessionId === latest.sessionId && r.status === "returned");
    if (returned) {
      return gate({
        state: "not_yet",
        outcome: "not_yet",
        reason: `Your teacher reviewed your oral check: ${returned.reviewerNote ?? "please revise and try again."}`,
        canRequestReview: appealOpen,
      });
    }
    return gate({
      state: "needs_review",
      outcome: "needs_review",
      reason: "Sent to your teacher for review. You'll be able to claim your certificate once they approve it.",
      queueReviewForSessionId: latest.sessionId,
    });
  }

  const returned = returnedFor(latest.sessionId);
  return gate({
    state: "not_yet",
    outcome: "not_yet",
    reason: returned?.reviewerNote ? `${decision.reason} Your teacher's note: ${returned.reviewerNote}` : decision.reason,
    canRequestReview: appealOpen,
  });
}

/** Whether a learner's request for a human review may be accepted (server re-checks with fresh state). */
export function canRequestVivaReview(gate: Pick<VivaGate, "state" | "canRequestReview">): boolean {
  return gate.canRequestReview && (gate.state === "not_yet" || gate.state === "misconfigured");
}

/** Trims and bounds a learner's appeal note. */
export function cleanAppealNote(note: unknown): string | null {
  if (typeof note !== "string") return null;
  const t = note.trim().slice(0, MAX_APPEAL_NOTE);
  return t.length > 0 ? t : null;
}
