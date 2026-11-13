import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentTenantAccess } from "@/lib/tenants/access";
import { canAccessTenantAdmin } from "@/lib/tenants/admin-helpers";

export interface TenantAdminPageContext {
  userId: string;
  supabase: ReturnType<typeof createClient>;
  company: {
    id: string;
    name: string;
    slug: string;
    admin_id: string | null;
    teacher_code: string | null;
    logo_url: string | null;
    primary_color: string | null;
  };
  access: Awaited<ReturnType<typeof getCurrentTenantAccess>>;
}

/**
 * Server-side guard for `/academy/[domain]/admin/**` pages.
 * Ensures consistent authentication, tenant lookup, and role authorization
 * across every admin subpage.
 */
export async function requireTenantAdminPage(
  domain: string,
  options: { adminOnly?: boolean; fallbackRedirect?: string } = {}
): Promise<TenantAdminPageContext> {
  const { userId } = await auth();
  if (!userId) {
    redirect("/sign-in");
  }

  const supabase = createClient();

  const { data: company } = await supabase
    .from("companies")
    .select("id, name, slug, admin_id, teacher_code, logo_url, primary_color")
    .eq("slug", domain)
    .single();

  if (!company) {
    redirect("/dashboard");
  }

  const access = await getCurrentTenantAccess(company.id);

  const authorized = canAccessTenantAdmin({
    userId,
    companyAdminId: company.admin_id,
    isSuperAdmin: access?.isSuperAdmin ?? false,
    tenantRole: access?.tenantRole ?? null,
    adminOnly: options.adminOnly ?? false,
  });

  if (!authorized) {
    const target =
      options.fallbackRedirect ??
      (options.adminOnly
        ? `/academy/${company.slug}/admin`
        : `/academy/${company.slug}/classroom`);
    redirect(target);
  }

  return {
    userId,
    supabase,
    company,
    access,
  };
}
