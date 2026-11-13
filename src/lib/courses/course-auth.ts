import type { CompanyMemberRole, UserRole } from "@/types/database";

export type CourseAuthContext = {
  userId: string;
  courseInstructorId: string | null;
  courseCompanyId: string | null;
  profileRole: UserRole | string | null | undefined;
  companyAdminId?: string | null;
  membershipStatus?: "invited" | "active" | "deactivated" | null;
  membershipRole?: CompanyMemberRole | string | null;
};

const TEACHING_ROLES = new Set(["company_admin", "teacher", "instructor"]);

/**
 * Pure authorization evaluator for course authoring/management operations.
 * Enforces strict tenant isolation: a staff member of Academy A cannot manage
 * courses belonging to Academy B.
 */
export function evaluateCourseManageAccess(ctx: CourseAuthContext): boolean {
  if (!ctx.userId) return false;
  if (ctx.profileRole === "super_admin") return true;
  if (ctx.courseInstructorId && ctx.courseInstructorId === ctx.userId) return true;

  if (ctx.courseCompanyId) {
    if (ctx.companyAdminId && ctx.companyAdminId === ctx.userId) return true;
    if (
      ctx.membershipStatus === "active" &&
      ctx.membershipRole &&
      TEACHING_ROLES.has(ctx.membershipRole)
    ) {
      return true;
    }
  }

  return false;
}
