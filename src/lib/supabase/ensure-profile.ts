import { currentUser } from "@clerk/nextjs/server";
import { createServiceClient } from "./server";

/**
 * Upserts a Supabase profile row for the currently signed-in Clerk user.
 * Safe to call on every authenticated page load — cheap when the row already exists.
 * Falls back to service client so it works even before the Clerk webhook is wired up.
 */
export async function ensureProfile(userId: string) {
  let clerkUser;
  try {
    clerkUser = await currentUser();
  } catch (err) {
    console.error("[ensureProfile] Clerk API unavailable — skipping profile sync:", err);
    return;
  }
  if (!clerkUser) return;

  const primaryEmail =
    clerkUser.emailAddresses.find((e) => e.id === clerkUser.primaryEmailAddressId)
      ?.emailAddress ?? null;

  const fullName =
    [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(" ") || null;

  const supabase = createServiceClient();

  // ignoreDuplicates: true = INSERT ... ON CONFLICT DO NOTHING
  // Never overwrites fields set manually (role, bio, etc.)
  // Webhook handles keeping name/avatar/email current after first insert.
  const { error } = await supabase.from("profiles").upsert(
    {
      id: userId,
      full_name: fullName,
      avatar_url: clerkUser.imageUrl ?? null,
      email: primaryEmail,
    },
    { onConflict: "id", ignoreDuplicates: true }
  );

  if (error) {
    console.error("[ensureProfile] upsert failed:", error.message);
  }
}
