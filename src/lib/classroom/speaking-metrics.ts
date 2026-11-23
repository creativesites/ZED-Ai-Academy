export type SpeakingSessionRow = {
  id: string;
  user_id: string;
  learner_speaking_ms: number | null;
  status: string;
  started_at: string;
  scenario_id?: string | null;
  shared_with_teacher?: boolean | null;
};

export type SpeakingReportRow = {
  session_id: string;
  scores: unknown;
};

export type UserSpeakingMetrics = {
  speakingMinutes: number;
  totalSpeakingMs: number;
  scenariosCompleted: number;
  totalSessions: number;
  flaggedSessionsCount: number;
  avgSpeakingScore: number | null;
  scoredSessionsCount: number;
  lastSpeakingAt: string | null;
};

export type AcademySpeakingSummary = {
  totalSpeakingMinutes: number;
  totalScenariosCompleted: number;
  avgSpeakingScore: number | null;
};

/**
 * Extracts valid numeric 0..100 rubric values from a tutor_reports.scores JSON payload
 * and returns their rounded mean, or null when no numeric scores are present.
 */
export function extractReportAverageScore(scores: unknown): number | null {
  if (!scores || typeof scores !== "object" || Array.isArray(scores)) {
    return null;
  }

  const values: number[] = [];
  for (const val of Object.values(scores as Record<string, unknown>)) {
    if (typeof val === "number" && Number.isFinite(val) && val >= 0 && val <= 100) {
      values.push(val);
    }
  }

  if (values.length === 0) return null;
  const sum = values.reduce((acc, n) => acc + n, 0);
  return Math.round(sum / values.length);
}

/** Converts milliseconds to whole display minutes (at least 1 minute when > 0 ms). */
export function speakingMsToMinutes(ms: number | null | undefined): number {
  const safe = typeof ms === "number" && Number.isFinite(ms) && ms > 0 ? ms : 0;
  if (safe === 0) return 0;
  return Math.max(1, Math.round(safe / 60000));
}

export function emptyUserSpeakingMetrics(): UserSpeakingMetrics {
  return {
    speakingMinutes: 0,
    totalSpeakingMs: 0,
    scenariosCompleted: 0,
    totalSessions: 0,
    flaggedSessionsCount: 0,
    avgSpeakingScore: null,
    scoredSessionsCount: 0,
    lastSpeakingAt: null,
  };
}

/** Aggregates speaking sessions and tutor report rubric scores per user_id. */
export function aggregateSpeakingMetricsByUser(
  sessions: SpeakingSessionRow[],
  reports: SpeakingReportRow[],
): {
  byUser: Map<string, UserSpeakingMetrics>;
  summary: AcademySpeakingSummary;
} {
  const reportScoreBySession = new Map<string, number>();
  for (const rep of reports) {
    const avg = extractReportAverageScore(rep.scores);
    if (avg !== null) {
      reportScoreBySession.set(rep.session_id, avg);
    }
  }

  const accumulators = new Map<
    string,
    {
      totalMs: number;
      completed: number;
      totalSessions: number;
      flagged: number;
      scoreSum: number;
      scoredCount: number;
      lastAt: string | null;
    }
  >();

  let academyTotalMs = 0;
  let academyCompleted = 0;
  let academyScoreSum = 0;
  let academyScoredCount = 0;

  for (const s of sessions) {
    const ms =
      typeof s.learner_speaking_ms === "number" && Number.isFinite(s.learner_speaking_ms) && s.learner_speaking_ms > 0
        ? s.learner_speaking_ms
        : 0;

    let acc = accumulators.get(s.user_id);
    if (!acc) {
      acc = {
        totalMs: 0,
        completed: 0,
        totalSessions: 0,
        flagged: 0,
        scoreSum: 0,
        scoredCount: 0,
        lastAt: null,
      };
      accumulators.set(s.user_id, acc);
    }

    acc.totalMs += ms;
    acc.totalSessions += 1;
    academyTotalMs += ms;

    if (s.status === "completed") {
      acc.completed += 1;
      academyCompleted += 1;
    }
    if (s.status === "flagged") {
      acc.flagged += 1;
    }

    if (s.started_at && (!acc.lastAt || s.started_at > acc.lastAt)) {
      acc.lastAt = s.started_at;
    }

    const sessionScore = reportScoreBySession.get(s.id);
    if (sessionScore !== undefined) {
      acc.scoreSum += sessionScore;
      acc.scoredCount += 1;
      academyScoreSum += sessionScore;
      academyScoredCount += 1;
    }
  }

  const byUser = new Map<string, UserSpeakingMetrics>();
  for (const [userId, acc] of accumulators.entries()) {
    byUser.set(userId, {
      speakingMinutes: speakingMsToMinutes(acc.totalMs),
      totalSpeakingMs: acc.totalMs,
      scenariosCompleted: acc.completed,
      totalSessions: acc.totalSessions,
      flaggedSessionsCount: acc.flagged,
      avgSpeakingScore: acc.scoredCount > 0 ? Math.round(acc.scoreSum / acc.scoredCount) : null,
      scoredSessionsCount: acc.scoredCount,
      lastSpeakingAt: acc.lastAt,
    });
  }

  return {
    byUser,
    summary: {
      totalSpeakingMinutes: speakingMsToMinutes(academyTotalMs),
      totalScenariosCompleted: academyCompleted,
      avgSpeakingScore: academyScoredCount > 0 ? Math.round(academyScoreSum / academyScoredCount) : null,
    },
  };
}
