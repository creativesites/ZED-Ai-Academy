import { ZEDAI_TENANT_ID } from "../tenants/constants.ts";

const TEACHING_ROLES = new Set(["company_admin", "teacher", "instructor"]);

export type CourseCreateResolutionInput = {
  userId: string;
  explicitCompanyId?: string | null;
  clerkOrgId?: string | null;
  profileRole?: string | null;
  profileCompanyId?: string | null;
  explicitCompanyAdminId?: string | null;
  clerkOrgAdminId?: string | null;
  memberships: Array<{
    company_id: string;
    role: string;
    status: string;
  }>;
  ownedCompanyIds: string[];
};

export type CourseCreateResolutionResult =
  | { ok: true; companyId: string }
  | { ok: false; error: string };

function hasStaffAccessInCompany(input: {
  userId: string;
  companyId: string;
  profileRole?: string | null;
  companyAdminId?: string | null;
  memberships: CourseCreateResolutionInput["memberships"];
}): boolean {
  if (input.profileRole === "super_admin") return true;
  if (input.companyAdminId && input.companyAdminId === input.userId) return true;
  return input.memberships.some(
    (m) =>
      m.company_id === input.companyId &&
      m.status === "active" &&
      TEACHING_ROLES.has(m.role),
  );
}

/**
 * Resolves and authorizes the target academy (company_id) for course creation.
 * Supports super admins, academy owners (companies.admin_id), active staff in
 * company_members, and platform instructors without an explicit company row.
 */
export function resolveCourseCreateCompany(
  input: CourseCreateResolutionInput,
): CourseCreateResolutionResult {
  const cleanExplicit = input.explicitCompanyId?.trim() || null;
  if (cleanExplicit) {
    const allowed = hasStaffAccessInCompany({
      userId: input.userId,
      companyId: cleanExplicit,
      profileRole: input.profileRole,
      companyAdminId: input.explicitCompanyAdminId,
      memberships: input.memberships,
    });
    if (!allowed) {
      return {
        ok: false,
        error: "You are not authorized to create courses in this academy.",
      };
    }
    return { ok: true, companyId: cleanExplicit };
  }

  const cleanOrgId = input.clerkOrgId?.trim() || null;
  if (
    cleanOrgId &&
    hasStaffAccessInCompany({
      userId: input.userId,
      companyId: cleanOrgId,
      profileRole: input.profileRole,
      companyAdminId: input.clerkOrgAdminId,
      memberships: input.memberships,
    })
  ) {
    return { ok: true, companyId: cleanOrgId };
  }

  const staffMembership = input.memberships.find(
    (m) => m.status === "active" && TEACHING_ROLES.has(m.role),
  );
  if (staffMembership) {
    return { ok: true, companyId: staffMembership.company_id };
  }

  if (input.ownedCompanyIds.length > 0) {
    return { ok: true, companyId: input.ownedCompanyIds[0] };
  }

  if (
    input.profileCompanyId &&
    (input.profileRole === "company_admin" ||
      input.profileRole === "instructor" ||
      input.profileRole === "super_admin")
  ) {
    return { ok: true, companyId: input.profileCompanyId };
  }

  if (input.profileRole === "super_admin" || input.profileRole === "instructor") {
    return { ok: true, companyId: ZEDAI_TENANT_ID };
  }

  return {
    ok: false,
    error: "Select an academy before creating a course.",
  };
}
