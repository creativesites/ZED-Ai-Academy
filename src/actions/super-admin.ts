"use server";

import { revalidatePath } from "next/cache";
import { requireSuperAdmin } from "@/lib/auth/super-admin";
import { ZEDAI_TENANT_ID } from "@/lib/tenants/constants";
import type { CompanyMemberRole, UserRole } from "@/types/database";

export async function getSuperAdminOverview() {
  const { supabase } = await requireSuperAdmin();

  const [
    { count: totalTenants },
    { count: suspendedTenants },
    { count: totalUsers },
    { count: superAdminsCount },
    { count: totalCourses },
    { count: totalEnrollments },
    { data: recentTenants },
    { data: recentUsers },
  ] = await Promise.all([
    supabase.from("companies").select("*", { head: true, count: "exact" }),
    supabase.from("companies").select("*", { head: true, count: "exact" }).eq("status", "suspended"),
    supabase.from("profiles").select("*", { head: true, count: "exact" }),
    supabase.from("profiles").select("*", { head: true, count: "exact" }).eq("role", "super_admin"),
    supabase.from("courses").select("*", { head: true, count: "exact" }),
    supabase.from("enrollments").select("*", { head: true, count: "exact" }),
    supabase
      .from("companies")
      .select("id, name, slug, status, created_at, admin_id")
      .order("created_at", { ascending: false })
      .limit(5),
    supabase
      .from("profiles")
      .select("id, full_name, email, role, created_at")
      .order("created_at", { ascending: false })
      .limit(6),
  ]);

  return {
    totalTenants: totalTenants ?? 0,
    activeTenants: (totalTenants ?? 0) - (suspendedTenants ?? 0),
    suspendedTenants: suspendedTenants ?? 0,
    totalUsers: totalUsers ?? 0,
    superAdminsCount: superAdminsCount ?? 0,
    totalCourses: totalCourses ?? 0,
    totalEnrollments: totalEnrollments ?? 0,
    recentTenants: recentTenants ?? [],
    recentUsers: recentUsers ?? [],
  };
}

export async function getTenantsList(filters?: { query?: string; status?: "all" | "active" | "suspended" }) {
  const { supabase } = await requireSuperAdmin();

  let query = supabase
    .from("companies")
    .select(`
      id,
      name,
      slug,
      status,
      logo_url,
      primary_color,
      admin_id,
      teacher_code,
      suspended_reason,
      suspended_at,
      created_at
    `)
    .order("created_at", { ascending: false });

  if (filters?.status && filters.status !== "all") {
    query = query.eq("status", filters.status);
  }

  if (filters?.query?.trim()) {
    const q = `%${filters.query.trim()}%`;
    query = query.or(`name.ilike.${q},slug.ilike.${q}`);
  }

  const { data: companies, error } = await query;
  if (error) throw new Error(`Failed to fetch tenants: ${error.message}`);

  const adminIds = (companies ?? []).map((c) => c.admin_id).filter(Boolean) as string[];
  const companyIds = (companies ?? []).map((c) => c.id);

  const [adminsRes, memberCountsRes, courseCountsRes] = await Promise.all([
    adminIds.length > 0
      ? supabase.from("profiles").select("id, full_name, email").in("id", adminIds)
      : Promise.resolve({ data: [] }),
    companyIds.length > 0
      ? supabase.from("company_members").select("company_id")
      : Promise.resolve({ data: [] }),
    companyIds.length > 0
      ? supabase.from("courses").select("company_id")
      : Promise.resolve({ data: [] }),
  ]);

  const adminsMap = new Map((adminsRes.data ?? []).map((a) => [a.id, a]));

  const memberCountsMap = new Map<string, number>();
  (memberCountsRes.data ?? []).forEach((m) => {
    memberCountsMap.set(m.company_id, (memberCountsMap.get(m.company_id) ?? 0) + 1);
  });

  const courseCountsMap = new Map<string, number>();
  (courseCountsRes.data ?? []).forEach((c) => {
    if (c.company_id) {
      courseCountsMap.set(c.company_id, (courseCountsMap.get(c.company_id) ?? 0) + 1);
    }
  });

  return (companies ?? []).map((c) => ({
    ...c,
    admin: c.admin_id ? adminsMap.get(c.admin_id) ?? null : null,
    membersCount: memberCountsMap.get(c.id) ?? 0,
    coursesCount: courseCountsMap.get(c.id) ?? 0,
    isPlatformTenant: c.id === ZEDAI_TENANT_ID,
  }));
}

