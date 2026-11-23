import "server-only";
import { createServiceClient } from "@/lib/supabase/server";
import { modelFor } from "@/lib/ai/models";
import type { Database, Json } from "@/types/database";
import { finalizeSessionCore, type FinalizeCoreDeps, type ReportPayload, type ProfileState } from "../finalize.ts";
import { summarizeSessionObjectives, type CollectedEvidence } from "../mastery/evidence.ts";
import { isSchemaUnavailableError, persistSessionMastery } from "../mastery/server.ts";
import {
  normalizeStoredReportContent,
  type LearnerMistake,
  type ReportObjectiveOutcome,
  type TutorReportContent,
} from "../report-model.ts";
import { generateReportJson } from "./gemini-calls.ts";
import { loadSessionContext, type TutorSessionRow } from "./session-context.ts";
import { recordUsage } from "./usage.ts";
import { utcDateString } from "../progress.ts";

// Database and model wiring for finalizeSessionCore. The sequencing and the idempotency rules
// live in ../finalize.ts, where they are tested. This file only connects them to Supabase and Gemini.

type Tables = Database["public"]["Tables"];
export type TutorReportRow = Tables["tutor_reports"]["Row"];
export type FinalizedReportPayload = TutorReportContent & {
  id?: string;
  session_id?: string;
};

export type FinalizeInput = {
  session: TutorSessionRow;
  learnerSpeakingMs: number;
  teacherSpeakingMs: number;
  status: "completed" | "abandoned";
};

export type FinalizeResult = { report: FinalizedReportPayload; created: boolean };

