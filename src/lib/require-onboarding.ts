import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

/**
 * Server-side helper: redirect the user to /onboarding if they haven't
 * completed the onboarding flow yet.
 *
 * Call this from any authenticated layout or page that should enforce
 * onboarding (learner, learning, creator, admin, etc.).
 *
 * Skips the check when the current path is already /onboarding.
 */
export async function requireOnboarding(userId: string) {
  const supabase = createClient();

  const { data: profile } = await supabase
    .from("profiles")
    .select("onboarding_completed")
    .eq("id", userId)
    .single();

  // If no profile row exists yet, or onboarding_completed is explicitly false/null → redirect.
  if (!profile?.onboarding_completed) {
    redirect("/onboarding");
  }
}
