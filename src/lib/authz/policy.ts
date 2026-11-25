/**
 * Authorisation policy: who may do what, as a pure role × action decision table.
 *
 * Server code uses the Supabase service role, so these rules are the only thing standing between a caller and
 * another academy's data. The facts (profile role, tenant owner, membership, course instructor) are loaded by
 * `context-server.ts`; the decision is made here so it can be unit-tested without a database.
 *
 * D-13 (Studio permissions) is still an open owner question. Until it is decided this module encodes TODAY'S
 * behaviour, which is the conservative option:
 * - a course owner (the course's instructor) may manage and preview their own course, including its flows;
 * - tenant staff (academy owner, company_admin, teacher, instructor with an active membership) keep their current
 *   tenant-wide powers: Studio authoring, tenant previews and insights;
 * - platform super admins may do everything;
 * - learners, invited or deactivated members, and outsiders may do nothing here.
 * Changing D-13 later means editing the tables below (and their tests), not the call sites.
 */

/** Membership roles that count as academy staff. */
export const STAFF_MEMBER_ROLES = ["company_admin", "teacher", "instructor"] as const;

/** A caller's effective role in one tenant. Ordered from most to least powerful. */
export type TenantRole = "super_admin" | "owner" | "company_admin" | "teacher" | "instructor" | "member" | "none";

/** A caller's effective role on one course. */
export type CourseRole = TenantRole | "course_owner";

export type TenantFacts = {
  userId: string;
  /** `profiles.role` of the caller. */
  profileRole: string | null | undefined;
  /** `companies.admin_id` of the tenant (the academy owner), when known. */
  tenantOwnerId?: string | null;
  /** The caller's `company_members` row for this tenant, if any. */
  membership?: { role: string | null | undefined; status: string | null | undefined } | null;
};

export type CourseFacts = TenantFacts & {
  courseInstructorId: string | null | undefined;
  /** `courses.company_id`; `null` for platform courses. Tenant facts only count when this is set. */
  courseCompanyId: string | null | undefined;
};

/** Actions authorised against a tenant (academy). */
export type TenantAction =
  /** Studio: flows, personas, tutor settings, groups, assignments, objectives of the academy. */
  | "tenant.author"
  /** Preview a draft flow that is not tied to a course. */
  | "tenant.preview"
  /** Read the academy's tutor insights. */
  | "tenant.insights.read";

/** Actions authorised against one course. */
export type CourseAction =
  /** Edit the course, its lessons, blocks, quizzes and its flows; preview them. */
  "course.manage";

const TENANT_STAFF: readonly TenantRole[] = ["super_admin", "owner", "company_admin", "teacher", "instructor"];

/** Role × action table for tenant actions. A role not listed is denied. */
export const TENANT_POLICY: Readonly<Record<TenantAction, readonly TenantRole[]>> = {
  "tenant.author": TENANT_STAFF,
  "tenant.preview": TENANT_STAFF,
  "tenant.insights.read": TENANT_STAFF,
};

/** Role × action table for course actions. A role not listed is denied. */
export const COURSE_POLICY: Readonly<Record<CourseAction, readonly CourseRole[]>> = {
  "course.manage": ["super_admin", "course_owner", ...TENANT_STAFF],
};

function isStaffMemberRole(role: string | null | undefined): boolean {
  return !!role && (STAFF_MEMBER_ROLES as readonly string[]).includes(role);
}

/** The caller's effective role in the tenant the facts were loaded for. */
export function tenantRole(facts: TenantFacts): TenantRole {
  if (!facts.userId) return "none";
  if (facts.profileRole === "super_admin") return "super_admin";
  if (facts.tenantOwnerId && facts.tenantOwnerId === facts.userId) return "owner";
  const membership = facts.membership;
  if (membership?.status !== "active") return "none";
  if (isStaffMemberRole(membership.role)) return membership.role as TenantRole;
  return "member";
}

/** True for roles with academy-staff powers (super admin, owner, active staff). */
export function isTenantStaffRole(role: TenantRole): boolean {
  return TENANT_STAFF.includes(role);
}

/** The caller's effective role on a course. Tenant membership only counts for courses that belong to a tenant. */
export function courseRole(facts: CourseFacts): CourseRole {
  if (!facts.userId) return "none";
  if (facts.profileRole === "super_admin") return "super_admin";
  if (facts.courseInstructorId && facts.courseInstructorId === facts.userId) return "course_owner";
  if (!facts.courseCompanyId) return "none";
  return tenantRole(facts);
}

export function canOnTenant(action: TenantAction, facts: TenantFacts): boolean {
  return TENANT_POLICY[action].includes(tenantRole(facts));
}

export function canOnCourse(action: CourseAction, facts: CourseFacts): boolean {
  return COURSE_POLICY[action].includes(courseRole(facts));
}
