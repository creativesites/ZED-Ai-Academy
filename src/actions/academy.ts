"use server";

import { randomInt } from "node:crypto";
import { auth, clerkClient, currentUser } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import { createServiceClient } from "@/lib/supabase/server";
import { ensureTenantMembership } from "@/lib/tenants/membership";
import { generateAcademySlug } from "@/lib/tenants/slug-server";
import type { Json, UserRole } from "@/types/database";

export type CreateAcademyResult =
  | { ok: true; slug: string; organizationId: string; existing: boolean }
  | { ok: false; error: string };

const NAME_MIN = 2;
const NAME_MAX = 80;
const TAGLINE_MAX = 160;

type Supabase = ReturnType<typeof createServiceClient>;

function newStaffCode() {
  return randomInt(100000, 1000000).toString();
}

function displayName(user: Awaited<ReturnType<typeof currentUser>>): string | null {
  if (!user) return null;
  return [user.firstName, user.lastName].filter(Boolean).join(" ") || user.fullName || user.username || null;
}

/** The academy this user already owns (companies.admin_id), oldest first. */
async function findOwnedAcademy(supabase: Supabase, userId: string) {
  const { data } = await supabase
    .from("companies")
    .select("id, slug, status")
    .eq("admin_id", userId)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  return data;
}

/**
 * An organization this user created earlier whose academy row was never written
 * (e.g. the tab closed, or a double click). Reusing it keeps createAcademy
 * idempotent and avoids orphan organizations.
 */
async function findOrphanOrganization(supabase: Supabase, userId: string): Promise<string | null> {
  try {
    const client = await clerkClient();
    const memberships = await client.users.getOrganizationMembershipList({ userId, limit: 50 });
    const created = memberships.data
      .filter((m) => m.role === "org:admin" && m.organization.createdBy === userId)
      .map((m) => m.organization.id);
    if (created.length === 0) return null;

    const { data: rows } = await supabase.from("companies").select("id, admin_id").in("id", created);
    const byId = new Map((rows ?? []).map((r) => [r.id, r.admin_id]));
    // An org with no academy row, or whose row (e.g. from the webhook) has no owner yet.
    return created.find((id) => !byId.has(id) || !byId.get(id)) ?? null;
  } catch (error) {
    console.warn("[createAcademy] Could not list organizations:", error instanceof Error ? error.message : error);
    return null;
  }
}

async function createOrganization(name: string, userId: string, slugHint: string): Promise<string> {
  const client = await clerkClient();
  try {
    const org = await client.organizations.createOrganization({ name, createdBy: userId });
    return org.id;
  } catch (first) {
    // Some instances require an organization slug; it is never used by the app.
    try {
      const org = await client.organizations.createOrganization({
        name,
        createdBy: userId,
        slug: `${slugHint}-${randomInt(100000, 1000000)}`,
      });
      return org.id;
    } catch {
      throw first;
    }
  }
}

/**
 * Persist the academy, its owner membership and the owner's profile. Supabase is
 * the source of truth; safe to run again for the same organization.
 */
