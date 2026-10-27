import { DEMO_SCENARIO_KEYS, type DemoScenarioKey } from "./demo-scenarios.ts";
import type { TutorEvent } from "./events.ts";
import type { HistoryTurn } from "./server/turn-pipeline.ts";

// Pure logic for the stateless showcase demo API (POST /api/tutor/demo/turn and /report): request
// validation, per-demo limits, the in-memory abuse limiter and history conversion. No I/O, no
// "@/" imports, so node:test can run it. The route files wire it to Clerk, Gemini and the pipeline.

export const DEMO_MAX_HISTORY = 24;
export const DEMO_MAX_LEARNER_TURNS = 12;
export const DEMO_MAX_TEXT_CHARS = 500;
export const DEMO_MAX_TUTOR_CHARS = 1000;
export const DEMO_AUDIO_MAX_BYTES = 2 * 1024 * 1024;
export const DEMO_AUDIO_TYPES: readonly string[] = ["audio/webm", "audio/ogg", "audio/wav", "audio/x-wav", "audio/wave"];
/** Best-effort per-user budget. Counted per server instance, so a serverless fleet allows more in total. */
export const DEMO_TURNS_PER_HOUR = 40;
export const DEMO_WINDOW_MS = 60 * 60_000;

const MAX_ELAPSED_MS = 24 * 60 * 60_000;

export type DemoRole = "learner" | "tutor";
export type DemoHistoryEntry = { role: DemoRole; text: string };

export type DemoTurnRequest = {
  scenarioKey: DemoScenarioKey;
  history: DemoHistoryEntry[];
  /** The learner's typed words, or null for the opening turn. Audio is transcribed before validation. */
  text: string | null;
  /** Client-reported time since the demo started. Used only for the time box. */
  elapsedMs: number;
};

export type DemoReportRequest = { scenarioKey: DemoScenarioKey; history: DemoHistoryEntry[] };

export type DemoParse<T> = { ok: true; value: T } | { ok: false; status: number; error: string };

const ok = <T>(value: T): DemoParse<T> => ({ ok: true, value });
const fail = (status: number, error: string): { ok: false; status: number; error: string } => ({ ok: false, status, error });

/** The kill switch: the demo is on unless TUTOR_DEMO_ENABLED is set to "false". */
export function isDemoEnabled(flag: string | undefined): boolean {
  return flag?.trim().toLowerCase() !== "false";
}

export function parseScenarioKey(value: unknown): DemoParse<DemoScenarioKey> {
  if (typeof value === "string" && (DEMO_SCENARIO_KEYS as readonly string[]).includes(value)) {
    return ok(value as DemoScenarioKey);
  }
  return fail(400, `scenarioKey must be one of: ${DEMO_SCENARIO_KEYS.join(", ")}`);
}

export function parseDemoHistory(value: unknown): DemoParse<DemoHistoryEntry[]> {
  if (value === undefined || value === null) return ok([]);
  if (!Array.isArray(value)) return fail(400, "history must be an array");
  if (value.length > DEMO_MAX_HISTORY) return fail(400, `history can have at most ${DEMO_MAX_HISTORY} entries`);

  const out: DemoHistoryEntry[] = [];
  for (const raw of value) {
    if (typeof raw !== "object" || raw === null) return fail(400, "each history entry must be an object");
    const entry = raw as { role?: unknown; text?: unknown };
    if (entry.role !== "learner" && entry.role !== "tutor") return fail(400, "history role must be learner or tutor");
    if (typeof entry.text !== "string") return fail(400, "history text must be a string");
    const text = entry.text.trim();
    if (!text) return fail(400, "history text must not be empty");
    const max = entry.role === "learner" ? DEMO_MAX_TEXT_CHARS : DEMO_MAX_TUTOR_CHARS;
    if (text.length > max) return fail(400, `history text must be ${max} characters or fewer`);
    out.push({ role: entry.role, text });
  }
  return ok(out);
}

export function parseDemoTurn(input: {
  scenarioKey: unknown;
  history: unknown;
  text?: unknown;
  elapsedMs?: unknown;
}): DemoParse<DemoTurnRequest> {
  const key = parseScenarioKey(input.scenarioKey);
  if (!key.ok) return key;
  const history = parseDemoHistory(input.history);
  if (!history.ok) return history;

  let text: string | null = null;
  if (input.text !== undefined && input.text !== null && input.text !== "") {
    if (typeof input.text !== "string") return fail(400, "text must be a string");
    const trimmed = input.text.trim();
    if (trimmed.length > DEMO_MAX_TEXT_CHARS) return fail(400, `text must be ${DEMO_MAX_TEXT_CHARS} characters or fewer`);
    text = trimmed || null;
  }

  let elapsedMs = 0;
  if (input.elapsedMs !== undefined && input.elapsedMs !== null) {
    if (typeof input.elapsedMs !== "number" || !Number.isFinite(input.elapsedMs)) {
      return fail(400, "elapsedMs must be a number");
    }
    elapsedMs = Math.min(MAX_ELAPSED_MS, Math.max(0, Math.floor(input.elapsedMs)));
  }

  return ok({ scenarioKey: key.value, history: history.value, text, elapsedMs });
}

