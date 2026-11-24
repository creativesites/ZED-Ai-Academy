import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ClassroomTabs } from "@/components/classroom/ClassroomTabs";
import { getCurrentTenantAccess, isTeachingRole } from "@/lib/tenants/access";
import { Building2 } from "lucide-react";

export const metadata = {
  title: "Academy Classroom",
};

export default async function TenantClassroomPage({
  params,
  searchParams,
}: {
  params: Promise<{ domain: string }>;
  searchParams: Promise<{ tab?: string; cohort?: string }>;
}) {
  const { domain } = await params;
  const { tab, cohort } = await searchParams;
  const { userId } = await auth();

  if (!userId) {
    redirect(`/sign-in?redirect_url=/academy/${domain}/classroom`);
  }

  const supabase = createClient();
  const { data: company } = await supabase
    .from("companies")
    .select("id, name, slug")
    .eq("slug", domain)
    .single();

  if (!company) {
    redirect("/dashboard");
  }

  const access = await getCurrentTenantAccess(company.id);
  if (!access?.isSuperAdmin && !access?.isMember) {
    redirect(`/academy/${company.slug}`);
  }

  const isAdminOrInstructor = access.isSuperAdmin || isTeachingRole(access.tenantRole);

  return (
    <div className="bg-slate-50 min-h-[100dvh] pt-20 sm:pt-24 pb-24 lg:pb-12">
      <div className="container max-w-7xl px-3 sm:px-6 lg:px-8">
        <div className="mb-4 sm:mb-6 flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex h-10 w-10 sm:h-11 sm:w-11 shrink-0 items-center justify-center rounded-xl bg-white shadow-xs border border-slate-200/80 p-2">
              <Building2 className="h-5 w-5 text-[#062e39]" />
            </div>
            <div className="min-w-0">
              <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-[#fd5523]/10 text-[#fd5523] text-[10px] font-bold uppercase tracking-wider">
                {isAdminOrInstructor ? "Teaching Console" : "Student Classroom"}
              </span>
              <h1 className="text-lg sm:text-2xl font-bold text-[#062e39] tracking-tight truncate mt-0.5">
                {company.name} <span className="text-[#fd5523]">Classroom</span>
              </h1>
            </div>
          </div>
        </div>

        <ClassroomTabs
          companyId={company.id}
          isAdminOrInstructor={isAdminOrInstructor}
          companySlug={company.slug}
          initialTab={tab as any}
          initialCohortId={cohort}
        />
      </div>
    </div>
  );
}
