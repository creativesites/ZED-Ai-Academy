import "server-only";
import { createServiceClient } from "@/lib/supabase/server";
import type { EvidenceResult } from "../mastery/evidence";
import { isSchemaUnavailableError } from "../mastery/server";
import {
  buildTeacherInsightsSummary,
  type InsightEvidenceRow,
  type InsightMasteryRow,
  type InsightSessionRow,
  type TenantInsightsSummary,
} from "./misconceptions";

type LooseResult<T> = {
  data: T[] | null;
  error: { code?: string; message?: string } | null;
};

type LooseSelect = PromiseLike<LooseResult<Record<string, unknown>>> & {
  eq: (col: string, val: unknown) => LooseSelect;
  order: (col: string, opts?: { ascending?: boolean }) => LooseSelect;
  limit: (n: number) => LooseSelect;
};

/**
 * Loads aggregated objective mastery and recurring misconception insights for an
 * academy (`companyId`) and optional `courseId`. Returns empty objective/misconception
 * lists cleanly if `learner_mastery`/`learner_evidence` are not yet migrated.
 */
export async function loadTenantTutorInsights(input: {
  companyId: string;
  courseId?: string | null;
}): Promise<{ summary: TenantInsightsSummary; masteryAvailable: boolean }> {
  const db = createServiceClient();
  const looseDb = db as unknown as {
    from: (t: string) => { select: (c: string) => LooseSelect };
  };

  let evidenceQuery = looseDb
    .from("learner_evidence")
    .select("user_id, course_id, scenario_id, objective_key, objective_text, result, detail, created_at")
    .eq("company_id", input.companyId);
  if (input.courseId) {
    evidenceQuery = evidenceQuery.eq("course_id", input.courseId);
  }

  let masteryQuery = looseDb
    .from("learner_mastery")
    .select("user_id, course_id, objective_key, objective_text, level, evidence_count")
    .eq("company_id", input.companyId);
  if (input.courseId) {
    masteryQuery = masteryQuery.eq("course_id", input.courseId);
  }

  let sessionsQuery = db
    .from("tutor_sessions")
    .select("id, status, learner_speaking_ms, teacher_speaking_ms, scenario_id")
    .eq("company_id", input.companyId)
    .order("started_at", { ascending: false })
    .limit(200);

  if (input.courseId) {
    const { data: courseScenarios } = await db
      .from("practice_scenarios")
      .select("id")
      .eq("course_id", input.courseId);
    const ids = (courseScenarios ?? []).map((s) => s.id);
    if (ids.length > 0) {
      sessionsQuery = sessionsQuery.in("scenario_id", ids);
    } else {
      sessionsQuery = sessionsQuery.limit(0);
    }
  }

  const [evRes, mRes, sessRes] = await Promise.all([
    evidenceQuery.order("created_at", { ascending: false }).limit(400),
    masteryQuery.limit(400),
    sessionsQuery,
  ]);

  const missingSchema =
    isSchemaUnavailableError(evRes.error) || isSchemaUnavailableError(mRes.error);

  const evidence: InsightEvidenceRow[] = missingSchema
    ? []
    : (evRes.data ?? []).map((r) => ({
        userId: String(r.user_id),
        courseId: (r.course_id as string | null) ?? null,
        scenarioId: (r.scenario_id as string | null) ?? null,
        objectiveKey: String(r.objective_key),
        objectiveText: String(r.objective_text),
        result: (r.result as EvidenceResult) ?? "partial",
        detail: (r.detail as string | null) ?? null,
        createdAt: String(r.created_at ?? ""),
      }));

  const mastery: InsightMasteryRow[] = missingSchema
    ? []
    : (mRes.data ?? []).map((r) => ({
        userId: String(r.user_id),
        courseId: (r.course_id as string | null) ?? null,
        objectiveKey: String(r.objective_key),
        objectiveText: String(r.objective_text),
        level: Number(r.level ?? 0),
        evidenceCount: Number(r.evidence_count ?? 0),
      }));

  const sessions: InsightSessionRow[] = (sessRes.data ?? []).map((s) => ({
    id: s.id,
    status: s.status,
    learnerSpeakingMs: s.learner_speaking_ms,
    teacherSpeakingMs: s.teacher_speaking_ms,
  }));

  return {
    masteryAvailable: !missingSchema,
    summary: buildTeacherInsightsSummary({
      evidence,
      mastery,
      sessions,
    }),
  };
}
