import { test } from "node:test";
import assert from "node:assert/strict";
import {
  decideTutorAccess,
  intersectModes,
  remainingFreeMinutes,
  startOfMonthUtc,
  type TutorAccessFacts,
} from "./entitlements.ts";

function base(overrides: Partial<TutorAccessFacts> = {}): TutorAccessFacts {
  return {
    origin: "practice",
    scenario: {
      id: "scn-1",
      exists: true,
      status: "published",
      visibility: "tenant_library",
      courseId: null,
      companyId: "co-1",
      allowedModes: ["live", "voice", "text"],
    },
    tenant: { member: true, active: true },
    enrolledInCourse: null,
    lesson: null,
    assignment: null,
    persona: { exists: true, active: true, id: "per-1" },
    settings: {
      practiceRoomEnabled: true,
      freePracticeMinutes: 60,
      allowedModes: ["live", "voice", "text"],
      enabledPersonaIds: null,
    },
    practiceUsedMs: 0,
    companyId: "co-1",
    ...overrides,
  };
}

test("practice origin is allowed for a tenant member with free minutes left", () => {
  const decision = decideTutorAccess(base());
  assert.equal(decision.ok, true);
  if (!decision.ok) return;
  assert.deepEqual(decision.allowedModes, ["live", "voice", "text"]);
  assert.equal(decision.liveMinutesLeft, 60);
});

test("practice origin reports remaining minutes after usage", () => {
  const decision = decideTutorAccess(base({ practiceUsedMs: 45 * 60_000 }));
  assert.equal(decision.ok, true);
  if (decision.ok) assert.equal(decision.liveMinutesLeft, 15);
});

test("practice origin is denied when free minutes are exhausted", () => {
  assert.deepEqual(decideTutorAccess(base({ practiceUsedMs: 60 * 60_000 })), {
    ok: false,
    reason: "free_minutes_exhausted",
  });
  assert.deepEqual(decideTutorAccess(base({ practiceUsedMs: 90 * 60_000 })), {
    ok: false,
    reason: "free_minutes_exhausted",
  });
});

test("practice origin is denied when the Practice Room is switched off", () => {
  const facts = base();
  facts.settings.practiceRoomEnabled = false;
  assert.deepEqual(decideTutorAccess(facts), { ok: false, reason: "practice_disabled" });
});

test("zero free minutes per month means no free practice", () => {
  const facts = base();
  facts.settings.freePracticeMinutes = 0;
  assert.deepEqual(decideTutorAccess(facts), { ok: false, reason: "free_minutes_exhausted" });
});

test("practice origin cannot use a course-only scenario", () => {
  const facts = base();
  facts.scenario.visibility = "course";
  facts.scenario.courseId = "course-1";
  facts.enrolledInCourse = true;
  assert.deepEqual(decideTutorAccess(facts), { ok: false, reason: "scenario_not_in_library" });
});

test("lesson origin is not capped by free practice minutes", () => {
  const facts = base({
    origin: "lesson",
    practiceUsedMs: 500 * 60_000,
    lesson: { exists: true, courseId: "course-1" },
    enrolledInCourse: true,
  });
  const decision = decideTutorAccess(facts);
  assert.equal(decision.ok, true);
  if (decision.ok) assert.equal(decision.liveMinutesLeft, undefined);
});

test("lesson origin requires enrollment in the lesson's course", () => {
  const facts = base({
    origin: "lesson",
    lesson: { exists: true, courseId: "course-1" },
    enrolledInCourse: false,
  });
  assert.deepEqual(decideTutorAccess(facts), { ok: false, reason: "not_enrolled" });
});

test("lesson origin with a course-only scenario must match the lesson's course", () => {
  const facts = base({
    origin: "lesson",
    lesson: { exists: true, courseId: "course-2" },
    enrolledInCourse: true,
  });
  facts.scenario.visibility = "course";
  facts.scenario.courseId = "course-1";
  assert.deepEqual(decideTutorAccess(facts), { ok: false, reason: "lesson_course_mismatch" });
});

test("missing lesson is a not-found denial", () => {
  const facts = base({ origin: "lesson", lesson: { exists: false, courseId: null } });
  assert.deepEqual(decideTutorAccess(facts), { ok: false, reason: "lesson_not_found" });
});

