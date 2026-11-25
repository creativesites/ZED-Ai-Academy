import { parseTutorTurn, type TutorEvent } from "../events.ts";
import {
  buildContents,
  fallbackTurnEvents,
  sessionLimitReason,
  type TurnGenerateRequest,
  type TurnPipelineDeps,
  type TurnPipelineInput,
  type TurnPipelineResult,
} from "../server/turn-pipeline.ts";
import { createTurnStreamParser } from "./stream-events.ts";

// `runTutorTurnStream` (P1-05, Architecture §3.2, D-04): the streaming twin of `runTutorTurn`. Same input, same
// side effects (one saved turn, `say` synthesis, fallback events), same result shape, plus each event handed to
// `onEvent` as soon as its JSON object closes. Kept in its own module, parallel to turn-pipeline.ts, so prompt and
// policy work there does not touch streaming. Pure: every side effect is injected.
//
// Fallbacks (D-04):
// - the stream cannot be opened, or fails before any event arrived → the non-stream `generate` for this turn;
// - the streamed JSON is incomplete or malformed → the non-stream parse of the full text (`parseTutorTurn`); when that
//   fails too, the events already streamed are kept (the learner has seen them), else the fallback apology.
// The final `events` (in the result and in the saved turn) are authoritative; clients replace what they streamed.

export type TurnStreamChunk = { text: string };

export type TurnStreamDeps = TurnPipelineDeps & {
  /** Opens a streamed structured-output model call. Throws when the stream cannot be opened. */
  generateStream: (req: TurnGenerateRequest) => Promise<AsyncIterable<TurnStreamChunk>>;
};

export type TurnStreamResult = TurnPipelineResult & {
  /** Events handed to onEvent while the model was still writing. */
  streamedCount: number;
  /** How the final events were obtained. */
  source: "stream" | "stream_reparsed" | "stream_partial" | "non_stream" | "limit";
  /** Set when the stream failed to open or broke mid-way. */
  streamError?: string;
};

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

export async function runTutorTurnStream(
  input: TurnPipelineInput,
  deps: TurnStreamDeps,
  onEvent: (event: TutorEvent) => void,
): Promise<TurnStreamResult> {
  const startedAt = deps.now();
  const emit = (event: TutorEvent) => {
    try {
      onEvent(event);
    } catch {
      // A broken consumer (closed connection) must not lose the turn.
    }
  };

  const endReason = sessionLimitReason({
    idx: input.idx,
    sessionStartedAtMs: input.sessionStartedAtMs,
    maxMinutes: input.maxMinutes,
    nowMs: startedAt,
  });
  if (endReason) {
    const summary = endReason === "time_box" ? "Time is up for this session." : "This session has reached its turn limit.";
    const events: TutorEvent[] = [{ type: "end_session", summary }];
    await deps.saveTurn({ idx: input.idx, learnerText: input.learnerText, events, latencyMs: 0 });
    emit(events[0]);
    return {
      idx: input.idx,
      events,
      ended: true,
      endReason,
      dropped: 0,
      fallback: false,
      latencyMs: 0,
      streamedCount: 1,
      source: "limit",
    };
  }

  const request: TurnGenerateRequest = {
    systemInstruction: input.systemInstruction,
    contents: buildContents(
      input.history,
      input.learnerText ?? (input.learnerAudio ? "[audio]" : input.learnerImage ? "[shared work image]" : null),
      input.openingInstruction,
    ),
    ...(input.learnerAudio ? { audio: input.learnerAudio } : {}),
    ...(input.learnerImage ? { image: input.learnerImage } : {}),
  };

  const parser = createTurnStreamParser();
  const streamed: TutorEvent[] = [];
  let rawText = "";
  let streamError: string | undefined;
  let usedNonStream = false;

  try {
    const stream = await deps.generateStream(request);
    for await (const chunk of stream) {
      const text = typeof chunk?.text === "string" ? chunk.text : "";
      if (!text) continue;
      rawText += text;
      for (const event of parser.push(text)) {
        streamed.push(event);
        emit(event);
      }
    }
  } catch (err) {
    streamError = errorMessage(err);
    if (streamed.length === 0) {
      // Nothing reached the learner yet: answer this turn without streaming (D-04).
      const response = await deps.generate(request);
      rawText = response.text ?? "";
      usedNonStream = true;
    }
  }
  const latencyMs = Math.max(0, deps.now() - startedAt);

  let events: TutorEvent[] = [];
  let dropped = 0;
  let parseError: string | undefined;
  let source: TurnStreamResult["source"];
  const parsedStream = parser.result();
  const hasText = rawText.trim() !== "";

  if (!usedNonStream && parsedStream.complete && !streamError) {
    events = parsedStream.events;
    dropped = parsedStream.dropped;
    source = "stream";
  } else {
    const parsed = hasText ? parseTutorTurn(rawText) : ({ ok: false, error: "empty model response" } as const);
    if (parsed.ok && parsed.events.length > 0) {
      events = parsed.events;
      dropped = parsed.dropped;
      source = usedNonStream ? "non_stream" : "stream_reparsed";
    } else {
      if (!parsed.ok) parseError = parsed.error;
      else dropped = parsed.dropped;
      if (!usedNonStream && streamed.length > 0) {
        events = [...streamed];
        dropped = parsedStream.dropped;
        source = "stream_partial";
      } else {
        source = usedNonStream ? "non_stream" : "stream_reparsed";
      }
    }
  }

  let resolvedLearnerText: string | null = input.learnerText;
  if (resolvedLearnerText === null && input.learnerAudio && hasText) {
    try {
      const obj = JSON.parse(rawText) as { learnerText?: unknown };
      if (typeof obj?.learnerText === "string" && obj.learnerText.trim()) {
        resolvedLearnerText = obj.learnerText.trim().slice(0, 1000);
      }
    } catch {
      // Same as runTutorTurn: no transcript when the JSON is unusable.
    }
  }

  let fallback = false;
  let rawOutput: string | undefined;
  if (events.length === 0) {
    fallback = true;
    events = fallbackTurnEvents(input.fallbackLanguage);
    rawOutput = hasText ? rawText : undefined;
  }

  events = await Promise.all(
    events.map(async (event): Promise<TutorEvent> => {
      if (event.type !== "say") return event;
      const audioUrl = await deps.synthesize(event.text, input.voice).catch(() => null);
      return audioUrl ? { ...event, audioUrl } : event;
    }),
  );

  const modelEnded = events.some((e) => e.type === "end_session");
  await deps.saveTurn({ idx: input.idx, learnerText: resolvedLearnerText, events, latencyMs, rawOutput });

  return {
    idx: input.idx,
    events,
    learnerText: resolvedLearnerText,
    ended: modelEnded,
    endReason: modelEnded ? "model_end" : undefined,
    dropped,
    parseError,
    fallback,
    latencyMs,
    streamedCount: streamed.length,
    source,
    ...(streamError ? { streamError } : {}),
  };
}
