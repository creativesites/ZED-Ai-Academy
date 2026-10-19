import { auth } from "@clerk/nextjs/server";
import { createClient } from "@/lib/supabase/server";
import type { CompanyMemberRole, UserRole } from "@/types/database";

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
 * at all and is in the matching Clerk organization, we fall back to the Clerk role
 * so the academy's own admin is never locked out by a missed webhook:
 *   - Clerk org:admin  → company_admin of THIS academy only
 *   - any other org role → learner
 * Clerk roles never grant platform (super admin) permissions.
 */
export async function getCurrentTenantAccess(companyId: string) {
  const { userId, orgId, orgRole } = await auth();
  if (!userId) return null;

  const supabase = createClient();
  const [{ data: profile }, { data: member }] = await Promise.all([
    supabase.from("profiles").select("role, company_id").eq("id", userId).maybeSingle(),
    supabase
      .from("company_members")
      .select("company_id, profile_id, status, role")
      .eq("company_id", companyId)
      .eq("profile_id", userId)
      .maybeSingle(),
  ]);

  const typedProfile = profile as TenantProfile | null;
  const row = member as TenantMembership | null;

  // A deactivated row is an explicit revocation: do not fall back to Clerk.
  const activeMember = row?.status === "active" ? row : null;
  const clerkFallback: CompanyMemberRole | null =
    !row && orgId === companyId ? (orgRole === "org:admin" ? "company_admin" : "learner") : null;
  const tenantRole = activeMember?.role ?? clerkFallback;

  return {
    userId,
    profile: typedProfile,
    membership: activeMember,
    isSuperAdmin: typedProfile?.role === "super_admin",
    isMember: !!activeMember || !!clerkFallback,
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
  const canTeach =
    access?.isSuperAdmin ||
    access?.tenantRole === "company_admin" ||
    access?.tenantRole === "teacher" ||
    access?.tenantRole === "instructor";

  if (!access || !canTeach) {
    throw new Error("Teacher permissions required.");
  }
  return { ...access, supabase: createClient() };
}

export function isTeachingRole(role: CompanyMemberRole | null | undefined) {
  return role === "company_admin" || role === "teacher" || role === "instructor";
}
