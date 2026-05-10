import { currentUser } from "@clerk/nextjs/server";
import { createClient } from "@/lib/supabase/server";
import { notFound, redirect } from "next/navigation";
import { LessonPlayerClient } from "@/components/learner/lesson-player-client";
import type { Metadata } from "next";
import type { Discussion } from "@/types/database";

type PageProps = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ lesson?: string }>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  return { title: `Learning — ${slug}` };
}

export default async function LearnPage({ params, searchParams }: PageProps) {
  const { slug } = await params;
  const { lesson: lessonIdParam } = await searchParams;

  const clerkUser = await currentUser();
  if (!clerkUser) redirect("/sign-in");
  const userId = clerkUser.id;

  const supabase = createClient();

  // 1. Get course first (everything else depends on its ID)
  const { data: course } = await supabase
    .from("courses")
    .select("id, title, slug, status, description, category, level, price_type, instructor_id")
    .eq("slug", slug)
    .single();

  if (!course) notFound();

  // 2. Parallelize queries that depend on course.id or userId
  const [
    { data: enrollmentInitial },
    { data: modulesData },
    { data: existingCert },
    { data: bookingsData }
  ] = await Promise.all([
    supabase.from("enrollments").select("id, status").eq("user_id", userId).eq("course_id", course.id).maybeSingle(),
    supabase.from("modules").select("id, title, position, lessons(id, title, position, is_preview)").eq("course_id", course.id).order("position", { ascending: true }),
    supabase.from("certificates").select("id, public_id, issued_at").eq("user_id", userId).eq("course_id", course.id).maybeSingle(),
    supabase.from("live_session_bookings").select("*, zoom_meetings(*)").eq("learner_id", userId).in("status", ["requested", "confirmed", "reschedule_requested", "completed"])
  ]);

  let enrollment = enrollmentInitial;

  // Auto-enroll if free
  if (!enrollment && course.price_type === "free") {
    const email = clerkUser.emailAddresses.find((e) => e.id === clerkUser.primaryEmailAddressId)?.emailAddress;
    await supabase.from("profiles").upsert({
      id: userId,
      full_name: [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(" ") || null,
      email: email,
      avatar_url: clerkUser.imageUrl,
      updated_at: new Date().toISOString(),
    }, { onConflict: "id", ignoreDuplicates: true });

    const { data: newEnrollment } = await supabase
      .from("enrollments")
      .insert({
        user_id: userId,
        course_id: course.id,
        source: "individual_purchase",
        status: "active",
      })
      .select("id, status")
      .single();
    enrollment = newEnrollment;
  }

  if (!modulesData || modulesData.length === 0) notFound();

  // Sort lessons within modules
  const modules = modulesData.map((m: any) => ({
    ...m,
    lessons: [...(m.lessons ?? [])].sort((a, b) => a.position - b.position),
  }));

  // Get all lesson IDs
  const allLessons = modules.flatMap((m) => m.lessons);
  const allLessonIds = allLessons.map((l) => l.id);

  // Determine active lesson
  const activeLessonId = lessonIdParam ?? allLessons[0]?.id;
  if (!activeLessonId) notFound();

  // Security checks
  const requestedLesson = allLessons.find((l) => l.id === activeLessonId);
  const isPreview = !enrollment;
  if (isPreview && !requestedLesson?.is_preview) redirect(`/courses/${slug}`);

  const isPartialEnrollment = enrollment?.status === "pending_payment";
  if (isPartialEnrollment) {
    const firstModuleLessonIds = new Set(modules[0]?.lessons.map((l: any) => l.id) ?? []);
    if (!firstModuleLessonIds.has(activeLessonId)) {
      const firstLesson = modules[0]?.lessons[0];
      if (firstLesson) redirect(`/courses/${slug}/learn?lesson=${firstLesson.id}`);
    }
  }

  // 3. Parallelize queries that depend on activeLessonId or allLessonIds
  const isInstructor = course.instructor_id === userId;

  const [
    { data: blocks },
    { data: quizDataRaw },
    { data: progressData },
    { data: rawDiscussionsData },
    { data: submissionsData }
  ] = await Promise.all([
    supabase.from("content_blocks").select("id, type, position, content").eq("lesson_id", activeLessonId).order("position", { ascending: true }),
    supabase.from("quizzes").select("id, title, pass_threshold, max_attempts, quiz_questions(id, question, options, correct_indices, explanation, position)").eq("lesson_id", activeLessonId).maybeSingle(),
    supabase.from("lesson_progress").select("lesson_id, completed").eq("user_id", userId).in("lesson_id", allLessonIds),
    supabase.from("discussions").select("*").eq("lesson_id", activeLessonId).order("created_at", { ascending: true }),
    supabase.from("practice_exercise_submissions").select("*, practice_exercise_scores(*), practice_exercise_files(*)").eq("user_id", userId).eq("lesson_id", activeLessonId).order("attempt_number", { ascending: false })
  ]);

  // Fetch profiles separately — discussions.user_id has no FK to profiles so the
  // Supabase join syntax fails; a manual lookup avoids the null-data problem.
  const discussionUserIds = [...new Set((rawDiscussionsData ?? []).map((d: any) => d.user_id as string))];
  let profileMap: Record<string, { full_name: string | null; avatar_url: string | null }> = {};
  if (discussionUserIds.length > 0) {
    const { data: profilesData } = await supabase
      .from("profiles")
      .select("id, full_name, avatar_url")
      .in("id", discussionUserIds);
    for (const p of profilesData ?? []) {
      profileMap[(p as any).id] = { full_name: (p as any).full_name, avatar_url: (p as any).avatar_url };
    }
  }

  const quizData = quizDataRaw as any;
  const completedSet = new Set(
    (progressData ?? []).filter((p) => p.completed).map((p) => p.lesson_id)
  );

  const allDone = allLessonIds.length > 0 && allLessonIds.every((id) => completedSet.has(id));

  // Filter visibility in JS — avoids failing if is_public/status columns don't yet exist
  const discussionsData = (isInstructor
    ? rawDiscussionsData
    : (rawDiscussionsData ?? []).filter((d: any) =>
        d.user_id === userId ||
        (d.is_public !== false && (d.status == null || d.status === "approved"))
      ))?.map((d: any) => ({ ...d, profiles: profileMap[d.user_id] ?? null })) as any[];

  return (
    <LessonPlayerClient
      course={{
        id: course.id,
        title: course.title,
        slug: course.slug,
        description: course.description,
        category: course.category,
        level: course.level,
        price_type: course.price_type,
      }}
      modules={modules}
      activeLessonId={activeLessonId}
      blocks={(blocks ?? []) as {
        id: string;
        type: string;
        position: number;
        content: Record<string, unknown>;
      }[]}
      quiz={quizData}
      completedLessonIds={[...completedSet]}
      allDone={allDone}
      existingCertificate={existingCert ?? null}
      discussions={discussionsData ?? []}
      practiceSubmissions={submissionsData ?? []}
      bookings={bookingsData ?? []}
      userId={userId}
      isPreview={isPreview}
      isPartialEnrollment={isPartialEnrollment}
    />
  );
}
