import "server-only";
import { createServiceClient } from "@/lib/supabase/server";
import { ZEDAI_TENANT_ID } from "@/lib/tenants/constants";
import { DEFAULT_TEACHER_NAME, safeTeacherName } from "../course-teacher.ts";
import { persistSessionMastery } from "../mastery/server.ts";
import { revisionSprintHref } from "../mastery/sprint.ts";
import { resolveDefaultPersona } from "../server/session-context.ts";
import { loadObjectiveRefsByIds } from "./objectives-server.ts";
import { buildQuizEvidence, revisionObjectiveIds, type GradedQuizQuestion } from "./quiz-evidence.ts";

export type QuizRevisionOffer = {
  objectiveIds: string[];
  objectiveTexts: string[];
  teacherName: string;
  href: string;
};

/**
 * Records server-verified quiz evidence for every graded question linked to a registered objective of the
 * quiz's course (P2-03), and returns a revision offer when missed objectives are now weak.
 *
 * Only for learners with an ACTIVE enrolment in the course: previews, course managers trying their own quiz
 * and guests (graded client-side) never produce evidence. Never throws: quiz submission must not fail
 * because the knowledge model is unavailable.
 */
export async function recordQuizEvidence(input: {
  userId: string;
  courseId: string | null;
  questions: ReadonlyArray<GradedQuizQuestion>;
}): Promise<QuizRevisionOffer | null> {
  try {
    if (!input.courseId) return null;
    const linkedIds = Array.from(
      new Set(input.questions.map((q) => q.objectiveId).filter((id): id is string => typeof id === "string" && !!id)),
    );
    if (linkedIds.length === 0) return null;

    const db = createServiceClient();
    const [{ data: course }, { data: enrollment }] = await Promise.all([
      db.from("courses").select("id, company_id").eq("id", input.courseId).maybeSingle(),
      db
        .from("enrollments")
        .select("id")
        .eq("user_id", input.userId)
        .eq("course_id", input.courseId)
        .eq("status", "active")
        .maybeSingle(),
    ]);
    if (!course || !enrollment) return null;
    const companyId = course.company_id ?? ZEDAI_TENANT_ID;

    // Tenant + course check: a question can only feed objectives of its own course.
    const objectives = await loadObjectiveRefsByIds({ client: db, ids: linkedIds, companyId, courseId: course.id });
    const evidence = buildQuizEvidence(input.questions, objectives);
    if (evidence.length === 0) return null;

    const states = await persistSessionMastery({
      supabase: db,
      companyId,
      userId: input.userId,
      courseId: course.id,
      scenarioId: null,
      sessionId: null,
      evidence,
    });

    const ids = revisionObjectiveIds(evidence, states);
    if (ids.length === 0) return null;

    let teacherName = DEFAULT_TEACHER_NAME;
    try {
      const persona = await resolveDefaultPersona(db, companyId);
      teacherName = safeTeacherName(persona.display_name) ?? safeTeacherName(persona.name) ?? DEFAULT_TEACHER_NAME;
    } catch {
      // keep the default name
    }

    let basePath = "";
    if (course.company_id && course.company_id !== ZEDAI_TENANT_ID) {
      const { data: company } = await db.from("companies").select("slug").eq("id", course.company_id).maybeSingle();
      if (company?.slug) basePath = `/academy/${company.slug}`;
    }

    const textById = new Map(objectives.map((o) => [o.id, o.text]));
    return {
      objectiveIds: ids,
      objectiveTexts: ids.map((id) => textById.get(id) ?? "").filter(Boolean),
      teacherName,
      href: revisionSprintHref({ basePath, courseId: course.id, objectiveIds: ids }),
    };
  } catch (err) {
    console.warn("[tutor/quiz-evidence] could not record quiz evidence:", err);
    return null;
  }
}
