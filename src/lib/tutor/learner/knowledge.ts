// Learner knowledge model: the evidence weighting and mastery update rule (Architecture §4.2, D-06).
//
// Pure: no I/O and no "@/" imports, so it runs under node:test. The SQL function
// `public.record_evidence(...)` (migration 20261125000201) implements the same rule; both are checked
// against the shared fixtures in `supabase/tests/tutor/fixtures/knowledge_parity.json`.
// Keep the two in step: any change here needs the same change in the SQL function and new fixtures.

export const EVIDENCE_SOURCES = [
  "quiz",
  "interaction",
  "widget",
  "viva_check",
  "teacher_judgement",
  "self_report",
  "legacy_ai",
] as const;
export type EvidenceSource = (typeof EVIDENCE_SOURCES)[number];

export const MASTERY_STATUSES = ["unseen", "learning", "practising", "secure", "needs_review"] as const;
export type MasteryStatus = (typeof MASTERY_STATUSES)[number];

export type EvidenceOutcome = "correct" | "partial" | "misconception";

/** Every tunable number of the rule, in one place (D-06). Mirrored as literals in the SQL function. */
export const KNOWLEDGE_PARAMS = {
  sourceWeight: {
    quiz: 1.0,
    interaction: 1.0,
    widget: 1.0,
    viva_check: 1.0,
    teacher_judgement: 0.5,
    self_report: 0.1,
    legacy_ai: 0.4,
  } satisfies Record<EvidenceSource, number>,
  /** difficulty 1 (recall) .. 3 (transfer / independent task); null = 2. */
  difficultyFactor: { 1: 0.8, 2: 1.0, 3: 1.2 } as Record<1 | 2 | 3, number>,
  unverifiedFactor: 0.6,
  /** p before any evidence. Below the learning threshold: we do not assume knowledge. */
  priorP: 0.3,
  alphaFirst: 0.35,
  alphaLater: 0.25,
  /** Evidence mass decays with this time constant (days) — "recent = last 60 days, recency-discounted". */
  massTauDays: 60,
  /** confidence = 1 − exp(−mass / confidenceScale) */
  confidenceScale: 3,
  initialStabilityDays: 1,
  minStabilityDays: 1,
  maxStabilityDays: 365,
  /** A review is "spaced" when the gap since the last evidence is ≥ this × stability. */
  spacedGapRatio: 0.5,
  /** Outcome at or above this counts as a successful review; below failureBelow counts as a failure. */
  successAtLeast: 0.75,
  failureBelow: 0.5,
  /** Stability growth on a successful spaced review: base + bonus × min(1, weight). Range 2.0–2.5. */
  growthBase: 2.0,
  growthBonus: 0.5,
  failureShrink: 0.5,
  learningBelow: 0.4,
  secureAtLeast: 0.8,
  secureConfidence: 0.5,
  /** Hysteresis: once secured, an objective stays secure until p_eff drops below this; then needs_review. */
  keepSecureAtLeast: 0.7,
  minDistinctSourcesForSecure: 2,
  targetRecall: 0.85,
} as const;

const DAY_MS = 86_400_000;

export type KnowledgeState = {
  /** null = unseen (no p-updating evidence yet). */
  pMastery: number | null;
  confidence: number;
  evidenceMass: number;
  stabilityDays: number;
  evidenceCount: number;
  /** Distinct sources that moved p (self_report and legacy_ai never count). */
  evidenceSources: string[];
  spacedReviews: number;
  lastEvidenceAt: string | null;
  securedAt: string | null;
  nextReviewAt: string | null;
  status: MasteryStatus;
  lastResult: EvidenceOutcome | null;
};

export type EvidenceInput = {
  source: EvidenceSource;
  serverVerified: boolean;
  /** Learner outcome. Used when score is null. */
  result: EvidenceOutcome;
  /** 0..1, overrides result when present. */
  score?: number | null;
  difficulty?: number | null;
  /** ISO timestamp of the evidence. */
  at: string;
};

