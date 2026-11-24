// Pure habit, XP, level, and weekly practice goal calculations for ALL subjects.

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
