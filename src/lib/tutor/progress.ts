// Learner progress helpers: practice streak and the language a profile row is keyed by.
// Pure. Dates are UTC calendar days ("YYYY-MM-DD").

export function utcDateString(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function dayNumber(day: string): number {
  return Date.UTC(Number(day.slice(0, 4)), Number(day.slice(5, 7)) - 1, Number(day.slice(8, 10))) / 86_400_000;
}

/**
 * Streak after a practice session on `today`.
 * - Same day as the last practice: unchanged (idempotent within a day).
 * - Practised yesterday: streak + 1.
 * - Otherwise (gap or first session): restarts at 1.
 * A `today` earlier than the last practice date (clock skew) leaves the streak unchanged.
 */
export function nextStreak(input: {
  lastPracticeDate: string | null;
  streakDays: number;
  today: string;
}): { streakDays: number; lastPracticeDate: string } {
  const { lastPracticeDate, streakDays, today } = input;
  if (lastPracticeDate === null) return { streakDays: 1, lastPracticeDate: today };
  const gap = dayNumber(today) - dayNumber(lastPracticeDate);
  if (gap <= 0) return { streakDays: Math.max(1, streakDays), lastPracticeDate };
  if (gap === 1) return { streakDays: streakDays + 1, lastPracticeDate: today };
  return { streakDays: 1, lastPracticeDate: today };
}

/** Key for learner_language_profiles.language. Language packs use their code; others use the persona's first language. */
export function profileLanguage(skillLanguage: string | null, personaLanguages: string[]): string {
  return skillLanguage ?? personaLanguages[0] ?? "en";
}