export function emptyKnowledgeState(): KnowledgeState {
  return {
    pMastery: null,
    confidence: 0,
    evidenceMass: 0,
    stabilityDays: KNOWLEDGE_PARAMS.initialStabilityDays,
    evidenceCount: 0,
    evidenceSources: [],
    spacedReviews: 0,
    lastEvidenceAt: null,
    securedAt: null,
    nextReviewAt: null,
    status: "unseen",
    lastResult: null,
  };
}

export function isEvidenceSource(value: unknown): value is EvidenceSource {
  return typeof value === "string" && (EVIDENCE_SOURCES as readonly string[]).includes(value);
}

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(1, n));
}

export function outcomeScore(result: EvidenceOutcome, score?: number | null): number {
  if (typeof score === "number" && Number.isFinite(score)) return clamp01(score);
  if (result === "correct") return 1;
  if (result === "partial") return 0.5;
  return 0;
}

export function difficultyFactor(difficulty?: number | null): number {
  if (difficulty === 1 || difficulty === 2 || difficulty === 3) return KNOWLEDGE_PARAMS.difficultyFactor[difficulty];
  return 1;
}

/** w = sourceWeight[source] × difficultyFactor × (server_verified ? 1 : 0.6) */
export function evidenceWeight(input: Pick<EvidenceInput, "source" | "serverVerified" | "difficulty">): number {
  const base = KNOWLEDGE_PARAMS.sourceWeight[input.source] ?? KNOWLEDGE_PARAMS.sourceWeight.legacy_ai;
  return base * difficultyFactor(input.difficulty) * (input.serverVerified ? 1 : KNOWLEDGE_PARAMS.unverifiedFactor);
}

function daysBetween(fromIso: string | null, toIso: string): number {
  if (!fromIso) return 0;
  const from = Date.parse(fromIso);
  const to = Date.parse(toIso);
  if (!Number.isFinite(from) || !Number.isFinite(to)) return 0;
  return Math.max(0, (to - from) / DAY_MS);
}

/** r(t) = exp(−t / stability) */
export function retention(daysSinceEvidence: number, stabilityDays: number): number {
  const s = Math.max(KNOWLEDGE_PARAMS.minStabilityDays, stabilityDays);
  return Math.exp(-Math.max(0, daysSinceEvidence) / s);
}

export function confidenceFromMass(mass: number): number {
  return clamp01(1 - Math.exp(-Math.max(0, mass) / KNOWLEDGE_PARAMS.confidenceScale));
}

/** Days until predicted recall falls to the target (85%): stability × ln(1 / 0.85). */
export function reviewIntervalDays(stabilityDays: number): number {
  return stabilityDays * Math.log(1 / KNOWLEDGE_PARAMS.targetRecall);
}

export function deriveStatus(input: {
  pEffective: number | null;
  confidence: number;
  distinctSources: number;
  spacedReviews: number;
  securedAt: string | null;
}): MasteryStatus {
  const P = KNOWLEDGE_PARAMS;
  if (input.pEffective === null) return "unseen";
  const p = input.pEffective;
  const strongEnough = input.confidence >= P.secureConfidence;
  const proven = input.distinctSources >= P.minDistinctSourcesForSecure || input.spacedReviews >= 1;
  if (p >= P.secureAtLeast && strongEnough && proven) return "secure";
  if (input.securedAt) {
    if (p >= P.keepSecureAtLeast && strongEnough) return "secure";
    if (p < P.keepSecureAtLeast) return "needs_review";
  }
  if (p < P.learningBelow) return "learning";
  return "practising";
}

/** Legacy 0..3 `level`, derived from p for backward compatibility (dual-write, D-05). */
export function legacyLevelFromP(p: number | null): number {
  if (p === null) return 0;
  if (p < 0.25) return 0;
  if (p < 0.5) return 1;
  if (p < 0.8) return 2;
  return 3;
}

/** Inverse used by the backfill: the p a legacy level most plausibly stood for. */
export function pFromLegacyLevel(level: number): number {
  const l = Math.max(0, Math.min(3, Math.round(Number.isFinite(level) ? level : 0)));
  return [0.15, 0.4, 0.65, 0.85][l];
}

const round = (n: number): number => Math.round(n * 1e6) / 1e6;

