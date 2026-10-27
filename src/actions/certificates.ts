"use server";

import { revalidatePath } from "next/cache";
import { auth, currentUser } from "@clerk/nextjs/server";
import { createClient } from "@/lib/supabase/server";
import { randomUUID } from "crypto";
import { sendCertificateIssued } from "@/lib/email/emailjs";
import { parseTutorSessionBlock } from "@/lib/tutor/tutor-session-block";

type LessonRow = { id: string };
type ProgressRow = { lesson_id: string; completed: boolean };

/**
 * Required tutor_session blocks in the lesson must each have a completed lesson session for their
 * scenario. Blocks whose scenario is not published are skipped, the same rule the lesson player uses.
 */
async function assertRequiredTutorSessionsDone(
  supabase: ReturnType<typeof createClient>,
  lessonId: string,
  userId: string,
) {
  const { data: blocks } = await supabase
    .from("content_blocks")
    .select("content")
    .eq("lesson_id", lessonId)
    .eq("type", "tutor_session");
  const requiredIds = (blocks ?? []).flatMap((b) => {
    const parsed = parseTutorSessionBlock(b.content);
    return parsed?.required ? [parsed.scenarioId] : [];
  });
  if (requiredIds.length === 0) return;

  const { data: published } = await supabase
    .from("practice_scenarios")
    .select("id")
    .in("id", requiredIds)
    .eq("status", "published");
  const gating = (published ?? []).map((r) => r.id);
  if (gating.length === 0) return;

  const { data: done } = await supabase
    .from("tutor_sessions")
    .select("scenario_id")
    .eq("user_id", userId)
    .eq("lesson_id", lessonId)
    .eq("origin", "lesson")
    .eq("status", "completed")
    .in("scenario_id", gating);
  const doneIds = new Set((done ?? []).map((r) => r.scenario_id));
  if (gating.some((id) => !doneIds.has(id))) {
    throw new Error("Finish the required speaking practice before you complete this lesson.");
  }
}

export async function generateCertificate(courseId: string) {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const supabase = createClient();

  const { data: existing } = await supabase
    .from("certificates")
    .select("id, public_id, issued_at")
    .eq("user_id", userId)
    .eq("course_id", courseId)
    .maybeSingle();

  if (existing) return existing;

  const { data: enrollment } = await supabase
    .from("enrollments")
    .select("id")
    .eq("user_id", userId)
    .eq("course_id", courseId)
    .maybeSingle();

  if (!enrollment) {
    // Check if user has administrative or company rights to the course, or auto-enroll
    const { data: courseRow } = await supabase
      .from("courses")
      .select("instructor_id, company_id")
      .eq("id", courseId)
      .single();

    if (courseRow) {
      await supabase.from("enrollments").insert({
        user_id: userId,
        course_id: courseId,
        company_id: courseRow.company_id,
        source: "manual_admin",
        status: "active",
      });
    } else {
      throw new Error("Course not found");
    }
  }

  const { data: modulesData } = await supabase
    .from("modules")
    .select("id")
    .eq("course_id", courseId);

  if (!modulesData || modulesData.length === 0) throw new Error("Course has no modules");

  const moduleIds = modulesData.map((m: { id: string }) => m.id);

  const { data: lessonsData } = await supabase
    .from("lessons")
    .select("id")
    .in("module_id", moduleIds);

  const lessons = lessonsData as LessonRow[] | null;
  if (!lessons || lessons.length === 0) throw new Error("Course has no lessons");

  const lessonIds = lessons.map((l) => l.id);

  const { data: progressData } = await supabase
    .from("lesson_progress")
    .select("lesson_id, completed")
    .eq("user_id", userId)
    .in("lesson_id", lessonIds);

  const progress = progressData as ProgressRow[] | null;
  const completedIds = new Set((progress ?? []).filter((p) => p.completed).map((p) => p.lesson_id));
  const allDone = lessonIds.every((id) => completedIds.has(id));

  if (!allDone) {
    throw new Error("You must complete all lessons before receiving a certificate");
  }

  // Verify that all quizzes in this course have a passing score
  const { data: courseQuizzes } = await supabase
    .from("quizzes")
    .select("id, title")
    .in("lesson_id", lessonIds);

  if (courseQuizzes && courseQuizzes.length > 0) {
    const quizIds = courseQuizzes.map((q) => q.id);
    const { data: passedAttempts } = await supabase
      .from("quiz_attempts")
      .select("quiz_id")
      .eq("user_id", userId)
      .eq("passed", true)
      .in("quiz_id", quizIds);

    const passedQuizIds = new Set((passedAttempts ?? []).map((a) => a.quiz_id));
    const unpassed = courseQuizzes.filter((q) => !passedQuizIds.has(q.id));
    if (unpassed.length > 0) {
      const titles = unpassed.map((q) => q.title || "Knowledge Check").join(", ");
      throw new Error(`You must pass all quizzes before receiving your certificate: ${titles}`);
    }
  }

  const publicId = randomUUID();
  const { data: cert, error } = await supabase
    .from("certificates")
    .insert({
      user_id: userId,
      course_id: courseId,
      public_id: publicId,
      file_url: null,
    })
    .select("id, public_id, issued_at")
    .single();

  if (error) throw new Error(error.message);

  await supabase
    .from("enrollments")
    .update({ completed_at: new Date().toISOString() })
    .eq("user_id", userId)
    .eq("course_id", courseId);

  // Send certificate email (non-blocking)
  const [clerkUser, courseResult] = await Promise.all([
    currentUser(),
    supabase.from("courses").select("title, slug").eq("id", courseId).single(),
  ]);

  const email = clerkUser?.emailAddresses.find(
    (e) => e.id === clerkUser.primaryEmailAddressId
  )?.emailAddress;

  if (email && courseResult.data) {
    const firstName = clerkUser?.firstName ?? clerkUser?.fullName?.split(" ")[0] ?? "there";
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
    sendCertificateIssued({
      toEmail: email,
      toName: firstName,
      courseTitle: courseResult.data.title,
      certUrl: `${appUrl}/certificates/${publicId}`,
    }).catch(console.error);
  }

  revalidatePath("/dashboard");
  revalidatePath(`/courses/${courseId}/learn`);

  return cert;
}

export async function markLessonComplete(lessonId: string, courseSlug: string) {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const supabase = createClient();
  await assertRequiredTutorSessionsDone(supabase, lessonId, userId);

  const { data: existing } = await supabase
    .from("lesson_progress")
    .select("id, completed")
    .eq("user_id", userId)
    .eq("lesson_id", lessonId)
    .single();

  if (existing) {
    await supabase
      .from("lesson_progress")
      .update({ completed: true, completed_at: new Date().toISOString() })
      .eq("id", existing.id);
  } else {
    await supabase.from("lesson_progress").insert({
      user_id: userId,
      lesson_id: lessonId,
      completed: true,
      completed_at: new Date().toISOString(),
    });
  }

  revalidatePath(`/courses/${courseSlug}/learn`);
}
