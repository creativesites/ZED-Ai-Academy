import type { TutorEvent } from "../contract/index.ts";
import type { PendingCheck } from "./interactions.ts";
import { STRATEGY_IDS, type Move, type StrategyId } from "./strategies.ts";

// Server-owned session state (P2-05, Architecture §3.3). Pure: no I/O, no "@/" imports.
// Stored in tutor_sessions.state (jsonb, versioned). `reduceSessionState` runs after each turn; the teaching policy
// reads it before the next. Evidence and objective progress live HERE, not in the rolling summary (P2-06), so
// summarising old turns never loses them.

export type CheckResult = "correct" | "partial" | "misconception";

export type PendingCheckRef = Pick<PendingCheck, "id" | "turnIdx" | "kind" | "objective">;

function checkRef(c: PendingCheck | PendingCheckRef): PendingCheckRef {
  return { id: c.id, turnIdx: c.turnIdx, kind: c.kind, objective: c.objective };
}

const CHECK_KINDS = new Set(["choice", "order", "fill", "numeric"]);

function parseCheckRef(raw: unknown): PendingCheckRef | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.id !== "string" || typeof r.turnIdx !== "number" || !CHECK_KINDS.has(r.kind as string)) return null;
  return checkRef({
    id: r.id,
    turnIdx: r.turnIdx,
    kind: r.kind as PendingCheckRef["kind"],
    objective: typeof r.objective === "string" ? r.objective : null,
  });
}
export type ObjectiveStatus = "pending" | "teaching" | "checking" | "met" | "partial" | "review";

export type ObjectiveRunState = {
  id: string;
  status: ObjectiveStatus;
  attempts: number;
  hints: number;
  lastResult?: CheckResult;
  /** Consecutive misconceptions. */
  misses: number;
  /** Consecutive correct answers. */
  streak: number;
  /** Correct, but with low confidence: one more check (different representation) before `met`. */
  needsConfirm?: boolean;
};

export type SessionState = {
  v: 1;
  flowVersion: number | null;
  objectives: ObjectiveRunState[];
  currentObjectiveId: string | null;
  stepIdx: number;
  strategy: StrategyId;
  /**
   * The latest open check, by reference only. The answer key itself is held in the server-only
   * tutor_pending_checks table: learners can read their own tutor_sessions rows under RLS.
   */
  pendingCheck?: PendingCheckRef;
  /** 1..5, from the last ask_confidence reply. */
  confidence?: 1 | 2 | 3 | 4 | 5;
  awaitingConfidence?: boolean;
  learnerTurns: number;
  /** Learner turns since the teacher last checked understanding. */
  turnsSinceCheck: number;
  offTopicStreak: number;
  lastMove?: Move;
  /** Rolling summary of turns older than the context window (P2-06). */
  summary?: string;
  /** Highest turn idx folded into `summary`. */
  summarizedThroughIdx?: number;
};

export const SESSION_STATE_VERSION = 1 as const;

export function initialSessionState(input: {
  objectiveIds: readonly string[];
  flowVersion?: number | null;
  strategy: StrategyId;
}): SessionState {
  const ids = [...new Set(input.objectiveIds)].slice(0, 24);
  return {
    v: 1,
    flowVersion: input.flowVersion ?? null,
    objectives: ids.map((id) => ({ id, status: "pending", attempts: 0, hints: 0, misses: 0, streak: 0 })),
    currentObjectiveId: ids[0] ?? null,
    stepIdx: 0,
    strategy: input.strategy,
    learnerTurns: 0,
    turnsSinceCheck: 0,
    offTopicStreak: 0,
  };
}

const STATUSES = new Set<ObjectiveStatus>(["pending", "teaching", "checking", "met", "partial", "review"]);
const RESULTS = new Set<CheckResult>(["correct", "partial", "misconception"]);

