"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@clerk/nextjs/server";
import { createClient } from "@/lib/supabase/server";

async function verifyInstructor(supabase: Awaited<ReturnType<typeof createClient>>, courseId: string, userId: string) {
  const { data } = await supabase
    .from("courses")
    .select("id")
    .eq("id", courseId)
    .eq("instructor_id", userId)
    .single();
  if (!data) throw new Error("Unauthorized");
}

export async function createModule(courseId: string, title: string) {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const supabase = createClient();
  await verifyInstructor(supabase, courseId, userId);

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
  await verifyInstructor(supabase, courseId, userId);

  const { error } = await supabase
    .from("modules")
    .update({ title })
    .eq("id", moduleId);

  if (error) throw new Error(error.message);
  revalidatePath(`/creator/courses/${courseId}`);
}

export async function deleteModule(moduleId: string, courseId: string) {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const supabase = createClient();
  await verifyInstructor(supabase, courseId, userId);

  const { error } = await supabase.from("modules").delete().eq("id", moduleId);
  if (error) throw new Error(error.message);
  revalidatePath(`/creator/courses/${courseId}`);
}

export async function reorderModules(courseId: string, orderedIds: string[]) {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const supabase = createClient();
  await verifyInstructor(supabase, courseId, userId);

  await Promise.all(
    orderedIds.map((id, index) =>
      supabase.from("modules").update({ position: index + 1 }).eq("id", id)
    )
  );
  revalidatePath(`/creator/courses/${courseId}`);
}
