import { auth } from "@clerk/nextjs/server";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentTenantAccess, isTeachingRole } from "@/lib/tenants/access";
import { CourseStudioView } from "@/components/creator/course-studio-view";
import type { Course } from "@/types/database";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ domain: string; courseId: string }>;
}) {
  const { courseId } = await params;
  const supabase = createClient();
  const { data } = await supabase.from("courses").select("title").eq("id", courseId).single();
  return { title: data ? `${data.title} — Course Studio` : "Course Studio" };
}

export default async function TenantAdminCourseDetailPage({
  params,
}: {
  params: Promise<{ domain: string; courseId: string }>;
}) {
  const { domain, courseId } = await params;
  const { userId } = await auth();

  if (!userId) {
    redirect(`/sign-in?redirect_url=/academy/${domain}/admin/courses/${courseId}`);
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
    .select("*")
    .eq("id", courseId)
    .eq("company_id", company.id)
    .single();

  if (!course) notFound();

  return <CourseStudioView course={course as Course} tenantSlug={company.slug} />;
}
