import type { CompanyMemberRole } from "@/types/database";

export interface TenantAdminAccessInput {
  userId: string | null | undefined;
  companyAdminId?: string | null;
  isSuperAdmin?: boolean;
  tenantRole?: CompanyMemberRole | string | null;
  adminOnly?: boolean;
}

/**
 * Pure authorization predicate for Tenant Admin routes.
 * Grants access to super admins, academy owners (`companies.admin_id`),
 * and active teaching staff (`company_admin`, `teacher`, `instructor`),
 * or restricts to owners/company_admins when `adminOnly` is true.
 */
export function canAccessTenantAdmin({
  userId,
  companyAdminId,
  isSuperAdmin = false,
  tenantRole,
  adminOnly = false,
}: TenantAdminAccessInput): boolean {
  if (!userId) return false;
  if (isSuperAdmin) return true;
  if (companyAdminId && companyAdminId === userId) return true;

  if (adminOnly) {
    return tenantRole === "company_admin";
  }

  return (
    tenantRole === "company_admin" ||
    tenantRole === "teacher" ||
    tenantRole === "instructor"
  );
}

/**
 * Converts a JS Date to the 1..7 (Monday..Sunday) day_of_week convention
 * used by `academy_schedules` and `TimetableCalendar`.
 */
export function getDatabaseDayOfWeek(date: Date = new Date()): number {
  const day = date.getDay();
  return day === 0 ? 7 : day;
}

/**
 * Counts scheduled sessions occurring on the given date's weekday.
 */
export function countTodaysSchedules(
  schedules: Array<{ day_of_week?: number | string | null }> | null | undefined,
  date: Date = new Date()
): number {
  if (!schedules || schedules.length === 0) return 0;
  const targetDay = getDatabaseDayOfWeek(date);
  return schedules.filter((s) => Number(s.day_of_week) === targetDay).length;
}
