import "server-only";
import { createServiceClient } from "@/lib/supabase/server";
import type { Json } from "@/types/database";
import { modelFor } from "@/lib/ai/models";
import { buildSystemPrompt, type TutorPromptMode } from "./prompt.ts";
import { generateTurnJson, streamTurnJson, synthesizeCachedSpeech } from "./gemini-calls.ts";
import { getOrCreatePromptCache } from "./prompt-cache.ts";
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
import { CONTRACT_VERSION, type TutorEvent } from "../contract/index.ts";
import { isSchemaUnavailableError } from "../mastery/server";
import {
  DEBUG_RAW_OUTPUT_TYPE,
  fallbackLanguageFor,
  runTutorTurn,
  type TurnGenerateRequest,
  type TurnPipelineDeps,
  type TurnPipelineInput,
  type TurnPipelineResult,
} from "./turn-pipeline.ts";
import { runTutorTurnStream, type TurnStreamChunk, type TurnStreamResult } from "../runtime/turn-stream.ts";

// Wires the real Gemini, TTS, storage, metering and database dependencies into the turn pipeline.
// Used by the session start route (opening turn) and the turn route (non-stream and ?stream=1).

export class TurnConflictError extends Error {
  constructor(idx: number) {
    super(`turn ${idx} already exists for this session`);
    this.name = "TurnConflictError";
  }
}

export function sessionSystemPrompt(ctx: SessionContext, mode: TutorPromptMode): string {
  return buildSystemPrompt({
    // objectives: registered objectives (P2-01). roleNotes: the origin's role (the lesson `ask` dock, P1-06).
    scenario: {
      ...toPromptScenario(ctx.scenario),
      objectives: ctx.objectives,
      ...(ctx.roleNotes ? { roleNotes: ctx.roleNotes } : {}),
    },
    persona: toPromptPersona(ctx.persona),
    skillPack: ctx.scenario.skill_pack,
    learnerProfile: ctx.learnerProfile,
    lessonText: ctx.lessonText,
    mode,
  });
}

export type SessionTurnInput = {
  ctx: SessionContext;
  idx: number;
  learnerText: string | null;
  learnerAudio?: { bytes: Buffer; mimeType: string };
  learnerImage?: { bytes: Buffer; mimeType: string };
  openingInstruction: string;
  /** When true, skips blocking server TTS so captions/board/choices return immediately (~1s) while the client fetches cached audio progressively via /api/tutor/tts. */
  deferTts?: boolean;
};

/**
 * The real side effects of a session turn. Shared by the non-stream and the streaming turn, so both store and meter
 * a turn identically.
 */
function sessionTurnDeps(input: SessionTurnInput): TurnPipelineDeps {
  const { ctx } = input;
  const session = ctx.session;
  const supabase = createServiceClient();

  return {
    now: () => Date.now(),
    generate: async (req) => {
      const cachedContent = await getOrCreatePromptCache(modelFor("tutorTurn"), req.systemInstruction);
      const result = await generateTurnJson({ ...req, cachedContent });
      // Fire-and-forget usage metering so it never adds latency to the learner's turn.
      meterTurnTokens(session, result.model, result.totalTokens);
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
      let { error } = await supabase.from("tutor_turns").insert({ ...row, contract_version: CONTRACT_VERSION });
      // Before the contract_version migration is applied, store the turn without it.
      if (error && isSchemaUnavailableError(error)) ({ error } = await supabase.from("tutor_turns").insert(row));
      if (error) {
        if (error.code === "23505") throw new TurnConflictError(turn.idx);
        throw new Error(`could not store turn: ${error.message}`);
      }
    },
  };
}

function meterTurnTokens(session: TutorSessionRow, model: string, totalTokens: number | undefined): void {
  void recordUsage({
    companyId: session.company_id,
    userId: session.user_id,
    sessionId: session.id,
    model,
    kind: "llm",
    units: totalTokens ?? 0,
    unit: "tokens",
  }).catch((err) => console.warn("[tutor] usage log failed:", err));
}

function pipelineInput(input: SessionTurnInput): TurnPipelineInput {
  const { ctx } = input;
  const mode = ctx.session.mode === "text" ? "text" : "voice";
  return {
    sessionStartedAtMs: Date.parse(ctx.session.started_at),
    maxMinutes: ctx.scenario.max_minutes,
    idx: input.idx,
    learnerText: input.learnerText,
    learnerAudio: input.learnerAudio,
    learnerImage: input.learnerImage,
    openingInstruction: input.openingInstruction,
    systemInstruction: sessionSystemPrompt(ctx, mode),
    voice: personaVoiceName(ctx.persona),
    history: ctx.history,
    fallbackLanguage: fallbackLanguageFor(ctx.skillLanguage ?? ctx.profileLanguage),
  };
}

/**
 * Runs one Voice or Text turn for a session. Stores the turn, synthesizes `say` lines, and ends the
 * session in the database when the pipeline reports that it has ended.
 */
export async function runSessionTurn(input: SessionTurnInput): Promise<TurnPipelineResult> {
  const result = await runTutorTurn(pipelineInput(input), sessionTurnDeps(input));
  if (result.ended) await endSession(input.ctx.session);
  return result;
}

/**
 * The streaming twin of `runSessionTurn` (P1-05): same prompt, storage, TTS and metering; each event is handed to
 * `onEvent` as soon as the model has written it. Usage is metered once the stream ends (or breaks).
 */
export async function runSessionTurnStream(
  input: SessionTurnInput & { onEvent: (event: TutorEvent) => void },
): Promise<TurnStreamResult> {
  const session = input.ctx.session;
  const deps = {
    ...sessionTurnDeps(input),
    generateStream: async (req: TurnGenerateRequest) => {
      const cachedContent = await getOrCreatePromptCache(modelFor("tutorTurn"), req.systemInstruction);
      const opened = await streamTurnJson({ ...req, cachedContent });
      return meteredTextStream(opened.stream, (totalTokens) => meterTurnTokens(session, opened.model, totalTokens));
    },
  };
  const result = await runTutorTurnStream(pipelineInput(input), deps, input.onEvent);
  if (result.ended) await endSession(session);
  return result;
}

/** Yields each chunk's text and meters the last usage seen once the stream ends, breaks or is abandoned. */
async function* meteredTextStream(
  stream: AsyncIterable<{ text: string; usage?: { totalTokens?: number } }>,
  report: (totalTokens: number | undefined) => void,
): AsyncGenerator<TurnStreamChunk> {
  let totalTokens: number | undefined;
  try {
    for await (const chunk of stream) {
      if (chunk.usage?.totalTokens !== undefined) totalTokens = chunk.usage.totalTokens;
      yield { text: chunk.text };
    }
  } finally {
    report(totalTokens);
  }
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