/**
 * Applies one piece of evidence to an objective's state (Architecture §4.2):
 *   p' = p + α·w·(o − p)       α = 0.35 first evidence, 0.25 after; self_report never moves p
 *   mass' = mass·exp(−Δt/60) + w;  confidence = 1 − exp(−mass'/3)
 *   stability: successful spaced review ×(2.0–2.5); failure → max(1, ×0.5)
 *   next_review_at = at + stability × ln(1/0.85)
 */
export function applyEvidence(prev: KnowledgeState, ev: EvidenceInput): KnowledgeState {
  const P = KNOWLEDGE_PARAMS;
  const w = evidenceWeight(ev);
  const o = outcomeScore(ev.result, ev.score);
  const gapDays = daysBetween(prev.lastEvidenceAt, ev.at);
  const movesP = ev.source !== "self_report";

  const mass = prev.evidenceMass * Math.exp(-gapDays / P.massTauDays) + w;
  const confidence = confidenceFromMass(mass);

  let p = prev.pMastery;
  let stability = Math.max(P.minStabilityDays, prev.stabilityDays || P.initialStabilityDays);
  let spacedReviews = prev.spacedReviews;
  let sources = prev.evidenceSources;

  if (movesP) {
    const first = p === null;
    const base = p ?? P.priorP;
    const alpha = first ? P.alphaFirst : P.alphaLater;
    p = clamp01(base + alpha * w * (o - base));

    if (!first) {
      const spaced = gapDays >= P.spacedGapRatio * stability;
      if (o >= P.successAtLeast && spaced) {
        stability = stability * (P.growthBase + P.growthBonus * Math.min(1, w));
        spacedReviews += 1;
      } else if (o < P.failureBelow) {
        stability = Math.max(P.minStabilityDays, stability * P.failureShrink);
      }
    }
    stability = Math.min(P.maxStabilityDays, stability);

    if (ev.source !== "legacy_ai" && !sources.includes(ev.source)) {
      sources = [...sources, ev.source].sort();
    }
  }

  const status = deriveStatus({
    pEffective: p,
    confidence,
    distinctSources: sources.length,
    spacedReviews,
    securedAt: prev.securedAt,
  });
  const securedAt = prev.securedAt ?? (status === "secure" ? ev.at : null);
  const nextReviewAt =
    p === null ? prev.nextReviewAt : new Date(Date.parse(ev.at) + reviewIntervalDays(stability) * DAY_MS).toISOString();

  return {
    pMastery: p === null ? null : round(p),
    confidence: round(confidence),
    evidenceMass: round(mass),
    stabilityDays: round(stability),
    evidenceCount: prev.evidenceCount + 1,
    evidenceSources: sources,
    spacedReviews,
    lastEvidenceAt: ev.at,
    securedAt,
    nextReviewAt,
    status,
    lastResult: ev.result,
  };
}

/** Applies a chronological list of evidence from an empty (or given) state. */
export function applyEvidenceSequence(evidence: ReadonlyArray<EvidenceInput>, start?: KnowledgeState): KnowledgeState {
  return evidence.reduce(applyEvidence, start ?? emptyKnowledgeState());
}

/**
 * Read-time view: retention decay applied (p_effective = p × r(t)) and status re-derived, so an objective
 * that was secure a month ago reads as needs_review today without any write.
 */
export function effectiveState(
  state: KnowledgeState,
  nowIso: string,
): { pEffective: number | null; status: MasteryStatus; due: boolean } {
  if (state.pMastery === null) return { pEffective: null, status: "unseen", due: false };
  const t = daysBetween(state.lastEvidenceAt, nowIso);
  const pEffective = round(state.pMastery * retention(t, state.stabilityDays));
  const status = deriveStatus({
    pEffective,
    confidence: state.confidence,
    distinctSources: state.evidenceSources.length,
    spacedReviews: state.spacedReviews,
    securedAt: state.securedAt,
  });
  const due = state.nextReviewAt ? Date.parse(state.nextReviewAt) <= Date.parse(nowIso) : false;
  return { pEffective, status, due };
}
