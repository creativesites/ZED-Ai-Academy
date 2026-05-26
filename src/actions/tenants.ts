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

/**
 * Core utility to ensure a profile and membership exist for a specific tenant.
 * Does NOT overwrite existing high-level roles (admin/instructor).
 */
export async function ensureTenantMembership(
  userId: string,
  companyId: string,
  role: CompanyMemberRole = "learner"
) {
  const supabase = createServiceClient();
  const clerkUser = await currentUser();
  const email = clerkUser?.emailAddresses.find((e) => e.id === clerkUser.primaryEmailAddressId)?.emailAddress ?? null;
  const fullName = [clerkUser?.firstName, clerkUser?.lastName].filter(Boolean).join(" ") || clerkUser?.fullName || null;

  const { data: existingProfile } = await supabase
    .from("profiles")
    .select("role, company_id")
    .eq("id", userId)
    .maybeSingle();

  const nextProfileRole = profileRoleForJoin((existingProfile?.role as UserRole | undefined) ?? null, role);
  
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
      role,
      joined_at: new Date().toISOString(),
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
