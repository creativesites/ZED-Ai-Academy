import { auth } from "@clerk/nextjs/server";
import { createClient } from "@/lib/supabase/server";
import { notFound, redirect } from "next/navigation";
import { canManageCourse } from "@/lib/courses/course-auth-server";
import { LessonStudioView } from "@/components/creator/lesson-studio-view";

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
  const { allowed } = await canManageCourse(supabase, courseId, userId);
  if (!allowed) redirect(`/creator/courses/${courseId}`);

  const { data: course } = await supabase
    .from("courses")
    .select("id, title")
    .eq("id", courseId)
    .single();

  if (!course) notFound();

  return <LessonStudioView courseId={course.id} courseTitle={course.title} lessonId={lessonId} />;
}
