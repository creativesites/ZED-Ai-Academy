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
    <div className="bg-slate-50 min-h-screen py-8 md:py-12">
      <div className="container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mb-6 sm:mb-10 flex flex-col sm:flex-row items-center sm:items-start gap-4 sm:gap-6 text-center sm:text-left">
          <div className="flex h-14 w-14 sm:h-20 sm:w-20 shrink-0 items-center justify-center rounded-2xl sm:rounded-3xl bg-white shadow-xl border border-slate-100 p-3 sm:p-4">
            <Building2 className="h-7 w-7 sm:h-10 sm:w-10 text-[#062e39]" />
          </div>
          <div className="space-y-1">
            <h1 className="text-2xl sm:text-4xl md:text-5xl font-black text-[#062e39] tracking-tight leading-tight sm:leading-none uppercase break-words">
              {company.name} <span className="text-brand-ink">Admin Hub</span>
            </h1>
            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-3 mt-4">
               <span className="px-4 py-1.5 rounded-full bg-brand/10 text-brand-ink text-[10px] font-black uppercase tracking-[0.2em] border border-brand/10">Management View</span>
            </div>
          </div>
        </div>
        
        <ClassroomTabs 
          companyId={company.id} 
          isAdminOrInstructor={isAdminOrInstructor} 
          companySlug={company.slug}
          initialTab={tab}
        />
      </div>
    </div>
  );
}
