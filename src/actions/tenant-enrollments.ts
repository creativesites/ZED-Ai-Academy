"use server";

import { revalidatePath } from "next/cache";
import { auth, clerkClient } from "@clerk/nextjs/server";
import { createServiceClient } from "@/lib/supabase/server";
import { getCurrentTenantAccess } from "@/lib/tenants/access";
import { canAccessTenantAdmin } from "@/lib/tenants/admin-helpers";
import type { ParsedStudentRow } from "@/lib/tenants/student-csv";

async function requireTenantStaff(companyId: string) {
  const { userId } = await auth();
  if (!userId) throw new Error("Please sign in first.");

  const supabase = createServiceClient();
  const [{ data: company }, access] = await Promise.all([
    supabase.from("companies").select("id, slug, name, admin_id").eq("id", companyId).single(),
    getCurrentTenantAccess(companyId),
  ]);

  if (!company) throw new Error("Academy not found.");

  const authorized = canAccessTenantAdmin({
    userId,
    companyAdminId: company.admin_id,
    isSuperAdmin: access?.isSuperAdmin ?? false,
    tenantRole: access?.tenantRole ?? null,
  });

  if (!authorized) {
    throw new Error("Only academy admins or instructors can manage enrollments.");
  }

  return { userId, supabase, company };
}

/**
 * Allows a tenant admin / instructor to self-enroll in any course inside their academy
 * so they can test the learner experience directly.
 */
export async function selfEnrollTenantAdmin(
  companyId: string,
  courseId: string,
  companySlug: string,
  cohortId?: string | null
) {
  const { userId, supabase } = await requireTenantStaff(companyId);

  if (!courseId) throw new Error("Select a course to self-enroll.");

  const { data: course } = await supabase
    .from("courses")
    .select("id, slug, company_id")
    .eq("id", courseId)
    .eq("company_id", companyId)
    .single();

  if (!course) throw new Error("Course not found in this academy.");

  const { data: existingEnrollment } = await supabase
    .from("enrollments")
    .select("id, status")
    .eq("user_id", userId)
    .eq("course_id", courseId)
    .maybeSingle();

  if (existingEnrollment) {
    if (existingEnrollment.status !== "active") {
      const { error } = await supabase
        .from("enrollments")
        .update({ status: "active", company_id: companyId })
        .eq("id", existingEnrollment.id);
      if (error) throw new Error(error.message);
    }
  } else {
    const { error } = await supabase.from("enrollments").insert({
      user_id: userId,
      course_id: courseId,
      company_id: companyId,
      source: "manual_admin",
      status: "active",
      notes: "Self-enrolled by academy staff",
    });
    if (error) throw new Error(error.message);
  }

  if (cohortId && cohortId !== "all") {
    const { data: groupMember } = await supabase
      .from("classroom_group_members")
      .select("id")
      .eq("group_id", cohortId)
      .eq("profile_id", userId)
      .maybeSingle();

    if (!groupMember) {
      await supabase
        .from("classroom_group_members")
        .insert({ group_id: cohortId, profile_id: userId });
    }
  }

  revalidatePath(`/academy/${companySlug}/admin/enrollments`);
  revalidatePath(`/academy/${companySlug}/classroom`);
  revalidatePath(`/academy/${companySlug}/courses/${course.slug}`);
  return { success: true, courseSlug: course.slug };
}

export interface BulkInviteResult {
  enrolledCount: number;
  invitedCount: number;
  alreadyEnrolledCount: number;
  failed: { email: string; reason: string }[];
}

/**
 * Registers or invites one or many students into the academy, optionally
 * assigning them to a specific Course and Class/Subject cohort.
 *
 * - Existing Zed AI Academy users are enrolled immediately into the academy, course & class.
 * - New users receive a Clerk invitation with a tenant-aware redirect URL so joining
 *   automatically completes their academy, course, and cohort placement.
 */
