import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { CompanyMemberRole, UserRole } from "@/types/database";

export type HomeMembership = {
  companyId: string;
  slug: string;
  name: string;
  role: CompanyMemberRole;
};

export type ResolvedHome = {
  platformRole: UserRole | null;
  onboardingCompleted: boolean;
  memberships: HomeMembership[];
  /** The tenant the user should land in, or null if there are none / the choice is ambiguous. */
  defaultTenant: HomeMembership | null;
};

type MembershipRow = {
  company_id: string;
  role: CompanyMemberRole;
  companies: { slug: string; name: string } | { slug: string; name: string }[] | null;
};

/**
 * Single source of truth for "where does this user belong?".
 *
 * Reads `company_members` (the per-tenant role source of truth) with the tenant joined in,
 * in parallel with the profile — one round trip instead of the old sequential chain.
 * Falls back to the legacy `profiles.company_id` only if the user has no active membership.
 *
 * `hintSlug` (e.g. the last-visited tenant cookie) is only a tiebreaker: it is honoured
 * only if it matches one of the user's own memberships, so it can't be used to gain access.
 */
export async function resolveHome(userId: string, hintSlug?: string | null): Promise<ResolvedHome> {
  const supabase = createClient();

  const [{ data: profile }, { data: rows }, { data: ownedCompanies }] = await Promise.all([
    supabase
      .from("profiles")
      .select("role, company_id, onboarding_completed")
      .eq("id", userId)
      .maybeSingle(),
    supabase
      .from("company_members")
      .select("company_id, role, companies(slug, name, admin_id)")
      .eq("profile_id", userId)
      .eq("status", "active")
      .order("joined_at", { ascending: false }),
    supabase
      .from("companies")
      .select("id, slug, name")
      .eq("admin_id", userId)
      .eq("status", "active"),
  ]);

  const ownedIds = new Set((ownedCompanies ?? []).map((c) => c.id));
  const seenIds = new Set<string>();

  const memberships: HomeMembership[] = ((rows ?? []) as unknown as MembershipRow[]).flatMap((row) => {
    const company = (Array.isArray(row.companies) ? row.companies[0] : row.companies) as
      | { slug: string; name: string; admin_id?: string | null }
      | null;
    if (!company?.slug) return [];
    seenIds.add(row.company_id);
    const effectiveRole: CompanyMemberRole =
      ownedIds.has(row.company_id) || company.admin_id === userId ? "company_admin" : row.role;
    return [{ companyId: row.company_id, slug: company.slug, name: company.name, role: effectiveRole }];
  });

  for (const owned of ownedCompanies ?? []) {
    if (!owned.slug || seenIds.has(owned.id)) continue;
    seenIds.add(owned.id);
    memberships.push({
      companyId: owned.id,
      slug: owned.slug,
      name: owned.name,
      role: "company_admin",
    });
  }

  // Legacy fallback: profile.company_id without a membership row.
  if (memberships.length === 0 && profile?.company_id) {
    const { data: company } = await supabase
      .from("companies")
      .select("id, slug, name")
      .eq("id", profile.company_id)
      .maybeSingle();
    if (company?.slug) {
      memberships.push({
        companyId: company.id,
        slug: company.slug,
        name: company.name,
        role: profile.role === "company_admin" ? "company_admin" : "learner",
      });
    }
  }

  let defaultTenant: HomeMembership | null = null;
  if (memberships.length === 1) {
    defaultTenant = memberships[0];
  } else if (memberships.length > 1) {
    defaultTenant = (hintSlug && memberships.find((m) => m.slug === hintSlug)) || null;
  }

  return {
    platformRole: (profile?.role as UserRole | undefined) ?? null,
    onboardingCompleted: !!profile?.onboarding_completed,
    memberships,
    defaultTenant,
  };
}

/**
 * Where a member lands inside their tenant.
 * Path-based today; Phase 2 swaps this for `https://{slug}.{root}` in ONE place.
 */
export function tenantLandingPath(m: Pick<HomeMembership, "slug" | "role">): string {
  const isStaff =
    m.role === "company_admin" || m.role === "teacher" || m.role === "instructor";
  return isStaff ? `/academy/${m.slug}/admin` : `/academy/${m.slug}/classroom`;
}
