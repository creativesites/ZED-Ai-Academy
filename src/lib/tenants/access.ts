import { auth } from "@clerk/nextjs/server";
import { createClient } from "@/lib/supabase/server";
import { isTeachingRole, resolveTenantRole } from "@/lib/tenants/roles";
import type { CompanyMemberRole, UserRole } from "@/types/database";

export { isTeachingRole };

export type TenantMembership = {
  company_id: string;
  profile_id: string;
  status: "invited" | "active" | "deactivated";
  role: CompanyMemberRole;
};

export type TenantProfile = {
  role: UserRole;
  company_id: string | null;
};

/**
 * Resolve the caller's role in one academy.
 *
 * company_members is the source of truth. When the caller has no membership row
 * at all, the academy owner (companies.admin_id) and the admin of the matching
 * Clerk organization are treated as company_admin of THIS academy only, so a
 * missed webhook never locks the academy's own admin out (see resolveTenantRole).
 * Clerk roles never grant platform (super admin) permissions.
 */
export async function getCurrentTenantAccess(companyId: string) {
  const { userId, orgId, orgRole } = await auth();
  if (!userId) return null;

  const supabase = createClient();
  const [{ data: profile }, { data: member }, { data: company }] = await Promise.all([
    supabase.from("profiles").select("role, company_id").eq("id", userId).maybeSingle(),
    supabase
      .from("company_members")
      .select("company_id, profile_id, status, role")
      .eq("company_id", companyId)
      .eq("profile_id", userId)
      .maybeSingle(),
    supabase.from("companies").select("admin_id").eq("id", companyId).maybeSingle(),
  ]);

  const typedProfile = profile as TenantProfile | null;
  const row = member as TenantMembership | null;
  const tenantRole = resolveTenantRole({
    companyId,
    row,
    isOwner: !!company?.admin_id && company.admin_id === userId,
    orgId,
    orgRole,
  });

  return {
    userId,
    profile: typedProfile,
    membership: row?.status === "active" ? row : null,
    isSuperAdmin: typedProfile?.role === "super_admin",
    isMember: tenantRole !== null,
    tenantRole,
  };
}

export async function requireTenantMember(companyId: string) {
  const access = await getCurrentTenantAccess(companyId);
  if (!access || (!access.isSuperAdmin && !access.isMember)) {
    throw new Error("Tenant membership required.");
  }
  return { ...access, supabase: createClient() };
}

export async function requireTenantAdmin(companyId: string) {
  const access = await getCurrentTenantAccess(companyId);
  const isAdmin = access?.isSuperAdmin || access?.tenantRole === "company_admin";
  if (!access || !isAdmin) {
    throw new Error("Tenant admin permissions required.");
  }
  return { ...access, supabase: createClient() };
}

export async function requireTenantTeacher(companyId: string) {
  const access = await getCurrentTenantAccess(companyId);
  const canTeach = access?.isSuperAdmin || isTeachingRole(access?.tenantRole);

  if (!access || !canTeach) {
    throw new Error("Teacher permissions required.");
  }
  return { ...access, supabase: createClient() };
}
