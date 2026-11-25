import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import {
  applyEvidence,
  applyEvidenceSequence,
  confidenceFromMass,
  deriveStatus,
  effectiveState,
  emptyKnowledgeState,
  evidenceWeight,
  isEvidenceSource,
  knowledgeStateFromRow,
  legacyLevelFromP,
  outcomeScore,
  pFromLegacyLevel,
  retention,
  reviewIntervalDays,
  type EvidenceInput,
  type KnowledgeState,
} from "./knowledge.ts";

const fixturesUrl = new URL("../../../../supabase/tests/tutor/fixtures/knowledge_parity.json", import.meta.url);
const fixtures = JSON.parse(readFileSync(fixturesUrl, "utf8")) as {
  tolerance: number;
  cases: Array<{ name: string; evidence: EvidenceInput[]; expected: Record<string, unknown> }>;
  effective: Array<{ name: string; evidence: EvidenceInput[]; now: string; expected: Record<string, unknown> }>;
};

const T0 = "2026-01-01T09:00:00.000Z";
const at = (days: number) => new Date(Date.parse(T0) + days * 86_400_000).toISOString();
const quiz = (result: EvidenceInput["result"], days = 0, extra: Partial<EvidenceInput> = {}): EvidenceInput => ({
  source: "quiz",
  serverVerified: true,
  result,
  at: at(days),
  ...extra,
});

function close(actual: number | null, expected: number | null, tol: number, label: string) {
  if (expected === null) {
    assert.equal(actual, null, label);
    return;
  }
  assert.ok(actual !== null, `${label}: expected ${expected}, got null`);
  assert.ok(Math.abs(actual - expected) <= tol, `${label}: expected ${expected}, got ${actual}`);
}

describe("learner/knowledge parity fixtures", () => {
  for (const c of fixtures.cases) {
    it(c.name, () => {
      const s = applyEvidenceSequence(c.evidence);
      const e = c.expected;
      close(s.pMastery, e.pMastery as number | null, fixtures.tolerance, "pMastery");
      close(s.confidence, e.confidence as number, fixtures.tolerance, "confidence");
      close(s.evidenceMass, e.evidenceMass as number, fixtures.tolerance, "evidenceMass");
      close(s.stabilityDays, e.stabilityDays as number, fixtures.tolerance, "stabilityDays");
      assert.equal(s.evidenceCount, e.evidenceCount);
      assert.deepEqual(s.evidenceSources, e.evidenceSources);
      assert.equal(s.spacedReviews, e.spacedReviews);
      assert.equal(s.status, e.status);
      assert.equal(s.securedAt, e.securedAt);
      assert.equal(s.nextReviewAt, e.nextReviewAt);
      assert.equal(legacyLevelFromP(s.pMastery), e.legacyLevel);
    });
  }
  for (const c of fixtures.effective) {
    it(c.name, () => {
      const view = effectiveState(applyEvidenceSequence(c.evidence), c.now);
      assert.deepEqual(view, c.expected);
    });
  }
});

