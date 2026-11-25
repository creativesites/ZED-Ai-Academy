import assert from "node:assert/strict";
import { describe, it } from "node:test";
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
  type VivaAttempt,
  type VivaDecision,
  type VivaGateInput,
  type VivaReviewRecord,
} from "./viva-v2.ts";

const met = (n: number) => Array.from({ length: n }, () => ({ status: "met" }));
const st = (s: string, n = 1) => Array.from({ length: n }, () => ({ status: s }));

describe("normalizeVivaRubric", () => {
  it("fills defaults and clamps out-of-range values", () => {
    assert.deepEqual(normalizeVivaRubric(null), DEFAULT_VIVA_RUBRIC);
    const r = normalizeVivaRubric({ minMetShare: 5, minTaskScore: -3, minMasteryShare: "0.7", requireHumanApproval: "yes" });
    assert.equal(r.minMetShare, 1);
    assert.equal(r.minTaskScore, 1);
    assert.equal(r.minMasteryShare, 0.7);
    assert.equal(r.requireHumanApproval, false);
  });

  it("the legacy rubric ignores mastery", () => {
    assert.equal(LEGACY_VIVA_RUBRIC.minMasteryShare, 0);
  });
});

describe("decideVivaOutcome", () => {
  const rubric = DEFAULT_VIVA_RUBRIC;
  const masteryOk = { total: 4, secure: 2, practising: 1 };
  const masteryLow = { total: 4, secure: 0, practising: 1 };

  it("passes a clean session with enough course mastery", () => {
    const d = decideVivaOutcome({ rubric, session: { objectives: [...met(2), ...st("partial")] }, mastery: masteryOk });
    assert.equal(d.outcome, "pass");
    assert.equal(d.masteryShare, 0.75);
  });

  it("sends a strong session with weak course mastery to a person, never to not_yet", () => {
    const d = decideVivaOutcome({ rubric, session: { objectives: met(3) }, mastery: masteryLow });
    assert.equal(d.outcome, "needs_review");
    assert.equal(d.mastery, "low");
  });

  it("treats mastery as not applicable when there are no registered objectives or it cannot be read", () => {
    assert.equal(decideVivaOutcome({ rubric, session: { objectives: met(2) }, mastery: null }).outcome, "pass");
    assert.equal(
      decideVivaOutcome({ rubric, session: { objectives: met(2) }, mastery: { total: 0, secure: 0, practising: 0 } }).outcome,
      "pass",
    );
  });

  it("borderline sessions go to review; clear misses are not_yet", () => {
    // 1 of 3 met = 0.33, within 0.2 of 0.5
    assert.equal(
      decideVivaOutcome({ rubric, session: { objectives: [...met(1), ...st("partial", 2)] }, mastery: masteryOk }).outcome,
      "needs_review",
    );
    // 0 of 4 met, 2 to review
    assert.equal(
      decideVivaOutcome({ rubric, session: { objectives: [...st("partial", 2), ...st("review", 2)] }, mastery: masteryOk }).outcome,
      "not_yet",
    );
    // borderline but weak course mastery → not_yet
    assert.equal(
      decideVivaOutcome({ rubric, session: { objectives: [...met(1), ...st("partial", 2)] }, mastery: masteryLow }).outcome,
      "not_yet",
    );
  });

  it("matches the legacy rule under the legacy rubric (majority met, nothing to review)", () => {
    const legacy = (objectives: Array<{ status: string }>) =>
      decideVivaOutcome({ rubric: LEGACY_VIVA_RUBRIC, session: { objectives }, mastery: masteryLow }).outcome;
    assert.equal(legacy([...met(2), ...st("partial")]), "pass");
    assert.equal(legacy([...met(1), ...st("review")]), "needs_review");
    assert.equal(legacy([...st("review", 3)]), "not_yet");
  });

  it("uses graded session evidence when the report has no objectives", () => {
    assert.equal(
      decideVivaOutcome({ rubric, session: { evidence: { correct: 3, partial: 1, misconception: 0 } }, mastery: null }).outcome,
      "pass",
    );
    assert.equal(
      decideVivaOutcome({ rubric, session: { evidence: { correct: 0, partial: 0, misconception: 3 } }, mastery: null }).outcome,
      "not_yet",
    );
  });

  it("falls back to the task score, with a borderline band", () => {
    assert.equal(decideVivaOutcome({ rubric, session: { taskScore: 70 }, mastery: null }).outcome, "pass");
    assert.equal(decideVivaOutcome({ rubric, session: { taskScore: 50 }, mastery: null }).outcome, "needs_review");
    assert.equal(decideVivaOutcome({ rubric, session: { taskScore: 30 }, mastery: null }).outcome, "not_yet");
  });

  it("is not_yet when the session recorded nothing", () => {
    const d = decideVivaOutcome({ rubric, session: {}, mastery: masteryOk });
    assert.equal(d.outcome, "not_yet");
    assert.equal(d.session, "none");
  });

  it("routes every pass to staff when the rubric requires human approval", () => {
    const d = decideVivaOutcome({
      rubric: { ...rubric, requireHumanApproval: true },
      session: { objectives: met(3) },
      mastery: masteryOk,
    });
    assert.equal(d.outcome, "needs_review");
  });
});

