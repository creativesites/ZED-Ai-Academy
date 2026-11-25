import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { aiCall } from "@/lib/ai/call";
import { createServiceClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";
import { applyPracticeDay, currentStreakDays, seedHabitsFromLegacy, type HabitRowState } from "../habits.ts";
import { isSchemaUnavailableError, loadWeakMasteryRows } from "../mastery/server.ts";
import type { LearnerMistake } from "../report-model.ts";
import type { PromptLearnerProfile } from "../server/prompt.ts";
import {
  buildLearnerBrief,
  defaultExpiry,
  memoryFromRow,
  mistakeToMemoryContent,
  type LearnerBrief,
  type LearnerMemoryRecord,
} from "./memory.ts";
import {
  buildIndexedTranscript,
  MEMORY_SUMMARY_JSON_SCHEMA,
  MEMORY_SUMMARY_SYSTEM_PROMPT,
  parseMemoryCandidates,
  shouldSummarise,
  type SummaryTurn,
} from "./memory-summary.ts";

// Database and model glue for learner memory (P1-07). The rules live in memory.ts / memory-summary.ts /
// ../habits.ts, where they are tested. Every read/write of the new tables degrades to today's behaviour
// when the migration (20261125000300_learner_memory.sql) has not been applied yet.
//
// Server code runs with the service role: every query here is filtered by user_id AND company_id taken
// from the session / resource, never from the client.

type DbError = { code?: string; message?: string } | null;
type LooseResult<T = unknown> = { data: T | null; error: DbError };

// Minimal chainable surface of the Supabase query builder, for tables not yet in the generated types.
type LooseFilter<T = unknown> = PromiseLike<LooseResult<T>> & {
  eq: (col: string, val: unknown) => LooseFilter<T>;
  neq: (col: string, val: unknown) => LooseFilter<T>;
  in: (col: string, vals: unknown[]) => LooseFilter<T>;
  order: (col: string, opts?: { ascending?: boolean }) => LooseFilter<T>;
  limit: (n: number) => LooseFilter<T>;
  maybeSingle: () => PromiseLike<LooseResult<T>>;
};

export type LooseDb = {
  from: (table: string) => {
    select: (columns: string) => LooseFilter<unknown>;
    insert: (rows: unknown) => PromiseLike<{ error: DbError }>;
    upsert: (rows: unknown, opts?: { onConflict?: string }) => PromiseLike<{ error: DbError }>;
    update: (values: unknown) => LooseFilter<unknown>;
    delete: () => LooseFilter<unknown>;
  };
};

export function looseDb(client?: SupabaseClient<Database>): LooseDb {
  return (client ?? createServiceClient()) as unknown as LooseDb;
}

export const MEMORY_COLUMNS =
  "id, company_id, kind, content, source, source_ref, session_id, course_id, objective_key, confidence, visible_to_staff, status, expires_at, created_at";

/**
 * A learner's memories in one tenant. `available: false` when the table is not migrated yet.
 * `statuses` defaults to active only (the brief path).
 */
export async function loadLearnerMemories(input: {
  db?: LooseDb;
  userId: string;
  companyId: string;
  statuses?: Array<"active" | "hidden">;
  limit?: number;
}): Promise<{ available: boolean; memories: LearnerMemoryRecord[] }> {
  const db = input.db ?? looseDb();
  const res = (await db
    .from("learner_memories")
    .select(MEMORY_COLUMNS)
    .eq("user_id", input.userId)
    .eq("company_id", input.companyId)
    .in("status", input.statuses ?? ["active"])
    .order("created_at", { ascending: false })
    .limit(input.limit ?? 200)) as LooseResult<Record<string, unknown>[]>;
  if (res.error) {
    if (!isSchemaUnavailableError(res.error)) {
      console.warn("[tutor/memory] could not load learner memories:", res.error.message);
    }
    return { available: false, memories: [] };
  }
  return {
    available: true,
    memories: (res.data ?? []).flatMap((row) => {
      const m = memoryFromRow(row);
      return m ? [m] : [];
    }),
  };
}

/**
 * The learner brief for a session, or null when the memory schema is unavailable (caller keeps the
 * legacy memory). Reads the weakest 5 objective states via the mastery readers (read only).
 */
export async function loadLearnerBrief(input: {
  supabase?: SupabaseClient<Database>;
  userId: string;
  companyId: string;
  courseId: string | null;
  now?: Date;
}): Promise<LearnerBrief | null> {
  const db = looseDb(input.supabase);
  const [loaded, weak] = await Promise.all([
    loadLearnerMemories({ db, userId: input.userId, companyId: input.companyId }),
    loadWeakMasteryRows({
      supabase: input.supabase,
      userId: input.userId,
      companyId: input.companyId,
      courseId: input.courseId,
      limit: 5,
    }).catch(() => []),
  ]);
  if (!loaded.available) return null;
  return buildLearnerBrief({
    memories: loaded.memories,
    objectiveStates: weak.map((w) => ({
      objectiveKey: w.objectiveKey,
      objectiveText: w.objectiveText,
      level: w.level,
      lastResult: w.lastResult ?? null,
    })),
    courseId: input.courseId,
    flowObjectiveKeys: weak.map((w) => w.objectiveKey),
    now: input.now ?? new Date(),
  });
}

/**
 * [P1-07] Puts the learner brief into a session's prompt profile. When memory is available the brief
 * supersedes the legacy recentMistakes / memoryNotes (so a deleted or hidden memory can never reach the
 * model through the old path); the warm-up uses the brief's own note. Schema unavailable or any error
 * ⇒ the legacy profile unchanged (empty brief).
 */
export async function withLearnerBrief(
  legacy: PromptLearnerProfile,
  input: { supabase?: SupabaseClient<Database>; userId: string; companyId: string; courseId: string | null },
): Promise<PromptLearnerProfile> {
  try {
    const brief = await loadLearnerBrief(input);
    if (!brief) return legacy;
    return {
      levelEstimate: legacy.levelEstimate,
      recentMistakes: [],
      memoryNotes: brief.warmupNote ? [brief.warmupNote] : [],
      brief: brief.text.trim() || "No earlier sessions with this learner are recorded yet.",
    };
  } catch (err) {
    console.warn("[tutor/memory] learner brief failed; using legacy memory:", err);
    return legacy;
  }
}

/**
 * Stores a finished session's mistakes as misconception memories (deduplicated against the learner's
 * active misconceptions). Returns false when the table is not migrated (caller keeps the legacy write).
 */
export async function saveMisconceptionMemories(input: {
  companyId: string;
  userId: string;
  courseId: string | null;
  sessionId: string | null;
  mistakes: ReadonlyArray<LearnerMistake>;
}): Promise<boolean> {
  const db = looseDb();
  const existing = await loadLearnerMemories({
    db,
    userId: input.userId,
    companyId: input.companyId,
    statuses: ["active", "hidden"],
  });
  if (!existing.available) return false;
  const known = new Set(existing.memories.map((m) => m.content.trim().toLowerCase()));
  const rows = input.mistakes
    .map((m) => mistakeToMemoryContent(m))
    .filter((content, i, all) => content && all.indexOf(content) === i && !known.has(content.toLowerCase()))
    .slice(0, 10)
    .map((content) => ({
      company_id: input.companyId,
      user_id: input.userId,
      kind: "misconception",
      content,
      source: "teacher_observed",
      source_ref: "session_report",
      session_id: input.sessionId,
      course_id: input.courseId,
      confidence: 0.6,
    }));
  if (rows.length === 0) return true;
  const { error } = await db.from("learner_memories").insert(rows);
  if (error) {
    if (isSchemaUnavailableError(error)) return false;
    throw new Error(`could not store misconception memories: ${error.message}`);
  }
  return true;
}

/** The one model call of the summariser (task `memoryExtract`; GEMINI_MODEL_MEMORY_EXTRACT overrides). Metered by aiCall. */
async function callMemoryExtractModel(
  transcript: string,
  meter: { companyId: string; userId: string; sessionId: string },
): Promise<{ text: string | undefined }> {
  const result = await aiCall(
    "memoryExtract",
    {
      contents: `Transcript:\n${transcript}`,
      systemInstruction: MEMORY_SUMMARY_SYSTEM_PROMPT,
      responseJsonSchema: MEMORY_SUMMARY_JSON_SCHEMA,
      temperature: 0.2,
      maxOutputTokens: 1024,
    },
    { meter },
  );
  return { text: result.text };
}

/**
 * Post-session summariser (run via after() on the first successful completion). Produces ≤1 episode and
 * ≤3 misconception/preference candidates (plus ≤1 learner-stated goal), each citing a turn. Never throws.
 */
export async function summariseSessionMemories(input: {
  companyId: string;
  userId: string;
  sessionId: string;
  courseId: string | null;
  turns: ReadonlyArray<SummaryTurn>;
}): Promise<{ stored: number }> {
  try {
    if (!shouldSummarise(input.turns)) return { stored: 0 };
    const db = looseDb();
    const existing = await loadLearnerMemories({
      db,
      userId: input.userId,
      companyId: input.companyId,
      statuses: ["active", "hidden"],
    });
    if (!existing.available) return { stored: 0 };

    const generated = await callMemoryExtractModel(buildIndexedTranscript(input.turns), {
      companyId: input.companyId,
      userId: input.userId,
      sessionId: input.sessionId,
    });

    const parsed = parseMemoryCandidates(
      generated.text,
      input.turns,
      existing.memories.map((m) => m.content),
    );
    if (!parsed.ok) {
      console.warn(`[tutor/memory] summariser output rejected for session ${input.sessionId}: ${parsed.error}`);
      return { stored: 0 };
    }
    if (parsed.candidates.length === 0) return { stored: 0 };

    const now = new Date();
    const rows = parsed.candidates.map((c) => ({
      company_id: input.companyId,
      user_id: input.userId,
      kind: c.kind,
      content: c.content,
      source: c.source,
      source_ref: c.sourceRef,
      session_id: input.sessionId,
      // Goals and preferences are about the person in this academy; episodes and misconceptions about the course.
      course_id: c.kind === "goal" || c.kind === "preference" ? null : input.courseId,
      confidence: c.kind === "goal" ? 0.9 : 0.6,
      expires_at: defaultExpiry(c.kind, now),
    }));
    const { error } = await db.from("learner_memories").insert(rows);
    if (error) {
      if (!isSchemaUnavailableError(error)) console.warn("[tutor/memory] could not store summary:", error.message);
      return { stored: 0 };
    }
    return { stored: rows.length };
  } catch (err) {
    console.warn(`[tutor/memory] summariser failed for session ${input.sessionId}:`, err);
    return { stored: 0 };
  }
}

type HabitDbRow = {
  streak_days: number;
  longest_streak_days: number;
  last_practice_date: string | null;
  total_practice_ms: number | string;
};

function habitFromRow(row: HabitDbRow): HabitRowState {
  return {
    streakDays: row.streak_days ?? 0,
    longestStreakDays: row.longest_streak_days ?? 0,
    lastPracticeDate: row.last_practice_date,
    totalPracticeMs: Number(row.total_practice_ms ?? 0),
  };
}

/** Loads the learner_habits row. `available: false` when not migrated. */
export async function loadLearnerHabits(userId: string, db: LooseDb = looseDb()): Promise<{ available: boolean; habits: HabitRowState | null }> {
  const res = (await db
    .from("learner_habits")
    .select("streak_days, longest_streak_days, last_practice_date, total_practice_ms")
    .eq("user_id", userId)
    .maybeSingle()) as LooseResult<HabitDbRow>;
  if (res.error) {
    if (!isSchemaUnavailableError(res.error)) console.warn("[tutor/habits] load failed:", res.error.message);
    return { available: false, habits: null };
  }
  return { available: true, habits: res.data ? habitFromRow(res.data) : null };
}

/**
 * Per-person habit update on session completion. The first time, the row is seeded from the learner's
 * legacy per-language rows so nobody loses their streak. No-op when not migrated.
 */
export async function recordLearnerHabits(input: { userId: string; today: string; practiceMs: number }): Promise<void> {
  const db = looseDb();
  const loaded = await loadLearnerHabits(input.userId, db);
  if (!loaded.available) return;
  let prev = loaded.habits;
  if (!prev) {
    const legacy = (await db
      .from("learner_language_profiles")
      .select("streak_days, last_practice_date, total_speaking_ms")
      .eq("user_id", input.userId)) as LooseResult<Array<{ streak_days: number; last_practice_date: string | null; total_speaking_ms: number }>>;
    // finalize runs the habits step before the legacy profile step, so these rows are as of before this session.
    prev = seedHabitsFromLegacy(legacy.data ?? []);
  }
  const next = applyPracticeDay(prev, input.today, input.practiceMs);
  const { error } = await db.from("learner_habits").upsert(
    {
      user_id: input.userId,
      streak_days: next.streakDays,
      longest_streak_days: next.longestStreakDays,
      last_practice_date: next.lastPracticeDate,
      total_practice_ms: next.totalPracticeMs,
    },
    { onConflict: "user_id" },
  );
  if (error && !isSchemaUnavailableError(error)) throw new Error(`could not update learner habits: ${error.message}`);
}

/** Streak to display from learner_habits, or null when the table/row is unavailable (use the legacy max). */
export async function loadDisplayStreak(userId: string, today: string): Promise<number | null> {
  const loaded = await loadLearnerHabits(userId).catch(() => ({ available: false, habits: null }));
  if (!loaded.available || !loaded.habits) return null;
  return currentStreakDays(loaded.habits, today);
}
