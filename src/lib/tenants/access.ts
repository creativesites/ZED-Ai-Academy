import { auth } from "@clerk/nextjs/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
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
  const { userId, orgId: activeOrgId, orgRole: activeOrgRole } = await auth();
  if (!userId) return null;

  const supabase = createClient();
  const service = createServiceClient();

  const [{ data: profile }, { data: member }, { data: company }] = await Promise.all([
    supabase.from("profiles").select("role, company_id").eq("id", userId).maybeSingle(),
    service
      .from("company_members")
      .select("company_id, profile_id, status, role")
      .eq("company_id", companyId)
      .eq("profile_id", userId)
      .eq("status", "active")
      .maybeSingle(),
    service
      .from("companies")
      .select("admin_id")
      .eq("id", companyId)
      .maybeSingle(),
  ]);

  const typedProfile = profile as TenantProfile | null;
  const typedMember = member as TenantMembership | null;
  const isOwner = Boolean(company?.admin_id && company.admin_id === userId);
  const clerkMatchesOrg = activeOrgId === companyId;
  const clerkRole = clerkMatchesOrg
    ? ((activeOrgRole?.replace("org:", "") || "learner") as CompanyMemberRole)
    : null;

  const isSuperAdmin =
    typedProfile?.role === "super_admin" ||
    (clerkMatchesOrg && activeOrgRole === "org:admin");

  const effectiveRole: CompanyMemberRole | null =
    typedMember?.role ?? (isOwner ? "company_admin" : clerkRole);

  return {
    userId,
    profile: typedProfile,
    membership: typedMember,
    isOwner,
    isSuperAdmin,
    isMember: Boolean(typedMember || isOwner || clerkMatchesOrg),
    tenantRole: effectiveRole,
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
  const isAdmin =
    access?.isSuperAdmin ||
    access?.isOwner ||
    access?.tenantRole === "company_admin";
  if (!access || !isAdmin) {
    throw new Error("Tenant admin permissions required.");
  }
  return { ...access, supabase: createClient() };
}

export async function requireTenantTeacher(companyId: string) {
  const access = await getCurrentTenantAccess(companyId);
  const canTeach =
    access?.isSuperAdmin ||
    access?.isOwner ||
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
