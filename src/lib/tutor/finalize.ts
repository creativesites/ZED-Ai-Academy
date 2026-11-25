import {
  collectNoteEvidence,
  summarizeSessionObjectives,
  type CollectedEvidence,
  type MasteryState,
  type SessionObjectiveSummary,
} from "./mastery/evidence.ts";
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
  objectives: SessionObjectiveSummary[];
  next_step: string;
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
  courseId?: string | null;
  scenarioId?: string | null;
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
  /** Optional Phase 2 persistence of `note_evidence` -> `learner_evidence` + `learner_mastery`. */
  persistMastery?(evidence: CollectedEvidence[]): Promise<MasteryState[]>;
  /**
   * Optional P1-07 write of this session's mistakes as `learner_memories` (kind=misconception). Returns true
   * when they were stored there; the legacy `learner_language_profiles.memory` is then left unchanged
   * (read-only, migrated). Returns false (e.g. table not migrated) to keep today's legacy write.
   */
  saveMisconceptionMemories?(mistakes: LearnerMistake[]): Promise<boolean>;
  /** Optional P1-07 per-person habit update (one streak across all subjects). */
  recordHabits?(input: { today: string; practiceMs: number }): Promise<void>;
  /** Optional observer called when a post-claim side effect fails, so other side effects still complete. */
  onSideEffectError?(step: FinalizeSideEffectStep, err: unknown): void;
};

export type FinalizeSideEffectStep = "usage" | "memories" | "profile" | "habits" | "vocab" | "mastery";

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
  const noteEvidence = collectNoteEvidence(
    input.turns.map((t) => ({ eventsJson: t.events })),
    { courseId: input.courseId, scenarioId: input.scenarioId },
  );
  const preliminaryObjectives = summarizeSessionObjectives(noteEvidence, []);

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
    objectives: preliminaryObjectives,
    next_step: content.nextStep,
  });
  if (!claim.created) return { report: claim.report, created: false };

  // Winner only: side effects run in isolated guards so a transient error in one (e.g. usage log)
  // never blocks learner streaks, vocabulary SRS, or objective mastery persistence.
  const runSideEffect = async (step: FinalizeSideEffectStep, fn: () => Promise<void>) => {
    try {
      await fn();
    } catch (err) {
      if (deps.onSideEffectError) {
        deps.onSideEffectError(step, err);
      } else {
        throw err;
      }
    }
  };

  await runSideEffect("usage", async () => {
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
  });

  let mistakesInMemories = false;
  if (deps.saveMisconceptionMemories && mistakes.length > 0) {
    await runSideEffect("memories", async () => {
      mistakesInMemories = await deps.saveMisconceptionMemories!(mistakes);
    });
  }

  // Habits before the legacy profile: a first-time habit row is seeded from the pre-session legacy streaks.
  if (deps.recordHabits) {
    await runSideEffect("habits", async () => {
      await deps.recordHabits!({ today: input.today, practiceMs: learnerMs + teacherMs });
    });
  }

  await runSideEffect("profile", async () => {
    const previous = await deps.loadProfile();
    const memory = parseMemory(previous?.memory);
    const recent = mistakesInMemories
      ? memory.recentMistakes
      : [...mistakes, ...memory.recentMistakes]
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
  });

  // Vocabulary review (SRS) is a Language pack feature: other subjects' mistakes are not words to drill.
  if (input.skillLanguage) {
    await runSideEffect("vocab", async () => {
      await deps.addMistakeVocabulary(mistakes);
    });
  }

  if (deps.persistMastery && noteEvidence.length > 0) {
    await runSideEffect("mastery", async () => {
      await deps.persistMastery!(noteEvidence);
    });
  }

  return { report: claim.report, created: true };
}

export type NextScenarioCandidate = {
  id: string;
  title: string;
  skillPack: string;
  courseId?: string | null;
  level?: string | null;
};

const LEVEL_RANK: Record<string, number> = {
  a1: 1,
  hsk1: 1,
  beginner: 1,
  a2: 2,
  hsk2: 2,
  elementary: 2,
  b1: 3,
  hsk3: 3,
  intermediate: 3,
  b2: 4,
  hsk4: 4,
  c1: 5,
  advanced: 5,
};

function levelRank(level: string | null | undefined): number {
  if (!level) return 0;
  return LEVEL_RANK[level.trim().toLowerCase()] ?? 0;
}

/**
 * Picks the best recommended next published scenario for the learner after completing a session:
 * 1) Another scenario in the same course (if applicable)
 * 2) Another scenario in the same skill pack at the same or next difficulty level
 * 3) Any other distinct published scenario in the candidate list
 */
export function pickRecommendedNextScenario(
  current: { id?: string | null; skillPack: string; courseId?: string | null; level?: string | null },
  candidates: ReadonlyArray<NextScenarioCandidate>,
  completedScenarioIds: ReadonlySet<string> = new Set(),
): NextScenarioCandidate | null {
  const pool = candidates.filter((c) => c.id !== current.id);
  if (pool.length === 0) return null;

  const curRank = levelRank(current.level);
  const score = (c: NextScenarioCandidate): number => {
    let pts = 0;
    if (!completedScenarioIds.has(c.id)) pts += 40;
    if (current.courseId && c.courseId === current.courseId) pts += 30;
    if (c.skillPack === current.skillPack) pts += 20;
    const r = levelRank(c.level);
    if (curRank > 0 && r === curRank + 1) pts += 12;
    else if (curRank > 0 && r === curRank) pts += 8;
    return pts;
  };

  let best = pool[0];
  let bestScore = score(best);
  for (let i = 1; i < pool.length; i += 1) {
    const s = score(pool[i]);
    if (s > bestScore) {
      best = pool[i];
      bestScore = s;
    }
  }
  return best;
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
