import { createServiceClient } from "@/lib/supabase/server";

/**
 * True when the user is a company_admin but has no Clerk org and no active company
 * membership / profile company link in Supabase.
 */
export async function companyAdminNeedsAcademySetup(
  userId: string,
  orgId: string | null | undefined
): Promise<boolean> {
  const supabase = createServiceClient();

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, company_id")
    .eq("id", userId)
    .single();

  if (profile?.role !== "company_admin") return false;

  if (orgId) return false;

  const { data: membership } = await supabase
    .from("company_members")
    .select("company_id")
    .eq("profile_id", userId)
    .eq("status", "active")
    .limit(1)
    .maybeSingle();

  if (membership?.company_id) return false;

  if (profile.company_id) {
    const { data: company } = await supabase
      .from("companies")
      .select("id")
      .eq("id", profile.company_id)
      .maybeSingle();
    if (company) return false;
  }

  return true;
}
