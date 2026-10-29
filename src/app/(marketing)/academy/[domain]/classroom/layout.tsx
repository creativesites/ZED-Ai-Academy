import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentTenantAccess, isTeachingRole } from "@/lib/tenants/access";
import { toPublicTenant } from "@/lib/tenants/public";

import { TenantAdminNavbar } from "@/components/tenant/admin/Navbar";
import { getProfileContext } from "@/actions/profile";
import TenantHomeNavBar from "@/components/tenant/TenantHomeNavBar";  


export default async function TenantClassroomLayout({
  children,
  params,
}: {
  children: React.ReactNode;
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
    .select("*")
    .eq("slug", domain)
    .single();

  if (!company) {
    redirect("/dashboard");
  }

  const access = await getCurrentTenantAccess(company.id);
  const isMember = Boolean(access?.isSuperAdmin || access?.isMember || company.admin_id === userId);
  const tenantRole = access?.tenantRole || (company.admin_id === userId ? "company_admin" : "");
  
  // Students and staff must be members (or platform super admins) to access the classroom
  if (!isMember) {
    redirect(`/academy/${company.slug}`);
  }

  return (
    <div className="bg-slate-50 min-h-screen">
      <TenantHomeNavBar 
        tenant={toPublicTenant(company)}
        template={"modern"} 
        userId={userId || ""} 
        role={tenantRole} 
        isMember={true} 
      />
      <main>
        {children}
      </main>
    </div>
  );
}
