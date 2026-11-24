"use server";

import { auth, currentUser, clerkClient } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createServiceClient } from "@/lib/supabase/server";
import type { CompanyMemberRole, UserRole } from "@/types/database";

type JoinTenantRole = "student" | "learner" | "teacher";

function normalizeJoinRole(role: JoinTenantRole): CompanyMemberRole {
  return role === "teacher" ? "teacher" : "learner";
}

function profileRoleForJoin(currentRole: UserRole | null | undefined, membershipRole: CompanyMemberRole): UserRole {
  if (currentRole === "super_admin" || currentRole === "company_admin" || currentRole === "instructor") {
    return currentRole;
  }
  if (membershipRole === "teacher") return "teacher";
  return currentRole ?? "learner";
}

/**
 * Server action to join a tenant from the public landing page.
 * If signed out, redirects to sign-up with tenant context.
 */
export async function joinTenantBySlug(formData: FormData) {
  const slug = String(formData.get("tenantSlug") ?? "");
  const requestedRole = String(formData.get("role") ?? "student") as JoinTenantRole;
  const next = String(formData.get("next") ?? "");

  const { userId } = await auth();
  
  if (!userId) {
    const params = new URLSearchParams({
      role: requestedRole === "teacher" ? "teacher" : "student",
      tenant: slug,
    });
    redirect(`/sign-up?${params.toString()}`);
  }

  const supabase = createServiceClient();
  const { data: company } = await supabase
    .from("companies")
    .select("id, slug")
    .eq("slug", slug)
    .maybeSingle();

  if (!company) {
    throw new Error("Academy not found.");
  }

  await ensureTenantMembership(userId, company.id, normalizeJoinRole(requestedRole));

  revalidatePath(`/academy/${company.slug}`);
  revalidatePath("/dashboard");
  
  // If they are a learner, go to the academy classroom. 
  // If teacher, they'll also likely want the classroom/dashboard.
  redirect(next || `/academy/${company.slug}/classroom`);
}

const TENANT_ROLE_RANK: Record<CompanyMemberRole, number> = {
  learner: 1,
  teacher: 2,
  instructor: 2,
  company_admin: 3,
};

function preserveHigherTenantRole(
  existingRole: CompanyMemberRole | null | undefined,
  requestedRole: CompanyMemberRole,
  isOwner: boolean
): CompanyMemberRole {
  if (isOwner) return "company_admin";
  if (!existingRole) return requestedRole;
  const existingRank = TENANT_ROLE_RANK[existingRole] ?? 0;
  const requestedRank = TENANT_ROLE_RANK[requestedRole] ?? 0;
  return existingRank >= requestedRank ? existingRole : requestedRole;
}

/**
 * Core utility to ensure a profile and membership exist for a specific tenant.
 * Never downgrades existing high-level roles (company_admin / teacher / instructor)
 * or the academy owner (`companies.admin_id`).
 */
