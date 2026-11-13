"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@clerk/nextjs/server";
import { createClient } from "@/lib/supabase/server";
import { assertCanManageCourse } from "@/lib/courses/course-auth-server";
import { getCourseEditorPath } from "@/lib/courses/course-routes";

export async function createModule(courseId: string, title: string, tenantSlug?: string) {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const supabase = createClient();
  await assertCanManageCourse(supabase, courseId, userId);

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
  revalidatePath(getCourseEditorPath(courseId, tenantSlug));
}

export async function updateModule(
  moduleId: string,
  courseId: string,
  title: string,
  tenantSlug?: string
) {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const supabase = createClient();
  await assertCanManageCourse(supabase, courseId, userId);

  const { error } = await supabase
    .from("modules")
    .update({ title })
    .eq("id", moduleId)
    .eq("course_id", courseId);

  if (error) throw new Error(error.message);
  revalidatePath(getCourseEditorPath(courseId, tenantSlug));
}

export async function deleteModule(moduleId: string, courseId: string, tenantSlug?: string) {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const supabase = createClient();
  await assertCanManageCourse(supabase, courseId, userId);

  const { error } = await supabase
    .from("modules")
    .delete()
    .eq("id", moduleId)
    .eq("course_id", courseId);
  if (error) throw new Error(error.message);
  revalidatePath(getCourseEditorPath(courseId, tenantSlug));
}

export async function reorderModules(
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
      supabase.from("modules").update({ position: index + 1 }).eq("id", id).eq("course_id", courseId)
    )
  );
  revalidatePath(getCourseEditorPath(courseId, tenantSlug));
}