export async function finalizeTutorSession(input: FinalizeInput): Promise<FinalizeResult> {
  const supabase = createServiceClient();
  const { session } = input;
  const ctx = await loadSessionContext(session);
  const sessionId = session.id;
  let lastPayloadFallback: { nextStep: string; objectives: ReportObjectiveOutcome[] } | undefined;
  let refinedObjectives: ReportObjectiveOutcome[] | undefined;

  const deps: FinalizeCoreDeps<FinalizedReportPayload> = {
    getReport: async () => {
      const { data } = await supabase.from("tutor_reports").select("*").eq("session_id", sessionId).maybeSingle();
      if (!data) return null;
      return {
        ...normalizeStoredReportContent(data as unknown as Record<string, unknown>),
        session_id: data.session_id,
      };
    },

    updateSession: async (update) => {
      const { error } = await supabase
        .from("tutor_sessions")
        .update({
          status: update.status,
          learner_speaking_ms: update.learnerSpeakingMs,
          teacher_speaking_ms: update.teacherSpeakingMs,
          ended_at: session.ended_at ?? new Date().toISOString(),
        })
        .eq("id", sessionId);
      if (error) throw new Error(`could not update session: ${error.message}`);
    },

    generateReport: async (req) => {
      const generated = await generateReportJson(req);
      return { text: generated.text, model: generated.model, totalTokens: generated.totalTokens };
    },

    claimReport: async (payload: ReportPayload) => {
      lastPayloadFallback = {
        nextStep: payload.next_step,
        objectives: payload.objectives,
      };

      const baseInsert = {
        session_id: sessionId,
        scores: payload.scores as Json,
        strengths: payload.strengths as Json,
        mistakes: payload.mistakes as unknown as Json,
        tone_stats: payload.tone_stats as Json,
        next_scenario_id: null,
      };

      let insertRes = await supabase
        .from("tutor_reports")
        .insert({
          ...baseInsert,
          objectives: payload.objectives as unknown as Json,
          next_step: payload.next_step,
        } as typeof baseInsert)
        .select("*")
        .single();

      // Pre-migration compatibility: retry without new columns if 20261123000000 isn't applied yet.
      if (insertRes.error && isSchemaUnavailableError(insertRes.error)) {
        insertRes = await supabase.from("tutor_reports").insert(baseInsert).select("*").single();
      }

      if (!insertRes.error && insertRes.data) {
        return {
          created: true,
          report: {
            ...normalizeStoredReportContent(
              insertRes.data as unknown as Record<string, unknown>,
              lastPayloadFallback,
            ),
            session_id: insertRes.data.session_id,
          },
        };
      }
      if (insertRes.error?.code === "23505") {
        // Another request stored the report first. Return that one.
        const { data: winner } = await supabase
          .from("tutor_reports")
          .select("*")
          .eq("session_id", sessionId)
          .single();
        if (winner) {
          return {
            created: false,
            report: {
              ...normalizeStoredReportContent(
                winner as unknown as Record<string, unknown>,
                lastPayloadFallback,
              ),
              session_id: winner.session_id,
            },
          };
        }
      }
      throw new Error(`could not store report: ${insertRes.error?.message ?? "unknown error"}`);
    },

    recordUsage: async (usage) => {
      await recordUsage({
        companyId: session.company_id,
        userId: session.user_id,
        sessionId,
        model: usage.model,
        kind: usage.kind,
        units: usage.units,
        unit: usage.unit,
      });
    },

    loadProfile: async (): Promise<ProfileState> => {
      const { data } = await supabase
        .from("learner_language_profiles")
        .select("level_estimate, framework, can_do, memory, streak_days, last_practice_date, total_speaking_ms")
        .eq("company_id", session.company_id)
        .eq("user_id", session.user_id)
        .eq("language", ctx.profileLanguage)
        .maybeSingle();
      return data ?? null;
    },

    saveProfile: async (row) => {
      const { error } = await supabase.from("learner_language_profiles").upsert(
        {
          company_id: session.company_id,
          user_id: session.user_id,
          language: ctx.profileLanguage,
          level_estimate: row.level_estimate,
          framework: row.framework,
          can_do: row.can_do as Json,
          memory: row.memory as unknown as Json,
          streak_days: row.streak_days,
          last_practice_date: row.last_practice_date,
          total_speaking_ms: row.total_speaking_ms,
        },
        { onConflict: "company_id,user_id,language" },
      );
      if (error) throw new Error(`could not update learner profile: ${error.message}`);
    },

    addMistakeVocabulary: async (mistakes: LearnerMistake[]) => {
      await addMistakeVocabulary(session.company_id, session.user_id, ctx.profileLanguage, mistakes);
    },

    persistMastery: async (evidence: CollectedEvidence[]) => {
      const updated = await persistSessionMastery({
        supabase,
        companyId: session.company_id,
        userId: session.user_id,
        courseId: ctx.courseId,
        scenarioId: session.scenario_id,
        sessionId,
        evidence,
      });
      refinedObjectives = summarizeSessionObjectives(evidence, updated);
      return updated;
    },
  };

  const result = await finalizeSessionCore(
    {
      mode: session.mode,
      currentStatus: session.status,
      requestedStatus: input.status,
      learnerSpeakingMs: input.learnerSpeakingMs,
      teacherSpeakingMs: input.teacherSpeakingMs,
      turns: ctx.history,
      scenarioTitle: ctx.scenario.title,
      scenarioGoal: ctx.scenario.goal,
      courseId: ctx.courseId,
      scenarioId: session.scenario_id,
      skillLanguage: ctx.skillLanguage,
      profileLanguage: ctx.profileLanguage,
      liveModel: modelFor("tutorLive"),
      today: utcDateString(new Date()),
    },
    deps,
  );

  if (result.created && refinedObjectives && refinedObjectives.length > 0) {
    result.report = { ...result.report, objectives: refinedObjectives };
  }

  return result;
}

async function addMistakeVocabulary(
  companyId: string,
  userId: string,
  language: string,
  mistakes: LearnerMistake[],
): Promise<void> {
  const supabase = createServiceClient();
  for (const mistake of mistakes) {
    const { data: found } = await supabase
      .from("vocab_items")
      .select("id")
      .eq("company_id", companyId)
      .eq("language", language)
      .eq("term", mistake.correct)
      .limit(1);

    let vocabId = found?.[0]?.id;
    if (!vocabId) {
      const { data: created, error: createError } = await supabase
        .from("vocab_items")
        .insert({ company_id: companyId, language, term: mistake.correct, tags: ["mistake", mistake.category] })
        .select("id")
        .single();
      if (createError) throw new Error(`could not create vocab item: ${createError.message}`);
      vocabId = created.id;
    }

    // ignoreDuplicates keeps the spaced-repetition state of an item the learner already has.
    const { error } = await supabase.from("learner_vocab").upsert(
      { user_id: userId, vocab_id: vocabId, company_id: companyId, source: "mistake" },
      { onConflict: "user_id,vocab_id", ignoreDuplicates: true },
    );
    if (error) throw new Error(`could not add learner vocab: ${error.message}`);
  }
}
