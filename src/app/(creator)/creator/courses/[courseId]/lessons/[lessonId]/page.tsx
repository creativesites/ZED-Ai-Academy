import { auth } from "@clerk/nextjs/server";
import { createClient } from "@/lib/supabase/server";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { LessonEditorClient } from "@/components/creator/lesson-editor-client";
import { Toaster } from "@/components/ui/sonner";
import type { ContentBlock, ContentBlockType, Json } from "@/types/database";

export const metadata = { title: "Lesson Editor" };

export default async function LessonEditorPage({
  params,
}: {
  params: Promise<{ courseId: string; lessonId: string }>;
}) {
  const { courseId, lessonId } = await params;
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const supabase = createClient();

  const { data: lesson } = await supabase
    .from("lessons")
    .select("id, title, is_preview, module_id")
    .eq("id", lessonId)
    .single();

  if (!lesson) notFound();

  // Verify ownership via module → course
  const { data: mod } = await supabase
    .from("modules")
    .select("course_id")
    .eq("id", lesson.module_id)
    .single();

  if (!mod || mod.course_id !== courseId) notFound();

  const { data: course } = await supabase
    .from("courses")
    .select("title, instructor_id")
    .eq("id", courseId)
    .single();

  if (!course || course.instructor_id !== userId) redirect("/creator/courses");

  const { data: blocks } = await supabase
    .from("content_blocks")
    .select("*")
    .eq("lesson_id", lessonId)
    .order("position", { ascending: true });

  const typedBlocks = (blocks ?? []) as ContentBlock[];

  // Fetch quiz for this lesson if any
  const { data: quizData } = await supabase
    .from("quizzes")
    .select("id, title, pass_threshold, max_attempts, quiz_questions(id, question, options, correct_indices, explanation, position)")
    .eq("lesson_id", lessonId)
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

  return (
    <>
      <Toaster />
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            className="text-slate-500 hover:text-slate-800"
            render={<Link href={`/creator/courses/${courseId}`} />}
          >
            <ArrowLeft className="h-4 w-4 mr-1" />
            {course.title}
          </Button>
        </div>

        <LessonEditorClient
          lesson={{
            id: lesson.id,
            title: lesson.title,
            is_preview: lesson.is_preview,
          }}
          courseId={courseId}
          initialBlocks={typedBlocks.map((b) => ({
            id: b.id,
            type: b.type as ContentBlockType,
            position: b.position,
            content: b.content as Json,
          }))}
          quiz={quizData}
        />
      </div>
    </>
  );
}
