import { test } from "node:test";
import assert from "node:assert/strict";
import { gradePendingCheck, prepareAnswerableEvents, type GradedInteraction } from "./interactions.ts";
import { commitTurn, planTurn, type TurnPlanInput } from "./plan.ts";
import { initialSessionState } from "./state.ts";

type T = { idx: number; learner_text: string | null; events: unknown };

function input(over: Partial<TurnPlanInput<T>> = {}): TurnPlanInput<T> {
  return {
    state: initialSessionState({ objectiveIds: ["obj-1"], strategy: "guided" }),
    statePersisted: true,
    history: [{ idx: 0, learner_text: null, events: [] }],
    learnerText: "hello",
    graded: null,
    gradedObjectiveId: null,
    vocabulary: ["fractions"],
    brief: {},
    flow: { origin: "lesson", timeLeftMs: 600_000 },
    directivesEnabled: true,
    learnerBlock: "Learner memory:\nA2",
    ...over,
  };
}

const check = prepareAnswerableEvents(
  [{ type: "ask_choice", question: "1/2 + 1/4?", options: ["2/6", "3/4"], answer: ["3/4"], objective: "obj-1" }],
  1,
).checks[0];

test("opening turn: probe directive, no learner reduction", () => {
  const plan = planTurn(input({ learnerText: null, history: [] }));
  assert.equal(plan.directive?.move, "probe");
  assert.equal(plan.state.learnerTurns, 0);
  assert.match(plan.teacherNote ?? "", /Suggested next move: probe/);
  assert.equal(plan.prelude, "Learner memory:\nA2");
});

test("a second wrong graded answer → grading note + worked-example directive in one teacher note", () => {
  let state = input().state;
  const wrong = gradePendingCheck(check, 0) as GradedInteraction;
  for (let i = 0; i < 2; i++) {
    const plan = planTurn(input({ state, graded: wrong, gradedObjectiveId: "obj-1", learnerText: "I choose: 2/6" }));
    state = commitTurn(plan, { events: [{ type: "say", text: "Let's see." }] });
    if (i === 1) {
      assert.equal(plan.directive?.move, "worked_example");
      assert.match(plan.teacherNote ?? "", /Graded check t1-0[\s\S]*Suggested next move: worked example/);
    }
  }
  assert.equal(state.lastMove, "worked_example");
  assert.equal(state.strategy, "worked_example");
});

test("directives off: only the grading note remains; nothing at all for plain text", () => {
  const right = gradePendingCheck(check, 1) as GradedInteraction;
  const plan = planTurn(input({ directivesEnabled: false, graded: right, gradedObjectiveId: "obj-1" }));
  assert.equal(plan.directive, null);
  assert.match(plan.teacherNote ?? "", /Result: correct/);
  assert.equal(planTurn(input({ directivesEnabled: false })).teacherNote, null);
});

test("window and summary: verbatim turns after the summary, none dropped without one", () => {
  const history = Array.from({ length: 14 }, (_, i) => ({ idx: i, learner_text: "x", events: [] }));
  const withSummary = { ...input().state, summary: "- taught halves", summarizedThroughIdx: 5 };
  const plan = planTurn(input({ history, state: withSummary }));
  assert.equal(plan.window.length, 8);
  assert.match(plan.prelude ?? "", /<earlier_in_session>\n- taught halves/);
  const unpersisted = planTurn(input({ history, state: withSummary, statePersisted: false }));
  assert.equal(unpersisted.window.length, 14, "without stored state every turn stays verbatim");
  assert.doesNotMatch(unpersisted.prelude ?? "", /earlier_in_session/);
});

test("commitTurn records the held check by reference and the move", () => {
  const plan = planTurn(input({ learnerText: null, history: [] }));
  const s = commitTurn(plan, { events: [{ type: "ask_choice", question: "q", options: ["a", "b"], checkId: "t0-0" }], checks: [check] });
  assert.deepEqual(s.pendingCheck, { id: "t1-0", turnIdx: 1, kind: "choice", objective: "obj-1" });
  assert.ok(!("spec" in (s.pendingCheck as object)), "no key in session state");
  assert.equal(s.lastMove, "probe");
});