test("assignment origin needs the assignment to be for this scenario and tenant", () => {
  const assignment = { exists: true, scenarioId: "other", companyId: "co-1", groupId: null, learnerInGroup: false };
  assert.deepEqual(decideTutorAccess(base({ origin: "assignment", assignment })), {
    ok: false,
    reason: "assignment_scenario_mismatch",
  });

  const otherTenant = { exists: true, scenarioId: "scn-1", companyId: "co-2", groupId: null, learnerInGroup: false };
  assert.deepEqual(decideTutorAccess(base({ origin: "assignment", assignment: otherTenant })), {
    ok: false,
    reason: "assignment_not_found",
  });
});

test("assignment for a group needs the learner to be in that group", () => {
  const assignment = { exists: true, scenarioId: "scn-1", companyId: "co-1", groupId: "g-1", learnerInGroup: false };
  assert.deepEqual(decideTutorAccess(base({ origin: "assignment", assignment })), {
    ok: false,
    reason: "assignment_not_for_learner",
  });
  const inGroup = { ...assignment, learnerInGroup: true };
  assert.equal(decideTutorAccess(base({ origin: "assignment", assignment: inGroup })).ok, true);
});

test("assignment for a course scenario needs enrollment in that course", () => {
  const assignment = { exists: true, scenarioId: "scn-1", companyId: "co-1", groupId: null, learnerInGroup: false };
  const facts = base({ origin: "assignment", assignment, enrolledInCourse: false });
  facts.scenario.courseId = "course-1";
  assert.deepEqual(decideTutorAccess(facts), { ok: false, reason: "not_enrolled" });
});

test("course-only scenario needs enrollment even for a practice-free lesson", () => {
  const facts = base({
    origin: "lesson",
    lesson: { exists: true, courseId: "course-1" },
    enrolledInCourse: false,
  });
  facts.scenario.visibility = "course";
  facts.scenario.courseId = "course-1";
  assert.deepEqual(decideTutorAccess(facts), { ok: false, reason: "not_enrolled" });
});

test("non-member and inactive tenant are denied", () => {
  assert.deepEqual(decideTutorAccess(base({ tenant: { member: false, active: true } })), {
    ok: false,
    reason: "not_tenant_member",
  });
  assert.deepEqual(decideTutorAccess(base({ tenant: { member: true, active: false } })), {
    ok: false,
    reason: "tenant_inactive",
  });
});

test("draft or archived scenarios are not published", () => {
  const facts = base();
  facts.scenario.status = "draft";
  assert.deepEqual(decideTutorAccess(facts), { ok: false, reason: "scenario_not_published" });
});

test("a missing scenario is denied as not found", () => {
  const facts = base();
  facts.scenario.exists = false;
  assert.deepEqual(decideTutorAccess(facts), { ok: false, reason: "scenario_not_found" });
});

test("persona must be active and, when restricted, enabled for the tenant", () => {
  const inactive = base();
  inactive.persona = { exists: true, active: false, id: "per-1" };
  assert.deepEqual(decideTutorAccess(inactive), { ok: false, reason: "persona_unavailable" });

  const restricted = base();
  restricted.settings.enabledPersonaIds = ["per-9"];
  assert.deepEqual(decideTutorAccess(restricted), { ok: false, reason: "persona_unavailable" });

  const allowed = base();
  allowed.settings.enabledPersonaIds = ["per-1"];
  assert.equal(decideTutorAccess(allowed).ok, true);
});

test("allowed modes are the intersection of scenario and tenant modes", () => {
  const facts = base();
  facts.scenario.allowedModes = ["voice", "text"];
  facts.settings.allowedModes = ["live", "text"];
  const decision = decideTutorAccess(facts);
  assert.equal(decision.ok, true);
  if (decision.ok) assert.deepEqual(decision.allowedModes, ["text"]);
});

test("empty mode intersection is denied", () => {
  const facts = base();
  facts.scenario.allowedModes = ["live"];
  facts.settings.allowedModes = ["text"];
  assert.deepEqual(decideTutorAccess(facts), { ok: false, reason: "no_modes_allowed" });
});

test("intersectModes keeps canonical order and drops duplicates", () => {
  assert.deepEqual(intersectModes(["text", "live"], ["live", "text", "voice"]), ["live", "text"]);
  assert.deepEqual(intersectModes([], ["live"]), []);
});

test("remainingFreeMinutes is never negative and handles fractions", () => {
  assert.equal(remainingFreeMinutes(60, 0), 60);
  assert.equal(remainingFreeMinutes(60, 30_000), 59.5);
  assert.equal(remainingFreeMinutes(10, 99 * 60_000), 0);
  assert.equal(remainingFreeMinutes(10, -5), 10);
});