function int(v: unknown, fallback = 0): number {
  return typeof v === "number" && Number.isFinite(v) ? Math.max(0, Math.floor(v)) : fallback;
}

/** Reads a stored state. Anything unrecognised (wrong version, corrupt jsonb) returns null: recompute instead. */
export function parseSessionState(raw: unknown): SessionState | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const r = raw as Record<string, unknown>;
  if (r.v !== 1) return null;
  if (typeof r.strategy !== "string" || !(STRATEGY_IDS as readonly string[]).includes(r.strategy)) return null;
  const objectives: ObjectiveRunState[] = Array.isArray(r.objectives)
    ? (r.objectives as unknown[])
        .filter((o): o is Record<string, unknown> => !!o && typeof o === "object" && typeof (o as { id?: unknown }).id === "string")
        .slice(0, 24)
        .map((o) => ({
          id: o.id as string,
          status: STATUSES.has(o.status as ObjectiveStatus) ? (o.status as ObjectiveStatus) : "pending",
          attempts: int(o.attempts),
          hints: int(o.hints),
          misses: int(o.misses),
          streak: int(o.streak),
          ...(RESULTS.has(o.lastResult as CheckResult) ? { lastResult: o.lastResult as CheckResult } : {}),
          ...(o.needsConfirm === true ? { needsConfirm: true } : {}),
        }))
    : [];
  const conf = int(r.confidence);
  return {
    v: 1,
    flowVersion: typeof r.flowVersion === "number" ? r.flowVersion : null,
    objectives,
    currentObjectiveId: typeof r.currentObjectiveId === "string" ? r.currentObjectiveId : null,
    stepIdx: int(r.stepIdx),
    strategy: r.strategy as StrategyId,
    ...(parseCheckRef(r.pendingCheck) ? { pendingCheck: parseCheckRef(r.pendingCheck)! } : {}),
    ...(conf >= 1 && conf <= 5 ? { confidence: conf as 1 | 2 | 3 | 4 | 5 } : {}),
    ...(r.awaitingConfidence === true ? { awaitingConfidence: true } : {}),
    learnerTurns: int(r.learnerTurns),
    turnsSinceCheck: int(r.turnsSinceCheck),
    offTopicStreak: int(r.offTopicStreak),
    ...(typeof r.lastMove === "string" ? { lastMove: r.lastMove as Move } : {}),
    ...(typeof r.summary === "string" && r.summary ? { summary: r.summary.slice(0, 4000) } : {}),
    ...(typeof r.summarizedThroughIdx === "number" ? { summarizedThroughIdx: int(r.summarizedThroughIdx) } : {}),
  };
}

// ---- learner-input signals ----

const CONFIDENCE_REPLIES: Record<string, 1 | 2 | 3 | 4 | 5> = { lost: 1, unsure: 2, "got it": 4 };
const HINT_RE = /\b(hint|clue)\b|\bi'?m stuck\b|\bhelp me\b/i;

export function confidenceFromReply(text: string | null | undefined): 1 | 2 | 3 | 4 | 5 | null {
  if (!text) return null;
  const key = text.trim().toLowerCase().replace(/[.!]+$/, "");
  return CONFIDENCE_REPLIES[key] ?? null;
}

const STOP = new Set(
  "the a an and or but of to in on at for with is are was were be been it this that these those i you we they he she my your our me do does did can could would should what why how when where which who about from as by so if not no yes just".split(
    " ",
  ),
);
const ON_TASK_RE =
  /\b(explain|example|hint|again|repeat|simpler|next|step|quiz|check|answer|understand|confused|lost|unsure|got it|ready|continue|why|how)\b/i;

function contentWords(text: string): string[] {
  return (text.toLowerCase().normalize("NFKD").match(/[a-zÀ-ɏ]{3,}/g) ?? []).filter((w) => !STOP.has(w));
}

