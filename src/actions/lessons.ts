"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { createClient } from "@/lib/supabase/server";
import { requireCourseEditor } from "@/lib/courses/authorize";

/** Resolve the module's course and require edit rights on it; returns the course id. */
async function verifyLessonOwner(
  supabase: Awaited<ReturnType<typeof createClient>>,
  moduleId: string,
  userId: string
): Promise<string> {
  const { data } = await supabase
    .from("modules")
    .select("course_id")
    .eq("id", moduleId)
    .single() as { data: { course_id: string } | null; error: unknown };

  if (!data?.course_id) throw new Error("Unauthorized");
  await requireCourseEditor(data.course_id, userId);
  return data.course_id;
}

/** Same check, starting from a lesson id. */
async function verifyLessonAccess(
  supabase: Awaited<ReturnType<typeof createClient>>,
  lessonId: string,
  userId: string
): Promise<string> {
  const { data } = await supabase
    .from("lessons")
    .select("module_id")
    .eq("id", lessonId)
    .single() as { data: { module_id: string } | null; error: unknown };

  if (!data?.module_id) throw new Error("Unauthorized");
  return verifyLessonOwner(supabase, data.module_id, userId);
}

export async function createLesson(moduleId: string, title: string) {
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
  revalidatePath(`/creator/courses/${courseId}`);
  redirect(`/creator/courses/${courseId}/lessons/${lesson.id}`);
}

export async function updateLesson(
  lessonId: string,
  courseId: string,
  data: { title?: string; is_preview?: boolean }
) {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const supabase = createClient();
  await verifyLessonAccess(supabase, lessonId, userId);
  const { error } = await supabase.from("lessons").update(data).eq("id", lessonId);

  if (error) throw new Error(error.message);
  revalidatePath(`/creator/courses/${courseId}/lessons/${lessonId}`);
}

export async function deleteLesson(lessonId: string, courseId: string) {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const supabase = createClient();
  await verifyLessonAccess(supabase, lessonId, userId);
  const { error } = await supabase.from("lessons").delete().eq("id", lessonId);
  if (error) throw new Error(error.message);
  revalidatePath(`/creator/courses/${courseId}`);
  redirect(`/creator/courses/${courseId}`);
}

export async function reorderLessons(moduleId: string, courseId: string, orderedIds: string[]) {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const supabase = createClient();
  await verifyLessonOwner(supabase, moduleId, userId);
  await Promise.all(
    orderedIds.map((id, index) =>
      supabase.from("lessons").update({ position: index + 1 }).eq("id", id).eq("module_id", moduleId)
    )
  );
  revalidatePath(`/creator/courses/${courseId}`);
}