async function persistAcademy(
  supabase: Supabase,
  opts: { organizationId: string; userId: string; name: string; tagline: string | null }
): Promise<string> {
  const { organizationId, userId, name, tagline } = opts;

  const { data: existing } = await supabase
    .from("companies")
    .select("id, slug, teacher_code, home_content, admin_id")
    .eq("id", organizationId)
    .maybeSingle();

  const homeContent = {
    ...((existing?.home_content as Record<string, unknown> | null) ?? {}),
    ...(tagline ? { hero_subtitle: tagline } : {}),
  } as Json;

  let slug: string;
  if (existing) {
    slug = existing.slug;
    const { error } = await supabase
      .from("companies")
      .update({
        name,
        admin_id: existing.admin_id ?? userId,
        status: "active",
        home_content: homeContent,
        ...(existing.teacher_code && existing.teacher_code !== "0000" ? {} : { teacher_code: newStaffCode() }),
        updated_at: new Date().toISOString(),
      })
      .eq("id", organizationId);
    if (error) throw new Error(error.message);
  } else {
    // Retry on a slug race with another academy created at the same moment.
    let lastError: string | null = null;
    slug = "";
    for (let attempt = 0; attempt < 3; attempt++) {
      slug = await generateAcademySlug(supabase, attempt === 0 ? name : `${name} ${randomInt(10, 100)}`, organizationId);
      const { error } = await supabase.from("companies").insert({
        id: organizationId,
        name,
        slug,
        admin_id: userId,
        status: "active",
        teacher_code: newStaffCode(),
        home_content: homeContent,
      });
      if (!error) {
        lastError = null;
        break;
      }
      lastError = error.message;
      // 23505 = unique violation. If the row itself now exists (webhook won the race), use it.
      const { data: raced } = await supabase.from("companies").select("slug").eq("id", organizationId).maybeSingle();
      if (raced?.slug) {
        slug = raced.slug;
        await supabase
          .from("companies")
          .update({ name, admin_id: userId, status: "active", home_content: homeContent })
          .eq("id", organizationId);
        lastError = null;
        break;
      }
      if (error.code !== "23505") break;
    }
    if (lastError) throw new Error(lastError);
  }

  // Owner membership (never downgrades an existing row).
  await ensureTenantMembership(userId, organizationId, "company_admin");

  // Profile: academy owner, onboarding done. A platform super admin stays one.
  const user = await currentUser().catch(() => null);
  const { data: profile } = await supabase
    .from("profiles")
    .select("role, full_name")
    .eq("id", userId)
    .maybeSingle();
  const role: UserRole = profile?.role === "super_admin" ? "super_admin" : "company_admin";
  const { error: profileError } = await supabase.from("profiles").upsert(
    {
      id: userId,
      role,
      company_id: organizationId,
      onboarding_completed: true,
      full_name: displayName(user) ?? profile?.full_name ?? null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "id" }
  );
  if (profileError) throw new Error(profileError.message);

  try {
    const client = await clerkClient();
    await client.users.updateUserMetadata(userId, { publicMetadata: { onboardingComplete: true } });
  } catch {
    // Cosmetic only: Supabase is the source of truth for onboarding.
  }

  return slug;
}

/**
 * Create the signed-in user's academy in one step. Idempotent: if the user
 * already owns an academy it is returned instead of creating another one.
 */
export async function createAcademy(input: { name: string; tagline?: string | null }): Promise<CreateAcademyResult> {
  const { userId } = await auth();
  if (!userId) return { ok: false, error: "Please sign in again to create your academy." };

  const name = String(input?.name ?? "").replace(/\s+/g, " ").trim();
  const tagline = String(input?.tagline ?? "").replace(/\s+/g, " ").trim().slice(0, TAGLINE_MAX) || null;
  if (name.length < NAME_MIN) return { ok: false, error: "Please enter a name for your academy." };
  if (name.length > NAME_MAX) return { ok: false, error: `Please keep the name under ${NAME_MAX} characters.` };

  const supabase = createServiceClient();

  try {
    const owned = await findOwnedAcademy(supabase, userId);
    if (owned?.slug) {
      if (owned.status === "suspended") {
        return { ok: false, error: "Your academy is currently suspended. Please contact support." };
      }
      // Self-heal the membership and profile, then send the owner back to it.
      const slug = await persistAcademy(supabase, {
        organizationId: owned.id,
        userId,
        name: (await supabase.from("companies").select("name").eq("id", owned.id).single()).data?.name ?? name,
        tagline: null,
      });
      return { ok: true, slug, organizationId: owned.id, existing: true };
    }

    const organizationId =
      (await findOrphanOrganization(supabase, userId)) ??
      (await createOrganization(name, userId, (await generateAcademySlug(supabase, name)).slice(0, 40)));

    const slug = await persistAcademy(supabase, { organizationId, userId, name, tagline });

    revalidatePath(`/academy/${slug}`);
    revalidatePath(`/academy/${slug}/admin`);
    return { ok: true, slug, organizationId, existing: false };
  } catch (error) {
    console.error("[createAcademy] failed:", error instanceof Error ? error.message : error);
    return {
      ok: false,
      error: "We couldn't create your academy just now. Please check your connection and try again.",
    };
  }
}
