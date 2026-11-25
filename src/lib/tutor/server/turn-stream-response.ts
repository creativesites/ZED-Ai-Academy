import "server-only";
import { after } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { CONTRACT_VERSION, toClientEvent, type TutorEvent } from "../contract/index.ts";
import type { InteractionInput } from "../runtime/interactions.ts";
import type { TurnPipelineResult } from "./turn-pipeline.ts";
import { collectNoteEvidence } from "../mastery/evidence.ts";
import { persistSessionMastery } from "../mastery/server.ts";
import { formatSse, sseComment, TURN_STREAM_EVENTS } from "../runtime/sse.ts";
import type { SessionContext } from "./session-context.ts";
import { runSessionTurnStream, TurnConflictError } from "./turn-runner.ts";

// SSE body of POST /api/tutor/sessions/:id/turn?stream=1 (P1-05). The route has already authorised the learner,
// loaded the session context and read the input exactly as for the non-stream turn; this streams the same turn:
// `event` messages as each event closes, then one `done` with the non-stream response body, or one `error`.
// Persistence and metering are the turn runner's, identical to the non-stream path.

const SSE_HEADERS = {
  "Content-Type": "text/event-stream; charset=utf-8",
  "Cache-Control": "no-cache, no-transform",
  Connection: "keep-alive",
  "X-Accel-Buffering": "no",
} as const;

/** The turn response body: the non-stream JSON body and the SSE `done` payload are this, byte for byte. */
export function turnResponseBody(idx: number, result: TurnPipelineResult, learnerText: string | null) {
  return {
    turnIdx: idx,
    contractVersion: CONTRACT_VERSION,
    learnerText: result.learnerText ?? learnerText,
    events: result.events.map((e) => toClientEvent(e)),
    ended: result.ended,
    endReason: result.endReason ?? null,
  };
}

export function turnStreamResponse(input: {
  ctx: SessionContext;
  idx: number;
  learnerText: string | null;
  learnerAudio?: { bytes: Buffer; mimeType: string };
  learnerImage?: { bytes: Buffer; mimeType: string };
  /** P2-04: the learner's answer to a held check, graded server-side exactly as on the non-stream path. */
  interaction?: InteractionInput | null;
}): Response {
  const encoder = new TextEncoder();
  let closed = false;

  // Work after the last message (recording Ask evidence) must not hold the response open, and must not be cut off
  // when it ends: `after` keeps the function alive until it settles (registered now, inside the request scope).
  let settleAfterWork: () => void = () => undefined;
  const afterWork = new Promise<void>((resolve) => {
    settleAfterWork = resolve;
  });
  after(() => afterWork);

  async function run(controller: ReadableStreamDefaultController<Uint8Array>): Promise<void> {
    const close = () => {
      if (closed) return;
      closed = true;
      try {
        controller.close();
      } catch {
        // already closed by the client
      }
    };
    const send = (text: string) => {
      if (closed) return;
      try {
        controller.enqueue(encoder.encode(text));
      } catch {
        closed = true; // the client went away; the turn still finishes and is stored
      }
    };

    send(sseComment("turn"));
    try {
      const result = await runSessionTurnStream({
        ctx: input.ctx,
        idx: input.idx,
        learnerText: input.learnerText,
        learnerAudio: input.learnerAudio,
        learnerImage: input.learnerImage,
        openingInstruction: "",
        deferTts: true,
        interaction: input.interaction ?? null,
        // The runner already stripped keys (createAnswerablePreparer); toClientEvent here is belt and braces.
        onEvent: (event) => send(formatSse(TURN_STREAM_EVENTS.event, toClientEvent(event))),
      });
      if (result.source !== "stream" && result.source !== "limit") {
        console.warn(`[tutor] streamed turn used ${result.source}${result.streamError ? `: ${result.streamError}` : ""}`);
      }
      // Same body as the non-stream response.
      send(formatSse(TURN_STREAM_EVENTS.done, turnResponseBody(input.idx, result, input.learnerText)));
      close();
      if (input.ctx.session.origin === "ask") await recordAskEvidence(input.ctx, result.events);
    } catch (err) {
      if (err instanceof TurnConflictError) {
        send(formatSse(TURN_STREAM_EVENTS.error, { error: "Another turn was saved at the same time. Try again.", status: 409 }));
      } else {
        console.error("[tutor] streamed turn failed:", err);
        send(formatSse(TURN_STREAM_EVENTS.error, { error: "The teacher could not respond. Try again.", status: 502 }));
      }
    } finally {
      close();
      settleAfterWork();
    }
  }

  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      // Not awaited: start() returns at once and the turn streams into the controller as it runs.
      void run(controller);
    },
    cancel() {
      closed = true;
    },
  });

  return new Response(body, { status: 200, headers: SSE_HEADERS });
}

/**
 * Ask sessions never "complete" into a report, so the teacher's checks are recorded per turn: `note_evidence` after
 * an `ask_choice` (the dock's knowledge checks, P1-06) is the teacher's judgement of the answer, recorded through the
 * existing mastery path until server grading lands (Stream F / P2-04). Only for learners actively enrolled in the
 * course, as the legacy dock check required. Best effort: never fails the turn.
 */
async function recordAskEvidence(ctx: SessionContext, events: readonly TutorEvent[]): Promise<void> {
  try {
    if (!ctx.courseId) return;
    const evidence = collectNoteEvidence([{ eventsJson: events }], { courseId: ctx.courseId });
    if (evidence.length === 0) return;
    const db = createServiceClient();
    const { data: enrollment } = await db
      .from("enrollments")
      .select("id")
      .eq("user_id", ctx.session.user_id)
      .eq("course_id", ctx.courseId)
      .eq("status", "active")
      .maybeSingle();
    if (!enrollment) return;
    await persistSessionMastery({
      supabase: db,
      companyId: ctx.session.company_id,
      userId: ctx.session.user_id,
      courseId: ctx.courseId,
      scenarioId: null,
      sessionId: ctx.session.id,
      evidence,
    });
  } catch (err) {
    console.warn("[tutor/ask] could not record evidence:", err);
  }
}
