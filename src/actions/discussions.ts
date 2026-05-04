"use server";

import { auth } from "@clerk/nextjs/server";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function postDiscussion(courseId: string, lessonId: string, content: string, parentId?: string) {
  const { userId } = await auth();
  if (!userId) throw new Error("Sign in to post.");

  const trimmed = content.trim();
  if (!trimmed) throw new Error("Message cannot be empty.");
  if (trimmed.length > 2000) throw new Error("Message too long (max 2000 chars).");

  const supabase = createClient();
  const { error } = await supabase.from("discussions").insert({
    course_id: courseId,
    lesson_id: lessonId,
    user_id: userId,
    parent_id: parentId ?? null,
    content: trimmed,
  });

  if (error) throw new Error(error.message);
  revalidatePath(`/courses/${courseId}/learn`);
}

export async function deleteDiscussion(id: string, courseId: string) {
  const { userId } = await auth();
  if (!userId) throw new Error("Not authenticated.");

  const supabase = createClient();
  await supabase.from("discussions").delete().eq("id", id).eq("user_id", userId);
  revalidatePath(`/courses/${courseId}/learn`);
}
