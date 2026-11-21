import { auth } from "@clerk/nextjs/server";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { ClassroomTabs } from "@/components/classroom/ClassroomTabs";
import { Building2 } from "lucide-react";
import { getCurrentTenantAccess, isTeachingRole } from "@/lib/tenants/access";

export const metadata = {
  title: "Admin Classroom",
};

export default async function AdminClassroomPage({
  params,
  searchParams,
}: {
  params: Promise<{ domain: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { domain } = await params;
  const { tab } = await searchParams;
  const { userId } = await auth();

  if (!userId) {
    redirect("/sign-in");
  }

  const supabase = createClient();

  // Get the company
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
    redirect("/dashboard");
  }

  const isAdminOrInstructor = access.isSuperAdmin || isTeachingRole(access.tenantRole);

  return (
    <div className="bg-slate-50 min-h-screen py-5 md:py-7">
      <div className="container max-w-7xl px-3 sm:px-6">
        <div className="mb-5 flex items-center gap-3 min-w-0">
          <div className="flex h-10 w-10 sm:h-11 sm:w-11 shrink-0 items-center justify-center rounded-xl bg-white shadow-xs border border-slate-200/80 p-2">
            <Building2 className="h-5 w-5 text-[#062e39]" />
          </div>
          <div className="min-w-0">
            <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-[#fd5523]/10 text-[#fd5523] text-[10px] font-bold uppercase tracking-wider">
              Management Console
            </span>
            <h1 className="text-lg sm:text-2xl font-bold text-[#062e39] tracking-tight truncate mt-0.5">
              {company.name} <span className="text-[#fd5523]">Classroom</span>
            </h1>
          </div>
        </div>
        
        <ClassroomTabs 
          companyId={company.id} 
          isAdminOrInstructor={isAdminOrInstructor} 
          companySlug={company.slug}
          initialTab={tab as any}
        />
      </div>
    </div>
  );
}
