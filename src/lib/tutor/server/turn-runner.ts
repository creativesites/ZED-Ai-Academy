import "server-only";
import { createServiceClient } from "@/lib/supabase/server";
import type { Json } from "@/types/database";
import { buildSystemPrompt, type TutorPromptMode } from "./prompt.ts";
import { generateTurnJson, synthesizeCachedSpeech } from "./gemini-calls.ts";
import { applyPronunciationGlossary } from "../pronunciation.ts";
import {
  personaPronunciationGlossary,
  personaVoiceName,
  toPromptPersona,
  toPromptScenario,
  type SessionContext,
  type TutorSessionRow,
} from "./session-context.ts";
import { recordUsage } from "./usage.ts";
import { CONTRACT_VERSION } from "../contract/index.ts";
import { isSchemaUnavailableError } from "../mastery/server";
import type { InteractionInput } from "../runtime/interactions.ts";
import { holdChecks } from "../runtime/server.ts";
import { prepareRuntimeTurn } from "../runtime/turn-server.ts";
import {
  DEBUG_RAW_OUTPUT_TYPE,
  fallbackLanguageFor,
  runTutorTurn,
  type TurnPipelineDeps,
  type TurnPipelineResult,
} from "./turn-pipeline.ts";

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
    scenario: { ...toPromptScenario(ctx.scenario), objectives: ctx.objectives },
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
  learnerAudio?: { bytes: Buffer; mimeType: string };
  learnerImage?: { bytes: Buffer; mimeType: string };
  openingInstruction: string;
  /** When true, skips blocking server TTS so captions/board/choices return immediately (~1s) while the client fetches cached audio progressively via /api/tutor/tts. */
  deferTts?: boolean;
  /** P2-04: the learner's answer to a held check ({ id, value }). Graded server-side. */
  interaction?: InteractionInput | null;
}): Promise<TurnPipelineResult> {
  const { ctx } = input;
  const session = ctx.session;
  const mode = session.mode === "text" ? "text" : "voice";
  const supabase = createServiceClient();
  // [Stream F runtime] grading, session state + teaching policy, context window, shared cache (P2-04/05/06).
  const runtime = await prepareRuntimeTurn({ ctx, mode, learnerText: input.learnerText, interaction: input.interaction });

  const deps: TurnPipelineDeps = {
    now: () => Date.now(),
    generate: async (req) => {
      const cachedContent = await runtime.cachedContent();
      const result = await generateTurnJson({ ...req, cachedContent });
      // Fire-and-forget usage metering so it never adds latency to the learner's turn.
      void recordUsage({
        companyId: session.company_id,
        userId: session.user_id,
        sessionId: session.id,
        model: result.model,
        kind: "llm",
        units: result.totalTokens ?? 0,
        unit: "tokens",
      }).catch((err) => console.warn("[tutor] usage log failed:", err));
      return result;
    },
    synthesize: async (text, voice) => {
      if (input.deferTts) return null;
      const glossary = personaPronunciationGlossary(ctx.persona);
      const spokenText = applyPronunciationGlossary(text, glossary);
      const speech = await synthesizeCachedSpeech(spokenText, voice);
      if (!speech.cached) {
        void recordUsage({
          companyId: session.company_id,
          userId: session.user_id,
          sessionId: session.id,
          model: speech.model,
          kind: "tts",
          units: speech.totalTokens ?? text.length,
          unit: speech.totalTokens ? "tokens" : "characters",
        }).catch((err) => console.warn("[tutor] tts usage log failed:", err));
      }
      return speech.url;
    },
    saveTurn: async (turn) => {
      // The events jsonb holds the teacher events. When the model output was unusable, the raw text
      // is appended as a debug entry that the contract does not define; clients must ignore it.
      const stored: unknown[] = turn.rawOutput
        ? [...turn.events, { type: DEBUG_RAW_OUTPUT_TYPE, raw: turn.rawOutput }]
        : turn.events;
      const row = {
        session_id: session.id,
        idx: turn.idx,
        learner_text: turn.learnerText,
        events: stored as unknown as Json,
        latency_ms: turn.latencyMs,
      };
      // P2-04/05/06 telemetry columns (migration 20261125000400); before it is applied, fall back step by step.
      const telemetry = {
        policy_move: runtime.policyMove,
        input_tokens: turn.usage?.inputTokens ?? null,
        output_tokens: turn.usage?.outputTokens ?? null,
        cached_tokens: turn.usage?.cachedTokens ?? null,
        ungraded_checks: turn.ungradedChecks ?? 0,
      };
      const turns = supabase.from("tutor_turns") as unknown as {
        insert: (r: Record<string, unknown>) => PromiseLike<{ error: { code?: string; message: string } | null }>;
      };
      let { error } = await turns.insert({ ...row, contract_version: CONTRACT_VERSION, ...telemetry });
      if (error && isSchemaUnavailableError(error)) {
        ({ error } = await supabase.from("tutor_turns").insert({ ...row, contract_version: CONTRACT_VERSION }));
      }
      // Before the contract_version migration is applied, store the turn without it.
      if (error && isSchemaUnavailableError(error)) ({ error } = await supabase.from("tutor_turns").insert(row));
      if (error) {
        if (error.code === "23505") throw new TurnConflictError(turn.idx);
        throw new Error(`could not store turn: ${error.message}`);
      }
      // Answer keys are held server-side, never in the turn row. Not held ⇒ the reply is judged by the teacher.
      if (turn.checks?.length) await holdChecks(session.id, turn.checks);
    },
  };

  const result = await runTutorTurn(
    {
      sessionStartedAtMs: Date.parse(session.started_at),
      maxMinutes: ctx.scenario.max_minutes,
      idx: input.idx,
      learnerText: runtime.learnerText,
      learnerAudio: input.learnerAudio,
      learnerImage: input.learnerImage,
      openingInstruction: input.openingInstruction,
      systemInstruction: runtime.systemInstruction,
      voice: personaVoiceName(ctx.persona),
      history: runtime.history,
      context: runtime.context,
      fallbackLanguage: fallbackLanguageFor(ctx.skillLanguage ?? ctx.profileLanguage),
    },
    deps,
  );

  await runtime.finish(result);
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
