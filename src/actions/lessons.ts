"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { createClient } from "@/lib/supabase/server";
import { assertCanManageCourse } from "@/lib/courses/course-auth-server";
import { getCourseEditorPath, getLessonEditorPath } from "@/lib/courses/course-routes";

async function verifyLessonOwner(
  supabase: ReturnType<typeof createClient>,
  moduleId: string,
  userId: string
): Promise<string> {
  const { data } = (await supabase
    .from("modules")
    .select("course_id")
    .eq("id", moduleId)
    .single()) as { data: { course_id: string } | null; error: unknown };

  if (!data?.course_id) throw new Error("Unauthorized");

  await assertCanManageCourse(supabase, data.course_id, userId);
  return data.course_id;
}

export async function createLesson(moduleId: string, title: string, tenantSlug?: string) {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const supabase = createClient();
  const courseId = await verifyLessonOwner(supabase, moduleId, userId);

  const { data: existing } = await supabase
    .from("lessons")
    .select("position")
    .eq("module_id", moduleId)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();

  const nextPosition = (existing?.position ?? 0) + 1;

  const { data: lesson, error } = await supabase
    .from("lessons")
    .insert({ module_id: moduleId, title, position: nextPosition })
    .select("id")
    .single();

  if (error) throw new Error(error.message);
  revalidatePath(getCourseEditorPath(courseId, tenantSlug));
  redirect(getLessonEditorPath(courseId, lesson.id, tenantSlug));
}

export async function updateLesson(
  lessonId: string,
  courseId: string,
  data: { title?: string; is_preview?: boolean },
  tenantSlug?: string
) {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const supabase = createClient();
  await assertCanManageCourse(supabase, courseId, userId);

  const { error } = await supabase.from("lessons").update(data).eq("id", lessonId);

  if (error) throw new Error(error.message);
  revalidatePath(getLessonEditorPath(courseId, lessonId, tenantSlug));
}

export async function deleteLesson(lessonId: string, courseId: string, tenantSlug?: string) {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const supabase = createClient();
  await assertCanManageCourse(supabase, courseId, userId);

  const { error } = await supabase.from("lessons").delete().eq("id", lessonId);
  if (error) throw new Error(error.message);
  const coursePath = getCourseEditorPath(courseId, tenantSlug);
  revalidatePath(coursePath);
  redirect(coursePath);
}

export async function reorderLessons(
  moduleId: string,
  courseId: string,
  orderedIds: string[],
  tenantSlug?: string
) {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const supabase = createClient();
  await assertCanManageCourse(supabase, courseId, userId);

  await Promise.all(
    orderedIds.map((id, index) =>
      supabase.from("lessons").update({ position: index + 1 }).eq("id", id).eq("module_id", moduleId)
    )
  );
  revalidatePath(getCourseEditorPath(courseId, tenantSlug));
}
