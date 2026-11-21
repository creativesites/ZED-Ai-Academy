"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@clerk/nextjs/server";
import { createClient } from "@/lib/supabase/server";
import type { ContentBlockType, Json } from "@/types/database";
import { assertCanManageLesson } from "@/lib/courses/course-auth-server";

async function verifyBlockOwner(
  supabase: ReturnType<typeof createClient>,
  lessonId: string,
  userId: string
) {
  const { courseId } = await assertCanManageLesson(supabase, lessonId, userId);
  return { courseId };
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

export async function createContentBlocksBatch(
  lessonId: string,
  courseId: string,
  blocks: { type: ContentBlockType; content: Json }[]
) {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  if (!blocks || blocks.length === 0) return [];

  const supabase = createClient();
  await verifyBlockOwner(supabase, lessonId, userId);

  const { data: existing } = await supabase
    .from("content_blocks")
    .select("position")
    .eq("lesson_id", lessonId)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();

  const startPosition = (existing?.position ?? 0) + 1;

  const rowsToInsert = blocks.map((b, index) => ({
    lesson_id: lessonId,
    type: b.type,
    position: startPosition + index,
    content: b.content,
  }));

  const { data, error } = await supabase
    .from("content_blocks")
    .insert(rowsToInsert)
    .select();

  if (error) throw new Error(error.message);
  revalidatePath(`/creator/courses/${courseId}/lessons/${lessonId}`);
  return data ?? [];
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
    .eq("id", blockId)
    .eq("lesson_id", lessonId);

  if (error) throw new Error(error.message);
  revalidatePath(`/creator/courses/${courseId}/lessons/${lessonId}`);
}

export async function deleteContentBlock(blockId: string, lessonId: string, courseId: string) {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const supabase = createClient();
  await verifyBlockOwner(supabase, lessonId, userId);

  const { data: block } = await supabase
    .from("content_blocks")
    .select("type")
    .eq("id", blockId)
    .eq("lesson_id", lessonId)
    .maybeSingle();

  const { error } = await supabase.from("content_blocks").delete().eq("id", blockId).eq("lesson_id", lessonId);
  if (error) throw new Error(error.message);

  // A lesson's quiz lives in its own table; removing the quiz block must remove the quiz too,
  // otherwise learners still see (and are graded on) a quiz the author deleted.
  if (block?.type === "quiz") {
    const { count } = await supabase
      .from("content_blocks")
      .select("id", { count: "exact", head: true })
      .eq("lesson_id", lessonId)
      .eq("type", "quiz");
    if (!count) await supabase.from("quizzes").delete().eq("lesson_id", lessonId);
  }
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
      supabase.from("content_blocks").update({ position: index + 1 }).eq("id", id).eq("lesson_id", lessonId)
    )
  );
  revalidatePath(`/creator/courses/${courseId}/lessons/${lessonId}`);
}