describe("summariseVivaMastery", () => {
  it("counts practising and secure, bounded by the total", () => {
    assert.deepEqual(summariseVivaMastery(3, ["secure", "practising", "learning", "secure", "secure"]), {
      total: 3,
      secure: 3,
      practising: 0,
    });
  });
});

describe("transitionVivaReview", () => {
  it("approves or returns a pending review", () => {
    assert.deepEqual(transitionVivaReview({ status: "pending" }, { type: "approve" }), { ok: true, status: "approved", note: null });
    assert.deepEqual(transitionVivaReview({ status: "pending" }, { type: "return", note: " Revise ratios " }), {
      ok: true,
      status: "returned",
      note: "Revise ratios",
    });
  });

  it("requires a note to return and refuses decided reviews", () => {
    assert.equal(transitionVivaReview({ status: "pending" }, { type: "return", note: "  " }).ok, false);
    assert.equal(transitionVivaReview({ status: "approved" }, { type: "return", note: "x" }).ok, false);
    assert.equal(transitionVivaReview({ status: "returned" }, { type: "approve" }).ok, false);
  });
});

describe("decideVivaGate (certificate gate)", () => {
  const decision = (outcome: VivaDecision["outcome"]): VivaDecision => ({
    outcome,
    reason: `outcome ${outcome}`,
    session: "pass",
    mastery: "not_applicable",
    metCount: 0,
    totalObjectives: 0,
    masteryShare: null,
  });
  const attempt = (id: string, outcome: VivaDecision["outcome"]): VivaAttempt => ({
    sessionId: id,
    endedAt: null,
    decision: decision(outcome),
  });
  const review = (over: Partial<VivaReviewRecord>): VivaReviewRecord => ({
    id: "r1",
    kind: "needs_review",
    status: "pending",
    sessionId: "s1",
    reviewerNote: null,
    createdAt: "2026-11-20T00:00:00Z",
    decidedAt: null,
    ...over,
  });
  const base: VivaGateInput = { required: true, scenarioReady: true, attempts: [], reviews: [], rubric: DEFAULT_VIVA_RUBRIC };

  it("never blocks courses that do not require a viva (including before the column exists)", () => {
    assert.equal(decideVivaGate({ ...base, required: false }).allowCertificate, true);
    assert.equal(decideVivaGate({ ...base, required: null, scenarioReady: false, reviews: null }).state, "not_required");
  });

  it("does not silently pass a misconfigured required viva", () => {
    const g = decideVivaGate({ ...base, scenarioReady: false });
    assert.equal(g.state, "misconfigured");
    assert.equal(g.allowCertificate, false);
    assert.equal(g.canRequestReview, true, "learner can ask for a human review instead");
    const noTable = decideVivaGate({ ...base, scenarioReady: false, reviews: null });
    assert.equal(noTable.allowCertificate, false);
    assert.equal(noTable.canRequestReview, false);
  });

  it("requires an attempt", () => {
    assert.equal(decideVivaGate(base).state, "not_started");
    assert.equal(decideVivaGate(base).allowCertificate, false);
  });

  it("issues on a pass (any attempt) or a staff approval", () => {
    assert.equal(decideVivaGate({ ...base, attempts: [attempt("s2", "not_yet"), attempt("s1", "pass")] }).allowCertificate, true);
    const approved = decideVivaGate({
      ...base,
      attempts: [attempt("s1", "not_yet")],
      reviews: [review({ kind: "appeal", status: "approved" })],
    });
    assert.equal(approved.state, "approved");
    assert.equal(approved.allowCertificate, true);
    assert.equal(
      decideVivaGate({ ...base, scenarioReady: false, reviews: [review({ kind: "appeal", status: "approved", sessionId: null })] })
        .allowCertificate,
      true,
      "staff can approve a learner on a misconfigured course",
    );
  });

  it("queues needs_review once and blocks while pending", () => {
    const fresh = decideVivaGate({ ...base, attempts: [attempt("s1", "needs_review")] });
    assert.equal(fresh.state, "needs_review");
    assert.equal(fresh.queueReviewForSessionId, "s1");
    assert.equal(fresh.allowCertificate, false);
    const queued = decideVivaGate({ ...base, attempts: [attempt("s1", "needs_review")], reviews: [review({})] });
    assert.equal(queued.queueReviewForSessionId, null);
    assert.equal(queued.allowCertificate, false);
  });

  it("is explicitly unavailable (blocked) when needs_review cannot be queued", () => {
    const g = decideVivaGate({ ...base, attempts: [attempt("s1", "needs_review")], reviews: null });
    assert.equal(g.state, "unavailable");
    assert.equal(g.allowCertificate, false);
  });

  it("a returned review becomes not_yet with the reviewer's note", () => {
    const g = decideVivaGate({
      ...base,
      attempts: [attempt("s1", "needs_review")],
      reviews: [review({ status: "returned", reviewerNote: "Explain ratios in your own words." })],
    });
    assert.equal(g.state, "not_yet");
    assert.match(g.reason ?? "", /ratios/);
    assert.equal(g.canRequestReview, true);
  });

  it("allows one learner appeal per course", () => {
    const notYet = decideVivaGate({ ...base, attempts: [attempt("s1", "not_yet")] });
    assert.equal(notYet.state, "not_yet");
    assert.equal(canRequestVivaReview(notYet), true);
    const pendingAppeal = decideVivaGate({
      ...base,
      attempts: [attempt("s1", "not_yet")],
      reviews: [review({ kind: "appeal", status: "pending" })],
    });
    assert.equal(pendingAppeal.state, "needs_review");
    assert.equal(canRequestVivaReview(pendingAppeal), false);
    const usedAppeal = decideVivaGate({
      ...base,
      attempts: [attempt("s2", "not_yet")],
      reviews: [review({ kind: "appeal", status: "returned", reviewerNote: "Retake after revising." })],
    });
    assert.equal(usedAppeal.state, "not_yet");
    assert.equal(canRequestVivaReview(usedAppeal), false);
    assert.match(usedAppeal.reason ?? "", /Retake/);
    const noAppeals = decideVivaGate({
      ...base,
      rubric: { ...DEFAULT_VIVA_RUBRIC, allowAppeal: false },
      attempts: [attempt("s1", "not_yet")],
    });
    assert.equal(canRequestVivaReview(noAppeals), false);
  });

  it("a newer needs_review attempt after a returned one is queued again", () => {
    const g = decideVivaGate({
      ...base,
      attempts: [attempt("s2", "needs_review"), attempt("s1", "needs_review")],
      reviews: [review({ sessionId: "s1", status: "returned", reviewerNote: "x" })],
    });
    assert.equal(g.state, "needs_review");
    assert.equal(g.queueReviewForSessionId, "s2");
  });
});

describe("cleanAppealNote", () => {
  it("trims, bounds and drops empty notes", () => {
    assert.equal(cleanAppealNote("  please  "), "please");
    assert.equal(cleanAppealNote("   "), null);
    assert.equal(cleanAppealNote(42), null);
    assert.equal(cleanAppealNote("x".repeat(5000))?.length, 1000);
  });
});
