import "server-only";

import { clerkClient } from "@clerk/nextjs/server";
import { createServiceClient } from "@/lib/supabase/server";
import { acceptInviteForUser, type AcceptInviteResult } from "@/lib/tenants/invites-server";

/**
 * Finish onboarding for someone who signed up from an academy invite link:
 * save their name, mark onboarding complete, then accept the invite (academy
 * membership, free course enrollments, class group).
 *
 * NOT a server action. Callers pass the signed-in user's own id (from auth()).
 */
export async function finishInviteOnboarding(
  userId: string,
  inviteCode: string,
  fullName: string | null,
  platform = "web"
): Promise<AcceptInviteResult> {
  const supabase = createServiceClient();
  const { data: existingProfile } = await supabase
    .from("profiles")
    .select("role, full_name")
    .eq("id", userId)
    .maybeSingle();

  const name = fullName?.trim() || existingProfile?.full_name || null;
  await supabase.from("profiles").upsert(
    {
      id: userId,
      ...(name ? { full_name: name } : {}),
      // Keep any existing role; new profiles start as learners.
      role: existingProfile?.role ?? "learner",
      onboarding_completed: true,
      updated_at: new Date().toISOString(),
    } as never,
    { onConflict: "id" }
  );

  try {
    const client = await clerkClient();
    await client.users.updateUserMetadata(userId, { publicMetadata: { onboardingComplete: true } });
    // Email sign-ups may have no name in Clerk: keep Clerk in step with what they typed.
    if (fullName?.trim()) {
      const [firstName, ...rest] = fullName.trim().split(/\s+/);
      await client.users.updateUser(userId, { firstName, lastName: rest.join(" ") || undefined });
    }
  } catch (error) {
    console.error("[invite onboarding] Clerk metadata update failed:", error instanceof Error ? error.message : error);
  }

  await supabase
    .from("user_platforms")
    .upsert({ user_id: userId, platform, last_seen_at: new Date().toISOString() });

  return acceptInviteForUser(userId, inviteCode);
}