export async function ensureTenantMembership(
  userId: string,
  companyId: string,
  role: CompanyMemberRole = "learner"
) {
  const supabase = createServiceClient();
  let clerkUser: any = null;
  try {
    clerkUser = await currentUser();
  } catch {
    // Webhooks or background tasks don't have request auth context
  }

  if (!clerkUser) {
    try {
      const client = await clerkClient();
      clerkUser = await client.users.getUser(userId);
    } catch (e) {
      console.warn("[ensureTenantMembership] Could not fetch clerk user directly:", e);
    }
  }

  const email = clerkUser?.emailAddresses?.find((e: any) => e.id === clerkUser.primaryEmailAddressId)?.emailAddress 
    ?? clerkUser?.emailAddresses?.[0]?.emailAddress 
    ?? null;
  const fullName = [clerkUser?.firstName, clerkUser?.lastName].filter(Boolean).join(" ") || clerkUser?.fullName || null;

  const [{ data: existingProfile }, { data: existingMember }, { data: companyRow }] = await Promise.all([
    supabase
      .from("profiles")
      .select("role, company_id")
      .eq("id", userId)
      .maybeSingle(),
    supabase
      .from("company_members")
      .select("role, joined_at")
      .eq("company_id", companyId)
      .eq("profile_id", userId)
      .maybeSingle(),
    supabase
      .from("companies")
      .select("admin_id")
      .eq("id", companyId)
      .maybeSingle(),
  ]);

  const isOwner = Boolean(companyRow?.admin_id && companyRow.admin_id === userId);
  const effectiveTenantRole = preserveHigherTenantRole(
    (existingMember?.role as CompanyMemberRole | undefined) ?? null,
    role,
    isOwner
  );

  const nextProfileRole = profileRoleForJoin(
    (existingProfile?.role as UserRole | undefined) ?? null,
    effectiveTenantRole
  );
  
  // Keep existing company_id as default if it exists, otherwise set it.
  const companyIdUpdate = existingProfile?.company_id ? existingProfile.company_id : companyId;

  await supabase.from("profiles").upsert(
    {
      id: userId,
      full_name: fullName,
      email,
      avatar_url: clerkUser?.imageUrl ?? null,
      role: nextProfileRole,
      company_id: companyIdUpdate,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "id" }
  );

  const { error } = await supabase.from("company_members").upsert(
    {
      company_id: companyId,
      profile_id: userId,
      status: "active",
      role: effectiveTenantRole,
      joined_at: existingMember?.joined_at ?? new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "company_id, profile_id" }
  );

  if (error) {
    throw new Error(error.message);
  }

  // SYNC WITH CLERK
  // Ensure the user is added to the Clerk organization
  // Since companyId in DB IS the Clerk Organization ID
  try {
    const client = await clerkClient();
    
    // Check if membership already exists to avoid 422
    const memberships = await client.organizations.getOrganizationMembershipList({
      organizationId: companyId,
    });
    
    const exists = memberships.data.some(m => m.publicUserData?.userId === userId);
    
    if (!exists) {
      // Add as basic member (learner/teacher)
      // Admins are usually created via organization.created webhook or manual invite
      await client.organizations.createOrganizationMembership({
        organizationId: companyId,
        userId: userId,
        role: role === "company_admin" ? "org:admin" : "org:member",
      });
      console.log(`[Clerk Sync] Added user ${userId} to org ${companyId} as ${role}`);
    }
  } catch (clerkError: any) {
    console.error("[Clerk Sync Error] Failed to add user to organization:", clerkError.message);
    // We don't throw here to avoid failing the enrollment if only Clerk sync fails,
    // but ideally we should keep them in sync.
  }

  return { success: true };
}

/**
 * Validates a staff code and joins the user as a teacher.
 */
export async function validateAndJoinStaff(tenantSlug: string, code: string) {
  const { userId } = await auth();
  if (!userId) {
    return { error: "Please sign in to join as staff." };
  }

  const supabase = createServiceClient();
  const { data: company } = await supabase
    .from("companies")
    .select("id, slug, teacher_code")
    .eq("slug", tenantSlug)
    .maybeSingle();

  if (!company) {
    return { error: "Academy not found." };
  }

  const cleanCode = code.trim();
  if (!cleanCode || cleanCode !== company.teacher_code) {
    return { error: "Invalid staff access code. Please check with your academy administrator." };
  }

  await ensureTenantMembership(userId, company.id, "teacher");

  revalidatePath(`/academy/${company.slug}/admin`);
  revalidatePath(`/academy/${company.slug}/admin/staff`);
  revalidatePath("/dashboard");

  return { success: true, redirectUrl: `/academy/${company.slug}/admin` };
}

/**
 * Regenerates the 6-digit staff join code for an academy.
 */
export async function regenerateStaffCode(companyId: string) {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const supabase = createServiceClient();
  
  // Verify permissions
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", userId).maybeSingle();
  if (profile?.role !== "super_admin") {
    const { data: member } = await supabase
      .from("company_members")
      .select("role")
      .eq("company_id", companyId)
      .eq("profile_id", userId)
      .eq("status", "active")
      .maybeSingle();

    if (member?.role !== "company_admin") {
      throw new Error("Only academy administrators can regenerate the staff code.");
    }
  }

  const newCode = Math.floor(100000 + Math.random() * 900000).toString();

  const { error } = await supabase
    .from("companies")
    .update({ teacher_code: newCode })
    .eq("id", companyId);

  if (error) throw new Error(error.message);

  const { data: company } = await supabase.from("companies").select("slug").eq("id", companyId).single();
  if (company?.slug) {
    revalidatePath(`/academy/${company.slug}/admin/staff`);
  }

  return { success: true, newCode };
}

/**
 * Updates a member's role within an academy.
 */
