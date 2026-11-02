"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@clerk/nextjs/server";
import { createClient } from "@/lib/supabase/server";
import { requireCourseEditor } from "@/lib/courses/authorize";

export async function createModule(courseId: string, title: string) {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const supabase = createClient();
  // The course's instructor, or a teaching member of its academy.
  await requireCourseEditor(courseId, userId);

  const { data: existing } = await supabase
    .from("modules")
    .select("position")
    .eq("course_id", courseId)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();

  const nextPosition = (existing?.position ?? 0) + 1;

  const { error } = await supabase
    .from("modules")
    .insert({ course_id: courseId, title, position: nextPosition });

  if (error) throw new Error(error.message);
  revalidatePath(`/creator/courses/${courseId}`);
}

export async function updateModule(moduleId: string, courseId: string, title: string) {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const supabase = createClient();
  // The course's instructor, or a teaching member of its academy.
  await requireCourseEditor(courseId, userId);

  const { error } = await supabase
    .from("modules")
    .update({ title })
    .eq("id", moduleId)
    .eq("course_id", courseId);

  if (error) throw new Error(error.message);
  revalidatePath(`/creator/courses/${courseId}`);
}

export async function deleteModule(moduleId: string, courseId: string) {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const supabase = createClient();
  // The course's instructor, or a teaching member of its academy.
  await requireCourseEditor(courseId, userId);

  const { error } = await supabase.from("modules").delete().eq("id", moduleId).eq("course_id", courseId);
  if (error) throw new Error(error.message);
  revalidatePath(`/creator/courses/${courseId}`);
}

export async function reorderModules(courseId: string, orderedIds: string[]) {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const supabase = createClient();
  // The course's instructor, or a teaching member of its academy.
  await requireCourseEditor(courseId, userId);

  await Promise.all(
    orderedIds.map((id, index) =>
      supabase.from("modules").update({ position: index + 1 }).eq("id", id).eq("course_id", courseId)
    )
  );
  revalidatePath(`/creator/courses/${courseId}`);
}