/**
 * Conservative off-topic heuristic: a substantial learner message (≥5 content words) sharing no word stem with the
 * session vocabulary (goal, steps, objectives) and not a learning request. Advisory only: it feeds a "redirect"
 * suggestion after two in a row, never blocks anything.
 */
export function isLikelyOffTopic(text: string | null | undefined, vocabulary: readonly string[]): boolean {
  if (!text || ON_TASK_RE.test(text)) return false;
  const words = contentWords(text);
  if (words.length < 5) return false;
  const stems = new Set(vocabulary.flatMap(contentWords).map((w) => w.slice(0, 5)));
  if (stems.size === 0) return false;
  return !words.some((w) => stems.has(w.slice(0, 5)));
}

// ---- reducer ----

export type GradedSignal = { objectiveId: string | null; result: CheckResult; checkId: string };

export type ReduceInput = {
  /** The learner's turn (null for the opening turn). */
  learner: {
    text: string | null;
    /** Server-graded interaction answered this turn. */
    graded?: GradedSignal | null;
    offTopic?: boolean;
  } | null;
  /** The teacher's stored events for this turn (keys included; server-side). */
  events: readonly TutorEvent[];
  /** Checks the server now holds for this turn. */
  checks?: readonly PendingCheck[];
  /** Move the policy recommended for this turn, if any. */
  move?: Move | null;
  /** Strategy the policy chose for this turn. */
  strategy?: StrategyId | null;
  /** Step ids of the flow, in order. */
  beatIds?: readonly string[];
  /** Maps a model-written objective reference (id, code or text) to a registered objective id. */
  resolveObjective?: (raw: string) => string | null;
};

function applyResult(o: ObjectiveRunState, result: CheckResult, confidence: number | undefined): ObjectiveRunState {
  const next: ObjectiveRunState = { ...o, attempts: o.attempts + 1, lastResult: result };
  if (result === "misconception") {
    next.misses = o.misses + 1;
    next.streak = 0;
    next.needsConfirm = false;
    next.status = next.misses >= 3 ? "review" : "teaching";
  } else if (result === "partial") {
    next.streak = 0;
    next.status = "partial";
  } else {
    next.misses = 0;
    next.streak = o.streak + 1;
    if (o.needsConfirm) {
      next.needsConfirm = false;
      next.status = "met";
    } else if (confidence !== undefined && confidence <= 2) {
      next.needsConfirm = true;
      next.status = "checking";
    } else {
      next.status = "met";
    }
  }
  if (!next.needsConfirm) delete next.needsConfirm;
  return next;
}

function withObjective(
  objectives: ObjectiveRunState[],
  id: string,
  update: (o: ObjectiveRunState) => ObjectiveRunState,
): ObjectiveRunState[] {
  const found = objectives.some((o) => o.id === id);
  const base = found
    ? objectives
    : [...objectives, { id, status: "pending" as const, attempts: 0, hints: 0, misses: 0, streak: 0 }].slice(-24);
  return base.map((o) => (o.id === id ? update(o) : o));
}

function nextOpenObjective(objectives: readonly ObjectiveRunState[], after: string | null): string | null {
  const start = after ? objectives.findIndex((o) => o.id === after) + 1 : 0;
  const ordered = [...objectives.slice(start), ...objectives.slice(0, start)];
  return ordered.find((o) => o.status !== "met")?.id ?? null;
}

