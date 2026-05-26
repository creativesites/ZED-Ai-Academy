import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentTenantAccess, isTeachingRole } from "@/lib/tenants/access";

import { TenantAdminNavbar } from "@/components/tenant/admin/Navbar";
import { getProfileContext } from "@/actions/profile";
import TenantHomeNavBar from "@/components/tenant/TenantHomeNavBar";  


export default async function TenantAdminLayout({
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
  
  // Only Super Admins and Teaching Roles (Company Admin, Teacher) can access the Admin Hub
  if (!access?.isSuperAdmin && !isTeachingRole(access?.tenantRole)) {
    redirect(`/academy/${company.slug}/classroom`); // Redirect students to the student classroom
  }

  return (
    <div className="bg-slate-50 min-h-screen">
       <TenantHomeNavBar tenant={company} template={"modern"} userId={userId || ""} role={access?.tenantRole || ""} />
      <main>
        {children}
      </main>
    </div>
  );
}
