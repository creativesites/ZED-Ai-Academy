import { parseMemory } from "./memory.ts";
import { nextStreak } from "./progress.ts";
import {
  buildTranscript,
  collectNoteMistakes,
  hasLearnerSpeech,
  MAX_REPORT_MISTAKES,
  parseTutorReport,
  toneStats,
  type LearnerMistake,
  type StoredTurn,
  type TutorReportContent,
} from "./report-model.ts";

// Finalization of a tutor session, with every side effect injected. Pure: relative imports only,
// so node:test can run the duplicate-/complete cases against in-memory stubs.
//
// Order matters for idempotency:
//   1. A stored report means the session is already finalized: return it, change nothing.
//   2. Session row update (status, speaking time). Safe to repeat.
//   3. Report generation (model call). Safe to repeat: no claim yet, so a retry starts over.
//   4. Claim the report row. Only the request whose claim wins applies usage, profile and vocabulary.
//      A duplicate or concurrent request gets created: false and changes nothing.

export const RECENT_MISTAKES_KEPT = 10;

export type SessionStatus = "active" | "completed" | "abandoned" | "flagged";

export type ProfileState = {
  level_estimate: string | null;
  framework: string | null;
  can_do: unknown;
  memory: unknown;
  streak_days: number;
  last_practice_date: string | null;
  total_speaking_ms: number;
} | null;

export type ReportPayload = {
  scores: unknown;
  strengths: unknown;
  mistakes: LearnerMistake[];
  tone_stats: Record<string, number>;
};

export type FinalizeCoreInput = {
  mode: "live" | "voice" | "text";
  currentStatus: SessionStatus;
  requestedStatus: "completed" | "abandoned";
  learnerSpeakingMs: number;
  teacherSpeakingMs: number;
  turns: StoredTurn[];
  scenarioTitle: string;
  scenarioGoal: string;
  /** Language pack code (zh, es, fr) or null for non-language packs. */
  skillLanguage: string | null;
  /** learner_language_profiles.language key. */
  profileLanguage: string;
  /** Live model id, used to label live audio usage. */
  liveModel: string;
  /** UTC calendar day of the session end, "YYYY-MM-DD". */
  today: string;
};

export type FinalizeCoreDeps<R> = {
  getReport(): Promise<R | null>;
  updateSession(update: {
    status: SessionStatus;
    learnerSpeakingMs: number;
    teacherSpeakingMs: number;
  }): Promise<void>;
  generateReport(input: {
    transcript: string;
    scenarioTitle: string;
    scenarioGoal: string;
    language: string | null;
  }): Promise<{ text?: string; model: string; totalTokens?: number }>;
  /** Inserts the report row. Returns created: false with the stored report when another request won. */
  claimReport(payload: ReportPayload): Promise<{ created: boolean; report: R }>;
  recordUsage(usage: {
    kind: "llm" | "live_audio_in" | "live_audio_out";
    model: string;
    units: number;
    unit: string;
  }): Promise<void>;
  loadProfile(): Promise<ProfileState>;
  saveProfile(row: {
    level_estimate: string | null;
    framework: string | null;
    can_do: unknown;
    memory: { recentMistakes: LearnerMistake[]; notes: string[] };
    streak_days: number;
    last_practice_date: string;
    total_speaking_ms: number;
  }): Promise<void>;
  addMistakeVocabulary(mistakes: LearnerMistake[]): Promise<void>;
};

export type FinalizeCoreResult<R> = { report: R; created: boolean };

export async function finalizeSessionCore<R>(
  input: FinalizeCoreInput,
  deps: FinalizeCoreDeps<R>,
): Promise<FinalizeCoreResult<R>> {
  const existing = await deps.getReport();
  if (existing) return { report: existing, created: false };

  // A flagged or already completed session keeps its status.
  const status: SessionStatus =
    input.currentStatus === "flagged" || input.currentStatus === "completed"
      ? input.currentStatus
      : input.requestedStatus;
  const learnerMs = clampMs(input.learnerSpeakingMs);
  const teacherMs = clampMs(input.teacherSpeakingMs);
  await deps.updateSession({ status, learnerSpeakingMs: learnerMs, teacherSpeakingMs: teacherMs });

  const noteMistakes = collectNoteMistakes(input.turns);
  let content: TutorReportContent;
  let llm: { model: string; totalTokens: number } | null = null;
  if (hasLearnerSpeech(input.turns)) {
    const generated = await deps.generateReport({
      transcript: buildTranscript(input.turns),
      scenarioTitle: input.scenarioTitle,
      scenarioGoal: input.scenarioGoal,
      language: input.skillLanguage,
    });
    const parsed = parseTutorReport(generated.text);
    if (!parsed.ok) throw new Error(`report model output unusable: ${parsed.error}`);
    content = parsed.report;
    llm = { model: generated.model, totalTokens: generated.totalTokens ?? 0 };
  } else {
    content = {
      scores: {},
      strengths: [],
      mistakes: [],
      nextStep: "Try a full session next time and reply to the teacher a few times, so there is something to review.",
    };
  }

  const mistakes = mergeMistakes(noteMistakes, content.mistakes);
  const claim = await deps.claimReport({
    scores: content.scores,
    strengths: content.strengths,
    mistakes,
    tone_stats: toneStats(input.skillLanguage, mistakes),
  });
  if (!claim.created) return { report: claim.report, created: false };

  // Winner only: side effects. Nothing here runs for a duplicate.
  if (llm) {
    await deps.recordUsage({ kind: "llm", model: llm.model, units: llm.totalTokens, unit: "tokens" });
  }
  if (input.mode === "live") {
    await deps.recordUsage({
      kind: "live_audio_in",
      model: input.liveModel,
      units: Math.ceil(learnerMs / 1000),
      unit: "seconds",
    });
    await deps.recordUsage({
      kind: "live_audio_out",
      model: input.liveModel,
      units: Math.ceil(teacherMs / 1000),
      unit: "seconds",
    });
  }

  const previous = await deps.loadProfile();
  const memory = parseMemory(previous?.memory);
  const recent = [...mistakes, ...memory.recentMistakes]
    .filter((m, i, all) => all.findIndex((x) => x.said === m.said && x.correct === m.correct) === i)
    .slice(0, RECENT_MISTAKES_KEPT);
  const streak = nextStreak({
    lastPracticeDate: previous?.last_practice_date ?? null,
    streakDays: previous?.streak_days ?? 0,
    today: input.today,
  });
  await deps.saveProfile({
    level_estimate: previous?.level_estimate ?? null,
    framework: previous?.framework ?? null,
    can_do: previous?.can_do ?? [],
    memory: { recentMistakes: recent, notes: memory.notes },
    streak_days: streak.streakDays,
    last_practice_date: streak.lastPracticeDate,
    total_speaking_ms: (previous?.total_speaking_ms ?? 0) + learnerMs + teacherMs,
  });

  await deps.addMistakeVocabulary(mistakes);

  return { report: claim.report, created: true };
}

/** Note-taken mistakes first, then the model's extra mistakes whose (said, correct) pair is new. Capped. */
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

function clampMs(value: number): number {
  return Math.max(0, Math.round(Number.isFinite(value) ? value : 0));
}
