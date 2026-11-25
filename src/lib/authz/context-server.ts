import { createServiceClient } from "@/lib/supabase/server";
import { canManageCourse } from "@/lib/courses/course-auth-server";
import { ZEDAI_TENANT_ID } from "@/lib/tenants/constants";
import {
  canOnTenant,
  isTenantStaffRole,
  tenantRole,
  type TenantAction,
  type TenantFacts,
  type TenantRole,
} from "@/lib/authz/policy";

/**
 * DB glue for the authorisation layer: loads facts with the service client and applies `policy.ts`.
 * Replaces the per-file copies that used to live in tutor-authoring (assertTenantStaff), tutor-scenarios
 * (assertCourseEditor), the insights route (canReadCompanyInsights) and the preview routes (authorizeStaffPreview).
 * The tenant is always derived from the resource when there is one; a client-supplied companyId is only a selector
 * that is checked against the caller's role in that tenant.
 */

export type TenantContext = {
  companyId: string;
  role: TenantRole;
  isSuperAdmin: boolean;
  isStaff: boolean;
};

async function loadTenantFacts(companyId: string, userId: string): Promise<TenantFacts> {
  const db = createServiceClient();
  const [{ data: profile }, { data: company }, { data: member }] = await Promise.all([
    db.from("profiles").select("role").eq("id", userId).maybeSingle(),
    db.from("companies").select("admin_id").eq("id", companyId).maybeSingle(),
    db
      .from("company_members")
      .select("role, status")
      .eq("company_id", companyId)
      .eq("profile_id", userId)
      .maybeSingle(),
  ]);
  return {
    userId,
    profileRole: profile?.role ?? null,
    tenantOwnerId: company?.admin_id ?? null,
    membership: member ? { role: member.role, status: member.status } : null,
  };
}

/** The caller's role in a tenant. */
export async function getTenantContext(companyId: string, userId: string): Promise<TenantContext> {
  const role = companyId && userId ? tenantRole(await loadTenantFacts(companyId, userId)) : "none";
  return { companyId, role, isSuperAdmin: role === "super_admin", isStaff: isTenantStaffRole(role) };
}

/** True when the caller may perform `action` in the tenant. */
export async function canInTenant(action: TenantAction, companyId: string, userId: string): Promise<boolean> {
  if (!companyId || !userId) return false;
  return canOnTenant(action, await loadTenantFacts(companyId, userId));
}

/** Throws `Unauthorized` unless the caller is academy staff (Studio authoring). */
export async function requireTenantStaff(companyId: string, userId: string): Promise<{ isSuperAdmin: boolean }> {
  if (!companyId || !userId) throw new Error("Unauthorized");
  const facts = await loadTenantFacts(companyId, userId);
  if (!canOnTenant("tenant.author", facts)) throw new Error("Unauthorized");
  return { isSuperAdmin: tenantRole(facts) === "super_admin" };
}

/**
 * Throws `Unauthorized` unless the caller may edit the course (course owner, super admin, or staff of the course's
 * tenant). Returns the course's own tenant id (`null` for platform courses).
 */
export async function requireCourseEditor(courseId: string, userId: string): Promise<{ companyId: string | null }> {
  const { allowed, course } = await canManageCourse(createServiceClient(), courseId, userId);
  if (!course) throw new Error("Course not found");
  if (!allowed) throw new Error("Unauthorized");
  return { companyId: course.company_id };
}

/**
 * Who may preview a draft flow. A flow tied to a course is authorised against that course (tenant derived from the
 * course); otherwise the client-named tenant must be one the caller is staff of.
 */
export async function authorizeFlowPreview(
  userId: string,
  flow: { courseId?: string | null; companyId?: string | null },
): Promise<{ allowed: true; companyId: string } | { allowed: false }> {
  if (flow.courseId) {
    const { allowed, course } = await canManageCourse(createServiceClient(), flow.courseId, userId);
    if (!allowed || !course) return { allowed: false };
    return { allowed: true, companyId: course.company_id ?? ZEDAI_TENANT_ID };
  }
  if (flow.companyId && (await canInTenant("tenant.preview", flow.companyId, userId))) {
    return { allowed: true, companyId: flow.companyId };
  }
  return { allowed: false };
}
