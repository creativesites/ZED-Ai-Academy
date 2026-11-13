import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { LessonEditorClient } from "@/components/creator/lesson-editor-client";
import { Toaster } from "@/components/ui/sonner";
import { getCourseEditorPath } from "@/lib/courses/course-routes";
import type { ContentBlock, ContentBlockType, Json } from "@/types/database";

export async function LessonStudioView({
  courseId,
  courseTitle,
  lessonId,
  tenantSlug,
}: {
  courseId: string;
  courseTitle: string;
  lessonId: string;
  tenantSlug?: string;
}) {
  const supabase = createClient();

  const { data: lesson } = await supabase
    .from("lessons")
    .select("id, title, is_preview, module_id")
    .eq("id", lessonId)
    .single();

  if (!lesson) notFound();

  const { data: mod } = await supabase
    .from("modules")
    .select("title, course_id")
    .eq("id", lesson.module_id)
    .single();

  if (!mod || mod.course_id !== courseId) notFound();

  const { data: blocks } = await supabase
    .from("content_blocks")
    .select("*")
    .eq("lesson_id", lessonId)
    .order("position", { ascending: true });

  const typedBlocks = (blocks ?? []) as ContentBlock[];

  const { data: quizData } = (await supabase
    .from("quizzes")
    .select(
      "id, title, pass_threshold, max_attempts, quiz_questions(id, question, options, correct_indices, explanation, position)"
    )
    .eq("lesson_id", lessonId)
    .maybeSingle()) as {
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
      <div className="max-w-100 sm:px-6 lg:px-8 space-y-6">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            className="text-slate-500 hover:text-slate-800"
            render={<Link href={getCourseEditorPath(courseId, tenantSlug)} />}
          >
            <ArrowLeft className="h-4 w-4 mr-1 max-w-100" />
            {courseTitle}
          </Button>
        </div>

        <LessonEditorClient
          lesson={{
            id: lesson.id,
            title: lesson.title,
            is_preview: lesson.is_preview,
          }}
          courseId={courseId}
          courseTitle={courseTitle}
          moduleTitle={mod.title}
          initialBlocks={typedBlocks.map((b) => ({
            id: b.id,
            type: b.type as ContentBlockType,
            position: b.position,
            content: b.content as Json,
          }))}
          quiz={quizData}
          tenantSlug={tenantSlug}
        />
      </div>
    </>
  );
}
