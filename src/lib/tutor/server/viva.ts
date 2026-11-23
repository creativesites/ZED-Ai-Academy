import "server-only";
import { createServiceClient } from "@/lib/supabase/server";
import { isSchemaUnavailableError } from "../mastery/server";
import { normalizeStoredReportContent } from "../report-model";
import { scenarioViewFromRow, type TutorScenarioRow, type TutorScenarioView } from "../tutor-session-block";
import { evaluateVivaOutcome } from "../viva";

export type CourseVivaStatus = {
  required: boolean;
  passed: boolean;
  scenarioId: string | null;
  scenario: TutorScenarioView | null;
  reason: string | null;
};

/**
 * Checks whether `courseId` requires an end-of-course Certificate Viva and whether `userId`
 * has already passed it. Degrades safely (`required: false`) if Phase 3 columns are not yet migrated.
 */
export async function getCourseVivaStatus(
  courseId: string,
  userId: string,
): Promise<CourseVivaStatus> {
  const db = createServiceClient();
  const looseCourses = db as unknown as {
    from: (t: string) => {
      select: (c: string) => {
        eq: (k: string, v: unknown) => {
          maybeSingle: () => Promise<{
            data: { require_certificate_viva?: boolean | null; viva_scenario_id?: string | null } | null;
            error: { code?: string; message?: string } | null;
          }>;
        };
      };
    };
  };

  const courseRes = await looseCourses
    .from("courses")
    .select("require_certificate_viva, viva_scenario_id")
    .eq("id", courseId)
    .maybeSingle();

  if (courseRes.error) {
    if (isSchemaUnavailableError(courseRes.error)) {
      return { required: false, passed: true, scenarioId: null, scenario: null, reason: null };
    }
    throw new Error(courseRes.error.message);
  }

  const required = Boolean(courseRes.data?.require_certificate_viva);
  const scenarioId = courseRes.data?.viva_scenario_id ?? null;

  if (!required || !scenarioId) {
    return { required: false, passed: true, scenarioId, scenario: null, reason: null };
  }

  const [{ data: scenarioRow }, { data: sessionRows }] = await Promise.all([
    db
      .from("practice_scenarios")
      .select("id, title, goal, style, scene, max_minutes, allowed_modes, status, persona_id")
      .eq("id", scenarioId)
      .maybeSingle(),
    db
      .from("tutor_sessions")
      .select("id")
      .eq("user_id", userId)
      .eq("scenario_id", scenarioId)
      .eq("status", "completed")
      .order("ended_at", { ascending: false })
      .limit(10),
  ]);

  // If creator turned the toggle on without publishing the viva scenario yet, do not trap learners.
  if (!scenarioRow || scenarioRow.status !== "published") {
    return { required: false, passed: true, scenarioId, scenario: null, reason: null };
  }

  const personaRow = scenarioRow.persona_id
    ? (
        await db
          .from("ai_personas")
          .select("name, display_name, rive_variant")
          .eq("id", scenarioRow.persona_id)
          .maybeSingle()
      ).data
    : null;

  const scenario = scenarioViewFromRow({
    ...scenarioRow,
    ai_personas: personaRow,
  } as unknown as TutorScenarioRow);
  const sessionIds = (sessionRows ?? []).map((s) => s.id);
  if (sessionIds.length === 0) {
    return {
      required: true,
      passed: false,
      scenarioId,
      scenario,
      reason: "Complete your oral viva check with the AI teacher before claiming your certificate.",
    };
  }

  const { data: reports } = await db
    .from("tutor_reports")
    .select("*")
    .in("session_id", sessionIds);

  let latestReason: string | null = null;
  for (const raw of reports ?? []) {
    const rec = raw as unknown as Record<string, unknown>;
    if (rec.viva_passed === true) {
      return { required: true, passed: true, scenarioId, scenario, reason: null };
    }
    const content = normalizeStoredReportContent(rec);
    const evaluation = evaluateVivaOutcome(content);
    if (evaluation.passed) {
      return { required: true, passed: true, scenarioId, scenario, reason: null };
    }
    latestReason = evaluation.reason;
  }

  return {
    required: true,
    passed: false,
    scenarioId,
    scenario,
    reason: latestReason ?? "Complete your oral viva check with the AI teacher to unlock your certificate.",
  };
}
