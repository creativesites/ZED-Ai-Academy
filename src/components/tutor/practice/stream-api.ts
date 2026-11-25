// Browser helper for streamed turns (P1-05): POST /api/tutor/sessions/:id/turn?stream=1 and consume its Server-Sent
// Events. Each `event` message is handed to `onEvent` as it arrives; the `done` message resolves to the same
// TurnResponse as the non-stream call (its `events` are authoritative: replace what was streamed with them).
// Never throws, like the other calls in ./api.ts.

import type { TutorEvent } from "@/lib/tutor/events";
import { parseTutorErrorBody } from "@/lib/tutor/client-errors";
import { createSseParser, TURN_STREAM_EVENTS, type SseMessage } from "@/lib/tutor/runtime/sse";
import type { InteractionAnswer, Result, TurnResponse } from "./api";

export type StreamTurnOptions = {
  onEvent: (event: TutorEvent) => void;
  signal?: AbortSignal;
  /** P2-04: the answer to a server-held check, graded on the server. */
  interaction?: InteractionAnswer;
};

export async function streamTutorText(
  sessionId: string,
  text: string,
  opts: StreamTurnOptions,
): Promise<Result<TurnResponse>> {
  let res: Response;
  try {
    res = await fetch(`/api/tutor/sessions/${encodeURIComponent(sessionId)}/turn?stream=1`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "text/event-stream" },
      body: JSON.stringify(opts.interaction ? { text, interaction: opts.interaction } : { text }),
      credentials: "same-origin",
      signal: opts.signal,
    });
  } catch {
    return { ok: false, failure: { kind: "network" } };
  }

  // Errors before the stream starts (auth, ownership, inactive session) are plain JSON, as for the non-stream call.
  if (!res.ok || !res.body || !(res.headers.get("content-type") ?? "").includes("text/event-stream")) {
    let body: unknown = null;
    try {
      body = await res.json();
    } catch {
      body = null;
    }
    if (res.ok) return { ok: true, data: body as TurnResponse }; // a non-stream body (should not happen)
    return { ok: false, failure: { kind: "http", status: res.status, ...parseTutorErrorBody(body) } };
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  const parser = createSseParser();
  let outcome: Result<TurnResponse> | null = null;

  const handle = (messages: SseMessage[]) => {
    for (const message of messages) {
      let data: unknown;
      try {
        data = JSON.parse(message.data);
      } catch {
        continue;
      }
      if (message.event === TURN_STREAM_EVENTS.event) {
        if (data && typeof data === "object" && typeof (data as { type?: unknown }).type === "string") {
          try {
            opts.onEvent(data as TutorEvent);
          } catch {
            // a UI error must not drop the turn
          }
        }
      } else if (message.event === TURN_STREAM_EVENTS.done) {
        outcome = { ok: true, data: data as TurnResponse };
      } else if (message.event === TURN_STREAM_EVENTS.error) {
        const status = typeof (data as { status?: unknown })?.status === "number" ? (data as { status: number }).status : 502;
        outcome = { ok: false, failure: { kind: "http", status, ...parseTutorErrorBody(data) } };
      }
    }
  };

  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      handle(parser.push(decoder.decode(value, { stream: true })));
    }
    handle(parser.push(decoder.decode()));
    handle(parser.flush());
  } catch {
    // Connection dropped mid-stream. The server still stores the turn; the caller can reload the conversation.
  }

  return outcome ?? { ok: false, failure: { kind: "network" } };
}
