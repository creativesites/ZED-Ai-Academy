import "server-only";
import { createServiceClient } from "@/lib/supabase/server";
import { modelFor } from "@/lib/ai/models";
import type { Database, Json } from "@/types/database";
import { nextStreak, utcDateString } from "../progress.ts";
import {
  buildTranscript,
  collectNoteMistakes,
  hasLearnerSpeech,
  MAX_REPORT_MISTAKES,
  parseTutorReport,
  toneStats,
  type LearnerMistake,
  type TutorReportContent,
} from "../report-model.ts";
import { generateReportJson } from "./gemini-calls.ts";
import { loadSessionContext, parseMemory, type TutorSessionRow } from "./session-context.ts";
import { recordUsage } from "./usage.ts";

// Finalizes a tutor session: stores the session's speaking time and status, generates the report,
// and applies learner-level side effects (profile streak and speaking time, mistake vocabulary).
//
// Idempotency: tutor_reports.session_id is the primary key. The side effects run only for the
// request whose report insert wins. A repeat call returns the stored report and changes nothing.

type Tables = Database["public"]["Tables"];
export type TutorReportRow = Tables["tutor_reports"]["Row"];

export const RECENT_MISTAKES_KEPT = 10;

export type FinalizeInput = {
  session: TutorSessionRow;
  learnerSpeakingMs: number;
  teacherSpeakingMs: number;
  status: "completed" | "abandoned";
};

export type FinalizeResult = { report: TutorReportRow; created: boolean };

export async function finalizeTutorSession(input: FinalizeInput): Promise<FinalizeResult> {
  const supabase = createServiceClient();
  const { session } = input;

  const existing = await getReport(session.id);
  if (existing) return { report: existing, created: false };

  // 1. Session row: status, speaking time and end time. A flagged or already completed session keeps its status.
  const nextStatus =
    session.status === "flagged" || session.status === "completed" ? session.status : input.status;
  const { error: updateError } = await supabase
    .from("tutor_sessions")
    .update({
      status: nextStatus,
      learner_speaking_ms: Math.max(0, Math.round(input.learnerSpeakingMs)),
      teacher_speaking_ms: Math.max(0, Math.round(input.teacherSpeakingMs)),
      ended_at: session.ended_at ?? new Date().toISOString(),
    })
    .eq("id", session.id);
  if (updateError) throw new Error(`could not update session: ${updateError.message}`);

  // 2. Context and transcript.
  const ctx = await loadSessionContext({ ...session, status: nextStatus });
  const turns = ctx.history;
  const noteMistakes = collectNoteMistakes(turns);
  const language = ctx.skillLanguage;

  // 3. Report content. Sessions with no learner speech skip the model call.
  let content: TutorReportContent;
  if (hasLearnerSpeech(turns)) {
    const generated = await generateReportJson({
      transcript: buildTranscript(turns),
      scenarioTitle: ctx.scenario.title,
      scenarioGoal: ctx.scenario.goal,
      language,
    });
    await recordUsage({
      companyId: session.company_id,
      userId: session.user_id,
      sessionId: session.id,
      model: generated.model,
      kind: "llm",
      units: generated.totalTokens ?? 0,
      unit: "tokens",
    });
    const parsed = parseTutorReport(generated.text);
    if (!parsed.ok) throw new Error(`report model output unusable: ${parsed.error}`);
    content = parsed.report;
  } else {
    content = {
      scores: {},
      strengths: [],
      mistakes: [],
      nextStep: "Try a full session next time and reply to the teacher a few times, so there is something to review.",
    };
  }

  const mistakes = mergeMistakes(noteMistakes, content.mistakes);
  const tone = toneStats(language, mistakes);

  // 4. Claim the report. Only the winning insert applies side effects.
  const { data: inserted, error: insertError } = await supabase
    .from("tutor_reports")
    .insert({
      session_id: session.id,
      scores: content.scores as Json,
      strengths: content.strengths as Json,
      mistakes: mistakes as unknown as Json,
      tone_stats: tone as Json,
      next_scenario_id: null,
    })
    .select("*")
    .single();

  if (insertError) {
    if (insertError.code === "23505") {
      const winner = await getReport(session.id);
      if (winner) return { report: winner, created: false };
    }
    throw new Error(`could not store report: ${insertError.message}`);
  }

  // 5. Side effects for the winner.
  if (session.mode === "live") {
    await recordUsage({
      companyId: session.company_id,
      userId: session.user_id,
      sessionId: session.id,
      model: modelFor("tutorLive"),
      kind: "live_audio_in",
      units: Math.ceil(input.learnerSpeakingMs / 1000),
      unit: "seconds",
    });
    await recordUsage({
      companyId: session.company_id,
      userId: session.user_id,
      sessionId: session.id,
      model: modelFor("tutorLive"),
      kind: "live_audio_out",
      units: Math.ceil(input.teacherSpeakingMs / 1000),
      unit: "seconds",
    });
  }

  await updateLearnerProfile({
    companyId: session.company_id,
    userId: session.user_id,
    language: ctx.profileLanguage,
    speakingMs: Math.max(0, input.learnerSpeakingMs) + Math.max(0, input.teacherSpeakingMs),
    mistakes,
  });

  await addMistakeVocabulary({
    companyId: session.company_id,
    userId: session.user_id,
    language: ctx.profileLanguage,
    mistakes,
  });

  return { report: inserted as TutorReportRow, created: true };
}

