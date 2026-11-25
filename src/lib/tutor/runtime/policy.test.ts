import { test } from "node:test";
import assert from "node:assert/strict";
import { directiveNote, policyDirectivesEnabled, POLICY, teachingPolicy, type PolicyFlow } from "./policy.ts";
import { initialSessionState, type ObjectiveRunState, type SessionState } from "./state.ts";

const PLENTY: PolicyFlow = { origin: "lesson", timeLeftMs: 10 * 60_000 };

function state(obj: Partial<ObjectiveRunState> = {}, extra: Partial<SessionState> = {}): SessionState {
  const s = initialSessionState({ objectiveIds: ["obj-1", "obj-2"], strategy: "guided" });
  return {
    ...s,
    learnerTurns: 3,
    objectives: s.objectives.map((o) => (o.id === "obj-1" ? { ...o, status: "teaching", ...obj } : o)),
    ...extra,
  };
}

// One row per rule in Architecture §3.3, plus the deny/edge cases around it.
const TABLE: Array<{ name: string; s: SessionState; flow?: PolicyFlow; brief?: object; move: string | null; objective?: string | null; strategy?: string }> = [
  { name: "2 consecutive misconceptions → worked example", s: state({ misses: 2 }), move: "worked_example", objective: "obj-1", strategy: "worked_example" },
  { name: "…then check after the worked example", s: state({ misses: 2 }, { lastMove: "worked_example" }), move: "check", objective: "obj-1" },
  { name: "1 misconception is not enough to switch", s: state({ misses: 1 }), move: null },
  {
    name: "3 misconceptions with a registered prerequisite → prerequisite",
    s: state({ misses: 3, status: "review" }),
    flow: { ...PLENTY, prerequisites: { "obj-1": ["obj-0"] } },
    move: "prerequisite",
    objective: "obj-0",
  },
  { name: "3 misconceptions, no prerequisite → simplify (flagged review)", s: state({ misses: 3, status: "review" }), move: "simplify", objective: "obj-1" },
  { name: "correct with low confidence → one more check", s: state({ streak: 1, needsConfirm: true, status: "checking" }, { confidence: 2 }), move: "check" },
  { name: "correct twice, high confidence, time left → stretch", s: state({ streak: 2, status: "met" }, { confidence: 4 }), move: "stretch" },
  {
    name: "…or independent task under a transfer strategy",
    s: state({ streak: 2, status: "met" }, { confidence: 5, strategy: "worked_example" }),
    move: "independent_task",
  },
  { name: "correct twice but low confidence → no stretch", s: state({ streak: 2 }, { confidence: 2 }), move: null },
  { name: "correct twice but little time → no stretch", s: state({ streak: 2 }, { confidence: 5 }), flow: { ...PLENTY, timeLeftMs: 150_000 }, move: null },
  { name: "off-topic twice → redirect", s: state({}, { offTopicStreak: 2 }), move: "redirect" },
  { name: "off-topic once → nothing", s: state({}, { offTopicStreak: 1 }), move: null },
  { name: "≤90 s left → recap", s: state({ misses: 2 }), flow: { ...PLENTY, timeLeftMs: 90_000 }, move: "recap", objective: null },
  { name: "…then wrap up", s: state({}, { lastMove: "recap" }), flow: { ...PLENTY, timeLeftMs: 30_000 }, move: "wrap_up" },
  { name: "91 s left is not wrap-up time", s: state({}), flow: { ...PLENTY, timeLeftMs: 91_000 }, move: null },
  { name: "session start → probe", s: { ...state(), learnerTurns: 0 }, move: "probe" },
  { name: "ask origin does not probe", s: { ...state(), learnerTurns: 0 }, flow: { ...PLENTY, origin: "ask" }, move: null },
  { name: "ask (light): still a worked example after 2 misses", s: state({ misses: 2 }), flow: { ...PLENTY, origin: "ask" }, move: "worked_example" },
  { name: "ask (light): still confirms a low-confidence correct", s: state({ needsConfirm: true, streak: 1 }, { confidence: 1 }), flow: { ...PLENTY, origin: "ask" }, move: "check" },
  { name: "ask (light): no wrap-up near the time box", s: state(), flow: { origin: "ask", timeLeftMs: 10_000 }, move: null },
  { name: "ask (light): no redirect, no check nudges", s: state({}, { offTopicStreak: 3, turnsSinceCheck: 9 }), flow: { ...PLENTY, origin: "ask" }, move: null },
  { name: "ask (light): no stretch", s: state({ streak: 3 }, { confidence: 5 }), flow: { ...PLENTY, origin: "ask" }, move: null },
  { name: "teaching without checks → check", s: state({}, { turnsSinceCheck: 3 }), move: "check" },
  { name: "hints used up → explain the answer", s: state({ hints: 3 }), move: "explain" },
  { name: "persona with generous hints allows one more", s: state({ hints: 3 }), brief: { philosophy: { hintGenerosity: "high" } }, move: null },
  { name: "viva never teaches: worked example becomes a check", s: state({ misses: 2 }, { strategy: "viva" }), move: "check" },
  { name: "no objectives and nothing to say → null", s: { ...initialSessionState({ objectiveIds: [], strategy: "guided" }), learnerTurns: 2 }, move: null },
];

for (const row of TABLE) {
  test(`policy: ${row.name}`, () => {
    const d = teachingPolicy(row.s, row.brief ?? {}, row.flow ?? PLENTY);
    assert.equal(d?.move ?? null, row.move);
    if (row.objective !== undefined) assert.equal(d?.objectiveId ?? null, row.objective);
    if (row.strategy) assert.equal(d?.strategy, row.strategy);
    if (d) assert.ok(d.reason.length > 0);
  });
}

test("a confident non-beginner on a stretch moves from guided to socratic; a beginner stays guided", () => {
  const s = state({ streak: 2 }, { confidence: 5 });
  assert.equal(teachingPolicy(s, { level: "B2" }, PLENTY)?.strategy, "socratic");
  assert.equal(teachingPolicy(s, { level: "beginner" }, PLENTY)?.strategy, "guided");
});

test("directive note is short, advisory and names the objective", () => {
  const d = teachingPolicy(state({ misses: 2 }), {}, PLENTY)!;
  const note = directiveNote(d, "Add fractions with unlike denominators");
  assert.match(note, /^Suggested next move: worked example on obj-1 \("Add fractions/);
  assert.match(note, /This is advice/);
  assert.ok(note.length < 500);
  assert.equal(POLICY.wrapUpMs, 90_000);
});

test("policy directives flag: default on, global off, per-tenant off", () => {
  assert.equal(policyDirectivesEnabled("c1", {}), true);
  assert.equal(policyDirectivesEnabled("c1", { TUTOR_POLICY_DIRECTIVES: "off" }), false);
  assert.equal(policyDirectivesEnabled("c1", { TUTOR_POLICY_DIRECTIVES_OFF_COMPANIES: "c2, C1" }), false);
  assert.equal(policyDirectivesEnabled("c3", { TUTOR_POLICY_DIRECTIVES_OFF_COMPANIES: "c2,c1" }), true);
  assert.equal(policyDirectivesEnabled(null, { TUTOR_POLICY_DIRECTIVES_OFF_COMPANIES: "c1" }), true);
});
