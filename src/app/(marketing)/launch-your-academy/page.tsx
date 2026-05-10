'use client'
import { useState, useEffect } from "react";
import { auth } from "@clerk/nextjs/server";
import { useAuth } from "@clerk/nextjs"
import { redirect } from "next/navigation";
import { companyAdminNeedsAcademySetup } from "@/lib/company-admin-setup";
import { createServiceClient } from "@/lib/supabase/server";
import { LaunchAcademyClient } from "./launch-academy-client";
import { createClient } from "@/lib/supabase/client";

// export const metadata = {
//   title: "Open your academy",
//   description: "Create your academy organization and start building courses.",
// };

export default async function LaunchYourAcademyPage() {
  //const { isSignedIn, userId, orgId } = await auth();
  const { isSignedIn, isLoaded, userId, orgId } = useAuth()
  const [tenantSlug, setTenantSlug] = useState(null)
  const [role, setRole] = useState(null)
  useEffect(() => {
    if (isSignedIn && userId) {
        const supabase = createClient();
        
        async function fetchUserContext() {
            const { data: profile } = await supabase
                .from("profiles")
                .select("role, company_id")
                .eq("id", userId as string)
                .single();
            
            if (profile) {
                setRole(profile.role);
                
                // Fetch latest active company slug
                const { data: membership } = await supabase
                    .from("company_members")
                    .select("company_id, companies(slug)")
                    .eq("profile_id", userId)
                    .eq("status", "active")
                    .order("joined_at", { ascending: false })
                    .limit(1)
                    .maybeSingle();
                
                if (membership?.companies?.slug) {
                    setTenantSlug(membership.companies.slug);
                } else if (profile.company_id) {
                    const { data: company } = await supabase
                        .from("companies")
                        .select("slug")
                        .eq("id", profile.company_id)
                        .maybeSingle();
                    if (company) setTenantSlug(company.slug);
                }
            }
        }
        
        fetchUserContext();
    }
}, [isSignedIn, userId]);

  if (!userId) {
    redirect("/sign-in?redirect_url=/launch-your-academy");
  }

  const supabase = createServiceClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("role, onboarding_completed")
    .eq("id", userId)
    .single();

  if (profile?.role !== "company_admin") {
    redirect("/dashboard");
  }

  if (!profile.onboarding_completed) {
    redirect("/onboarding?role=company_admin");
  }

  const needs = await companyAdminNeedsAcademySetup(userId, orgId);
  if (!needs) {
    redirect(`/academy/${tenantSlug}/admin`);
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white pb-28 pt-8 md:pb-16 md:pt-12">
      <LaunchAcademyClient />
    </div>
  );
}
