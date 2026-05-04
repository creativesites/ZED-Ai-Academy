"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@clerk/nextjs/server";
import { createClient } from "@/lib/supabase/server";
import type { ContentBlockType, Json } from "@/types/database";

async function verifyBlockOwner(
  supabase: Awaited<ReturnType<typeof createClient>>,
  lessonId: string,
  userId: string
) {
  const { data: lesson } = await supabase
    .from("lessons")
    .select("module_id")
    .eq("id", lessonId)
    .single();
  if (!lesson) throw new Error("Lesson not found");

  const { data: mod } = await supabase
    .from("modules")
    .select("course_id")
    .eq("id", lesson.module_id)
    .single() as { data: { course_id: string } | null; error: unknown };
  if (!mod) throw new Error("Module not found");

  const { data: course } = await supabase
    .from("courses")
    .select("instructor_id")
    .eq("id", mod.course_id)
    .single() as { data: { instructor_id: string | null } | null; error: unknown };
  if (!course || course.instructor_id !== userId) throw new Error("Unauthorized");

  return { courseId: mod.course_id };
}

export async function createContentBlock(
  lessonId: string,
  courseId: string,
  type: ContentBlockType,
  content: Json
) {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const supabase = createClient();
  await verifyBlockOwner(supabase, lessonId, userId);

  const { data: existing } = await supabase
    .from("content_blocks")
    .select("position")
    .eq("lesson_id", lessonId)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();

  const position = (existing?.position ?? 0) + 1;

  const { data, error } = await supabase
    .from("content_blocks")
    .insert({ lesson_id: lessonId, type, position, content })
    .select()
    .single();

  if (error) throw new Error(error.message);
  revalidatePath(`/creator/courses/${courseId}/lessons/${lessonId}`);
  return data;
}

export async function updateContentBlock(
  blockId: string,
  lessonId: string,
  courseId: string,
  content: Json
) {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const supabase = createClient();
  await verifyBlockOwner(supabase, lessonId, userId);

  const { error } = await supabase
    .from("content_blocks")
    .update({ content })
    .eq("id", blockId);

  if (error) throw new Error(error.message);
  revalidatePath(`/creator/courses/${courseId}/lessons/${lessonId}`);
}

export async function deleteContentBlock(blockId: string, lessonId: string, courseId: string) {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const supabase = createClient();
  await verifyBlockOwner(supabase, lessonId, userId);

  const { error } = await supabase.from("content_blocks").delete().eq("id", blockId);
  if (error) throw new Error(error.message);
  revalidatePath(`/creator/courses/${courseId}/lessons/${lessonId}`);
}

export async function reorderContentBlocks(
  lessonId: string,
  courseId: string,
  orderedIds: string[]
) {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const supabase = createClient();
  await verifyBlockOwner(supabase, lessonId, userId);

  await Promise.all(
    orderedIds.map((id, index) =>
      supabase.from("content_blocks").update({ position: index + 1 }).eq("id", id)
    )
  );
  revalidatePath(`/creator/courses/${courseId}/lessons/${lessonId}`);
}
