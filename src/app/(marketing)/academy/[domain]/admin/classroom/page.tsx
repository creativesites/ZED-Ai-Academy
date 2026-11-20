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
    <div className="bg-slate-50 min-h-screen py-6 md:py-8">
      <div className="container max-w-7xl px-3 sm:px-6">
        <div className="mb-6 flex items-center gap-4 min-w-0">
          <div className="flex h-12 w-12 sm:h-16 sm:w-16 shrink-0 items-center justify-center rounded-2xl bg-white shadow-sm border border-slate-200/80 p-2.5 sm:p-3">
            <Building2 className="h-6 w-6 sm:h-8 sm:w-8 text-[#062e39]" />
          </div>
          <div className="min-w-0">
            <span className="px-2.5 py-0.5 rounded-full bg-[#fd5523]/10 text-[#fd5523] text-[10px] font-black uppercase tracking-wider border border-[#fd5523]/10">
              Management Console
            </span>
            <h1 className="text-xl sm:text-2xl md:text-3xl font-black text-[#062e39] tracking-tight truncate uppercase mt-0.5">
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
