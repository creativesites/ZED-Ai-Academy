import type { TutorEvent } from "../contract/index.ts";
import { buildPrelude, combineTeacherNotes, windowTurns, type ContextTurn } from "./context.ts";
import { teacherNoteForGrade, type GradedInteraction, type PendingCheck } from "./interactions.ts";
import { directiveNote, teachingPolicy, type Directive, type PolicyBrief, type PolicyFlow } from "./policy.ts";
import { isLikelyOffTopic, reduceSessionState, type SessionState } from "./state.ts";

// One turn of the adaptive runtime, as two pure steps the turn runner calls around the model call
// (Architecture §9.1). Pure: no I/O, no "@/" imports.
//
//   planTurn   (before):  fold the learner's input into state → policy directive → teacher note + context parts
//   commitTurn (after):   fold the teacher's events (and the new held checks) into state

export type TurnPlanInput<T extends ContextTurn> = {
  state: SessionState;
  /** Whether `state` can be persisted (tutor_sessions.state exists). Without it nothing is summarised. */
  statePersisted: boolean;
  history: readonly T[];
  learnerText: string | null;
  graded: GradedInteraction | null;
  /** Registered objective id the graded check is evidence for (resolved by the caller). */
  gradedObjectiveId: string | null;
  /** Goal, step goals and objective texts: the off-topic heuristic's vocabulary. */
  vocabulary: readonly string[];
  brief: PolicyBrief;
  flow: PolicyFlow;
  directivesEnabled: boolean;
  /** Objective id → text, for the directive note. */
  objectiveText?: (id: string) => string | null;
  /** Per-learner context block (memory + brief), outside the cached prefix. */
  learnerBlock: string | null;
};

export type TurnPlan<T extends ContextTurn> = {
  /** State with the learner's input applied (the policy's view). */
  state: SessionState;
  directive: Directive | null;
  teacherNote: string | null;
  prelude: string | null;
  /** Turns to send verbatim. */
  window: T[];
};

export function planTurn<T extends ContextTurn>(input: TurnPlanInput<T>): TurnPlan<T> {
  const isOpening = input.learnerText === null && !input.graded;
  const state = isOpening
    ? input.state
    : reduceSessionState(input.state, {
        learner: {
          text: input.learnerText,
          graded: input.graded
            ? { objectiveId: input.gradedObjectiveId, result: input.graded.grade.result, checkId: input.graded.check.id }
            : null,
          offTopic: !input.graded && isLikelyOffTopic(input.learnerText, input.vocabulary),
        },
        events: [],
        // Keep the previous turn's move visible to the policy (e.g. recap → wrap_up, worked example → check).
        move: input.state.lastMove ?? null,
      });

  const directive = input.directivesEnabled ? teachingPolicy(state, input.brief, input.flow) : null;
  const teacherNote = combineTeacherNotes(
    input.graded ? teacherNoteForGrade(input.graded) : null,
    directive ? directiveNote(directive, directive.objectiveId ? input.objectiveText?.(directive.objectiveId) : null) : null,
  );
  const summary = input.statePersisted ? state.summary : undefined;
  return {
    state,
    directive,
    teacherNote,
    prelude: buildPrelude({ learner: input.learnerBlock, summary }),
    window: windowTurns(input.history, summary ? state.summarizedThroughIdx : undefined),
  };
}

export function commitTurn(
  plan: { state: SessionState; directive: Directive | null },
  turn: { events: readonly TutorEvent[]; checks?: readonly PendingCheck[] },
  opts: { beatIds?: readonly string[]; resolveObjective?: (raw: string) => string | null } = {},
): SessionState {
  return reduceSessionState(plan.state, {
    learner: null,
    events: turn.events,
    checks: turn.checks,
    move: plan.directive?.move ?? null,
    strategy: plan.directive?.strategy ?? null,
    beatIds: opts.beatIds,
    resolveObjective: opts.resolveObjective,
  });
}
