import "server-only";
import { createServiceClient } from "@/lib/supabase/server";
import type { Json } from "@/types/database";
import { buildSystemPrompt, type TutorPromptMode } from "./prompt.ts";
import { generateTurnJson, synthesizeCachedSpeech } from "./gemini-calls.ts";
import { personaVoiceName, toPromptPersona, toPromptScenario, type SessionContext, type TutorSessionRow } from "./session-context.ts";
import { recordUsage } from "./usage.ts";
import { runTutorTurn, type TurnPipelineResult, type TurnPipelineDeps } from "./turn-pipeline.ts";

// Wires the real Gemini, TTS, storage, metering and database dependencies into the turn pipeline.
// Used by the session start route (opening turn) and the turn route.

export class TurnConflictError extends Error {
  constructor(idx: number) {
    super(`turn ${idx} already exists for this session`);
    this.name = "TurnConflictError";
  }
}

export function sessionSystemPrompt(ctx: SessionContext, mode: TutorPromptMode): string {
  return buildSystemPrompt({
    scenario: toPromptScenario(ctx.scenario),
    persona: toPromptPersona(ctx.persona),
    skillPack: ctx.scenario.skill_pack,
    learnerProfile: ctx.learnerProfile,
    lessonText: ctx.lessonText,
    mode,
  });
}

/**
 * Runs one Voice or Text turn for a session. Stores the turn, synthesizes `say` lines, and ends the
 * session in the database when the pipeline reports that it has ended.
 */
export async function runSessionTurn(input: {
  ctx: SessionContext;
  idx: number;
  learnerText: string | null;
  openingInstruction: string;
}): Promise<TurnPipelineResult> {
  const { ctx } = input;
  const session = ctx.session;
  const mode = session.mode === "text" ? "text" : "voice";
  const supabase = createServiceClient();

  const deps: TurnPipelineDeps = {
    now: () => Date.now(),
    generate: async (req) => {
      const result = await generateTurnJson(req);
      await recordUsage({
        companyId: session.company_id,
        userId: session.user_id,
        sessionId: session.id,
        model: result.model,
        kind: "llm",
        units: result.totalTokens ?? 0,
        unit: "tokens",
      });
      return result;
    },
    synthesize: async (text, voice) => {
      const speech = await synthesizeCachedSpeech(text, voice);
      if (!speech.cached) {
        await recordUsage({
          companyId: session.company_id,
          userId: session.user_id,
          sessionId: session.id,
          model: speech.model,
          kind: "tts",
          units: speech.totalTokens ?? text.length,
          unit: speech.totalTokens ? "tokens" : "characters",
        });
      }
      return speech.url;
    },
    saveTurn: async (turn) => {
      const { error } = await supabase.from("tutor_turns").insert({
        session_id: session.id,
        idx: turn.idx,
        learner_text: turn.learnerText,
        events: turn.events as unknown as Json,
        latency_ms: turn.latencyMs,
      });
      if (error) {
        if (error.code === "23505") throw new TurnConflictError(turn.idx);
        throw new Error(`could not store turn: ${error.message}`);
      }
    },
  };

  const result = await runTutorTurn(
    {
      sessionStartedAtMs: Date.parse(session.started_at),
      maxMinutes: ctx.scenario.max_minutes,
      idx: input.idx,
      learnerText: input.learnerText,
      openingInstruction: input.openingInstruction,
      systemInstruction: sessionSystemPrompt(ctx, mode),
      voice: personaVoiceName(ctx.persona),
      history: ctx.history,
    },
    deps,
  );

  if (result.ended) await endSession(session);
  return result;
}

/** Marks an active session completed. Leaves other statuses alone. */
export async function endSession(session: TutorSessionRow): Promise<void> {
  const supabase = createServiceClient();
  await supabase
    .from("tutor_sessions")
    .update({ status: "completed", ended_at: new Date().toISOString() })
    .eq("id", session.id)
    .eq("status", "active");
}
