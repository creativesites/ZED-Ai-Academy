import { parseTutorTurn, type TutorEvent } from "../events.ts";

// Voice and Text turn orchestration, with every side effect injected (model call, TTS, storage, clock).
// Pure: relative imports only, so node:test can run it against stubs. The route wires real deps.

/** Maximum turns per session, counting the opening turn. */
export const MAX_TURNS = 60;

export type HistoryTurn = { idx: number; learner_text: string | null; events: unknown };

export type GenContent = { role: "user" | "model"; parts: { text: string }[] };

export type TurnGenerateRequest = { systemInstruction: string; contents: GenContent[] };

export type TurnGenerateResult = { text: string | undefined; totalTokens?: number };

export type TurnPipelineDeps = {
  now: () => number;
  /** Structured-output model call. Throws on transport errors. */
  generate: (req: TurnGenerateRequest) => Promise<TurnGenerateResult>;
  /** TTS for one `say` line. Returns the public audio URL, or null when synthesis is unavailable. */
  synthesize: (text: string, voice: string) => Promise<string | null>;
  /** Persists the turn row. */
  saveTurn: (turn: { idx: number; learnerText: string | null; events: TutorEvent[]; latencyMs: number }) => Promise<void>;
};

export type TurnPipelineInput = {
  sessionStartedAtMs: number;
  maxMinutes: number;
  idx: number;
  /** Learner's words for this turn. null for the opening turn, which the learner did not speak. */
  learnerText: string | null;
  /** Used as the user message when there is no learner text (the opening turn). */
  openingInstruction: string;
  systemInstruction: string;
  voice: string;
  history: HistoryTurn[];
};

export type TurnPipelineResult = {
  idx: number;
  events: TutorEvent[];
  ended: boolean;
  endReason?: "time_box" | "turn_limit" | "model_end";
  /** Model events dropped by validation. */
  dropped: number;
  /** Set when the model reply was missing or not valid JSON. The turn is still stored, with no events. */
  parseError?: string;
  latencyMs: number;
};

const TIME_UP_SUMMARY = "Time is up for this session.";
const TURN_LIMIT_SUMMARY = "This session has reached its turn limit.";

/** Why a session must end before another turn: the turn cap, or the scenario time box. Null when it may go on. */
export function sessionLimitReason(input: {
  idx: number;
  sessionStartedAtMs: number;
  maxMinutes: number;
  nowMs: number;
}): "time_box" | "turn_limit" | null {
  if (input.idx >= MAX_TURNS) return "turn_limit";
  if (input.nowMs - input.sessionStartedAtMs >= input.maxMinutes * 60_000) return "time_box";
  return null;
}

export async function runTutorTurn(input: TurnPipelineInput, deps: TurnPipelineDeps): Promise<TurnPipelineResult> {
  const startedAt = deps.now();

  // Time box and turn limit end the session without a model call.
  const endReason = sessionLimitReason({
    idx: input.idx,
    sessionStartedAtMs: input.sessionStartedAtMs,
    maxMinutes: input.maxMinutes,
    nowMs: startedAt,
  });
  if (endReason) {
    const summary = endReason === "time_box" ? TIME_UP_SUMMARY : TURN_LIMIT_SUMMARY;
    const events: TutorEvent[] = [{ type: "end_session", summary }];
    await deps.saveTurn({ idx: input.idx, learnerText: input.learnerText, events, latencyMs: 0 });
    return { idx: input.idx, events, ended: true, endReason, dropped: 0, latencyMs: 0 };
  }

  const contents = buildContents(input.history, input.learnerText, input.openingInstruction);
  const response = await deps.generate({ systemInstruction: input.systemInstruction, contents });
  const latencyMs = Math.max(0, deps.now() - startedAt);

  let events: TutorEvent[] = [];
  let dropped = 0;
  let parseError: string | undefined;
  if (response.text === undefined || response.text.trim() === "") {
    parseError = "empty model response";
  } else {
    const parsed = parseTutorTurn(response.text);
    if (parsed.ok) {
      events = parsed.events;
      dropped = parsed.dropped;
    } else {
      parseError = parsed.error;
    }
  }

  // Each `say` line gets audio. A TTS failure leaves the line as text only.
  events = await Promise.all(
    events.map(async (event): Promise<TutorEvent> => {
      if (event.type !== "say") return event;
      const audioUrl = await deps.synthesize(event.text, input.voice).catch(() => null);
      return audioUrl ? { ...event, audioUrl } : event;
    }),
  );

  const modelEnded = events.some((e) => e.type === "end_session");
  await deps.saveTurn({ idx: input.idx, learnerText: input.learnerText, events, latencyMs });

  return {
    idx: input.idx,
    events,
    ended: modelEnded,
    endReason: modelEnded ? "model_end" : undefined,
    dropped,
    parseError,
    latencyMs,
  };
}

/**
 * Gemini contents from stored turns: each stored turn becomes a user message (the learner's words,
 * or a marker for the opening) followed by a model message holding its events as JSON.
 * The current learner input (or opening instruction) comes last. Consecutive same-role messages merge.
 */
export function buildContents(
  history: HistoryTurn[],
  learnerText: string | null,
  openingInstruction: string,
): GenContent[] {
  const contents: GenContent[] = [];
  const push = (role: "user" | "model", text: string) => {
    const last = contents[contents.length - 1];
    if (last && last.role === role) {
      last.parts.push({ text });
    } else {
      contents.push({ role, parts: [{ text }] });
    }
  };

  for (const turn of [...history].sort((a, b) => a.idx - b.idx)) {
    push("user", turn.learner_text && turn.learner_text.trim() ? `Learner: ${turn.learner_text}` : "(session opening)");
    push("model", JSON.stringify({ events: eventsForHistory(turn.events) }));
  }

  push("user", learnerText && learnerText.trim() ? `Learner: ${learnerText}` : openingInstruction);
  return contents;
}

/** Stored events without audio URLs, so history stays small. Non-array values become an empty list. */
export function eventsForHistory(events: unknown): unknown[] {
  if (!Array.isArray(events)) return [];
  return events.map((e) => {
    if (typeof e === "object" && e !== null && "audioUrl" in e) {
      const copy: Record<string, unknown> = { ...(e as Record<string, unknown>) };
      delete copy.audioUrl;
      return copy;
    }
    return e;
  });
}
