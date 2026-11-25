import type { SessionState } from "./state.ts";
import {
  isBeginnerLevel,
  isMoveAllowed,
  maxHintsFor,
  STRATEGIES,
  type Move,
  type StrategyId,
  type TeachingPhilosophy,
} from "./strategies.ts";

// The Teaching Policy (P2-05, Architecture §3.3). Pure: no I/O, no "@/" imports.
// `teachingPolicy(state, brief, flow)` runs before each turn and RECOMMENDS one move. The directive is advisory: it
// reaches the model as a short teacher note at the end of `contents`, and the model may still answer what the
// learner actually asked. Returns null when there is nothing worth saying (the model's own judgement stands).

export type Directive = {
  move: Move;
  objectiveId: string | null;
  reason: string;
  constraints?: string[];
  /** Strategy in force for this turn (recorded into state by the reducer). */
  strategy: StrategyId;
};

export type PolicyBrief = {
  level?: string | null;
  philosophy?: TeachingPhilosophy;
};

export type PolicyFlow = {
  origin?: string | null;
  /** Milliseconds left in the session's time box. */
  timeLeftMs: number;
  /** Registered prerequisites per objective id (first one is used). */
  prerequisites?: Readonly<Record<string, readonly string[]>>;
};

/** Thresholds, exported so the tests read like the §3.3 table. */
export const POLICY = {
  wrapUpMs: 90_000,
  stretchNeedsMs: 180_000,
  offTopicTurns: 2,
  workedExampleMisses: 2,
  prerequisiteMisses: 3,
  lowConfidence: 2,
  highConfidence: 4,
  stretchStreak: 2,
} as const;

const TRANSFER_STRATEGIES = new Set<StrategyId>(["worked_example", "problem_based", "demonstration"]);

/** Strategies the policy never switches away from (an oral check must stay an oral check). */
const LOCKED_STRATEGIES = new Set<StrategyId>(["viva"]);

function constrain(d: Directive, sessionStrategy: StrategyId): Directive | null {
  if (LOCKED_STRATEGIES.has(sessionStrategy)) d = { ...d, strategy: sessionStrategy };
  if (isMoveAllowed(d.strategy, d.move)) return d;
  // e.g. a viva never teaches: anything other than probe/check becomes a check, if the strategy allows it.
  if (isMoveAllowed(d.strategy, "check")) return { ...d, move: "check", constraints: [...(d.constraints ?? []), "do not teach or hint"] };
  return null;
}

