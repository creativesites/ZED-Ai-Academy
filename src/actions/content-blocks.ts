"use server";

import { toActionResult } from "@/lib/actions/result";
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

async function createContentBlockImpl(
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

async function createContentBlocksBatchImpl(
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

async function updateContentBlockImpl(
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

async function deleteContentBlockImpl(blockId: string, lessonId: string, courseId: string) {
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

async function reorderContentBlocksImpl(
  lessonId: string,
  courseId: string,
  orderedIds: string[]
) {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const supabase = createClient();
  await verifyBlockOwner(supabase, lessonId, userId);

  const results = await Promise.all(
    orderedIds.map((id, index) =>
      supabase.from("content_blocks").update({ position: index + 1 }).eq("id", id).eq("lesson_id", lessonId)
    )
  );
  const failed = results.find((r) => r.error);
  if (failed?.error) throw new Error(failed.error.message);
  revalidatePath(`/creator/courses/${courseId}/lessons/${lessonId}`);
}

// ── Public actions: return { ok, data | error } so the real error reaches the author. ──
export async function createContentBlock(...args: Parameters<typeof createContentBlockImpl>) {
  return toActionResult("createContentBlock", () => createContentBlockImpl(...args));
}

export async function createContentBlocksBatch(...args: Parameters<typeof createContentBlocksBatchImpl>) {
  return toActionResult("createContentBlocksBatch", () => createContentBlocksBatchImpl(...args));
}

export async function updateContentBlock(...args: Parameters<typeof updateContentBlockImpl>) {
  return toActionResult("updateContentBlock", () => updateContentBlockImpl(...args));
}

export async function deleteContentBlock(...args: Parameters<typeof deleteContentBlockImpl>) {
  return toActionResult("deleteContentBlock", () => deleteContentBlockImpl(...args));
}

export async function reorderContentBlocks(...args: Parameters<typeof reorderContentBlocksImpl>) {
  return toActionResult("reorderContentBlocks", () => reorderContentBlocksImpl(...args));
}
