import { auth } from "@clerk/nextjs/server";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentTenantAccess, isTeachingRole } from "@/lib/tenants/access";
import { NewCourseForm } from "@/components/creator/new-course-form";

export const metadata = {
  title: "New Course — Academy Admin",
};

export default async function TenantAdminNewCoursePage({
  params,
}: {
  params: Promise<{ domain: string }>;
}) {
  const { domain } = await params;
  const { userId } = await auth();

  if (!userId) {
    redirect(`/sign-in?redirect_url=/academy/${domain}/admin/courses/new`);
  }

  const supabase = createClient();
  const { data: company } = await supabase
    .from("companies")
    .select("id, name, slug")
    .eq("slug", domain)
    .single();

  if (!company) notFound();

  const access = await getCurrentTenantAccess(company.id);
  const isAuthorized = access?.isSuperAdmin || isTeachingRole(access?.tenantRole);

  if (!isAuthorized) {
    redirect(`/academy/${company.slug}/classroom`);
  }

  return (
    <div className="container max-w-7xl px-4 py-8 md:py-12">
      <NewCourseForm
        companyId={company.id}
        tenantSlug={company.slug}
        cancelHref={`/academy/${company.slug}/admin/courses`}
      />
    </div>
  );
}