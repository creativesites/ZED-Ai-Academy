import { test } from "node:test";
import assert from "node:assert/strict";
import type { DailyPlanItem } from "./mastery/sprint.ts";
import { MAX_SECONDARY, pickUpNext, teacherLine, type UpNextInput } from "./up-next.ts";

const NOW = new Date("2026-11-25T12:00:00Z");
const hoursAgo = (h: number) => new Date(NOW.getTime() - h * 3600_000).toISOString();
const hoursAhead = (h: number) => new Date(NOW.getTime() + h * 3600_000).toISOString();

const sprint: DailyPlanItem = {
  id: "daily-sprint",
  kind: "revision_sprint",
  title: "5-min revision sprint with Tinashe",
  subtitle: "Focus: equivalent fractions",
  durationMinutes: 5,
  objectiveTexts: ["equivalent fractions", "common denominators"],
  ctaLabel: "Start sprint",
  href: "/practice/sprint?courseId=c1",
};
const lesson: DailyPlanItem = {
  id: "lesson-l1",
  kind: "unfinished_lesson",
  title: "Fractions 3",
  subtitle: "Maths · Continue",
  courseTitle: "Maths",
  durationMinutes: 10,
  ctaLabel: "Continue lesson",
  href: "/courses/maths/learn",
};
const flow: DailyPlanItem = {
  id: "flow-f1",
  kind: "untried_flow",
  title: "Market day role-play",
  subtitle: "Practise prices",
  durationMinutes: 6,
  ctaLabel: "Try flow",
  href: "/practice/f1",
};

function input(over: Partial<UpNextInput> = {}): UpNextInput {
  return { academySlug: "acme", teacherName: "Tinashe", planItems: [], now: NOW, ...over };
}

test("pickUpNext: due revision wins and links inside the academy", () => {
  const r = pickUpNext(input({ planItems: [lesson, flow, sprint], dueCards: 12 }));
  assert.equal(r.primary?.kind, "revision");
  assert.equal(r.primary?.label, "Start 5-min revision");
  assert.equal(r.primary?.detail, "equivalent fractions");
  assert.equal(r.primary?.href, "/academy/acme/practice/sprint?courseId=c1");
  assert.deepEqual(
    r.secondary.map((s) => s.kind),
    ["lesson", "cards"],
  );
  assert.equal(r.secondary[0].href, "/courses/maths/learn", "the lesson player is never academy-prefixed");
  assert.equal(r.secondary[1].href, "/academy/acme/practice/deck");
  assert.equal(r.secondary[1].label, "12 cards due");
});

test("pickUpNext: one primary and at most two secondary actions", () => {
  const r = pickUpNext(
    input({
      planItems: [sprint, lesson, flow],
      dueCards: 3,
      activeSessions: [{ sessionId: "s1", scenarioId: "sc1", title: "Fractions chat", startedAt: hoursAgo(2) }],
      assignments: [{ assignmentId: "a1", scenarioId: "sc2", title: "Oral check", dueAt: hoursAhead(100), completed: false }],
    }),
  );
  assert.ok(r.primary);
  assert.ok(r.secondary.length <= MAX_SECONDARY);
  assert.equal(r.secondary.length, 2);
  const kinds = [r.primary.kind, ...r.secondary.map((s) => s.kind)];
  assert.equal(new Set(kinds).size, kinds.length, "no duplicate kinds");
});

test("pickUpNext: assignment due within 48h outranks resume and lessons, but not revision", () => {
  const assignments = [{ assignmentId: "a1", scenarioId: "sc2", title: "Oral check", dueAt: hoursAhead(10), completed: false }];
  const activeSessions = [{ sessionId: "s1", scenarioId: "sc1", title: "Chat", startedAt: hoursAgo(1) }];
  assert.equal(pickUpNext(input({ planItems: [lesson], assignments, activeSessions })).primary?.kind, "assignment");
  assert.equal(pickUpNext(input({ planItems: [sprint, lesson], assignments })).primary?.kind, "revision");
  const overdue = pickUpNext(
    input({ assignments: [{ ...assignments[0], dueAt: hoursAgo(5) }] }),
  );
  assert.equal(overdue.primary?.label, "Do overdue assignment");
  assert.equal(overdue.primary?.href, "/academy/acme/practice/sc2");
});

