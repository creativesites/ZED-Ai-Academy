import { auth } from "@clerk/nextjs/server";
import { createClient } from "@/lib/supabase/server";
import { notFound, redirect } from "next/navigation";
import { LessonPlayerClient } from "@/components/learner/lesson-player-client";
import type { Metadata } from "next";

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

  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const supabase = createClient();

  // Get course
  const { data: course } = await supabase
    .from("courses")
    .select("id, title, slug, status, description, category, level")
    .eq("slug", slug)
    .single();

  if (!course) notFound();

  // Check enrollment
  const { data: enrollment } = await supabase
    .from("enrollments")
    .select("id, status")
    .eq("user_id", userId)
    .eq("course_id", course.id)
    .single();


  // Get curriculum with content blocks + quiz data
  const { data: modulesData } = await supabase
    .from("modules")
    .select("id, title, position, lessons(id, title, position, is_preview)")
    .eq("course_id", course.id)
    .order("position", { ascending: true }) as {
      data: {
        id: string;
        title: string;
        position: number;
        lessons: { id: string; title: string; position: number; is_preview: boolean }[];
      }[] | null;
      error: unknown;
    };

  if (!modulesData || modulesData.length === 0) notFound();

  // Sort lessons within modules
  const modules = modulesData.map((m) => ({
    ...m,
    lessons: [...(m.lessons ?? [])].sort((a, b) => a.position - b.position),
  }));

  // Get all lesson IDs
  const allLessons = modules.flatMap((m) => m.lessons);
  const allLessonIds = allLessons.map((l) => l.id);

  // Determine active lesson
  const activeLessonId = lessonIdParam ?? allLessons[0]?.id;
  if (!activeLessonId) notFound();

  // Allow unenrolled users to view preview lessons; redirect otherwise
  const requestedLesson = allLessons.find((l) => l.id === activeLessonId);
  const isPreview = !enrollment;
  if (isPreview && !requestedLesson?.is_preview) redirect(`/courses/${slug}`);

  // Partial enrollment: pending_payment users can only access the first module
  const isPartialEnrollment = enrollment?.status === "pending_payment";
  if (isPartialEnrollment) {
    const firstModuleLessonIds = new Set(modules[0]?.lessons.map((l) => l.id) ?? []);
    if (!firstModuleLessonIds.has(activeLessonId)) {
      const firstLesson = modules[0]?.lessons[0];
      if (firstLesson) redirect(`/courses/${slug}/learn?lesson=${firstLesson.id}`);
    }
  }

  // Fetch content blocks for active lesson
  const { data: blocks } = await supabase
    .from("content_blocks")
    .select("id, type, position, content")
    .eq("lesson_id", activeLessonId)
    .order("position", { ascending: true });

  // Fetch quiz for active lesson (if any)
  const { data: quizData } = await supabase
    .from("quizzes")
    .select("id, title, pass_threshold, max_attempts, quiz_questions(id, question, options, correct_indices, explanation, position)")
    .eq("lesson_id", activeLessonId)
    .maybeSingle() as {
      data: {
        id: string;
        title: string | null;
        pass_threshold: number;
        max_attempts: number;
        quiz_questions: {
          id: string;
          question: string;
          options: string[];
          correct_indices: number[];
          explanation: string | null;
          position: number;
        }[];
      } | null;
      error: unknown;
    };

  // Fetch progress for all lessons
  const { data: progressData } = await supabase
    .from("lesson_progress")
    .select("lesson_id, completed")
    .eq("user_id", userId)
    .in("lesson_id", allLessonIds);

  const completedSet = new Set(
    (progressData ?? []).filter((p) => p.completed).map((p) => p.lesson_id)
  );

  // Check if already has certificate
  const { data: existingCert } = await supabase
    .from("certificates")
    .select("id, public_id, issued_at")
    .eq("user_id", userId)
    .eq("course_id", course.id)
    .maybeSingle();

  const allDone = allLessonIds.length > 0 && allLessonIds.every((id) => completedSet.has(id));

  // Fetch discussions for active lesson
  const { data: discussionsData } = await supabase
    .from("discussions")
    .select("*, profiles(full_name, avatar_url)")
    .eq("lesson_id", activeLessonId)
    .order("created_at", { ascending: true }) as {
      data: (import("@/types/database").Discussion & { profiles: { full_name: string | null; avatar_url: string | null } | null })[] | null;
      error: unknown;
    };

  return (
    <LessonPlayerClient
      course={{
        id: course.id,
        title: course.title,
        slug: course.slug,
        description: course.description,
        category: course.category,
        level: course.level,
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
      userId={userId}
      isPreview={isPreview}
      isPartialEnrollment={isPartialEnrollment}
    />
  );
}