export function parseDemoReport(input: { scenarioKey: unknown; history: unknown }): DemoParse<DemoReportRequest> {
  const key = parseScenarioKey(input.scenarioKey);
  if (!key.ok) return key;
  const history = parseDemoHistory(input.history);
  if (!history.ok) return history;
  if (learnerTurnCount(history.value) === 0) return fail(422, "There is nothing to report yet.");
  return ok({ scenarioKey: key.value, history: history.value });
}

export function learnerTurnCount(history: DemoHistoryEntry[]): number {
  return history.filter((entry) => entry.role === "learner").length;
}

/**
 * Why the demo must end before another model call: the time box, or the learner turn cap (the
 * opening turn does not count). Null when the turn may go to the model.
 */
export function demoLimitReason(input: {
  history: DemoHistoryEntry[];
  /** True when this request carries the learner's words (typed or spoken), false for the opening. */
  learnerTurn: boolean;
  elapsedMs: number;
  maxMinutes: number;
}): "time_box" | "turn_limit" | null {
  if (input.elapsedMs >= input.maxMinutes * 60_000) return "time_box";
  if (input.learnerTurn && learnerTurnCount(input.history) >= DEMO_MAX_LEARNER_TURNS) return "turn_limit";
  return null;
}

/** The end_session event the demo returns when a limit ends it without a model call. */
export function demoEndEvent(reason: "time_box" | "turn_limit"): TutorEvent {
  return {
    type: "end_session",
    summary:
      reason === "time_box"
        ? "Time is up for this demo. Sign up to practise with a full session."
        : "This demo has reached its turn limit. Sign up to practise with a full session.",
  };
}

/** Extra system text for the last learner turn the demo allows, so the model wraps up. Null otherwise. */
export function demoWrapUpInstruction(input: { history: DemoHistoryEntry[]; learnerTurn: boolean }): string | null {
  if (!input.learnerTurn) return null;
  if (learnerTurnCount(input.history) + 1 < DEMO_MAX_LEARNER_TURNS) return null;
  return "This is the last learner turn of the demo. Reply briefly to what the learner said, then end the session with end_session and a one-sentence summary.";
}

/**
 * Demo history as pipeline turns. Each learner entry with the teacher's reply after it becomes one
 * turn. A teacher entry with no learner before it is the opening. The client keeps only the
 * teacher's words, so the model sees its earlier lines as `say` events.
 */
export function demoHistoryToTurns(history: DemoHistoryEntry[]): HistoryTurn[] {
  const turns: HistoryTurn[] = [];
  let i = 0;
  while (i < history.length) {
    const entry = history[i];
    const next = history[i + 1];
    if (entry.role === "learner") {
      const reply = next && next.role === "tutor" ? [say(next.text)] : [];
      turns.push({ idx: turns.length, learner_text: entry.text, events: reply });
      i += reply.length ? 2 : 1;
    } else {
      turns.push({ idx: turns.length, learner_text: null, events: [say(entry.text)] });
      i += 1;
    }
  }
  return turns;
}

function say(text: string): TutorEvent {
  return { type: "say", text };
}

/** A WAV buffer as an inline data URL. Demo audio is never stored. */
export function demoSpeechDataUrl(wav: Uint8Array): string {
  return `data:audio/wav;base64,${Buffer.from(wav).toString("base64")}`;
}

export type DemoRateDecision = { ok: true; remaining: number } | { ok: false; retryAfterSec: number };

export type DemoRateLimiter = { take(key: string): DemoRateDecision };

/**
 * Sliding-window counter per key (a Clerk user id). In memory, so it is per server instance: a
 * best-effort brake on cost, not a hard quota. Old keys are swept when the map grows.
 */
export function createDemoRateLimiter(options: {
  limit: number;
  windowMs: number;
  now?: () => number;
  maxKeys?: number;
}): DemoRateLimiter {
  const { limit, windowMs } = options;
  const now = options.now ?? (() => Date.now());
  const maxKeys = options.maxKeys ?? 5000;
  const hits = new Map<string, number[]>();

  return {
    take(key) {
      const t = now();
      const cutoff = t - windowMs;
      const recent = (hits.get(key) ?? []).filter((ts) => ts > cutoff);

      if (recent.length >= limit) {
        hits.set(key, recent);
        const retryAfterSec = Math.max(1, Math.ceil((recent[0] + windowMs - t) / 1000));
        return { ok: false, retryAfterSec };
      }

      recent.push(t);
      hits.set(key, recent);
      if (hits.size > maxKeys) {
        for (const [k, stamps] of hits) {
          if (stamps[stamps.length - 1] <= cutoff) hits.delete(k);
        }
      }
      return { ok: true, remaining: limit - recent.length };
    },
  };
}
