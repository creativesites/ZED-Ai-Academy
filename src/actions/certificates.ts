"use server";

import { revalidatePath } from "next/cache";
import { auth, currentUser } from "@clerk/nextjs/server";
import { createClient } from "@/lib/supabase/server";
import { randomUUID } from "crypto";
import { sendCertificateIssued } from "@/lib/email/emailjs";
import { pendingRequiredTutorScenarios } from "@/lib/tutor/server/required-tutor-blocks";
import { getCourseVivaStatus, recordVivaCertificateIssued } from "@/lib/tutor/server/viva";
import { REQUIRED_TUTOR_HINT } from "@/lib/tutor/tutor-session-block";
import { getLessonAccess } from "@/lib/courses/course-auth-server";
import { BRAND } from "@/lib/brand";

type LessonRow = { id: string };
type ProgressRow = { lesson_id: string; completed: boolean };

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

  // Certificates are only for learners with a fully paid, active enrollment.
  // (Never create an enrollment here — that would let anyone unlock a paid course.)
  const { data: enrollment } = await supabase
    .from("enrollments")
    .select("id, status")
    .eq("user_id", userId)
    .eq("course_id", courseId)
    .maybeSingle();

  if (!enrollment || enrollment.status !== "active") {
    throw new Error("An active enrollment is required to receive a certificate.");
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

  // Per-course oral check gate (P2-08): issuance requires a pass or a staff approval. Courses that never
  // required a viva are not blocked; a required viva never passes because of missing config or tables.
  const vivaStatus = await getCourseVivaStatus(courseId, userId);
  if (vivaStatus.state !== "not_required" && !vivaStatus.passed) {
    throw new Error(
      vivaStatus.reason ?? "You must pass the oral check before receiving your certificate.",
    );
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

  await recordVivaCertificateIssued({ courseId, userId, status: vivaStatus }).catch(() => undefined);

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
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || BRAND.url;
    sendCertificateIssued({
      toEmail: email,
      toName: firstName,
      courseTitle: courseResult.data.title,
      certUrl: `${appUrl}/certificates/${publicId}`,
    }).catch(console.error);
  }

  revalidatePath("/dashboard");
  if (courseResult.data?.slug) revalidatePath(`/courses/${courseResult.data.slug}/learn`);

  return cert;
}

export async function markLessonComplete(lessonId: string, courseSlug: string) {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const supabase = createClient();
  const access = await getLessonAccess(supabase, lessonId, userId);
  if (!access.allowed) throw new Error("Enrol in this course to track your progress.");

  if ((await pendingRequiredTutorScenarios(supabase, lessonId, userId)).length > 0) {
    throw new Error(REQUIRED_TUTOR_HINT);
  }

  const { data: existing } = await supabase
    .from("lesson_progress")
    .select("id, completed")
    .eq("user_id", userId)
    .eq("lesson_id", lessonId)
    .maybeSingle();

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
