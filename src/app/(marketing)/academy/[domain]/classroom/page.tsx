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
}: {
  params: Promise<{ domain: string }>;
}) {
  const { domain } = await params;
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
    <div className="bg-slate-50 min-h-screen py-12 md:py-20">
      <div className="container max-w-7xl px-4">
        <div className="mb-10 flex flex-col sm:flex-row items-center sm:items-start gap-6 text-center sm:text-left">
          <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-3xl bg-white shadow-2xl border border-slate-100 p-4">
            <Building2 className="h-10 w-10 text-[#062e39]" />
          </div>
          <div className="space-y-1">
            <h1 className="text-3xl md:text-5xl font-black text-[#062e39] tracking-tight leading-none uppercase">
              {company.name} <span className="text-[#fd5523]">Classroom</span>
            </h1>
            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-3 mt-4">
               <span className="px-4 py-1.5 rounded-full bg-[#fd5523]/10 text-[#fd5523] text-[10px] font-black uppercase tracking-[0.2em] border border-[#fd5523]/10">
                 {isAdminOrInstructor ? "Teaching Workspace" : "Student Workspace"}
               </span>
            </div>
          </div>
        </div>

        <ClassroomTabs
          companyId={company.id}
          isAdminOrInstructor={isAdminOrInstructor}
          companySlug={company.slug}
        />
      </div>
    </div>
  );
}
