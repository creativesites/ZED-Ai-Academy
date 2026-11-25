"use server";

import { auth } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { assertCanManageCourse, assertCanManageLesson } from "@/lib/courses/course-auth-server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { ZEDAI_TENANT_ID } from "@/lib/tenants/constants";
import { courseTenantId } from "@/lib/authz/refs";
import {
  listCourseObjectives,
  saveLessonObjectives,
  updateObjective,
} from "@/lib/tutor/learner/objectives-server";
import type { RegisteredObjective } from "@/lib/tutor/learner/objectives";

// Objective registry actions (P2-01). Only content authors of the course (assertCanManageCourse) may
// read or change a course's registry; the tenant always comes from the course, never from the client.
// Every action reports `available: false` instead of failing while migration 20261125000200 is pending.

export type CourseObjectivesResult = { available: boolean; objectives: RegisteredObjective[] };

async function authorise(courseId: string, lessonId?: string | null): Promise<{ userId: string; companyId: string }> {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");
  const supabase = createClient();
  const course = await assertCanManageCourse(supabase, courseId, userId);
  if (lessonId) await assertCanManageLesson(supabase, lessonId, userId, courseId);
  return { userId, companyId: courseTenantId(course.company_id, ZEDAI_TENANT_ID) };
}

const objectiveInput = z.object({
  text: z.string().trim().min(3).max(500),
  evidence: z.string().trim().max(600).optional().nullable(),
});

const saveSchema = z.object({
  courseId: z.string().uuid(),
  lessonId: z.string().uuid().nullable().optional(),
  scenarioId: z.string().uuid().nullable().optional(),
  objectives: z.array(objectiveInput).min(1).max(12),
  source: z.enum(["authored", "extracted"]).optional(),
});

export async function listCourseObjectivesAction(courseId: string): Promise<CourseObjectivesResult> {
  const parsed = z.string().uuid().parse(courseId);
  const { companyId } = await authorise(parsed);
  const res = await listCourseObjectives({ courseId: parsed, companyId, includeRetired: true });
  return res.available ? { available: true, objectives: res.value } : { available: false, objectives: [] };
}

/**
 * Persists a lesson's objectives ("accept all" — the author already reviewed them inline) and, when a
 * flow id is given, records that the flow teaches them.
 */
export async function saveLessonObjectivesAction(input: z.input<typeof saveSchema>): Promise<CourseObjectivesResult> {
  const parsed = saveSchema.parse(input);
  const { userId, companyId } = await authorise(parsed.courseId, parsed.lessonId ?? null);

  if (parsed.scenarioId) {
    const { data: scenario } = await createServiceClient()
      .from("practice_scenarios")
      .select("id")
      .eq("id", parsed.scenarioId)
      .eq("company_id", companyId)
      .eq("course_id", parsed.courseId)
      .maybeSingle();
    if (!scenario) throw new Error("Scenario not found");
  }

  const res = await saveLessonObjectives({
    companyId,
    courseId: parsed.courseId,
    lessonId: parsed.lessonId ?? null,
    userId,
    objectives: parsed.objectives,
    source: parsed.source ?? "extracted",
    scenarioId: parsed.scenarioId ?? null,
  });
  if (!res.available) return { available: false, objectives: [] };
  revalidatePath(`/creator/courses/${parsed.courseId}`);
  return { available: true, objectives: res.value };
}

const updateSchema = z.object({
  courseId: z.string().uuid(),
  id: z.string().uuid(),
  text: z.string().trim().min(3).max(500).optional(),
  evidenceCriteria: z.string().trim().max(600).nullable().optional(),
  status: z.enum(["draft", "active", "retired"]).optional(),
});

export async function updateCourseObjectiveAction(
  input: z.input<typeof updateSchema>,
): Promise<{ available: boolean; objective: RegisteredObjective | null }> {
  const parsed = updateSchema.parse(input);
  const { companyId } = await authorise(parsed.courseId);
  const res = await updateObjective({
    id: parsed.id,
    companyId,
    courseId: parsed.courseId,
    text: parsed.text,
    evidenceCriteria: parsed.evidenceCriteria,
    status: parsed.status,
  });
  if (!res.available) return { available: false, objective: null };
  if (!res.value) throw new Error("Objective not found");
  revalidatePath(`/creator/courses/${parsed.courseId}`);
  return { available: true, objective: res.value };
}
