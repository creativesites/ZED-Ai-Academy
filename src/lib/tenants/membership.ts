import "server-only";

import { currentUser, clerkClient } from "@clerk/nextjs/server";
import { createServiceClient } from "@/lib/supabase/server";
import { higherMemberRole } from "@/lib/tenants/roles";
import type { CompanyMemberRole, UserRole } from "@/types/database";

function profileRoleForJoin(currentRole: UserRole | null | undefined, membershipRole: CompanyMemberRole): UserRole {
  if (currentRole === "super_admin" || currentRole === "company_admin" || currentRole === "instructor") {
    return currentRole;
  }
  if (membershipRole === "teacher") return "teacher";
  return currentRole ?? "learner";
}

type ClerkUser = NonNullable<Awaited<ReturnType<typeof currentUser>>>;

/**
 * Load the Clerk user being added. Inside a request made by that same user we
 * use the session; webhooks and background tasks have no session (or another
 * user's), so fall back to the Clerk API by id. Never copy another user's details.
 */
async function loadClerkUser(userId: string): Promise<ClerkUser | null> {
  try {
    const sessionUser = await currentUser();
    if (sessionUser?.id === userId) return sessionUser;
  } catch {
    // No request auth context (webhook / background task).
  }
  try {
    const client = await clerkClient();
    return (await client.users.getUser(userId)) as ClerkUser;
  } catch (error) {
    console.warn(
      "[ensureTenantMembership] Could not fetch Clerk user:",
      error instanceof Error ? error.message : error
    );
    return null;
  }
}

/**
 * Ensure a profile and active membership exist for a tenant.
 *
 * NOT a server action: this module is server-only and must only be called after
 * the caller has authorized the operation (e.g. a verified enrollment, payment
 * webhook or staff code). It never downgrades an existing membership role.
 */
export async function ensureTenantMembership(
  userId: string,
  companyId: string,
  role: CompanyMemberRole = "learner"
) {
  const supabase = createServiceClient();
  const clerkUser = await loadClerkUser(userId);
  const email =
    clerkUser?.emailAddresses.find((e) => e.id === clerkUser.primaryEmailAddressId)?.emailAddress ??
    clerkUser?.emailAddresses[0]?.emailAddress ??
    null;
  const fullName = clerkUser
    ? [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(" ") || clerkUser.fullName || null
    : null;

  const [{ data: existingProfile }, { data: existingMember }] = await Promise.all([
    supabase.from("profiles").select("role, company_id").eq("id", userId).maybeSingle(),
    supabase
      .from("company_members")
      .select("role")
      .eq("company_id", companyId)
      .eq("profile_id", userId)
      .maybeSingle(),
  ]);

  const finalRole = higherMemberRole(existingMember?.role as CompanyMemberRole | undefined, role);
  const nextProfileRole = profileRoleForJoin((existingProfile?.role as UserRole | undefined) ?? null, finalRole);

  // Keep existing company_id as default if it exists, otherwise set it.
  const companyIdUpdate = existingProfile?.company_id ? existingProfile.company_id : companyId;

  const profileUpdate: Record<string, unknown> = {
    id: userId,
    role: nextProfileRole,
    company_id: companyIdUpdate,
    updated_at: new Date().toISOString(),
  };
  if (clerkUser) {
    profileUpdate.full_name = fullName;
    profileUpdate.email = email;
    profileUpdate.avatar_url = clerkUser.imageUrl ?? null;
  }

  await supabase.from("profiles").upsert(profileUpdate as never, { onConflict: "id" });

  const { error } = await supabase.from("company_members").upsert(
    {
      company_id: companyId,
      profile_id: userId,
      status: "active",
      role: finalRole,
      joined_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "company_id, profile_id" }
  );

  if (error) {
    throw new Error(error.message);
  }

  // Keep the Clerk organization in sync (companyId IS the Clerk Organization ID).
  try {
    const client = await clerkClient();
    const memberships = await client.organizations.getOrganizationMembershipList({
      organizationId: companyId,
    });
    const exists = memberships.data.some((m) => m.publicUserData?.userId === userId);
    if (!exists) {
      await client.organizations.createOrganizationMembership({
        organizationId: companyId,
        userId,
        role: finalRole === "company_admin" ? "org:admin" : "org:member",
      });
    }
  } catch (clerkError: unknown) {
    const message = clerkError instanceof Error ? clerkError.message : String(clerkError);
    console.error("[Clerk Sync Error] Failed to add user to organization:", message);
  }

  return { success: true };
}
