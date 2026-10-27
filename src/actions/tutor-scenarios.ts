"use server";

import { auth } from "@clerk/nextjs/server";
import { createServiceClient } from "@/lib/supabase/server";
import {
  scenarioViewFromRow,
  type TutorScenarioRow,
  type TutorScenarioView,
} from "@/lib/tutor/tutor-session-block";

export type TutorScenarioOption = TutorScenarioView & {
  visibility: "course" | "tenant_library" | "platform";
};

const SCENARIO_SELECT =
  "id, title, goal, style, scene, max_minutes, allowed_modes, visibility, company_id, course_id, ai_personas(name, display_name, rive_variant)";

/**
 * Same rule as verifyBlockOwner in actions/content-blocks.ts, at course level: super admin, the
 * instructor, or an active company_admin / teacher / instructor of the course's tenant.
 */
async function assertCourseEditor(courseId: string, userId: string) {
  const db = createServiceClient();

  const { data: course } = await db
    .from("courses")
    .select("instructor_id, company_id")
    .eq("id", courseId)
    .maybeSingle();
  if (!course) throw new Error("Course not found");

  const { data: profile } = await db.from("profiles").select("role").eq("id", userId).maybeSingle();
  if (profile?.role === "super_admin") return { companyId: course.company_id as string | null };
  if (course.instructor_id === userId) return { companyId: course.company_id as string | null };

  if (course.company_id) {
    const { data: member } = await db
      .from("company_members")
      .select("role")
      .eq("company_id", course.company_id)
      .eq("profile_id", userId)
      .eq("status", "active")
      .maybeSingle();
    if (member && ["company_admin", "teacher", "instructor"].includes(member.role)) {
      return { companyId: course.company_id as string | null };
    }
  }

  throw new Error("Unauthorized");
}

/**
 * Published scenarios a teacher can place in this course's tutor_session blocks: this course's own
 * scenarios, the tenant library, and the ZAI platform starter packs.
 */
export async function listTutorScenariosForCourse(courseId: string): Promise<TutorScenarioOption[]> {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const { companyId } = await assertCourseEditor(courseId, userId);
  const db = createServiceClient();

  const queries = [
    db
      .from("practice_scenarios")
      .select(SCENARIO_SELECT)
      .eq("status", "published")
      .eq("visibility", "course")
      .eq("course_id", courseId),
    db
      .from("practice_scenarios")
      .select(SCENARIO_SELECT)
      .eq("status", "published")
      .eq("visibility", "platform"),
    companyId
      ? db
          .from("practice_scenarios")
          .select(SCENARIO_SELECT)
          .eq("status", "published")
          .eq("visibility", "tenant_library")
          .eq("company_id", companyId)
      : null,
  ].filter((q): q is NonNullable<typeof q> => q !== null);

  const results = await Promise.all(queries);
  const seen = new Set<string>();
  const options: TutorScenarioOption[] = [];
  for (const { data, error } of results) {
    if (error) throw new Error(error.message);
    for (const row of (data ?? []) as unknown as (TutorScenarioRow & { visibility: TutorScenarioOption["visibility"] })[]) {
      if (seen.has(row.id)) continue;
      seen.add(row.id);
      options.push({ ...scenarioViewFromRow(row), visibility: row.visibility });
    }
  }
  return options.sort((a, b) => a.title.localeCompare(b.title));
}
