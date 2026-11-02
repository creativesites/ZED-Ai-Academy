"use server";

import { auth } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import { createServiceClient } from "@/lib/supabase/server";
import { requireTenantAdmin, requireTenantTeacher } from "@/lib/tenants/access";
import { acceptInviteForUser, grantInviteCourses, insertInvite, type AcceptInviteResult } from "@/lib/tenants/invites-server";
import { inviteExpiresAt, parseExpiryChoice, parseMaxUses } from "@/lib/tenants/invites";
import type { AcademyInvite } from "@/types/database";

/**
 * Join an academy from an invite link (/i/{code}). Safe to call twice: the
 * second call re-applies the same grants and counts no extra use.
 */
export async function acceptInvite(code: string): Promise<AcceptInviteResult> {
  const { userId } = await auth();
  if (!userId) return { ok: false, reason: "failed", error: "Please sign in first." };
  const result = await acceptInviteForUser(userId, String(code ?? ""));
  if (result.ok) {
    revalidatePath(`/academy/${result.slug}/admin/students`);
    revalidatePath("/dashboard");
  }
  return result;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function companySlug(companyId: string) {
  const { data } = await createServiceClient().from("companies").select("slug").eq("id", companyId).maybeSingle();
  return data?.slug ?? null;
}

async function revalidateStudents(companyId: string) {
  const slug = await companySlug(companyId);
  if (slug) revalidatePath(`/academy/${slug}/admin/students`);
}

export type CreateInviteInput = {
  companyId: string;
  label: string;
  role: "learner" | "teacher";
  courseIds: string[];
  groupId: string | null;
  maxUses: string | number | null;
  expires: "never" | "7d" | "30d";
};

/**
 * New invite link. Teachers may create student links; only academy admins may
 * create teacher links (a teacher link is itself the staff authorization).
 */
export async function createInvite(
  input: CreateInviteInput
): Promise<{ ok: true; invite: AcademyInvite } | { ok: false; error: string }> {
  const companyId = String(input.companyId ?? "");
  const role = input.role === "teacher" ? "teacher" : "learner";
  const access = role === "teacher" ? await requireTenantAdmin(companyId) : await requireTenantTeacher(companyId);
  const supabase = access.supabase;

  const label = String(input.label ?? "").trim().slice(0, 80) || (role === "teacher" ? "Teachers" : "Students");

  // Only this academy's courses and groups, whatever the browser sent.
  const requestedCourses = Array.from(new Set((input.courseIds ?? []).filter((id) => UUID_RE.test(String(id)))));
  let courseIds: string[] = [];
  if (role === "learner" && requestedCourses.length) {
    const { data } = await supabase.from("courses").select("id").eq("company_id", companyId).in("id", requestedCourses);
    courseIds = (data ?? []).map((c) => c.id);
  }

  let groupId: string | null = null;
  if (role === "learner" && input.groupId && UUID_RE.test(input.groupId)) {
    const { data } = await supabase
      .from("classroom_groups")
      .select("id")
      .eq("id", input.groupId)
      .eq("company_id", companyId)
      .maybeSingle();
    if (!data) return { ok: false, error: "That group does not belong to this academy." };
    groupId = input.groupId;
  }

  const { invite, error } = await insertInvite({
    companyId,
    label,
    role,
    courseIds,
    groupId,
    maxUses: parseMaxUses(input.maxUses),
    expiresAt: inviteExpiresAt(parseExpiryChoice(input.expires)),
    createdBy: access.userId,
  });
  if (!invite) return { ok: false, error: error?.message ?? "Could not create the invite link." };

  await revalidateStudents(companyId);
  return { ok: true, invite };
}

/** Turn a link off. Academy admins only. */
export async function revokeInvite(companyId: string, inviteId: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const { supabase } = await requireTenantAdmin(companyId);
  if (!UUID_RE.test(inviteId)) return { ok: false, error: "Invite not found." };
  const { data, error } = await supabase
    .from("academy_invites")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", inviteId)
    .eq("company_id", companyId)
    .is("revoked_at", null)
    .select("id");
  if (error) return { ok: false, error: error.message };
  if (!data?.length) return { ok: false, error: "Invite not found or already revoked." };
  await revalidateStudents(companyId);
  return { ok: true };
}

/** Create a classroom group from the "New invite link" sheet; returns its id. */
export async function createInviteGroup(
  companyId: string,
  name: string
): Promise<{ ok: true; group: { id: string; name: string } } | { ok: false; error: string }> {
  const { supabase } = await requireTenantTeacher(companyId);
  const clean = String(name ?? "").trim().slice(0, 80);
  if (!clean) return { ok: false, error: "Give the group a name." };
  const { data, error } = await supabase
    .from("classroom_groups")
    .insert({ company_id: companyId, name: clean } as never)
    .select("id, name")
    .single();
  if (error || !data) return { ok: false, error: error?.message ?? "Could not create the group." };
  const slug = await companySlug(companyId);
  if (slug) revalidatePath(`/academy/${slug}/admin/classroom`);
  return { ok: true, group: data as { id: string; name: string } };
}

/**
 * Remove a student from the academy: the membership is deactivated, the profile
 * and history are kept. Only learner memberships; staff are managed on the
 * Staff page. Academy admins only.
 */
export async function removeStudent(companyId: string, profileId: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const { supabase } = await requireTenantAdmin(companyId);
  const { data, error } = await supabase
    .from("company_members")
    .update({ status: "deactivated", updated_at: new Date().toISOString() })
    .eq("company_id", companyId)
    .eq("profile_id", String(profileId ?? ""))
    .eq("role", "learner")
    .select("profile_id");
  if (error) return { ok: false, error: error.message };
  if (!data?.length) return { ok: false, error: "Student not found in this academy." };
  await revalidateStudents(companyId);
  return { ok: true };
}

/** Free enrollment of an existing student in one of this academy's courses. Academy admins only. */
export async function addStudentToCourse(
  companyId: string,
  profileId: string,
  courseId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { supabase } = await requireTenantAdmin(companyId);
  if (!UUID_RE.test(courseId)) return { ok: false, error: "Course not found." };
  const { data: member } = await supabase
    .from("company_members")
    .select("status")
    .eq("company_id", companyId)
    .eq("profile_id", String(profileId ?? ""))
    .maybeSingle();
  if (member?.status !== "active") return { ok: false, error: "Student not found in this academy." };

  const { data: existing } = await supabase
    .from("enrollments")
    .select("status")
    .eq("user_id", profileId)
    .eq("course_id", courseId)
    .maybeSingle();

  if (existing?.status === "revoked") {
    // An admin restoring access on purpose.
    await supabase.from("enrollments").update({ status: "active" }).eq("user_id", profileId).eq("course_id", courseId);
  } else {
    await grantInviteCourses(supabase, profileId, companyId, [courseId], "manual_admin");
  }
  const { data: check } = await supabase
    .from("enrollments")
    .select("status")
    .eq("user_id", profileId)
    .eq("course_id", courseId)
    .maybeSingle();
  if (check?.status !== "active") return { ok: false, error: "Could not enroll the student in that course." };

  await revalidateStudents(companyId);
  return { ok: true };
}
