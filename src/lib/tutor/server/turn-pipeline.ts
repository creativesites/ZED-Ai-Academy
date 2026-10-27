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
  /** `rawOutput` is the model's unusable reply when the fallback was used. Storage keeps it for debugging. */
  saveTurn: (turn: {
    idx: number;
    learnerText: string | null;
    events: TutorEvent[];
    latencyMs: number;
    rawOutput?: string;
  }) => Promise<void>;
};

export type TurnPipelineInput = {
  sessionStartedAtMs: number;
  maxMinutes: number;
  idx: number;
  /** Learner's words for this turn. null for the opening turn, which the learner did not speak. */
  learnerText: string | null;
  /** Used as the user message when there is no learner text (the opening turn). */
  openingInstruction: string;
  /** Language of the fallback apology when the model gives no valid event. */
  fallbackLanguage: FallbackLanguage;
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
  /** Set when the model reply was missing or not valid JSON. */
  parseError?: string;
  /** True when no valid model event was left, so the fallback events were used. */
  fallback: boolean;
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
    return { idx: input.idx, events, ended: true, endReason, dropped: 0, fallback: false, latencyMs: 0 };
  }

  const contents = buildContents(input.history, input.learnerText, input.openingInstruction);
  const response = await deps.generate({ systemInstruction: input.systemInstruction, contents });
  const latencyMs = Math.max(0, deps.now() - startedAt);

  let events: TutorEvent[] = [];
  let dropped = 0;
  let parseError: string | undefined;
  const rawText = response.text !== undefined && response.text.trim() !== "" ? response.text : undefined;
  if (rawText === undefined) {
    parseError = "empty model response";
  } else {
    const parsed = parseTutorTurn(rawText);
    if (parsed.ok) {
      events = parsed.events;
      dropped = parsed.dropped;
    } else {
      parseError = parsed.error;
    }
  }

  // No valid event at all: the learner still hears the teacher. The raw output is kept for debugging.
  let fallback = false;
  let rawOutput: string | undefined;
  if (events.length === 0) {
    fallback = true;
    events = fallbackTurnEvents(input.fallbackLanguage);
    rawOutput = rawText;
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
  await deps.saveTurn({ idx: input.idx, learnerText: input.learnerText, events, latencyMs, rawOutput });

  return {
    idx: input.idx,
    events,
    ended: modelEnded,
    endReason: modelEnded ? "model_end" : undefined,
    dropped,
    parseError,
    fallback,
    latencyMs,
  };
}

export type FallbackLanguage = "zh" | "es" | "fr" | "en";

const FALLBACK_LINES: Record<FallbackLanguage, { text: string; translation?: string }> = {
  zh: { text: "不好意思，请再说一遍。", translation: "Sorry, could you say that again?" },
  es: { text: "Perdona, ¿puedes repetirlo?", translation: "Sorry, can you repeat that?" },
  fr: { text: "Pardon, vous pouvez répéter ?", translation: "Sorry, could you repeat that?" },
  en: { text: "Sorry, could you say that again?" },
};

/** Events used when the model gave no valid event: one spoken apology in the target language, and a thinking gesture. */
export function fallbackTurnEvents(language: FallbackLanguage): TutorEvent[] {
  const line = FALLBACK_LINES[language];
  return [
    line.translation === undefined
      ? { type: "say", text: line.text }
      : { type: "say", text: line.text, translation: line.translation },
    { type: "gesture", name: "think" },
  ];
}

/** Maps a session's language pack (or persona language) to a fallback language. Unknown languages use English. */
export function fallbackLanguageFor(language: string | null | undefined): FallbackLanguage {
  return language === "zh" || language === "es" || language === "fr" ? language : "en";
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

/** Type of the debug entry that storage appends when the model output was unusable. Never sent back to the model. */
export const DEBUG_RAW_OUTPUT_TYPE = "debug_raw_output";

/**
 * Stored events without audio URLs or debug entries, so history stays small and the model only sees
 * what the teacher said. Non-array values become an empty list.
 */
export function eventsForHistory(events: unknown): unknown[] {
  if (!Array.isArray(events)) return [];
  return events
    .filter((e) => !(typeof e === "object" && e !== null && (e as { type?: unknown }).type === DEBUG_RAW_OUTPUT_TYPE))
    .map((e) => {
    if (typeof e === "object" && e !== null && "audioUrl" in e) {
      const copy: Record<string, unknown> = { ...(e as Record<string, unknown>) };
      delete copy.audioUrl;
      return copy;
    }
    return e;
  });
}
