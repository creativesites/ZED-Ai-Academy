import type { EvidenceResult } from "../mastery/evidence.ts";

export type InsightEvidenceRow = {
  userId: string;
  courseId: string | null;
  scenarioId: string | null;
  objectiveKey: string;
  objectiveText: string;
  result: EvidenceResult;
  detail: string | null;
  createdAt: string;
};

export type InsightMasteryRow = {
  userId: string;
  courseId: string | null;
  objectiveKey: string;
  objectiveText: string;
  level: number;
  evidenceCount: number;
};

export type InsightSessionRow = {
  id: string;
  status: string;
  learnerSpeakingMs: number;
  teacherSpeakingMs: number;
};

export type MisconceptionCluster = {
  objectiveKey: string;
  objectiveText: string;
  misconceptionCount: number;
  partialCount: number;
  correctCount: number;
  learnerCount: number;
  avgMasteryLevel: number;
  sampleDetails: string[];
  latestAt: string | null;
};

export type ObjectiveMasteryStat = {
  objectiveKey: string;
  objectiveText: string;
  learnerCount: number;
  avgLevel: number;
  metCount: number;
  developingCount: number;
  reviewCount: number;
};

export type TenantInsightsSummary = {
  totalSessions: number;
  completedSessions: number;
  completionRatePct: number;
  totalSpeakingMinutes: number;
  uniqueLearners: number;
  trackedObjectives: number;
  objectives: ObjectiveMasteryStat[];
  topMisconceptions: MisconceptionCluster[];
};

/**
 * Aggregates raw `learner_evidence`, `learner_mastery`, and `tutor_sessions` rows
 * into actionable teacher insights and ranked recurring misconceptions.
 */
export function buildTeacherInsightsSummary(input: {
  evidence: ReadonlyArray<InsightEvidenceRow>;
  mastery: ReadonlyArray<InsightMasteryRow>;
  sessions: ReadonlyArray<InsightSessionRow>;
  maxMisconceptions?: number;
  maxObjectives?: number;
}): TenantInsightsSummary {
  const uniqueLearners = new Set<string>();
  const masteryByObjective = new Map<
    string,
    {
      objectiveText: string;
      learners: Set<string>;
      levels: number[];
      metCount: number;
      developingCount: number;
      reviewCount: number;
    }
  >();

  for (const row of input.mastery) {
    uniqueLearners.add(row.userId);
    const entry = masteryByObjective.get(row.objectiveKey) ?? {
      objectiveText: row.objectiveText,
      learners: new Set<string>(),
      levels: [],
      metCount: 0,
      developingCount: 0,
      reviewCount: 0,
    };
    entry.objectiveText = row.objectiveText || entry.objectiveText;
    entry.learners.add(row.userId);
    entry.levels.push(row.level);
    if (row.level >= 2) entry.metCount += 1;
    else if (row.level === 1) entry.developingCount += 1;
    else entry.reviewCount += 1;
    masteryByObjective.set(row.objectiveKey, entry);
  }

  const evidenceByObjective = new Map<
    string,
    {
      objectiveText: string;
      learners: Set<string>;
      misconceptionCount: number;
      partialCount: number;
      correctCount: number;
      details: string[];
      latestAt: string | null;
    }
  >();

  for (const ev of input.evidence) {
    uniqueLearners.add(ev.userId);
    const entry = evidenceByObjective.get(ev.objectiveKey) ?? {
      objectiveText: ev.objectiveText,
      learners: new Set<string>(),
      misconceptionCount: 0,
      partialCount: 0,
      correctCount: 0,
      details: [],
      latestAt: null,
    };
    entry.objectiveText = ev.objectiveText || entry.objectiveText;
    entry.learners.add(ev.userId);
    if (ev.result === "misconception") entry.misconceptionCount += 1;
    else if (ev.result === "partial") entry.partialCount += 1;
    else entry.correctCount += 1;

    if (
      (ev.result === "misconception" || ev.result === "partial") &&
      ev.detail &&
      ev.detail.trim() &&
      !entry.details.includes(ev.detail.trim()) &&
      entry.details.length < 4
    ) {
      entry.details.push(ev.detail.trim());
    }
    if (!entry.latestAt || ev.createdAt > entry.latestAt) {
      entry.latestAt = ev.createdAt;
    }
    evidenceByObjective.set(ev.objectiveKey, entry);
  }

  const objectives: ObjectiveMasteryStat[] = Array.from(masteryByObjective.entries())
    .map(([objectiveKey, stat]) => {
      const avgLevel =
        stat.levels.length > 0
          ? Number((stat.levels.reduce((s, n) => s + n, 0) / stat.levels.length).toFixed(2))
          : 0;
      return {
        objectiveKey,
        objectiveText: stat.objectiveText,
        learnerCount: stat.learners.size,
        avgLevel,
        metCount: stat.metCount,
        developingCount: stat.developingCount,
        reviewCount: stat.reviewCount,
      };
    })
    .sort((a, b) => a.avgLevel - b.avgLevel || b.learnerCount - a.learnerCount)
    .slice(0, input.maxObjectives ?? 20);

  const topMisconceptions: MisconceptionCluster[] = Array.from(evidenceByObjective.entries())
    .filter(([, entry]) => entry.misconceptionCount + entry.partialCount > 0)
    .map(([objectiveKey, entry]) => {
      const masteryStat = masteryByObjective.get(objectiveKey);
      const avgMasteryLevel =
        masteryStat && masteryStat.levels.length > 0
          ? Number(
              (
                masteryStat.levels.reduce((s, n) => s + n, 0) /
                masteryStat.levels.length
              ).toFixed(2),
            )
          : 0;

      return {
        objectiveKey,
        objectiveText: entry.objectiveText,
        misconceptionCount: entry.misconceptionCount,
        partialCount: entry.partialCount,
        correctCount: entry.correctCount,
        learnerCount: entry.learners.size,
        avgMasteryLevel,
        sampleDetails: entry.details,
        latestAt: entry.latestAt,
      };
    })
    .sort(
      (a, b) =>
        b.misconceptionCount - a.misconceptionCount ||
        b.partialCount - a.partialCount ||
        a.avgMasteryLevel - b.avgMasteryLevel,
    )
    .slice(0, input.maxMisconceptions ?? 10);

  const totalSessions = input.sessions.length;
  const completedSessions = input.sessions.filter((s) => s.status === "completed").length;
  const completionRatePct =
    totalSessions > 0 ? Math.round((completedSessions / totalSessions) * 100) : 0;
  const totalSpeakingMs = input.sessions.reduce(
    (sum, s) => sum + Math.max(0, s.learnerSpeakingMs) + Math.max(0, s.teacherSpeakingMs),
    0,
  );

  return {
    totalSessions,
    completedSessions,
    completionRatePct,
    totalSpeakingMinutes: Math.round(totalSpeakingMs / 60_000),
    uniqueLearners: uniqueLearners.size,
    trackedObjectives: masteryByObjective.size,
    objectives,
    topMisconceptions,
  };
}