export async function toggleTenantStatus(
  companyId: string,
  newStatus: "active" | "suspended",
  reason?: string
) {
  const { supabase } = await requireSuperAdmin();

  if (companyId === ZEDAI_TENANT_ID && newStatus === "suspended") {
    throw new Error("Cannot suspend the core platform tenant.");
  }

  const { error } = await supabase
    .from("companies")
    .update({
      status: newStatus,
      suspended_reason: newStatus === "suspended" ? reason || "Suspended by platform administrator." : null,
      suspended_at: newStatus === "suspended" ? new Date().toISOString() : null,
    })
    .eq("id", companyId);

  if (error) throw new Error(`Failed to update tenant status: ${error.message}`);

  revalidatePath("/superadmin");
  revalidatePath("/superadmin/tenants");
  return { success: true };
}

export type UserWithMemberships = {
  id: string;
  full_name: string | null;
  email: string | null;
  role: UserRole;
  onboarding_completed: boolean;
  created_at: string;
  memberships: {
    company_id: string;
    company_name: string;
    company_slug: string;
    role: CompanyMemberRole;
    status: "invited" | "active" | "deactivated";
  }[];
};

export async function getUsersList(filters?: { query?: string; role?: string; tenantId?: string }): Promise<UserWithMemberships[]> {
  const { supabase } = await requireSuperAdmin();

  let query = supabase
    .from("profiles")
    .select("id, full_name, email, role, onboarding_completed, created_at")
    .order("created_at", { ascending: false });

  if (filters?.role && filters.role !== "all") {
    query = query.eq("role", filters.role as UserRole);
  }

  if (filters?.query?.trim()) {
    const q = `%${filters.query.trim()}%`;
    query = query.or(`full_name.ilike.${q},email.ilike.${q},id.ilike.${q}`);
  }

  const { data: profiles, error } = await query;
  if (error) throw new Error(`Failed to fetch users: ${error.message}`);

  const userIds = (profiles ?? []).map((p) => p.id);

  let memberQuery = supabase
    .from("company_members")
    .select("company_id, profile_id, role, status, companies(name, slug)")
    .in("profile_id", userIds);

  if (filters?.tenantId && filters.tenantId !== "all") {
    memberQuery = memberQuery.eq("company_id", filters.tenantId);
  }

  const { data: memberRows } = await memberQuery;

  const membershipMap = new Map<string, UserWithMemberships["memberships"]>();

  (memberRows ?? []).forEach((row: any) => {
    const company = Array.isArray(row.companies) ? row.companies[0] : row.companies;
    const list = membershipMap.get(row.profile_id) ?? [];
    list.push({
      company_id: row.company_id,
      company_name: company?.name ?? "Unknown Academy",
      company_slug: company?.slug ?? "",
      role: row.role as CompanyMemberRole,
      status: row.status,
    });
    membershipMap.set(row.profile_id, list);
  });

  const result = (profiles ?? []).map((p) => ({
    id: p.id,
    full_name: p.full_name,
    email: p.email,
    role: p.role as UserRole,
    onboarding_completed: !!p.onboarding_completed,
    created_at: p.created_at,
    memberships: membershipMap.get(p.id) ?? [],
  }));

  if (filters?.tenantId && filters.tenantId !== "all") {
    return result.filter((u) => u.memberships.some((m) => m.company_id === filters.tenantId));
  }

  return result;
}

