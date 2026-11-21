import { createClient } from "@/lib/supabase/server";
import { evaluateCourseManageAccess } from "./course-auth";

export async function canManageCourse(
  supabase: ReturnType<typeof createClient>,
  courseId: string,
  userId: string
): Promise<{
  allowed: boolean;
  course: { id: string; instructor_id: string | null; company_id: string | null } | null;
}> {
  const { data: course } = await supabase
    .from("courses")
    .select("id, instructor_id, company_id")
    .eq("id", courseId)
    .maybeSingle();

  if (!course) {
    return { allowed: false, course: null };
  }

  const [{ data: profile }, memberResult, companyResult] = await Promise.all([
    supabase.from("profiles").select("role").eq("id", userId).maybeSingle(),
    course.company_id
      ? supabase
          .from("company_members")
          .select("role, status")
          .eq("company_id", course.company_id)
          .eq("profile_id", userId)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    course.company_id
      ? supabase
          .from("companies")
          .select("admin_id")
          .eq("id", course.company_id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  const allowed = evaluateCourseManageAccess({
    userId,
    courseInstructorId: course.instructor_id,
    courseCompanyId: course.company_id,
    profileRole: profile?.role,
    companyAdminId: companyResult.data?.admin_id ?? null,
    membershipStatus: memberResult.data?.status ?? null,
    membershipRole: memberResult.data?.role ?? null,
  });

  return { allowed, course };
}

export async function assertCanManageCourse(
  supabase: ReturnType<typeof createClient>,
  courseId: string,
  userId: string
) {
  const { allowed, course } = await canManageCourse(supabase, courseId, userId);
  if (!course) throw new Error("Course not found.");
  if (!allowed) throw new Error("Unauthorized");
  return course;
}

async function loadLessonModule(supabase: ReturnType<typeof createClient>, lessonId: string) {
  const { data: lesson } = await supabase
    .from("lessons")
    .select("id, module_id, is_preview")
    .eq("id", lessonId)
    .maybeSingle();
  if (!lesson) return { lesson: null, mod: null };
  const { data: mod } = await supabase
    .from("modules")
    .select("id, course_id, position")
    .eq("id", lesson.module_id)
    .maybeSingle();
  return { lesson, mod };
}

/**
 * Resolve a lesson to its course and assert the user may author it.
 * Every lesson-scoped authoring action (blocks, quizzes, lesson meta) must go
 * through this so callers cannot pair an allowed courseId with a foreign lessonId.
 */
export async function assertCanManageLesson(
  supabase: ReturnType<typeof createClient>,
  lessonId: string,
  userId: string,
  expectedCourseId?: string
): Promise<{ courseId: string; moduleId: string }> {
  const { lesson, mod } = await loadLessonModule(supabase, lessonId);
  if (!lesson || !mod?.course_id) throw new Error("Lesson not found.");
  if (expectedCourseId && mod.course_id !== expectedCourseId) throw new Error("Unauthorized");

  await assertCanManageCourse(supabase, mod.course_id, userId);
  return { courseId: mod.course_id, moduleId: lesson.module_id };
}

/** Resolve a quiz to its lesson and assert the user may author it. */
export async function assertCanManageQuiz(
  supabase: ReturnType<typeof createClient>,
  quizId: string,
  userId: string
): Promise<{ courseId: string; lessonId: string }> {
  const { data: quiz } = await supabase.from("quizzes").select("id, lesson_id").eq("id", quizId).maybeSingle();
  if (!quiz?.lesson_id) throw new Error("Quiz not found.");
  const { courseId } = await assertCanManageLesson(supabase, quiz.lesson_id, userId);
  return { courseId, lessonId: quiz.lesson_id };
}

/**
 * Learner-side gate: does this user have access to this lesson's content?
 * Active enrollment → every lesson; pending payment → first module only;
 * course managers → everything; anyone → free-preview lessons of published courses.
 */
export async function getLessonAccess(
  supabase: ReturnType<typeof createClient>,
  lessonId: string,
  userId: string
): Promise<{ allowed: boolean; enrolled: boolean; courseId: string | null }> {
  const { lesson, mod } = await loadLessonModule(supabase, lessonId);
  if (!lesson || !mod) return { allowed: false, enrolled: false, courseId: null };

  const { data: enrollment } = await supabase
    .from("enrollments")
    .select("status")
    .eq("user_id", userId)
    .eq("course_id", mod.course_id)
    .maybeSingle();

  if (enrollment?.status === "active") return { allowed: true, enrolled: true, courseId: mod.course_id };

  if (enrollment?.status === "pending_payment") {
    const { data: firstModule } = await supabase
      .from("modules")
      .select("id")
      .eq("course_id", mod.course_id)
      .order("position", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (firstModule?.id === lesson.module_id) return { allowed: true, enrolled: true, courseId: mod.course_id };
  }

  const { allowed: isManager } = await canManageCourse(supabase, mod.course_id, userId);
  if (isManager) return { allowed: true, enrolled: Boolean(enrollment), courseId: mod.course_id };

  return { allowed: false, enrolled: false, courseId: mod.course_id };
}
