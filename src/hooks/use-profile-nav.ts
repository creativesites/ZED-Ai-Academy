"use client";

import { useAuth } from "@clerk/nextjs";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export type ProfileNavState = {
  loaded: boolean;
  role: string | null;
  tenantSlug: string | null;
  /** True when user should see Launch Pad / Open Academy CTAs */
  needsAcademyLaunch: boolean;
};

/**
 * Profile + tenant context for nav (matches server-side company admin guard loosely).
 */
export function useProfileNav(): ProfileNavState {
  const { userId, isSignedIn, orgId } = useAuth();
  const [role, setRole] = useState<string | null>(null);
  const [tenantSlug, setTenantSlug] = useState<string | null>(null);
  const [onboardingCompleted, setOnboardingCompleted] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!isSignedIn || !userId) {
      setRole(null);
      setTenantSlug(null);
      setOnboardingCompleted(false);
      setLoaded(true);
      return;
    }

    let cancelled = false;
    const supabase = createClient();

    async function load() {
      if (!userId) return;
      const { data: profile } = await supabase
        .from("profiles")
        .select("role, company_id, onboarding_completed")
        .eq("id", userId)
        .single();

      if (cancelled || !profile) {
        if (!cancelled) setLoaded(true);
        return;
      }

      setRole(profile.role);
      setOnboardingCompleted(!!profile.onboarding_completed);

      const { data: membership } = await supabase
        .from("company_members")
        .select("company_id")
        .eq("profile_id", userId)
        .eq("status", "active")
        .order("joined_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      const companyId = membership?.company_id ?? profile.company_id;
      let slug: string | null = null;
      if (companyId) {
        const { data: company } = await supabase
          .from("companies")
          .select("slug")
          .eq("id", companyId)
          .maybeSingle();
        slug = company?.slug ?? null;
      }

      if (!cancelled) {
        setTenantSlug(slug);
        setLoaded(true);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [isSignedIn, userId]);

  const needsAcademyLaunch =
    loaded &&
    role === "company_admin" &&
    onboardingCompleted &&
    !orgId &&
    !tenantSlug;

  return { loaded, role, tenantSlug, needsAcademyLaunch };
}