export async function enrollOrInviteTenantStudents(input: {
  companyId: string;
  companySlug: string;
  courseId?: string | null;
  cohortId?: string | null;
  students: ParsedStudentRow[];
  appOrigin?: string;
}): Promise<BulkInviteResult> {
  const { supabase, company } = await requireTenantStaff(input.companyId);

  const courseId = input.courseId && input.courseId !== "all" ? input.courseId : null;
  const cohortId = input.cohortId && input.cohortId !== "all" ? input.cohortId : null;

  if (input.students.length === 0) {
    throw new Error("No valid student emails provided.");
  }

  const batch = input.students.slice(0, 200);
  let enrolledCount = 0;
  let invitedCount = 0;
  let alreadyEnrolledCount = 0;
  const failed: { email: string; reason: string }[] = [];

  const origin =
    input.appOrigin ||
    process.env.NEXT_PUBLIC_APP_URL ||
    "https://zed-ai-academy.vercel.app";

  const joinParams = new URLSearchParams();
  if (courseId) joinParams.set("courseId", courseId);
  if (cohortId) joinParams.set("cohortId", cohortId);
  const joinQuery = joinParams.toString();
  const redirectUrl = `${origin}/academy/${company.slug}/join${joinQuery ? `?${joinQuery}` : ""}`;

  const clerk = await clerkClient();

  for (const row of batch) {
    const normalizedEmail = row.email.trim().toLowerCase();

    try {
      const { data: existingProfile } = await supabase
        .from("profiles")
        .select("id")
        .ilike("email", normalizedEmail)
        .maybeSingle();

      if (existingProfile) {
        // Existing account: ensure active tenant membership without demoting existing staff
        const { data: existingMember } = await supabase
          .from("company_members")
          .select("id, role, status")
          .eq("company_id", company.id)
          .eq("profile_id", existingProfile.id)
          .maybeSingle();

        if (!existingMember) {
          await supabase.from("company_members").insert({
            company_id: company.id,
            profile_id: existingProfile.id,
            role: "learner",
            status: "active",
            joined_at: new Date().toISOString(),
          });
        } else if (existingMember.status !== "active") {
          await supabase
            .from("company_members")
            .update({ status: "active", joined_at: new Date().toISOString() })
            .eq("id", existingMember.id);
        }

        let wasAlreadyEnrolled = Boolean(existingMember && existingMember.status === "active" && !courseId);

        if (courseId) {
          const { data: existingEnroll } = await supabase
            .from("enrollments")
            .select("id, status")
            .eq("user_id", existingProfile.id)
            .eq("course_id", courseId)
            .maybeSingle();

          if (existingEnroll?.status === "active") {
            wasAlreadyEnrolled = true;
          } else if (existingEnroll) {
            await supabase
              .from("enrollments")
              .update({ status: "active", company_id: company.id, notes: "Enrolled by academy admin" })
              .eq("id", existingEnroll.id);
          } else {
            await supabase.from("enrollments").insert({
              user_id: existingProfile.id,
              course_id: courseId,
              company_id: company.id,
              source: "manual_admin",
              status: "active",
              notes: "Enrolled by academy admin",
            });
          }
        }

        if (cohortId) {
          const { data: existingGroupMember } = await supabase
            .from("classroom_group_members")
            .select("id")
            .eq("group_id", cohortId)
            .eq("profile_id", existingProfile.id)
            .maybeSingle();

          if (!existingGroupMember) {
            await supabase
              .from("classroom_group_members")
              .insert({ group_id: cohortId, profile_id: existingProfile.id });
          }
        }

        if (wasAlreadyEnrolled) {
          alreadyEnrolledCount++;
        } else {
          enrolledCount++;
        }
      } else {
        // New user: dispatch Clerk invitation carrying tenant/course/cohort assignment
        await clerk.invitations.createInvitation({
          emailAddress: normalizedEmail,
          redirectUrl,
          ignoreExisting: true,
          publicMetadata: {
            invitedCompanyId: company.id,
            invitedCompanySlug: company.slug,
            invitedCourseId: courseId,
            invitedCohortId: cohortId,
            invitedFullName: row.fullName || null,
          },
        });
        invitedCount++;
      }
    } catch (err) {
      failed.push({
        email: normalizedEmail,
        reason: err instanceof Error ? err.message : "Unable to process invite",
      });
    }
  }

  revalidatePath(`/academy/${company.slug}/admin/enrollments`);
  revalidatePath(`/academy/${company.slug}/classroom`);

  return {
    enrolledCount,
    invitedCount,
    alreadyEnrolledCount,
    failed,
  };
}