describe("learner/knowledge rule", () => {
  it("distinguishes unseen from failed", () => {
    const unseen = emptyKnowledgeState();
    const failed = applyEvidence(unseen, quiz("misconception"));
    assert.equal(unseen.status, "unseen");
    assert.equal(unseen.pMastery, null);
    assert.equal(failed.status, "learning");
    assert.ok(failed.pMastery !== null && failed.pMastery < 0.3);
    assert.equal(legacyLevelFromP(unseen.pMastery), 0);
  });

  it("weights sources: verified quiz > teacher judgement > legacy AI > self report", () => {
    const w = (source: EvidenceInput["source"], serverVerified: boolean) =>
      evidenceWeight({ source, serverVerified, difficulty: null });
    assert.equal(w("quiz", true), 1);
    assert.ok(Math.abs(w("quiz", false) - 0.6) < 1e-9);
    assert.ok(Math.abs(w("teacher_judgement", false) - 0.3) < 1e-9);
    assert.ok(Math.abs(w("legacy_ai", false) - 0.24) < 1e-9);
    assert.ok(Math.abs(w("self_report", false) - 0.06) < 1e-9);
    assert.ok(Math.abs(evidenceWeight({ source: "quiz", serverVerified: true, difficulty: 3 }) - 1.2) < 1e-9);
    assert.ok(Math.abs(evidenceWeight({ source: "quiz", serverVerified: true, difficulty: 1 }) - 0.8) < 1e-9);
  });

  it("an AI opinion moves p less than a verified quiz", () => {
    const ai = applyEvidence(emptyKnowledgeState(), quiz("correct", 0, { source: "legacy_ai", serverVerified: false }));
    const q = applyEvidence(emptyKnowledgeState(), quiz("correct"));
    assert.ok((ai.pMastery ?? 0) < (q.pMastery ?? 0));
    assert.deepEqual(ai.evidenceSources, [], "legacy_ai never counts as an independent source");
  });

  it("self_report only adds confidence mass, never moves p or status", () => {
    const s = applyEvidence(emptyKnowledgeState(), quiz("correct", 0, { source: "self_report", serverVerified: false }));
    assert.equal(s.pMastery, null);
    assert.equal(s.status, "unseen");
    assert.ok(s.confidence > 0);
    assert.equal(s.nextReviewAt, null);
  });

  it("uses alpha 0.35 for the first evidence and 0.25 after", () => {
    const first = applyEvidence(emptyKnowledgeState(), quiz("correct"));
    assert.ok(Math.abs((first.pMastery ?? 0) - (0.3 + 0.35 * 0.7)) < 1e-9);
    const second = applyEvidence(first, quiz("correct", 0.001));
    const p1 = first.pMastery ?? 0;
    assert.ok(Math.abs((second.pMastery ?? 0) - (p1 + 0.25 * (1 - p1))) < 1e-6);
  });

  it("score overrides the coarse result", () => {
    assert.equal(outcomeScore("correct", 0.2), 0.2);
    assert.equal(outcomeScore("misconception", null), 0);
    assert.equal(outcomeScore("partial"), 0.5);
    assert.equal(outcomeScore("correct", 7), 1);
  });

  it("needs a second source or a spaced review before secure", () => {
    const massed = applyEvidenceSequence([0, 0.01, 0.02, 0.03, 0.04, 0.05].map((d) => quiz("correct", d)));
    assert.ok((massed.pMastery ?? 0) >= 0.8);
    assert.equal(massed.status, "practising");
    const spaced = applyEvidenceSequence([quiz("correct", 0), quiz("correct", 1), quiz("correct", 3), quiz("correct", 8)]);
    assert.equal(spaced.spacedReviews, 3);
    assert.equal(spaced.status, "secure");
    assert.equal(spaced.securedAt, at(8));
  });

  it("grows stability 2.0–2.5x on successful spaced reviews and halves it on failure", () => {
    const a = applyEvidence(emptyKnowledgeState(), quiz("correct", 0));
    assert.equal(a.stabilityDays, 1);
    const b = applyEvidence(a, quiz("correct", 1));
    assert.equal(b.stabilityDays, 2.5);
    const unverified = applyEvidence(a, quiz("correct", 1, { source: "teacher_judgement", serverVerified: false }));
    assert.ok(unverified.stabilityDays >= 2 && unverified.stabilityDays < 2.5);
    const massed = applyEvidence(b, quiz("correct", 1.1)); // gap 0.1 < 0.5 × 2.5
    assert.equal(massed.stabilityDays, 2.5);
    const failed = applyEvidence(b, quiz("misconception", 4));
    assert.equal(failed.stabilityDays, 1.25);
    const floor = applyEvidence(a, quiz("misconception", 0.1));
    assert.equal(floor.stabilityDays, 1, "stability never drops below 1 day");
    const partial = applyEvidence(b, quiz("partial", 4));
    assert.equal(partial.stabilityDays, 2.5, "a partial answer neither grows nor shrinks stability");
  });

  it("schedules next review for 85% predicted recall", () => {
    const s = applyEvidence(emptyKnowledgeState(), quiz("correct", 0));
    const expectedMs = Date.parse(at(0)) + reviewIntervalDays(1) * 86_400_000;
    assert.equal(Date.parse(s.nextReviewAt ?? ""), Math.trunc(expectedMs));
    assert.ok(Math.abs(retention(reviewIntervalDays(4), 4) - 0.85) < 1e-12);
  });

  it("decays p at read time and flags formerly secure objectives for review", () => {
    const fixture = fixtures.cases.find((c) => c.name === "two sources same day reach secure");
    assert.ok(fixture);
    const s = applyEvidenceSequence(fixture.evidence);
    assert.equal(effectiveState(s, s.lastEvidenceAt ?? "").status, "secure");
    const later = effectiveState(s, new Date(Date.parse(s.lastEvidenceAt ?? "") + 3 * 86_400_000).toISOString());
    assert.equal(later.status, "needs_review");
    assert.equal(later.due, true);
    assert.ok((later.pEffective ?? 1) < (s.pMastery ?? 0));
    assert.deepEqual(effectiveState(emptyKnowledgeState(), at(0)), { pEffective: null, status: "unseen", due: false });
  });

  it("keeps secure with hysteresis between 0.7 and 0.8 once secured", () => {
    const base = { confidence: 0.9, distinctSources: 1, spacedReviews: 0 };
    assert.equal(deriveStatus({ ...base, pEffective: 0.75, securedAt: null }), "practising");
    assert.equal(deriveStatus({ ...base, pEffective: 0.75, securedAt: at(0) }), "secure");
    assert.equal(deriveStatus({ ...base, pEffective: 0.69, securedAt: at(0) }), "needs_review");
    assert.equal(deriveStatus({ ...base, pEffective: 0.2, securedAt: at(0) }), "needs_review");
    assert.equal(deriveStatus({ ...base, pEffective: 0.39, securedAt: null }), "learning");
    assert.equal(deriveStatus({ ...base, pEffective: 0.85, confidence: 0.4, securedAt: null }), "practising");
    assert.equal(deriveStatus({ ...base, pEffective: null, securedAt: null }), "unseen");
  });

  it("confidence accumulates with evidence mass and decays with time", () => {
    assert.equal(confidenceFromMass(0), 0);
    assert.ok(confidenceFromMass(3) > 0.63 && confidenceFromMass(3) < 0.64);
    const fresh = applyEvidenceSequence([quiz("correct", 0), quiz("correct", 0.5)]);
    const stale = applyEvidenceSequence([quiz("correct", 0), quiz("correct", 200)]);
    assert.ok(stale.confidence < fresh.confidence);
  });

  it("maps legacy levels both ways for dual-write and backfill", () => {
    for (const level of [0, 1, 2, 3]) {
      assert.equal(legacyLevelFromP(pFromLegacyLevel(level)), level);
    }
    assert.equal(pFromLegacyLevel(99), 0.85);
    assert.equal(pFromLegacyLevel(Number.NaN), 0.15);
  });

  it("is pure: does not mutate the previous state", () => {
    const prev: KnowledgeState = emptyKnowledgeState();
    const snapshot = JSON.stringify(prev);
    applyEvidence(prev, quiz("correct"));
    assert.equal(JSON.stringify(prev), snapshot);
  });

  it("reads stored rows, seeding legacy (not yet backfilled) rows from their level like the SQL function", () => {
    const legacy = knowledgeStateFromRow({ level: 2, evidence_count: 3, evidence_mass: 0, p_mastery: null, status: "unseen" });
    assert.equal(legacy.pMastery, 0.65);
    assert.equal(legacy.status, "practising");
    const next = applyEvidence(legacy, quiz("correct"));
    assert.ok(Math.abs((next.pMastery ?? 0) - (0.65 + 0.25 * 0.35)) < 1e-6, "legacy rows are not 'first evidence'");

    const unseen = knowledgeStateFromRow({ evidence_count: 0 });
    assert.equal(unseen.pMastery, null);
    assert.equal(unseen.status, "unseen");

    const selfReportOnly = knowledgeStateFromRow({ evidence_count: 1, evidence_mass: "0.06", p_mastery: null, status: "unseen" });
    assert.equal(selfReportOnly.pMastery, null);

    const v2 = knowledgeStateFromRow({
      p_mastery: "0.82",
      confidence: "0.7",
      evidence_mass: "3.5",
      stability_days: "0",
      evidence_count: 5,
      evidence_sources: ["interaction", "quiz"],
      status: "secure",
      last_result: "weird",
    });
    assert.equal(v2.pMastery, 0.82);
    assert.equal(v2.stabilityDays, 1);
    assert.equal(v2.status, "secure");
    assert.equal(v2.lastResult, null);
  });

  it("recognises evidence sources", () => {
    assert.equal(isEvidenceSource("quiz"), true);
    assert.equal(isEvidenceSource("opinion"), false);
    assert.equal(isEvidenceSource(undefined), false);
  });
});
