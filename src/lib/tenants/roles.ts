import type { CompanyMemberRole } from "@/types/database";

export type MembershipRowFacts = {
  status: "invited" | "active" | "deactivated";
  role: CompanyMemberRole;
} | null;

export type TenantRoleFacts = {
  companyId: string;
  /** The caller's company_members row for this academy, if any (any status). */
  row: MembershipRowFacts;
  /** The caller is companies.admin_id (the academy owner). */
  isOwner: boolean;
  /** Clerk's active organization and the caller's role in it. */
  orgId: string | null | undefined;
  orgRole: string | null | undefined;
};

/**
 * Pure role resolution for one academy. company_members is the source of truth.
 *
 * Only when the caller has NO membership row at all do we fall back, so the
 * academy's own admin is never locked out by a missed Clerk webhook:
 *   - the academy owner (companies.admin_id) → company_admin
 *   - Clerk org:admin of THIS academy's org   → company_admin
 *   - any other role in this academy's org    → learner
 * A row that is not active (deactivated / invited) is never overridden.
 * Clerk roles never grant platform (super admin) permissions.
 */
export function resolveTenantRole(facts: TenantRoleFacts): CompanyMemberRole | null {
  if (facts.row) return facts.row.status === "active" ? facts.row.role : null;
  if (facts.isOwner) return "company_admin";
  if (facts.orgId && facts.orgId === facts.companyId) {
    return facts.orgRole === "org:admin" ? "company_admin" : "learner";
  }
  return null;
}

// Higher number = more privileged. Used so a re-join never downgrades a member.
const MEMBER_ROLE_RANK: Record<CompanyMemberRole, number> = {
  learner: 0,
  teacher: 1,
  instructor: 2,
  company_admin: 3,
};

export function higherMemberRole(
  current: CompanyMemberRole | null | undefined,
  requested: CompanyMemberRole
): CompanyMemberRole {
  if (!current) return requested;
  return MEMBER_ROLE_RANK[current] >= MEMBER_ROLE_RANK[requested] ? current : requested;
}

export function isTeachingRole(role: CompanyMemberRole | null | undefined) {
  return role === "company_admin" || role === "teacher" || role === "instructor";
}