test("startOfMonthUtc returns the first instant of the UTC month", () => {
  assert.equal(startOfMonthUtc(new Date("2026-10-27T15:42:00Z")), "2026-10-01T00:00:00.000Z");
  assert.equal(startOfMonthUtc(new Date("2026-12-31T23:59:59Z")), "2026-12-01T00:00:00.000Z");
});

// ---- Access by origin (lesson tenant, staff preview, practice fallback) ----

function lessonFacts(overrides: Partial<TutorAccessFacts> = {}): TutorAccessFacts {
  return base({
    origin: "lesson",
    lesson: { exists: true, courseId: "course-1" },
    companyId: "co-course",
    tenant: { member: false, active: true },
    enrolledInCourse: false,
    ...overrides,
  });
}

test("enrolled learner with no company membership can run a lesson session", () => {
  const facts = lessonFacts({ enrolledInCourse: true });
  facts.scenario.visibility = "course";
  facts.scenario.courseId = "course-1";
  assert.equal(decideTutorAccess(facts).ok, true);
});

test("enrolled learner can use a platform scenario in a lesson without a membership row", () => {
  const facts = lessonFacts({ enrolledInCourse: true });
  facts.scenario.visibility = "platform";
  assert.equal(decideTutorAccess(facts).ok, true);
});

test("active staff of the course tenant can preview a lesson without enrolling", () => {
  const facts = lessonFacts({ tenant: { member: true, active: true, staff: true } });
  facts.scenario.visibility = "course";
  facts.scenario.courseId = "course-1";
  assert.equal(decideTutorAccess(facts).ok, true);
});

test("an outsider (not enrolled, not staff) is denied a lesson session", () => {
  const facts = lessonFacts({ tenant: { member: true, active: true, staff: false } });
  assert.deepEqual(decideTutorAccess(facts), { ok: false, reason: "not_enrolled" });
  const platform = lessonFacts();
  platform.scenario.visibility = "platform";
  assert.deepEqual(decideTutorAccess(platform), { ok: false, reason: "not_enrolled" });
});

test("a lesson's tenant library scenario must belong to the course's tenant", () => {
  const same = lessonFacts({ enrolledInCourse: true });
  same.scenario.visibility = "tenant_library";
  same.scenario.companyId = "co-course";
  assert.equal(decideTutorAccess(same).ok, true);

  const other = lessonFacts({ enrolledInCourse: true });
  other.scenario.visibility = "tenant_library";
  other.scenario.companyId = "co-other";
  assert.deepEqual(decideTutorAccess(other), { ok: false, reason: "scenario_not_in_library" });
});

test("a lesson session in an inactive tenant is denied", () => {
  const facts = lessonFacts({ enrolledInCourse: true, tenant: { member: false, active: false } });
  facts.scenario.visibility = "platform";
  assert.deepEqual(decideTutorAccess(facts), { ok: false, reason: "tenant_inactive" });
});

test("practice with no membership falls back to the platform tenant for platform scenarios", () => {
  const facts = base({ tenant: { member: true, active: true, fallback: true }, companyId: "co-platform" });
  facts.scenario.visibility = "platform";
  const decision = decideTutorAccess(facts);
  assert.equal(decision.ok, true);
  if (decision.ok) assert.equal(decision.liveMinutesLeft, 60);
});

test("practice with no membership cannot use a tenant library scenario", () => {
  const facts = base({ tenant: { member: true, active: true, fallback: true }, companyId: "co-platform" });
  facts.scenario.visibility = "tenant_library";
  assert.deepEqual(decideTutorAccess(facts), { ok: false, reason: "not_tenant_member" });
});

test("practice with no membership and no fallback is denied", () => {
  const facts = base({ tenant: { member: false, active: true } });
  facts.scenario.visibility = "platform";
  assert.deepEqual(decideTutorAccess(facts), { ok: false, reason: "not_tenant_member" });
});

test("practice fallback still respects free minutes on the platform tenant's settings", () => {
  const facts = base({
    tenant: { member: true, active: true, fallback: true },
    practiceUsedMs: 60 * 60_000,
  });
  facts.scenario.visibility = "platform";
  assert.deepEqual(decideTutorAccess(facts), { ok: false, reason: "free_minutes_exhausted" });
});
