import { auth } from "@clerk/nextjs/server";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { ensureProfile } from "@/lib/supabase/ensure-profile";
import { resolveHome, tenantLandingPath } from "@/lib/tenants/resolve-home";
import { createServiceClient } from "@/lib/supabase/server";
import { ensureTenantMembership } from "@/lib/tenants/membership";

/**
 * Post-sign-in router. Signed-in users should never idle on the main site:
 * we honor tenant return URLs, auto-join student memberships, or resolve
 * their tenant on the server and redirect immediately.
 */
export async function GET(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.redirect(new URL("/sign-in", req.url));
  }

  await ensureProfile(userId);

  const rawRedirect = req.nextUrl.searchParams.get("redirect_url");

  // If a safe redirect URL was requested (e.g. from a specific academy or course)
  if (rawRedirect) {
    let safePath = rawRedirect;
    if (rawRedirect.startsWith("http://") || rawRedirect.startsWith("https://")) {
      try {
        const parsed = new URL(rawRedirect);
        safePath = parsed.pathname + parsed.search;
      } catch {
        safePath = "";
      }
    }

    // Check if this is an academy route: /academy/:slug/...
    if (safePath.startsWith("/academy/")) {
      const match = safePath.match(/^\/academy\/([^/?#]+)/);
      const tenantSlug = match ? match[1] : null;

      if (tenantSlug) {
        const supabase = createServiceClient();
        const { data: tenant } = await supabase
          .from("companies")
          .select("id, slug, status")
          .eq("slug", tenantSlug)
          .maybeSingle();

        if (tenant && tenant.status !== "suspended") {
          // Check existing membership
          const { data: existingMember } = await supabase
            .from("company_members")
            .select("id")
            .eq("company_id", tenant.id)
            .eq("profile_id", userId)
            .maybeSingle();

          // Auto-join as learner if they don't have a membership in this academy yet
          if (!existingMember) {
            try {
              await ensureTenantMembership(userId, tenant.id, "learner");
            } catch (err) {
              console.error("[after-sign-in] Auto-join failed:", err);
            }
          }

          return NextResponse.redirect(new URL(safePath, req.url));
        }
      }
    } else if (safePath.startsWith("/") && !safePath.startsWith("//")) {
      return NextResponse.redirect(new URL(safePath, req.url));
    }
  }

  const cookieStore = await cookies();
  const home = await resolveHome(userId, cookieStore.get("last_visited_tenant")?.value);

  if (!home.onboardingCompleted) {
    return NextResponse.redirect(new URL("/onboarding", req.url));
  }

  // Platform super admins go straight to the Super Admin Control Plane
  if (home.platformRole === "super_admin") {
    return NextResponse.redirect(new URL("/superadmin", req.url));
  }

  if (home.defaultTenant) {
    return NextResponse.redirect(new URL(tenantLandingPath(home.defaultTenant), req.url));
  }

  // Ambiguous (several academies) or none: the dashboard hosts the academy picker for now.
  if (home.memberships.length === 0 && home.platformRole === "company_admin") {
    return NextResponse.redirect(new URL("/launch-your-academy", req.url));
  }
  return NextResponse.redirect(new URL("/dashboard", req.url));
}