test("pickUpNext: far-off and undated assignments rank after the next lesson", () => {
  const r = pickUpNext(
    input({
      planItems: [lesson],
      assignments: [{ assignmentId: "a1", scenarioId: "sc2", title: "Essay", dueAt: null, completed: false }],
    }),
  );
  assert.equal(r.primary?.kind, "lesson");
  assert.equal(r.secondary[0].kind, "assignment");
});

test("pickUpNext: completed assignments are ignored", () => {
  const r = pickUpNext(
    input({ assignments: [{ assignmentId: "a1", scenarioId: "sc2", title: "Done", dueAt: hoursAhead(1), completed: true }] }),
  );
  assert.equal(r.primary, null);
});

test("pickUpNext: resume only sessions with a scenario started in the last 48h, newest first", () => {
  const r = pickUpNext(
    input({
      planItems: [lesson],
      activeSessions: [
        { sessionId: "old", scenarioId: "sc0", title: "Old", startedAt: hoursAgo(60) },
        { sessionId: "sprint", scenarioId: null, title: "Sprint", startedAt: hoursAgo(1) },
        { sessionId: "s1", scenarioId: "sc1", title: "Earlier", startedAt: hoursAgo(20) },
        { sessionId: "s2", scenarioId: "sc2", title: "Latest", startedAt: hoursAgo(3) },
        { sessionId: "future", scenarioId: "sc3", title: "Clock skew", startedAt: hoursAhead(2) },
        { sessionId: "bad", scenarioId: "sc4", title: "Bad date", startedAt: "not a date" },
      ],
    }),
  );
  assert.equal(r.primary?.kind, "resume");
  assert.equal(r.primary?.detail, "Latest");
  assert.equal(r.primary?.href, "/academy/acme/practice/sc2");
  const stale = pickUpNext(
    input({ activeSessions: [{ sessionId: "old", scenarioId: "sc0", title: "Old", startedAt: hoursAgo(49) }] }),
  );
  assert.equal(stale.primary, null);
});

test("pickUpNext: cards outrank a suggested flow; flow is last", () => {
  assert.equal(pickUpNext(input({ planItems: [flow], dueCards: 1 })).primary?.label, "1 card due");
  const onlyFlow = pickUpNext(input({ planItems: [flow] }));
  assert.equal(onlyFlow.primary?.kind, "flow");
  assert.equal(onlyFlow.primary?.href, "/academy/acme/practice/f1");
  assert.deepEqual(onlyFlow.secondary, []);
});

test("pickUpNext: platform learners get platform paths", () => {
  const r = pickUpNext(input({ academySlug: null, planItems: [sprint], dueCards: 2 }));
  assert.equal(r.primary?.href, "/practice/sprint?courseId=c1");
  assert.equal(r.secondary[0].href, "/practice/deck");
});

test("pickUpNext: plan hrefs that already carry an academy are kept, broken academy lesson links are fixed", () => {
  const r = pickUpNext(
    input({
      planItems: [
        { ...sprint, href: "/academy/acme/practice/sprint" },
        { ...lesson, href: "/academy/acme/courses/maths/learn" },
      ],
    }),
  );
  assert.equal(r.primary?.href, "/academy/acme/practice/sprint");
  assert.equal(r.secondary[0].href, "/courses/maths/learn");
});

test("pickUpNext: nothing in flight gives the empty state", () => {
  const r = pickUpNext(input({ dueCards: 0, assignments: [], activeSessions: [] }));
  assert.equal(r.primary, null);
  assert.deepEqual(r.secondary, []);
  assert.equal(r.line, "Ready when you are.");
});

test("pickUpNext: negative or fractional card counts are clamped", () => {
  assert.equal(pickUpNext(input({ dueCards: -4 })).primary, null);
  assert.equal(pickUpNext(input({ dueCards: 2.7 })).primary?.label, "2 cards due");
});

test("teacherLine: one honest line per primary kind", () => {
  const r = pickUpNext(input({ planItems: [sprint] }));
  assert.match(r.line, /equivalent fractions/);
  assert.equal(teacherLine(null), "Ready when you are.");
});
