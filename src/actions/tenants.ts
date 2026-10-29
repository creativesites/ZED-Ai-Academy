"use server";

import { randomInt } from "node:crypto";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createServiceClient } from "@/lib/supabase/server";
import { ensureTenantMembership } from "@/lib/tenants/membership";
import type { CompanyMemberRole } from "@/types/database";

/** Only allow same-site relative redirects. */
function safeNextPath(next: string): string | null {
  if (!next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return null;
  return next;
}

/**
 * Server action to join a tenant from the public landing page.
 * If signed out, redirects to sign-up with tenant context.
 *
 * Signed-in users always join as learners here. Staff roles require the
 * academy's staff code (join page / onboarding) — never trust a role sent from
 * the form. ensureTenantMembership lives in a server-only module so it cannot
 * be called directly from the browser as a server action.
 */
export async function joinTenantBySlug(formData: FormData) {
  const slug = String(formData.get("tenantSlug") ?? "");
  const requestedRole = String(formData.get("role") ?? "student");
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

  // Staff must go through the staff-code check on the join page.
  if (requestedRole === "teacher") {
    redirect(`/academy/${company.slug}/join?role=teacher`);
  }

  await ensureTenantMembership(userId, company.id, "learner");

  revalidatePath(`/academy/${company.slug}`);
  revalidatePath("/dashboard");

  redirect(safeNextPath(next) ?? `/academy/${company.slug}/classroom`);
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
  // NULL or the legacy "0000" default means staff sign-up is not enabled.
  if (!company.teacher_code || company.teacher_code === "0000") {
    return { error: "This academy hasn't enabled staff sign-up yet. Ask the owner to set a staff access code." };
  }
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

  const newCode = randomInt(100000, 1000000).toString();

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

  for (const row of (memberRows ?? []) as any[]) {
    const company = (Array.isArray(row.companies) ? row.companies[0] : row.companies) as CompanyRecord | null;
    if (!company?.slug || company.status === "suspended" || seenIds.has(company.id)) continue;
    seenIds.add(company.id);

    const isStaff = row.role === "company_admin" || row.role === "teacher" || row.role === "instructor";
    results.push({
      id: company.id,
      name: company.name,
      slug: company.slug,
      role: row.role as CompanyMemberRole,
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
