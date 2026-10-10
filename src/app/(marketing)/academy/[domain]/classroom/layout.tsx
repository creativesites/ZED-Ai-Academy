import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentTenantAccess } from "@/lib/tenants/access";

import TenantHomeNavBar from "@/components/tenant/TenantHomeNavBar";  


export default async function ClassroomLayout({
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
  
  // The classroom is for every member (students included). Non-members go to
  // the academy's landing page where they can join.
  if (!access?.isSuperAdmin && !access?.isMember) {
    redirect(`/academy/${company.slug}`);
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
