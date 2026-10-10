import "server-only";

import { currentUser, clerkClient } from "@clerk/nextjs/server";
import { createServiceClient } from "@/lib/supabase/server";
import type { CompanyMemberRole, UserRole } from "@/types/database";

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

function profileRoleForJoin(currentRole: UserRole | null | undefined, membershipRole: CompanyMemberRole): UserRole {
  if (currentRole === "super_admin" || currentRole === "company_admin" || currentRole === "instructor") {
    return currentRole;
  }
  if (membershipRole === "teacher") return "teacher";
  return currentRole ?? "learner";
}

/**
 * Ensure a profile and active membership exist for a tenant.
 *
 * NOT a server action: this module is server-only and must only be called after
 * the caller has authorized the operation (e.g. a verified enrollment). It never
 * downgrades an existing membership role.
 */
export async function ensureTenantMembership(
  userId: string,
  companyId: string,
  role: CompanyMemberRole = "learner"
) {
  const supabase = createServiceClient();
  const clerkUser = await currentUser();
  // Only trust Clerk profile details when they belong to the user being added.
  const sameUser = clerkUser?.id === userId;
  const email = sameUser
    ? clerkUser?.emailAddresses.find((e) => e.id === clerkUser.primaryEmailAddressId)?.emailAddress ?? null
    : null;
  const fullName = sameUser
    ? [clerkUser?.firstName, clerkUser?.lastName].filter(Boolean).join(" ") || clerkUser?.fullName || null
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
  if (sameUser) {
    profileUpdate.full_name = fullName;
    profileUpdate.email = email;
    profileUpdate.avatar_url = clerkUser?.imageUrl ?? null;
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