export function teachingPolicy(state: SessionState, brief: PolicyBrief, flow: PolicyFlow): Directive | null {
  const strategy = state.strategy;
  const objectiveId = state.currentObjectiveId;
  const obj = state.objectives.find((o) => o.id === objectiveId) ?? null;

  // Time box: ≤90 s left → recap, then wrap up.
  if (flow.timeLeftMs <= POLICY.wrapUpMs) {
    return state.lastMove === "recap" || state.lastMove === "wrap_up"
      ? {
          move: "wrap_up",
          objectiveId: null,
          reason: "under 90 seconds left and the recap is done",
          constraints: ["one sentence", "then end_session with a one-line summary"],
          strategy,
        }
      : {
          move: "recap",
          objectiveId: null,
          reason: "under 90 seconds left",
          constraints: ["recap the key point in two sentences", "no new material"],
          strategy,
        };
  }

  // Off-topic twice → brief answer + redirect.
  if (state.offTopicStreak >= POLICY.offTopicTurns) {
    return {
      move: "redirect",
      objectiveId,
      reason: `${state.offTopicStreak} off-topic messages in a row`,
      constraints: ["answer the side question in one sentence", "then bring the learner back to the current step"],
      strategy,
    };
  }

  if (obj) {
    // 3 misconceptions → prerequisite if registered, else simplify and flag for review.
    if (obj.misses >= POLICY.prerequisiteMisses) {
      const prereq = flow.prerequisites?.[obj.id]?.[0];
      return constrain(
        prereq
          ? {
              move: "prerequisite",
              objectiveId: prereq,
              reason: `${obj.misses} misconceptions on ${obj.id}; revisit its prerequisite first`,
              constraints: ["one short explanation and one check on the prerequisite"],
              strategy: "guided",
            }
          : {
              move: "simplify",
              objectiveId: obj.id,
              reason: `${obj.misses} misconceptions on ${obj.id} and no registered prerequisite; flagged for review`,
              constraints: ["smallest possible step", "concrete everyday example", "no new terms"],
              strategy: "guided",
            },
        strategy,
      );
    }
    // 2 misconceptions → worked example, then check.
    if (obj.misses >= POLICY.workedExampleMisses) {
      return constrain(
        state.lastMove === "worked_example"
          ? {
              move: "check",
              objectiveId: obj.id,
              reason: "after the worked example, check with a similar item",
              constraints: ["one question only", "a different example than the worked one"],
              strategy: "worked_example",
            }
          : {
              move: "worked_example",
              objectiveId: obj.id,
              reason: `${obj.misses} failed checks on ${obj.id}; switch to a worked example`,
              constraints: ["use show_board steps", "explain each step in one line"],
              strategy: "worked_example",
            },
        strategy,
      );
    }
    // Correct with low confidence → one more check at a different representation before `met`.
    if (obj.needsConfirm) {
      return constrain({
        move: "check",
        objectiveId: obj.id,
        reason: "correct but the learner was unsure; confirm before moving on",
        constraints: ["one question only", "use a different representation than last time"],
        strategy,
      }, strategy);
    }
    // Correct twice with high confidence and time left → transfer.
    const confident = (state.confidence ?? POLICY.highConfidence) >= POLICY.highConfidence;
    if (obj.streak >= POLICY.stretchStreak && confident && flow.timeLeftMs > POLICY.stretchNeedsMs) {
      return constrain({
        move: TRANSFER_STRATEGIES.has(strategy) ? "independent_task" : "stretch",
        objectiveId: obj.id,
        reason: `${obj.streak} correct in a row with high confidence`,
        constraints: ["apply it in a new situation", "do not re-teach"],
        strategy: !isBeginnerLevel(brief.level) && strategy === "guided" ? "socratic" : strategy,
      }, strategy);
    }
    // Hints used up → reveal and explain rather than hint again.
    if (obj.hints > maxHintsFor(strategy, brief.philosophy)) {
      return constrain({
        move: "explain",
        objectiveId: obj.id,
        reason: `hints used up (${obj.hints}) on ${obj.id}`,
        constraints: ["give the answer and explain why in two sentences", "then one check"],
        strategy,
      }, strategy);
    }
  }

  // Session start or an unseen objective → probe what the learner knows.
  if (state.learnerTurns === 0 && flow.origin !== "ask") {
    return constrain({
      move: "probe",
      objectiveId,
      reason: "session start: find out what the learner already knows",
      constraints: ["one short question"],
      strategy,
    }, strategy);
  }

  // Teaching for a while without checking → check.
  if (obj && obj.status !== "met" && state.turnsSinceCheck >= STRATEGIES[strategy].checkEvery + 1) {
    return constrain({
      move: "check",
      objectiveId: obj.id,
      reason: `${state.turnsSinceCheck} learner turns since the last check`,
      constraints: ["one question only", "prefer ask_choice, ask_fill, ask_order or ask_numeric with an answer key"],
      strategy,
    }, strategy);
  }

  return null;
}

/** The directive as the short per-turn teacher note. `objectiveText` labels the objective when known. */
export function directiveNote(d: Directive, objectiveText?: string | null): string {
  const target = d.objectiveId ? ` on ${d.objectiveId}${objectiveText ? ` ("${objectiveText.slice(0, 120)}")` : ""}` : "";
  return [
    `Suggested next move: ${d.move.replace(/_/g, " ")}${target}. Why: ${d.reason}.`,
    d.constraints?.length ? `Constraints: ${d.constraints.join("; ")}.` : null,
    "This is advice: if the learner asked something else, answer that first.",
  ]
    .filter((l): l is string => l !== null)
    .join("\n");
}

/** Per-tenant switch (A/B): env TUTOR_POLICY_DIRECTIVES=off disables everywhere; a company id listed in
 * TUTOR_POLICY_DIRECTIVES_OFF_COMPANIES (comma-separated) disables it for that tenant only. Default on. */
export function policyDirectivesEnabled(
  companyId: string | null | undefined,
  env: Readonly<Record<string, string | undefined>>,
): boolean {
  const global = (env.TUTOR_POLICY_DIRECTIVES ?? "on").trim().toLowerCase();
  if (global === "off" || global === "false" || global === "0") return false;
  const off = (env.TUTOR_POLICY_DIRECTIVES_OFF_COMPANIES ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  return !(companyId && off.includes(companyId.toLowerCase()));
}