/** Pure reducer: state after one turn (learner input first, then the teacher's events). Never mutates `state`. */
export function reduceSessionState(state: SessionState, input: ReduceInput): SessionState {
  const resolve = input.resolveObjective ?? ((raw: string) => raw);
  let s: SessionState = { ...state, objectives: state.objectives.map((o) => ({ ...o })) };

  // 1. Learner input.
  if (input.learner) {
    s.learnerTurns += 1;
    s.turnsSinceCheck += 1;
    const conf = s.awaitingConfidence ? confidenceFromReply(input.learner.text) : null;
    if (conf !== null) s.confidence = conf;
    delete s.awaitingConfidence;
    s.offTopicStreak = input.learner.offTopic ? s.offTopicStreak + 1 : 0;

    const target = input.learner.graded
      ? (input.learner.graded.objectiveId ?? s.currentObjectiveId)
      : s.currentObjectiveId;
    if (input.learner.graded && target) {
      const result = input.learner.graded.result;
      s.objectives = withObjective(s.objectives, target, (o) => applyResult(o, result, s.confidence));
      s.currentObjectiveId = target;
    }
    if (input.learner.graded) delete s.pendingCheck;
    if (target && HINT_RE.test(input.learner.text ?? "")) {
      s.objectives = withObjective(s.objectives, target, (o) => ({ ...o, hints: o.hints + 1 }));
    }
  }

  // 2. Teacher events.
  for (const e of input.events) {
    switch (e.type) {
      case "note_evidence": {
        const id = resolve(e.objective);
        if (!id) break;
        s.objectives = withObjective(s.objectives, id, (o) => applyResult(o, e.result, s.confidence));
        s.currentObjectiveId = id;
        break;
      }
      case "ask_choice":
      case "ask_order":
      case "ask_fill":
      case "ask_numeric": {
        s.turnsSinceCheck = 0;
        const raw = (e as { objective?: string }).objective;
        const id = raw ? resolve(raw) : null;
        if (id) s.currentObjectiveId = id;
        if (s.currentObjectiveId) {
          s.objectives = withObjective(s.objectives, s.currentObjectiveId, (o) =>
            o.status === "met" ? o : { ...o, status: "checking" },
          );
        }
        break;
      }
      case "ask_confidence":
        s.awaitingConfidence = true;
        s.turnsSinceCheck = 0;
        break;
      case "advance_step":
      case "advance_scene": {
        const beat = e.type === "advance_step" ? e.step : e.beat;
        const idx = (input.beatIds ?? []).findIndex((b) => b.toLowerCase() === beat.toLowerCase());
        s.stepIdx = idx >= 0 ? idx : s.stepIdx + 1;
        break;
      }
      case "say":
      case "show_board":
        if (s.currentObjectiveId) {
          s.objectives = withObjective(s.objectives, s.currentObjectiveId, (o) =>
            o.status === "pending" ? { ...o, status: "teaching" } : o,
          );
        }
        break;
      default:
        break;
    }
  }

  const latestCheck = input.checks?.at(-1);
  if (latestCheck) s.pendingCheck = checkRef(latestCheck);

  // 3. Move on once the current objective is met.
  const current = s.objectives.find((o) => o.id === s.currentObjectiveId);
  if (!s.currentObjectiveId || (current && current.status === "met")) {
    s.currentObjectiveId = nextOpenObjective(s.objectives, s.currentObjectiveId) ?? s.currentObjectiveId;
  }

  if (input.move) s.lastMove = input.move;
  else delete s.lastMove;
  if (input.strategy) s.strategy = input.strategy;
  s = { ...s };
  return s;
}

/** Rebuilds state from stored turns when tutor_sessions.state is unavailable (no grading signals: teacher judgement only). */
export function recomputeSessionState(
  initial: SessionState,
  turns: ReadonlyArray<{ idx: number; learner_text: string | null; events: unknown }>,
  opts: Pick<ReduceInput, "beatIds" | "resolveObjective"> = {},
): SessionState {
  let s = initial;
  for (const t of [...turns].sort((a, b) => a.idx - b.idx)) {
    const events = (Array.isArray(t.events) ? t.events : []).filter(
      (e): e is TutorEvent => !!e && typeof e === "object" && typeof (e as { type?: unknown }).type === "string",
    );
    s = reduceSessionState(s, {
      learner: t.idx === 0 && !t.learner_text ? null : { text: t.learner_text },
      events,
      beatIds: opts.beatIds,
      resolveObjective: opts.resolveObjective,
    });
  }
  return s;
}
