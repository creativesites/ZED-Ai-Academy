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
    <div className="bg-slate-50 min-h-screen py-10">
      <div className="container max-w-7xl">
        <div className="mb-8 flex items-center gap-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white shadow-sm border border-slate-200">
            <Building2 className="h-8 w-8 text-[#062e39]" />
          </div>
          <div>
            <h1 className="text-3xl font-black text-slate-900 tracking-tight">{company.name} Classroom</h1>
            <p className="text-slate-500 font-medium text-sm uppercase tracking-widest mt-1">
              {isAdminOrInstructor ? "Teaching Workspace" : "Student Workspace"}
            </p>
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
