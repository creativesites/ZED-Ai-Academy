import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { companyAdminNeedsAcademySetup } from "@/lib/company-admin-setup";
import { createServiceClient } from "@/lib/supabase/server";
import { LaunchAcademyClient } from "./launch-academy-client";

export default async function LaunchYourAcademyPage() {
  const { userId, orgId } = await auth();

  if (!userId) {
    redirect("/sign-in?redirect_url=/launch-your-academy");
  }

  const supabase = createServiceClient();
  
  // 1. Fetch profile to check role and onboarding
  const { data: profile } = await supabase
    .from("profiles")
    .select("role, onboarding_completed, company_id")
    .eq("id", userId)
    .single();

  if (!profile) {
    // If no profile exists yet, they need to onboard first
    redirect("/onboarding?role=company_admin");
  }

  if (profile.role !== "company_admin" && profile.role !== "super_admin") {
    redirect("/dashboard");
  }

  if (!profile.onboarding_completed) {
    redirect("/onboarding?role=company_admin");
  }

  // 2. Check if they already have an academy setup
  const needs = await companyAdminNeedsAcademySetup(userId, orgId);
  
  if (!needs) {
    // Find the slug to redirect to admin
    let tenantSlug: string | null = null;
    
    // Check memberships first
    const { data: membership } = await supabase
      .from("company_members")
      .select("company_id, companies(slug)")
      .eq("profile_id", userId)
      .eq("status", "active")
      .order("joined_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const membershipData = membership as unknown as {
      company_id: string;
      companies: { slug: string } | null;
    } | null;

    if (membershipData?.companies?.slug) {
      tenantSlug = membershipData.companies.slug;
    } else if (profile.company_id) {
      const { data: company } = await supabase
        .from("companies")
        .select("slug")
        .eq("id", profile.company_id)
        .maybeSingle();
      tenantSlug = company?.slug ?? null;
    }

    if (tenantSlug) {
      redirect(`/academy/${tenantSlug}/admin`);
    } else if (orgId) {
        // If they have an orgId but we couldn't find a slug, maybe it's still syncing
        // or they just created it.
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white pb-28 pt-8 md:pb-16 md:pt-12">
      <LaunchAcademyClient />
    </div>
  );
}
