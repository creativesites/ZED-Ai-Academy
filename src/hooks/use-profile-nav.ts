"use client";

import { useAuth } from "@clerk/nextjs";
import { useEffect, useState } from "react";
import { getProfileContext } from "@/actions/profile";

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
  const { userId, isSignedIn, orgId, getToken } = useAuth();
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

    async function load() {
      if (!userId) return;
      
      const context = await getProfileContext(userId);


      if (cancelled || !context) {
        if (!cancelled) setLoaded(true);
        return;
      }

      setRole(context.role);
      setOnboardingCompleted(context.onboardingCompleted);
      setTenantSlug(context.tenantSlug);
      setLoaded(true);
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [isSignedIn, userId]);

  const needsAcademyLaunch =
    loaded &&
    role === "company_admin" &&
    !orgId &&
    !tenantSlug;

  return { loaded, role, tenantSlug, needsAcademyLaunch };
}
