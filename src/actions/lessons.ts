"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { createClient } from "@/lib/supabase/server";

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

  const { data: course } = await supabase
    .from("courses")
    .select("instructor_id")
    .eq("id", data.course_id)
    .single() as { data: { instructor_id: string | null } | null; error: unknown };

  if (course?.instructor_id !== userId) throw new Error("Unauthorized");
  return data.course_id;
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
  const { error } = await supabase.from("lessons").update(data).eq("id", lessonId);

  if (error) throw new Error(error.message);
  revalidatePath(`/creator/courses/${courseId}/lessons/${lessonId}`);
}

export async function deleteLesson(lessonId: string, courseId: string) {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const supabase = createClient();
  const { error } = await supabase.from("lessons").delete().eq("id", lessonId);
  if (error) throw new Error(error.message);
  revalidatePath(`/creator/courses/${courseId}`);
  redirect(`/creator/courses/${courseId}`);
}

export async function reorderLessons(moduleId: string, courseId: string, orderedIds: string[]) {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const supabase = createClient();
  await Promise.all(
    orderedIds.map((id, index) =>
      supabase.from("lessons").update({ position: index + 1 }).eq("id", id)
    )
  );
  revalidatePath(`/creator/courses/${courseId}`);
}
