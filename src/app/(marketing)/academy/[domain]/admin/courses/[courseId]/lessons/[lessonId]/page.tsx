import { auth } from "@clerk/nextjs/server";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentTenantAccess, isTeachingRole } from "@/lib/tenants/access";
import { LessonStudioView } from "@/components/creator/lesson-studio-view";

export const metadata = { title: "Lesson Studio — Academy Admin" };

export default async function TenantAdminLessonEditorPage({
  params,
}: {
  params: Promise<{ domain: string; courseId: string; lessonId: string }>;
}) {
  const { domain, courseId, lessonId } = await params;
  const { userId } = await auth();

  if (!userId) {
    redirect(`/sign-in?redirect_url=/academy/${domain}/admin/courses/${courseId}/lessons/${lessonId}`);
  }

  const supabase = createClient();
  const { data: company } = await supabase
    .from("companies")
    .select("id, slug, admin_id")
    .eq("slug", domain)
    .single();

  if (!company) notFound();

  const access = await getCurrentTenantAccess(company.id);
  const isAuthorized = Boolean(
    access?.isSuperAdmin ||
      company.admin_id === userId ||
      isTeachingRole(access?.tenantRole)
  );

  if (!isAuthorized) {
    redirect(`/academy/${company.slug}/classroom`);
  }

  // Strict tenant isolation: course MUST belong to this academy
  const { data: course } = await supabase
    .from("courses")
    .select("id, title")
    .eq("id", courseId)
    .eq("company_id", company.id)
    .single();

  if (!course) notFound();

  return (
    <div className="container max-w-7xl px-4 py-8 md:py-12">
      <LessonStudioView
        courseId={course.id}
        courseTitle={course.title}
        lessonId={lessonId}
        tenantSlug={company.slug}
      />
    </div>
  );
}
