"use server";

import { toActionResult } from "@/lib/actions/result";
import { revalidatePath } from "next/cache";
import { auth } from "@clerk/nextjs/server";
import { createClient } from "@/lib/supabase/server";
import { assertCanManageCourse } from "@/lib/courses/course-auth-server";
import { getCourseEditorPath } from "@/lib/courses/course-routes";

async function createModuleImpl(courseId: string, title: string, tenantSlug?: string) {
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

async function updateModuleImpl(
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

async function deleteModuleImpl(moduleId: string, courseId: string, tenantSlug?: string) {
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

async function reorderModulesImpl(
  courseId: string,
  orderedIds: string[],
  tenantSlug?: string
) {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const supabase = createClient();
  await assertCanManageCourse(supabase, courseId, userId);

  const results = await Promise.all(
    orderedIds.map((id, index) =>
      supabase.from("modules").update({ position: index + 1 }).eq("id", id).eq("course_id", courseId)
    )
  );
  const failed = results.find((r) => r.error);
  if (failed?.error) throw new Error(failed.error.message);
  revalidatePath(getCourseEditorPath(courseId, tenantSlug));
}

// ── Public actions: return { ok, data | error } so the real error reaches the author. ──
export async function createModule(...args: Parameters<typeof createModuleImpl>) {
  return toActionResult("createModule", () => createModuleImpl(...args));
}

export async function updateModule(...args: Parameters<typeof updateModuleImpl>) {
  return toActionResult("updateModule", () => updateModuleImpl(...args));
}

export async function deleteModule(...args: Parameters<typeof deleteModuleImpl>) {
  return toActionResult("deleteModule", () => deleteModuleImpl(...args));
}

export async function reorderModules(...args: Parameters<typeof reorderModulesImpl>) {
  return toActionResult("reorderModules", () => reorderModulesImpl(...args));
}
