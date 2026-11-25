// Pure habit, XP, level, and weekly practice goal calculations for ALL subjects.

import { nextStreak } from "./progress.ts";

export type LearnerTier = {
  level: number;
  title: string;
  xp: number;
  nextLevelXp: number;
  levelProgressPct: number;
};

export type LearnerHabitSummary = {
  tier: LearnerTier;
  weeklyMinutes: number;
  weeklyGoalMinutes: number;
  weeklyGoalPct: number;
  weeklyGoalMet: boolean;
  nextBestAction: {
    label: string;
    detail: string;
    kind: "deck" | "goal" | "streak" | "celebrate";
  };
};

const TIERS: Array<{ minXp: number; title: string }> = [
  { minXp: 0, title: "Explorer" },
  { minXp: 150, title: "Builder" },
  { minXp: 450, title: "Practitioner" },
  { minXp: 1000, title: "Specialist" },
  { minXp: 2000, title: "Master" },
];

export const DEFAULT_WEEKLY_GOAL_MINUTES = 15;

export function computeLearnerTier(xp: number): LearnerTier {
  const safeXp = Math.max(0, Math.round(Number.isFinite(xp) ? xp : 0));
  let idx = 0;
  for (let i = TIERS.length - 1; i >= 0; i -= 1) {
    if (safeXp >= TIERS[i].minXp) {
      idx = i;
      break;
    }
  }
  const current = TIERS[idx];
  const next = TIERS[idx + 1];
  if (!next) {
    return {
      level: idx + 1,
      title: current.title,
      xp: safeXp,
      nextLevelXp: current.minXp,
      levelProgressPct: 100,
    };
  }
  const span = Math.max(1, next.minXp - current.minXp);
  const progress = Math.min(100, Math.max(0, Math.round(((safeXp - current.minXp) / span) * 100)));
  return {
    level: idx + 1,
    title: current.title,
    xp: safeXp,
    nextLevelXp: next.minXp,
    levelProgressPct: progress,
  };
}

export function computeLearnerHabits(input: {
  streakDays: number;
  completedSessionsCount: number;
  totalPracticeMinutes: number;
  weeklyMinutes: number;
  weeklyGoalMinutes?: number;
  deckDueCount: number;
  deckMasteredCount: number;
}): LearnerHabitSummary {
  const goal = Math.max(5, input.weeklyGoalMinutes ?? DEFAULT_WEEKLY_GOAL_MINUTES);
  const weeklyMinutes = Math.max(0, Math.round(input.weeklyMinutes));
  const weeklyGoalPct = Math.min(100, Math.round((weeklyMinutes / goal) * 100));
  const weeklyGoalMet = weeklyMinutes >= goal;

  const xp =
    Math.max(0, input.completedSessionsCount) * 50 +
    Math.max(0, input.totalPracticeMinutes) * 5 +
    Math.max(0, input.deckMasteredCount) * 15 +
    Math.max(0, input.streakDays) * 10;

  const tier = computeLearnerTier(xp);

  let nextBestAction: LearnerHabitSummary["nextBestAction"];
  if (input.deckDueCount > 0) {
    nextBestAction = {
      kind: "deck",
      label: `Review ${input.deckDueCount} Study Deck card${input.deckDueCount === 1 ? "" : "s"}`,
      detail: "Quick 2-minute active recall locks concepts into long-term memory.",
    };
  } else if (!weeklyGoalMet) {
    const remaining = Math.max(1, goal - weeklyMinutes);
    nextBestAction = {
      kind: "goal",
      label: `${remaining} min left to hit your weekly goal`,
      detail: "Run one short AI Teacher session to close your weekly ring.",
    };
  } else if (input.streakDays > 0) {
    nextBestAction = {
      kind: "streak",
      label: `${input.streakDays}-day streak active!`,
      detail: "Weekly goal complete — try a new scenario or challenge to level up.",
    };
  } else {
    nextBestAction = {
      kind: "celebrate",
      label: "Weekly practice goal reached!",
      detail: "Great consistency — pick any AI Teacher session to keep building mastery.",
    };
  }

  return {
    tier,
    weeklyMinutes,
    weeklyGoalMinutes: goal,
    weeklyGoalPct,
    weeklyGoalMet,
    nextBestAction,
  };
}

// ---------------------------------------------------------------------------
// Per-person habit row (learner_habits, P1-07). One streak per person instead of one per language,
// so a learner practising Maths on Monday and Chinese on Tuesday keeps a 2-day streak.

export type HabitRowState = {
  streakDays: number;
  longestStreakDays: number;
  lastPracticeDate: string | null;
  totalPracticeMs: number;
};

export type LegacyStreakRow = {
  streak_days: number | null;
  last_practice_date: string | null;
  total_speaking_ms: number | null;
};

/**
 * Initial habit state for a learner who has no learner_habits row yet, from their legacy per-language
 * rows: the streak of the most recently practised language (ties: the longest), totals summed.
 */
export function seedHabitsFromLegacy(rows: ReadonlyArray<LegacyStreakRow>): HabitRowState | null {
  if (rows.length === 0) return null;
  let best: LegacyStreakRow | null = null;
  for (const r of rows) {
    if (!r.last_practice_date) continue;
    if (
      !best ||
      r.last_practice_date > (best.last_practice_date ?? "") ||
      (r.last_practice_date === best.last_practice_date && (r.streak_days ?? 0) > (best.streak_days ?? 0))
    ) {
      best = r;
    }
  }
  const streak = Math.max(0, best?.streak_days ?? 0);
  return {
    streakDays: streak,
    longestStreakDays: Math.max(streak, ...rows.map((r) => Math.max(0, r.streak_days ?? 0))),
    lastPracticeDate: best?.last_practice_date ?? null,
    totalPracticeMs: rows.reduce((sum, r) => sum + Math.max(0, Number(r.total_speaking_ms ?? 0)), 0),
  };
}

/** Habit row after practising on `today` (calendar day "YYYY-MM-DD") for `addMs` milliseconds. */
export function applyPracticeDay(prev: HabitRowState | null, today: string, addMs: number): HabitRowState {
  const streak = nextStreak({
    lastPracticeDate: prev?.lastPracticeDate ?? null,
    streakDays: prev?.streakDays ?? 0,
    today,
  });
  const add = Number.isFinite(addMs) ? Math.max(0, Math.round(addMs)) : 0;
  return {
    streakDays: streak.streakDays,
    longestStreakDays: Math.max(prev?.longestStreakDays ?? 0, streak.streakDays),
    lastPracticeDate: streak.lastPracticeDate,
    totalPracticeMs: (prev?.totalPracticeMs ?? 0) + add,
  };
}

/** The streak to show on `today`: a streak whose last practice is older than yesterday has lapsed (0). */
export function currentStreakDays(
  state: Pick<HabitRowState, "streakDays" | "lastPracticeDate">,
  today: string,
): number {
  if (!state.lastPracticeDate) return 0;
  const gap = (Date.parse(`${today}T00:00:00Z`) - Date.parse(`${state.lastPracticeDate}T00:00:00Z`)) / 86_400_000;
  if (!Number.isFinite(gap)) return Math.max(0, state.streakDays);
  return gap > 1 ? 0 : Math.max(0, state.streakDays);
}
