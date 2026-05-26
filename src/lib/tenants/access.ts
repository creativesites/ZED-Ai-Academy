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

export async function getCurrentTenantAccess(companyId: string) {
  const { userId, orgId: activeOrgId, orgRole: activeOrgRole, orgSlug: activeOrgSlug } = await auth();
  if (!userId) return null;

  // If the requested company matches the active Clerk organization, use Clerk data as source of truth
  if (activeOrgId === companyId) {
    return {
      userId,
      profile: null, // We are bypassing profile fetch for performance as requested
      membership: {
        company_id: activeOrgId,
        profile_id: userId,
        status: "active",
        role: (activeOrgRole?.replace("org:", "") || "learner") as CompanyMemberRole,
      } as TenantMembership,
      isSuperAdmin: activeOrgRole === "org:admin", // Simplified, may need global check
      isMember: true,
      tenantRole: (activeOrgRole?.replace("org:", "") || "learner") as CompanyMemberRole,
    };
  }

  const supabase = createClient();
  const [{ data: profile }, { data: member }] = await Promise.all([
    supabase.from("profiles").select("role, company_id").eq("id", userId).maybeSingle(),
    supabase
      .from("company_members")
      .select("company_id, profile_id, status, role")
      .eq("company_id", companyId)
      .eq("profile_id", userId)
      .eq("status", "active")
      .maybeSingle(),
  ]);

  const typedProfile = profile as TenantProfile | null;
  const typedMember = member as TenantMembership | null;

  return {
    userId,
    profile: typedProfile,
    membership: typedMember,
    isSuperAdmin: typedProfile?.role === "super_admin",
    isMember: !!typedMember,
    tenantRole: typedMember?.role ?? null,
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
