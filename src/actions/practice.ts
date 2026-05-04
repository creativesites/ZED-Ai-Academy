"use server";

import { auth } from "@clerk/nextjs/server";
import { createClient } from "@/lib/supabase/server";

export async function savePracticeSession({
  lessonId,
  selectedTool,
  inputs,
  output,
}: {
  lessonId: string;
  selectedTool: string;
  inputs: any;
  output: string;
}) {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const supabase = createClient();

  const { error } = await supabase
    .from("practice_sessions")
    .upsert({
      user_id: userId,
      lesson_id: lessonId,
      selected_tool: selectedTool,
      inputs,
      output,
    }, {
      onConflict: "user_id, lesson_id",
    });

  if (error) {
    console.error("Error saving practice session:", error);
    throw new Error("Failed to save work");
  }

  return { success: true };
}

export async function getPracticeSession(lessonId: string) {
  const { userId } = await auth();
  if (!userId) return null;

  const supabase = createClient();

  const { data, error } = await supabase
    .from("practice_sessions")
    .select("*")
    .eq("user_id", userId)
    .eq("lesson_id", lessonId)
    .maybeSingle();

  if (error) {
    console.error("Error fetching practice session:", error);
    return null;
  }

  return data;
}
