import { auth } from "@clerk/nextjs/server";
import { createClient } from "@/lib/supabase/server";
import { notFound, redirect } from "next/navigation";
import { canManageCourse } from "@/lib/courses/course-auth-server";
import { CourseStudioView } from "@/components/creator/course-studio-view";
import type { Course } from "@/types/database";

export async function generateMetadata({ params }: { params: Promise<{ courseId: string }> }) {
  const { courseId } = await params;
  const supabase = createClient();
  const { data } = await supabase.from("courses").select("title").eq("id", courseId).maybeSingle();
  return { title: data ? `${data.title} — Course Builder` : "Course Builder" };
}

export default async function CourseDetailPage({
  params,
}: {
  params: Promise<{ courseId: string }>;
}) {
  const { courseId } = await params;
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const supabase = createClient();
  const { allowed } = await canManageCourse(supabase, courseId, userId);
  if (!allowed) notFound();

  const { data: course } = await supabase
    .from("courses")
    .select("*")
    .eq("id", courseId)
    .maybeSingle();

  if (!course) notFound();

  const { data: company } = course.company_id
    ? await supabase.from("companies").select("slug").eq("id", course.company_id).maybeSingle()
    : { data: null };

  return <CourseStudioView course={course as Course} previewTenantSlug={company?.slug} />;
}
