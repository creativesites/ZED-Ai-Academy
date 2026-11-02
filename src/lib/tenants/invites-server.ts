import "server-only";

import { randomInt } from "node:crypto";
import { headers } from "next/headers";
import { createServiceClient } from "@/lib/supabase/server";
import { ensureProfile } from "@/lib/supabase/ensure-profile";
import { ensureTenantMembership } from "@/lib/tenants/membership";
import {
  generateInviteCode,
  inviteStatus,
  normalizeInviteCode,
  pickNextClass,
  type InviteStatus,
  type NextClass,
  type ScheduleFacts,
} from "@/lib/tenants/invites";
import type { AcademyInvite, AcademyInviteRole, CompanyMemberRole } from "@/types/database";

/**
 * Server-side reads and writes for academy invite links. NOT server actions:
 * callers authorize first (src/actions/invites.ts, the /i/{code} page and
 * onboarding). Everything goes through the service role; the tables have no
 * anon / authenticated grants (supabase/migrations/20261104000000_academy_invites.sql).
 */

type ServiceClient = ReturnType<typeof createServiceClient>;

export type InviteCompany = {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  primary_color: string | null;
  status: "active" | "suspended";
};

const COMPANY_COLUMNS = "id, name, slug, logo_url, primary_color, status";

/** proto://host of the current request, so links work on previews, subdomains and custom domains. */
export async function requestOrigin(): Promise<string> {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  if (!host) return process.env.NEXT_PUBLIC_APP_URL ?? "";
  const proto = h.get("x-forwarded-proto")?.split(",")[0]?.trim() ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

export async function loadInviteWithCompany(
  rawCode: string | null | undefined
): Promise<{ invite: AcademyInvite; company: InviteCompany } | null> {
  const code = normalizeInviteCode(rawCode);
  if (!code) return null;
  const supabase = createServiceClient();
  const { data: invite, error } = await supabase.from("academy_invites").select("*").eq("code", code).maybeSingle();
  if (error) {
    console.error("[invites] load failed:", error.message);
    return null;
  }
  if (!invite) return null;
  const { data: company } = await supabase
    .from("companies")
    .select(COMPANY_COLUMNS)
    .eq("id", invite.company_id)
    .maybeSingle();
  if (!company) return null;
  return { invite: invite as AcademyInvite, company: company as InviteCompany };
}

export type InvitePreview = {
  code: string;
  status: InviteStatus;
  role: AcademyInviteRole;
  company: InviteCompany;
  courses: { id: string; title: string }[];
  groupName: string | null;
  nextClass: NextClass | null;
};

/** Everything the /i/{code} page shows. Null when the code does not exist (or the academy is suspended). */
export async function getInvitePreview(rawCode: string): Promise<InvitePreview | null> {
  const loaded = await loadInviteWithCompany(rawCode);
  if (!loaded || loaded.company.status === "suspended") return null;
  const { invite, company } = loaded;
  const supabase = createServiceClient();

  const [{ data: courses }, { data: group }, { data: schedules }] = await Promise.all([
    invite.course_ids.length
      ? supabase.from("courses").select("id, title").eq("company_id", company.id).in("id", invite.course_ids)
      : Promise.resolve({ data: [] as { id: string; title: string }[] }),
    invite.group_id
      ? supabase.from("classroom_groups").select("name").eq("id", invite.group_id).eq("company_id", company.id).maybeSingle()
      : Promise.resolve({ data: null }),
    supabase
      .from("class_schedules")
      .select("id, title, is_recurring, day_of_week, start_time_only, starts_at, group_id")
      .eq("company_id", company.id),
  ]);

  const order = new Map(invite.course_ids.map((id, i) => [id, i]));
  const sortedCourses = ((courses ?? []) as { id: string; title: string }[]).sort(
    (a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0)
  );

  return {
    code: invite.code,
    status: inviteStatus(invite),
    role: invite.role,
    company,
    courses: sortedCourses,
    groupName: (group as { name?: string } | null)?.name ?? null,
    nextClass: pickNextClass((schedules ?? []) as ScheduleFacts[], new Date(), { groupId: invite.group_id }),
  };
}

function isUniqueViolation(error: { code?: string } | null | undefined) {
  return error?.code === "23505";
}

type NewInvite = {
  companyId: string;
  label: string;
  role: AcademyInviteRole;
  courseIds: string[];
  groupId: string | null;
  maxUses: number | null;
  expiresAt: string | null;
  createdBy: string | null;
  isDefault?: boolean;
};

/** Insert an invite with a fresh code (retries on the astronomically rare code collision). */
export async function insertInvite(input: NewInvite, supabase: ServiceClient = createServiceClient()) {
  let lastError: { code?: string; message: string } | null = null;
  for (let attempt = 0; attempt < 5; attempt++) {
    const { data, error } = await supabase
      .from("academy_invites")
      .insert({
        company_id: input.companyId,
        code: generateInviteCode(randomInt),
        label: input.label,
        role: input.role,
        course_ids: input.courseIds,
        group_id: input.groupId,
        max_uses: input.maxUses,
        expires_at: input.expiresAt,
        created_by: input.createdBy,
        is_default: input.isDefault ?? false,
      })
      .select("*")
      .single();
    if (!error && data) return { invite: data as AcademyInvite, error: null };
    lastError = error;
    // A clash on the one-default-per-academy index is not fixed by a new code.
    if (!isUniqueViolation(error) || input.isDefault) break;
  }
  return { invite: null, error: lastError };
}

/**
 * The academy's default "General" learner link, created on first need. A revoked
 * default is retired (is_default = false) and replaced, so revoking it works as
 * "reset the link". Callers must have authorized the caller for this academy.
 */
export async function getOrCreateDefaultInvite(companyId: string, createdBy: string | null): Promise<AcademyInvite | null> {
  const supabase = createServiceClient();
  const findDefault = async () => {
    const { data, error } = await supabase
      .from("academy_invites")
      .select("*")
      .eq("company_id", companyId)
      .eq("is_default", true)
      .maybeSingle();
    if (error) console.error("[invites] default lookup failed:", error.message);
    return (data as AcademyInvite | null) ?? null;
  };

  const existing = await findDefault();
  if (existing && !existing.revoked_at) return existing;
  if (existing?.revoked_at) {
    await supabase.from("academy_invites").update({ is_default: false } as never).eq("id", existing.id);
  }

  const { invite, error } = await insertInvite(
    {
      companyId,
      label: "General",
      role: "learner",
      courseIds: [],
      groupId: null,
      maxUses: null,
      expiresAt: null,
      createdBy,
      isDefault: true,
    },
    supabase
  );
  if (invite) return invite;
  // Another request created it first.
  if (isUniqueViolation(error)) return findDefault();
  if (error) console.error("[invites] default create failed:", error.message);
  return null;
}

/** A teacher link only works if an academy admin (or the owner, or a super admin) made it. */
async function inviteCreatorIsAdmin(supabase: ServiceClient, invite: AcademyInvite): Promise<boolean> {
  if (!invite.created_by) return false;
  const [{ data: member }, { data: company }, { data: profile }] = await Promise.all([
    supabase
      .from("company_members")
      .select("role, status")
      .eq("company_id", invite.company_id)
      .eq("profile_id", invite.created_by)
      .maybeSingle(),
    supabase.from("companies").select("admin_id").eq("id", invite.company_id).maybeSingle(),
    supabase.from("profiles").select("role").eq("id", invite.created_by).maybeSingle(),
  ]);
  if (member?.status === "active" && member.role === "company_admin") return true;
  if (company?.admin_id === invite.created_by) return true;
  return profile?.role === "super_admin";
}

export type AcceptInviteResult =
  | { ok: true; redirectUrl: string; academyName: string; slug: string }
  | { ok: false; error: string; reason: "invalid" | InviteStatus | "removed" | "not_authorized" | "failed" };

const STATUS_MESSAGE: Record<Exclude<InviteStatus, "active">, string> = {
  revoked: "This invite link has been turned off. Ask your academy for a new link.",
  expired: "This invite link has expired. Ask your academy for a new link.",
  used_up: "This invite link has reached its limit. Ask your academy for a new link.",
};

function landingFor(slug: string, role: CompanyMemberRole) {
  return role === "learner" ? `/academy/${slug}/classroom` : `/academy/${slug}/admin`;
}

/**
 * Accept an invite for `userId`. Idempotent: a second call re-applies the same
 * grants without counting another use. Never downgrades a membership role or an
 * active enrollment. The caller must have verified that `userId` is the
 * signed-in user.
 */
export async function acceptInviteForUser(userId: string, rawCode: string): Promise<AcceptInviteResult> {
  const loaded = await loadInviteWithCompany(rawCode);
  if (!loaded || loaded.company.status === "suspended") {
    return { ok: false, reason: "invalid", error: "This invite link is not valid. Check the link or ask your academy for a new one." };
  }
  const { invite, company } = loaded;
  const supabase = createServiceClient();
  const memberRole: CompanyMemberRole = invite.role === "teacher" ? "teacher" : "learner";

  const { data: existingMember } = await supabase
    .from("company_members")
    .select("role, status")
    .eq("company_id", company.id)
    .eq("profile_id", userId)
    .maybeSingle();

  // Someone the academy removed cannot let themselves back in with a shared link.
  if (existingMember?.status === "deactivated") {
    return {
      ok: false,
      reason: "removed",
      error: `Your access to ${company.name} was removed. Please contact the academy if this is a mistake.`,
    };
  }

  if (invite.role === "teacher" && !(await inviteCreatorIsAdmin(supabase, invite))) {
    return { ok: false, reason: "not_authorized", error: "This staff invite link is no longer valid. Ask the academy admin for a new one." };
  }

  // The redemption row references profiles, so make sure the profile exists first.
  await ensureProfile(userId);
  await supabase.from("profiles").upsert({ id: userId } as never, { onConflict: "id", ignoreDuplicates: true });

  // Count the use atomically (respects revoked / expired / max_uses). Typed
  // loosely because Database.Functions is intentionally empty (see database.ts).
  const { data: redeemed, error: redeemError } = await (
    supabase.rpc as unknown as (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }>
  )("redeem_academy_invite", { p_invite_id: invite.id, p_user_id: userId });

  if (redeemError) {
    console.error("[invites] redeem failed:", redeemError.message);
    return { ok: false, reason: "failed", error: "We couldn't use this invite right now. Please try again." };
  }

  if (redeemed === "unavailable") {
    const status = inviteStatus(invite);
    // Already in (e.g. the second tap after the last seat went): just go in.
    if (existingMember?.status === "active") {
      return { ok: true, redirectUrl: landingFor(company.slug, existingMember.role as CompanyMemberRole), academyName: company.name, slug: company.slug };
    }
    const reason: Exclude<InviteStatus, "active"> = status === "active" ? "used_up" : status;
    return { ok: false, reason, error: STATUS_MESSAGE[reason] };
  }

  try {
    await ensureTenantMembership(userId, company.id, memberRole);
  } catch (error) {
    console.error("[invites] membership failed:", error instanceof Error ? error.message : error);
    return { ok: false, reason: "failed", error: "We couldn't add you to the academy. Please try again." };
  }

  if (memberRole === "learner") {
    await grantInviteCourses(supabase, userId, company.id, invite.course_ids);
    if (invite.group_id) {
      const { data: group } = await supabase
        .from("classroom_groups")
        .select("id")
        .eq("id", invite.group_id)
        .eq("company_id", company.id)
        .maybeSingle();
      if (group) {
        await supabase
          .from("classroom_group_members")
          .upsert({ group_id: invite.group_id, profile_id: userId } as never, {
            onConflict: "group_id,profile_id",
            ignoreDuplicates: true,
          });
      }
    }
  }

  // ensureTenantMembership keeps the higher role, so land on what they now are.
  const { data: member } = await supabase
    .from("company_members")
    .select("role")
    .eq("company_id", company.id)
    .eq("profile_id", userId)
    .maybeSingle();
  const finalRole = (member?.role as CompanyMemberRole | undefined) ?? memberRole;

  return { ok: true, redirectUrl: landingFor(company.slug, finalRole), academyName: company.name, slug: company.slug };
}

/**
 * Free, active enrollments in this academy's courses (no order, no payment).
 * Existing active enrollments are left alone; one waiting for payment becomes
 * active (the academy is granting it). A revoked one stays revoked: that was an
 * admin decision, and a shared link must not undo it.
 */
export async function grantInviteCourses(
  supabase: ServiceClient,
  userId: string,
  companyId: string,
  courseIds: string[],
  source: "academy_invite" | "manual_admin" = "academy_invite"
) {
  if (!courseIds.length) return;
  const { data: courses } = await supabase
    .from("courses")
    .select("id")
    .eq("company_id", companyId)
    .in("id", courseIds);
  const validIds = (courses ?? []).map((c) => c.id);
  if (!validIds.length) return;

  const { data: existing } = await supabase
    .from("enrollments")
    .select("id, course_id, status")
    .eq("user_id", userId)
    .in("course_id", validIds);
  const byCourse = new Map((existing ?? []).map((e) => [e.course_id, e]));

  const missing = validIds.filter((id) => !byCourse.has(id));
  if (missing.length) {
    const { error } = await supabase.from("enrollments").upsert(
      missing.map((courseId) => ({
        user_id: userId,
        course_id: courseId,
        company_id: companyId,
        source,
        status: "active" as const,
      })),
      { onConflict: "user_id,course_id", ignoreDuplicates: true }
    );
    if (error) console.error("[invites] enrollment failed:", error.message);
  }

  const pendingIds = (existing ?? []).filter((e) => e.status === "pending_payment").map((e) => e.id);
  if (pendingIds.length) {
    await supabase.from("enrollments").update({ status: "active" }).in("id", pendingIds);
  }
}