export async function updateStaffRole(companyId: string, targetUserId: string, newRole: CompanyMemberRole) {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const supabase = createServiceClient();

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", userId).maybeSingle();
  if (profile?.role !== "super_admin") {
    const { data: member } = await supabase
      .from("company_members")
      .select("role")
      .eq("company_id", companyId)
      .eq("profile_id", userId)
      .eq("status", "active")
      .maybeSingle();

    if (member?.role !== "company_admin") {
      throw new Error("Only academy administrators can modify staff roles.");
    }
  }

  const { error } = await supabase
    .from("company_members")
    .update({ role: newRole, updated_at: new Date().toISOString() })
    .eq("company_id", companyId)
    .eq("profile_id", targetUserId);

  if (error) throw new Error(error.message);

  const { data: company } = await supabase.from("companies").select("slug").eq("id", companyId).single();
  if (company?.slug) {
    revalidatePath(`/academy/${company.slug}/admin/staff`);
  }

  return { success: true };
}

/**
 * Removes a member from an academy.
 */
export async function removeStaffMember(companyId: string, targetUserId: string) {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const supabase = createServiceClient();

  const { data: company } = await supabase
    .from("companies")
    .select("admin_id, slug")
    .eq("id", companyId)
    .single();

  if (!company) throw new Error("Academy not found.");

  if (company.admin_id === targetUserId) {
    throw new Error("Cannot remove the primary academy owner.");
  }

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", userId).maybeSingle();
  if (profile?.role !== "super_admin") {
    const { data: member } = await supabase
      .from("company_members")
      .select("role")
      .eq("company_id", companyId)
      .eq("profile_id", userId)
      .eq("status", "active")
      .maybeSingle();

    if (member?.role !== "company_admin") {
      throw new Error("Only academy administrators can remove members.");
    }
  }

  const { error } = await supabase
    .from("company_members")
    .delete()
    .eq("company_id", companyId)
    .eq("profile_id", targetUserId);

  if (error) throw new Error(error.message);

  if (company.slug) {
    revalidatePath(`/academy/${company.slug}/admin/staff`);
  }

  return { success: true };
}

export type UserAcademy = {
  id: string;
  name: string;
  slug: string;
  role: CompanyMemberRole | "super_admin";
  logo_url: string | null;
  primary_color: string | null;
  targetUrl: string;
};

/**
 * Returns all academies the current user belongs to (as admin, teacher, or learner).
 * If the user is a platform super_admin, returns all active academies.
 */
export async function getUserAcademies(): Promise<UserAcademy[]> {
  const { userId } = await auth();
  if (!userId) return [];

  const supabase = createServiceClient();

  // Active memberships in company_members where the user is an enrolled member
  const { data: memberRows } = await supabase
    .from("company_members")
    .select("company_id, role, companies(id, name, slug, logo_url, primary_color, status)")
    .eq("profile_id", userId)
    .eq("status", "active")
    .order("joined_at", { ascending: false });

  // Academies created/owned by this user (where they are admin_id)
  const { data: ownedCompanies } = await supabase
    .from("companies")
    .select("id, name, slug, logo_url, primary_color, status")
    .eq("admin_id", userId)
    .eq("status", "active");

  type CompanyRecord = {
    id: string;
    name: string;
    slug: string;
    logo_url: string | null;
    primary_color: string | null;
    status: string;
  };

  const results: UserAcademy[] = [];
  const seenIds = new Set<string>();
  const ownedIds = new Set((ownedCompanies ?? []).map((c) => c.id));

  for (const row of (memberRows ?? []) as any[]) {
    const company = (Array.isArray(row.companies) ? row.companies[0] : row.companies) as CompanyRecord | null;
    if (!company?.slug || company.status === "suspended" || seenIds.has(company.id)) continue;
    seenIds.add(company.id);

    const effectiveRole: CompanyMemberRole = ownedIds.has(company.id)
      ? "company_admin"
      : (row.role as CompanyMemberRole);
    const isStaff =
      effectiveRole === "company_admin" ||
      effectiveRole === "teacher" ||
      effectiveRole === "instructor";
    results.push({
      id: company.id,
      name: company.name,
      slug: company.slug,
      role: effectiveRole,
      logo_url: company.logo_url,
      primary_color: company.primary_color,
      targetUrl: isStaff ? `/academy/${company.slug}/admin` : `/academy/${company.slug}/classroom`,
    });
  }

  // Also include academies where user is admin_id (owner)
  for (const company of ownedCompanies ?? []) {
    if (!company?.slug || company.status === "suspended" || seenIds.has(company.id)) continue;
    seenIds.add(company.id);

    results.push({
      id: company.id,
      name: company.name,
      slug: company.slug,
      role: "company_admin",
      logo_url: company.logo_url,
      primary_color: company.primary_color,
      targetUrl: `/academy/${company.slug}/admin`,
    });
  }

  return results;
}
