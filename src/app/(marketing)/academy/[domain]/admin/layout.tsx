import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentTenantAccess, isTeachingRole } from "@/lib/tenants/access";

import { TenantAdminNavbar } from "@/components/tenant/admin/Navbar";

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
    redirect(`/sign-in?redirect_url=/academy/${domain}/admin`);
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
  
  // Only Super Admins and Teaching Roles (Company Admin, Teacher) can access the Admin Hub
  if (!access?.isSuperAdmin && !isTeachingRole(access?.tenantRole)) {
    redirect(`/academy/${company.slug}/classroom`); // Redirect students to the student classroom
  }

  return (
    <div className="bg-slate-50 min-h-screen">
      <TenantAdminNavbar slug={company.slug} name={company.name} />
      <main>
        {children}
      </main>
    </div>
  );
}
