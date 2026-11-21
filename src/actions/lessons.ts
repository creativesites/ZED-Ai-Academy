"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { createClient } from "@/lib/supabase/server";
import { assertCanManageCourse, assertCanManageLesson } from "@/lib/courses/course-auth-server";
import { getCourseEditorPath, getLessonEditorPath } from "@/lib/courses/course-routes";

async function verifyLessonOwner(
  supabase: ReturnType<typeof createClient>,
  moduleId: string,
  userId: string
): Promise<string> {
  const { data } = (await supabase
    .from("modules")
    .select("course_id")
    .eq("id", moduleId)
    .single()) as { data: { course_id: string } | null; error: unknown };

  if (!data?.course_id) throw new Error("Unauthorized");

  await assertCanManageCourse(supabase, data.course_id, userId);
  return data.course_id;
}

export async function createLesson(moduleId: string, title: string, tenantSlug?: string) {
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
  revalidatePath(getCourseEditorPath(courseId, tenantSlug));
  redirect(getLessonEditorPath(courseId, lesson.id, tenantSlug));
}

export async function updateLesson(
  lessonId: string,
  courseId: string,
  data: { title?: string; is_preview?: boolean },
  tenantSlug?: string
) {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const supabase = createClient();
  await assertCanManageLesson(supabase, lessonId, userId, courseId);

  const patch: { title?: string; is_preview?: boolean } = {};
  if (typeof data.title === "string") {
    const title = data.title.trim();
    if (!title) throw new Error("Lesson title cannot be empty.");
    patch.title = title.slice(0, 200);
  }
  if (typeof data.is_preview === "boolean") patch.is_preview = data.is_preview;

  const { error } = await supabase.from("lessons").update(patch).eq("id", lessonId);

  if (error) throw new Error(error.message);
  revalidatePath(getLessonEditorPath(courseId, lessonId, tenantSlug));
}

export async function deleteLesson(lessonId: string, courseId: string, tenantSlug?: string) {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const supabase = createClient();
  await assertCanManageLesson(supabase, lessonId, userId, courseId);

  const { error } = await supabase.from("lessons").delete().eq("id", lessonId);
  if (error) throw new Error(error.message);
  const coursePath = getCourseEditorPath(courseId, tenantSlug);
  revalidatePath(coursePath);
  redirect(coursePath);
}

export async function reorderLessons(
  moduleId: string,
  courseId: string,
  orderedIds: string[],
  tenantSlug?: string
) {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const supabase = createClient();
  await assertCanManageCourse(supabase, courseId, userId);
  const { data: mod } = await supabase
    .from("modules")
    .select("id")
    .eq("id", moduleId)
    .eq("course_id", courseId)
    .maybeSingle();
  if (!mod) throw new Error("Unauthorized");

  await Promise.all(
    orderedIds.map((id, index) =>
      supabase.from("lessons").update({ position: index + 1 }).eq("id", id).eq("module_id", moduleId)
    )
  );
  revalidatePath(getCourseEditorPath(courseId, tenantSlug));
}

/** Create a lesson and stay in the outline (no redirect) — used for rapid outlining. */
export async function addLesson(moduleId: string, title: string, tenantSlug?: string) {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const clean = title.trim().slice(0, 200);
  if (!clean) throw new Error("Lesson title is required.");

  const supabase = createClient();
  const courseId = await verifyLessonOwner(supabase, moduleId, userId);

  const { data: existing } = await supabase
    .from("lessons")
    .select("position")
    .eq("module_id", moduleId)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data: lesson, error } = await supabase
    .from("lessons")
    .insert({ module_id: moduleId, title: clean, position: (existing?.position ?? 0) + 1 })
    .select("id, title, position, is_preview")
    .single();

  if (error) throw new Error(error.message);
  revalidatePath(getCourseEditorPath(courseId, tenantSlug));
  return lesson;
}

/** Copy a lesson with its content blocks and quiz, placed directly after the original. */
export async function duplicateLesson(lessonId: string, courseId: string, tenantSlug?: string) {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const supabase = createClient();
  const { moduleId } = await assertCanManageLesson(supabase, lessonId, userId, courseId);

  const { data: source } = await supabase
    .from("lessons")
    .select("id, title, position, is_preview")
    .eq("id", lessonId)
    .single();
  if (!source) throw new Error("Lesson not found.");

  // Shift later lessons down to make room right after the source.
  const { data: later } = await supabase
    .from("lessons")
    .select("id, position")
    .eq("module_id", moduleId)
    .gt("position", source.position)
    .order("position", { ascending: false });
  for (const row of later ?? []) {
    await supabase.from("lessons").update({ position: row.position + 1 }).eq("id", row.id);
  }

  const { data: copy, error } = await supabase
    .from("lessons")
    .insert({
      module_id: moduleId,
      title: `${source.title} (copy)`.slice(0, 200),
      position: source.position + 1,
      is_preview: false,
    })
    .select("id, title, position, is_preview")
    .single();
  if (error || !copy) throw new Error(error?.message ?? "Could not duplicate lesson.");

  const { data: blocks } = await supabase
    .from("content_blocks")
    .select("type, position, content")
    .eq("lesson_id", lessonId)
    .order("position", { ascending: true });
  if (blocks && blocks.length > 0) {
    await supabase
      .from("content_blocks")
      .insert(blocks.map((b) => ({ lesson_id: copy.id, type: b.type, position: b.position, content: b.content })));
  }

  const { data: quiz } = await supabase
    .from("quizzes")
    .select("id, title, pass_threshold, max_attempts")
    .eq("lesson_id", lessonId)
    .maybeSingle();
  if (quiz) {
    const { data: questionRows } = await supabase
      .from("quiz_questions")
      .select("question, options, correct_indices, explanation, position")
      .eq("quiz_id", quiz.id);
    const { data: newQuiz } = await supabase
      .from("quizzes")
      .insert({
        lesson_id: copy.id,
        title: quiz.title,
        pass_threshold: quiz.pass_threshold,
        max_attempts: quiz.max_attempts,
      })
      .select("id")
      .single();
    const questions = questionRows ?? [];
    if (newQuiz && questions.length > 0) {
      await supabase.from("quiz_questions").insert(questions.map((q) => ({ ...q, quiz_id: newQuiz.id })));
    }
  }

  revalidatePath(getCourseEditorPath(courseId, tenantSlug));
  return { ...copy, content_block_count: blocks?.length ?? 0, has_quiz: Boolean(quiz) };
}