async function getReport(sessionId: string): Promise<TutorReportRow | null> {
  const { data } = await createServiceClient()
    .from("tutor_reports")
    .select("*")
    .eq("session_id", sessionId)
    .maybeSingle();
  return data ?? null;
}

/** Note-taken mistakes first, then the model's extra mistakes whose correct form is new. Capped. */
export function mergeMistakes(noted: LearnerMistake[], fromModel: LearnerMistake[]): LearnerMistake[] {
  const out: LearnerMistake[] = [];
  const seen = new Set<string>();
  for (const m of [...noted, ...fromModel]) {
    const key = `${m.said}\u0000${m.correct}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ said: m.said, correct: m.correct, category: m.category });
    if (out.length >= MAX_REPORT_MISTAKES) break;
  }
  return out;
}

async function updateLearnerProfile(input: {
  companyId: string;
  userId: string;
  language: string;
  speakingMs: number;
  mistakes: LearnerMistake[];
}) {
  const supabase = createServiceClient();
  const { data: existing } = await supabase
    .from("learner_language_profiles")
    .select("*")
    .eq("company_id", input.companyId)
    .eq("user_id", input.userId)
    .eq("language", input.language)
    .maybeSingle();

  const streak = nextStreak({
    lastPracticeDate: existing?.last_practice_date ?? null,
    streakDays: existing?.streak_days ?? 0,
    today: utcDateString(new Date()),
  });

  const previous = parseMemory(existing?.memory);
  const recent = [...input.mistakes, ...previous.recentMistakes]
    .filter((m, i, all) => all.findIndex((x) => x.said === m.said && x.correct === m.correct) === i)
    .slice(0, RECENT_MISTAKES_KEPT);

  const { error } = await supabase.from("learner_language_profiles").upsert(
    {
      company_id: input.companyId,
      user_id: input.userId,
      language: input.language,
      level_estimate: existing?.level_estimate ?? null,
      framework: existing?.framework ?? null,
      can_do: existing?.can_do ?? [],
      memory: { recentMistakes: recent, notes: previous.notes } as Json,
      streak_days: streak.streakDays,
      last_practice_date: streak.lastPracticeDate,
      total_speaking_ms: (existing?.total_speaking_ms ?? 0) + input.speakingMs,
    },
    { onConflict: "company_id,user_id,language" },
  );
  if (error) throw new Error(`could not update learner profile: ${error.message}`);
}

async function addMistakeVocabulary(input: {
  companyId: string;
  userId: string;
  language: string;
  mistakes: LearnerMistake[];
}) {
  const supabase = createServiceClient();
  for (const mistake of input.mistakes) {
    const { data: found } = await supabase
      .from("vocab_items")
      .select("id")
      .eq("company_id", input.companyId)
      .eq("language", input.language)
      .eq("term", mistake.correct)
      .limit(1);

    let vocabId = found?.[0]?.id;
    if (!vocabId) {
      const { data: created, error: createError } = await supabase
        .from("vocab_items")
        .insert({
          company_id: input.companyId,
          language: input.language,
          term: mistake.correct,
          tags: ["mistake", mistake.category],
        })
        .select("id")
        .single();
      if (createError) throw new Error(`could not create vocab item: ${createError.message}`);
      vocabId = created.id;
    }

    // ignoreDuplicates keeps the spaced-repetition state of an item the learner already has.
    const { error } = await supabase.from("learner_vocab").upsert(
      { user_id: input.userId, vocab_id: vocabId, company_id: input.companyId, source: "mistake" },
      { onConflict: "user_id,vocab_id", ignoreDuplicates: true },
    );
    if (error) throw new Error(`could not add learner vocab: ${error.message}`);
  }
}
