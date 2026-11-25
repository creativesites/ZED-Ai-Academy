import { z } from "zod";
import { ANSWERABLE_EVENT_TYPES, SERVER_ONLY_FIELDS, toClientEvent, type TutorEvent } from "../contract/index.ts";
import {
  fillBlanksFromAnswer,
  gradeInteraction,
  isGradeError,
  resolveChoiceAnswer,
  type AnswerSpec,
  type GradeResult,
} from "./grader.ts";

// Answerable interactions in the turn pipeline (P2-04, Architecture §3.4). Pure: no I/O, no "@/" imports.
//
// 1. prepareAnswerableEvents: after the model replies, every ask_choice/ask_order/ask_fill/ask_numeric gets a
//    server `checkId`; its key is normalised (choice text → indexes, order shuffled) into a PendingCheck, and the
//    event itself goes through toClientEvent. An event whose key is missing or unusable is shown ungraded (the
//    teacher judges the reply, as in v2) and counted.
// 2. Keys are NEVER stored in tutor_turns or tutor_sessions: RLS lets learners read (and write) their own rows
//    there with a Clerk JWT. PendingChecks live in the server-only `tutor_pending_checks` table (RLS on, no
//    policies), are single-use, and only the latest turn's checks are open (isCheckOpen).
// 3. The learner replies with { interaction: { id, value } }; gradeInteraction scores it and teacherNoteForGrade
//    tells the model the result on the next turn.

export type CheckKind = AnswerSpec["kind"];

export type PendingCheck = {
  id: string;
  turnIdx: number;
  kind: CheckKind;
  /** Question text, for the teacher note and the evidence detail. */
  prompt: string;
  /** Objective id (or text) the model named. Resolved against the session's registered objectives at grading. */
  objective: string | null;
  spec: AnswerSpec;
};

export type PreparedTurnEvents = {
  /** Events to store AND send: keys stripped (toClientEvent), checkIds assigned, order items shuffled. */
  client: TutorEvent[];
  checks: PendingCheck[];
  /** Answerable events without a usable key: shown ungraded (teacher judgement). Telemetry. */
  ungraded: number;
};

const ANSWERABLE = new Set<string>(ANSWERABLE_EVENT_TYPES);

export function isAnswerableEvent(e: { type?: unknown }): boolean {
  return typeof e.type === "string" && ANSWERABLE.has(e.type);
}

// ---- deterministic shuffle (seeded by the check id, so a re-render or replay shows the same order) ----

