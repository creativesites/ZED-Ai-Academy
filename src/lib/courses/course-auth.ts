import type { CompanyMemberRole, UserRole } from "@/types/database";
import { canOnCourse } from "../authz/policy.ts";

export type CourseAuthContext = {
  userId: string;
  courseInstructorId: string | null;
  courseCompanyId: string | null;
  profileRole: UserRole | string | null | undefined;
  companyAdminId?: string | null;
  membershipStatus?: "invited" | "active" | "deactivated" | null;
  membershipRole?: CompanyMemberRole | string | null;
};

/**
 * Course authoring/management decision. The rule lives in `src/lib/authz/policy.ts` (`course.manage`); this keeps
 * the course module's existing fact shape. A staff member of Academy A cannot manage courses of Academy B.
 */
export function evaluateCourseManageAccess(ctx: CourseAuthContext): boolean {
  return canOnCourse("course.manage", {
    userId: ctx.userId,
    profileRole: ctx.profileRole,
    courseInstructorId: ctx.courseInstructorId,
    courseCompanyId: ctx.courseCompanyId,
    tenantOwnerId: ctx.companyAdminId ?? null,
    membership: ctx.membershipStatus || ctx.membershipRole
      ? { role: ctx.membershipRole ?? null, status: ctx.membershipStatus ?? null }
      : null,
  });
}