export async function updateUserPlatformRole(targetUserId: string, newRole: UserRole) {
  const { userId, supabase } = await requireSuperAdmin();

  if (targetUserId === userId && newRole !== "super_admin") {
    throw new Error("You cannot remove your own super_admin role.");
  }

  const { error } = await supabase
    .from("profiles")
    .update({ role: newRole })
    .eq("id", targetUserId);

  if (error) throw new Error(`Failed to update user role: ${error.message}`);

  revalidatePath("/superadmin");
  revalidatePath("/superadmin/users");
  return { success: true };
}

export async function upsertUserTenantMembership(
  companyId: string,
  profileId: string,
  role: CompanyMemberRole,
  status: "active" | "invited" | "deactivated" = "active"
) {
  const { supabase } = await requireSuperAdmin();

  const { error } = await supabase.from("company_members").upsert(
    {
      company_id: companyId,
      profile_id: profileId,
      role,
      status,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "company_id, profile_id" }
  );

  if (error) throw new Error(`Failed to update membership: ${error.message}`);

  revalidatePath("/superadmin/users");
  revalidatePath("/superadmin/tenants");
  return { success: true };
}

export async function removeUserTenantMembership(companyId: string, profileId: string) {
  const { supabase } = await requireSuperAdmin();

  // Guard: Check if user is the tenant admin
  const { data: company } = await supabase
    .from("companies")
    .select("admin_id, name")
    .eq("id", companyId)
    .single();

  if (company?.admin_id === profileId) {
    throw new Error(`Cannot remove the primary owner of ${company.name}. Reassign ownership first.`);
  }

  const { error } = await supabase
    .from("company_members")
    .delete()
    .eq("company_id", companyId)
    .eq("profile_id", profileId);

  if (error) throw new Error(`Failed to remove membership: ${error.message}`);

  revalidatePath("/superadmin/users");
  revalidatePath("/superadmin/tenants");
  return { success: true };
}

export async function getCoursesOverview(tenantId?: string) {
  const { supabase } = await requireSuperAdmin();

  let query = supabase
    .from("courses")
    .select(`
      id,
      title,
      slug,
      status,
      price_type,
      price_amount,
      category,
      created_at,
      company_id,
      instructor_id,
      companies(id, name, slug),
      profiles(full_name, email)
    `)
    .order("created_at", { ascending: false });

  if (tenantId && tenantId !== "all") {
    query = query.eq("company_id", tenantId);
  }

  const { data: courses, error } = await query;
  if (error) throw new Error(`Failed to load courses: ${error.message}`);

  // Fetch enrollment count per course
  const courseIds = ((courses ?? []) as Array<{ id: string }>).map((c) => c.id);
  const { data: enrollments } = courseIds.length > 0
    ? await supabase.from("enrollments").select("course_id")
    : { data: [] };

  const enrollCountMap = new Map<string, number>();
  (enrollments ?? []).forEach((e) => {
    enrollCountMap.set(e.course_id, (enrollCountMap.get(e.course_id) ?? 0) + 1);
  });

  return (courses ?? []).map((c: any) => {
    const comp = Array.isArray(c.companies) ? c.companies[0] : c.companies;
    const inst = Array.isArray(c.profiles) ? c.profiles[0] : c.profiles;
    return {
      id: c.id,
      title: c.title,
      slug: c.slug,
      status: c.status,
      price_type: c.price_type,
      price_amount: c.price_amount,
      category: c.category,
      created_at: c.created_at,
      company_id: c.company_id,
      company_name: comp?.name ?? "Unknown Academy",
      company_slug: comp?.slug ?? "",
      is_platform: c.company_id === ZEDAI_TENANT_ID,
      instructor_name: inst?.full_name ?? "Instructor",
      instructor_email: inst?.email ?? "",
      enrollments_count: enrollCountMap.get(c.id) ?? 0,
    };
  });
}