function seedOf(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

function rng(seed: number): () => number {
  let a = seed || 1;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Shuffles items deterministically; never returns the original order when there are 2+ distinct items. */
export function shuffleForDisplay<T>(items: readonly T[], seedText: string): T[] {
  const out = [...items];
  const rand = rng(seedOf(seedText));
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  if (out.length > 1 && out.every((v, i) => v === items[i])) out.push(out.shift() as T);
  return out;
}

export function checkIdFor(turnIdx: number, n: number): string {
  return `t${turnIdx}-${n}`;
}

function blankCount(prompt: string): number {
  return (prompt.match(/_{3,}/g) ?? []).length;
}

/** The answer spec of a model-written answerable event (ask_order already shuffled), or null without a usable key. */
export function specFromModelEvent(e: TutorEvent): AnswerSpec | null {
  switch (e.type) {
    case "ask_choice": {
      if (!e.answer?.length) return null;
      const correct = resolveChoiceAnswer(e.options, e.answer);
      return correct ? { kind: "choice", options: e.options, correct } : null;
    }
    case "ask_order": {
      if (!e.answer || e.answer.length !== e.items.length) return null;
      return { kind: "order", items: e.items, correct: e.answer };
    }
    case "ask_fill": {
      if (!e.answer?.length) return null;
      const blanks = fillBlanksFromAnswer(e.answer);
      if (blanks.length === 0) return null;
      const n = blankCount(e.prompt);
      // More answers than blanks: the model listed synonyms as separate entries for a single blank.
      if (n === 1 && blanks.length > 1) return { kind: "fill", blanks: [blanks.flat()] };
      return { kind: "fill", blanks };
    }
    case "ask_numeric": {
      if (e.value === undefined || !Number.isFinite(e.value)) return null;
      return {
        kind: "numeric",
        value: e.value,
        ...(e.tolerance !== undefined ? { tolerance: e.tolerance } : {}),
        ...(e.unit ? { unit: e.unit } : {}),
      };
    }
    default:
      return null;
  }
}

function promptOf(e: TutorEvent): string {
  if (e.type === "ask_choice") return e.question;
  if (e.type === "ask_order" || e.type === "ask_fill" || e.type === "ask_numeric") return e.prompt;
  return "";
}

function objectiveOf(e: TutorEvent): string | null {
  const o = (e as { objective?: unknown }).objective;
  return typeof o === "string" && o.trim() ? o.trim().slice(0, 200) : null;
}

/** Drops a key the server could not use, so it is neither stored as if graded nor ever sent anywhere. */
function withoutKey(e: TutorEvent): TutorEvent {
  const copy: Record<string, unknown> = { ...e };
  for (const f of SERVER_ONLY_FIELDS[e.type] ?? []) delete copy[f];
  return copy as TutorEvent;
}

/** See the module comment. `turnIdx` makes check ids unique per session. */
export function prepareAnswerableEvents(events: readonly TutorEvent[], turnIdx: number): PreparedTurnEvents {
  const prepare = createAnswerablePreparer(turnIdx);
  const client: TutorEvent[] = [];
  const checks: PendingCheck[] = [];
  let ungraded = 0;
  for (const raw of events) {
    const r = prepare(raw);
    client.push(r.client);
    if (r.check) checks.push(r.check);
    if (r.ungraded) ungraded++;
  }
  return { client, checks, ungraded };
}

/**
 * One event at a time, for streaming (P1-05 × P2-04): every event goes through this BEFORE it is emitted, so no
 * answer key reaches an SSE frame. Numbering matches prepareAnswerableEvents over the same events in the same order.
 */
export function createAnswerablePreparer(
  turnIdx: number,
): (raw: TutorEvent) => { client: TutorEvent; check: PendingCheck | null; ungraded: boolean } {
  let n = 0;
  return (raw) => {
    if (!isAnswerableEvent(raw)) return { client: toClientEvent(raw), check: null, ungraded: false };
    const id = checkIdFor(turnIdx, n++);
    let e: TutorEvent = raw;
    if (e.type === "ask_order") {
      // The model lists the items in the correct order. The learner sees them shuffled; the order is the key.
      e = { ...e, items: shuffleForDisplay(e.items, id), answer: [...e.items] };
    }
    const spec = specFromModelEvent(e);
    if (!spec) return { client: toClientEvent(withoutKey(e)), check: null, ungraded: true };
    return {
      client: toClientEvent({ ...e, checkId: id } as TutorEvent),
      check: { id, turnIdx, kind: spec.kind, prompt: promptOf(e), objective: objectiveOf(e), spec },
      ungraded: false,
    };
  };
}

/**
 * A held check can be answered only while it belongs to the session's latest turn and has not been answered:
 * once the learner has replied (a new turn is stored) or the check was graded, a value cannot be graded again.
 */
export function isCheckOpen(
  check: { turnIdx: number; answeredAt?: string | null },
  history: ReadonlyArray<{ idx: number }>,
): boolean {
  if (check.answeredAt) return false;
  if (history.length === 0) return false;
  const latest = Math.max(...history.map((t) => t.idx));
  return check.turnIdx === latest;
}

/** Parses a held check row's spec (jsonb). Null for anything malformed. */
export function parseAnswerSpec(raw: unknown): AnswerSpec | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const strs = (v: unknown): v is string[] => Array.isArray(v) && v.every((x) => typeof x === "string");
  switch (r.kind) {
    case "choice":
      return strs(r.options) && Array.isArray(r.correct) && r.correct.every((i) => Number.isInteger(i))
        ? { kind: "choice", options: r.options, correct: r.correct as number[] }
        : null;
    case "order":
      return strs(r.items) && strs(r.correct) ? { kind: "order", items: r.items, correct: r.correct } : null;
    case "fill":
      return Array.isArray(r.blanks) && r.blanks.every(strs) ? { kind: "fill", blanks: r.blanks as string[][] } : null;
    case "numeric":
      return typeof r.value === "number" && Number.isFinite(r.value)
        ? {
            kind: "numeric",
            value: r.value,
            ...(typeof r.tolerance === "number" ? { tolerance: r.tolerance } : {}),
            ...(typeof r.unit === "string" ? { unit: r.unit } : {}),
          }
        : null;
    default:
      return null;
  }
}

// ---- learner reply ----

const MAX_VALUE_TEXT = 400;

export const interactionInputSchema = z.object({
  id: z.string().min(1).max(64),
  value: z.union([
    z.number().finite(),
    z.string().max(MAX_VALUE_TEXT),
    z.array(z.union([z.number().int().min(0).max(16), z.string().max(MAX_VALUE_TEXT)])).min(1).max(8),
  ]),
});

export type InteractionInput = z.infer<typeof interactionInputSchema>;

/** What the learner "said" for the transcript and the model history, when they only sent a value. */
export function interactionLearnerText(check: PendingCheck, value: InteractionInput["value"]): string {
  const spec = check.spec;
  const asList = Array.isArray(value) ? value : [value];
  const label = (v: string | number, list: readonly string[]) =>
    typeof v === "number" && list[v] !== undefined ? list[v] : String(v);
  switch (spec.kind) {
    case "choice":
      return `I choose: ${asList.map((v) => label(v, spec.options)).join("; ")}`.slice(0, 1000);
    case "order":
      return `My order: ${asList.map((v) => label(v, spec.items)).join(" → ")}`.slice(0, 1000);
    case "fill":
      return `My answer: ${asList.map(String).join(" / ")}`.slice(0, 1000);
    case "numeric":
      return `My answer: ${String(asList[0])}${spec.unit ? ` ${spec.unit}` : ""}`.slice(0, 1000);
  }
}

export type GradedInteraction = { check: PendingCheck; grade: GradeResult };

export function gradePendingCheck(
  check: PendingCheck,
  value: InteractionInput["value"],
): GradedInteraction | { error: string } {
  const r = gradeInteraction(check.spec, value);
  if (isGradeError(r)) return r;
  return { check, grade: r };
}

/** Teacher note for the next turn: the result is authoritative, the model must not re-grade it. */
export function teacherNoteForGrade(g: GradedInteraction): string {
  const pct = Math.round(g.grade.score * 100);
  const verdict =
    g.grade.result === "correct" ? "correct" : g.grade.result === "partial" ? `partly correct (${pct}%)` : "not correct";
  return [
    `Graded check ${g.check.id} (${g.check.kind}): "${g.check.prompt.slice(0, 160)}"`,
    `The learner answered: ${g.grade.given.slice(0, 200)}. Result: ${verdict}. Expected: ${g.grade.expected.slice(0, 200)}.`,
    "This result is already recorded as evidence; do not add note_evidence for it. React to it: praise briefly if correct; if not, address the specific mistake without just repeating the answer.",
  ].join("\n");
}

// ---- outbound events ----

/** Client-safe copy of a stored turn's events (replay endpoints): keys stripped (old or forged rows), debug entries dropped. */
export function clientEventsForReplay(events: unknown): unknown {
  if (!Array.isArray(events)) return events;
  // The raw-output debug entry may hold an unparsed model reply (and so an answer key): server-side only.
  return events.filter((e) => !(e && typeof e === "object" && (e as { type?: unknown }).type === "debug_raw_output")).map((e) => {
    if (!e || typeof e !== "object") return e;
    const type = (e as { type?: unknown }).type;
    if (typeof type !== "string" || !SERVER_ONLY_FIELDS[type]) return e;
    return toClientEvent(e as TutorEvent);
  });
}
