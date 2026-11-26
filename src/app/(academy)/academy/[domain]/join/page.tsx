import { auth, clerkClient, currentUser } from "@clerk/nextjs/server";
import { notFound, redirect } from "next/navigation";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { JoinClient } from "./join-client";
import { ensureTenantMembership, validateAndJoinStaff } from "@/actions/tenants";
import { resolveJoinAssignments } from "@/lib/tenants/join-decision";
import { staffCodeMatches } from "@/lib/tenants/staff-code";

export const metadata = {
  title: "Join Academy",
};

interface JoinPageProps {
  params: Promise<{ domain: string }>;
  // courseId / cohortId query params are deliberately ignored: course and cohort assignments
  // come only from the invite metadata an admin set on the user (see resolveJoinAssignments).
  searchParams: Promise<{ code?: string; role?: string }>;
}

async function applyPendingLearnerAssignments({
  userId,
  companyId,
  courseId,
  cohortId,
}: {
  userId: string;
  companyId: string;
  courseId?: string | null;
  cohortId?: string | null;
}) {
  if (!courseId && !cohortId) return;
  const service = createServiceClient();

  if (courseId) {
    const { data: validCourse } = await service
      .from("courses")
      .select("id")
      .eq("id", courseId)
      .eq("company_id", companyId)
      .maybeSingle();

    if (validCourse) {
      const { data: existingEnroll } = await service
        .from("enrollments")
        .select("id, status")
        .eq("user_id", userId)
        .eq("course_id", courseId)
        .maybeSingle();

      if (!existingEnroll) {
        await service.from("enrollments").insert({
          user_id: userId,
          course_id: courseId,
          company_id: companyId,
          source: "manual_admin",
          status: "active",
          notes: "Enrolled via academy invitation",
        });
      } else if (existingEnroll.status === "pending_payment") {
        // An admin invite to this course outranks a pending checkout. Revoked access stays revoked.
        await service
          .from("enrollments")
          .update({ status: "active", company_id: companyId })
          .eq("id", existingEnroll.id);
      }
    }
  }

  if (cohortId) {
    const { data: validGroup } = await service
      .from("classroom_groups")
      .select("id")
      .eq("id", cohortId)
      .eq("company_id", companyId)
      .maybeSingle();

    if (validGroup) {
      const { data: existingMember } = await service
        .from("classroom_group_members")
        .select("profile_id")
        .eq("group_id", cohortId)
        .eq("profile_id", userId)
        .maybeSingle();

      if (!existingMember) {
        await service
          .from("classroom_group_members")
          .insert({ group_id: cohortId, profile_id: userId });
      }
    }
  }
}

export default async function TenantJoinPage({
  params,
  searchParams,
}: JoinPageProps) {
  const { domain } = await params;
  const { code, role: rawRole } = await searchParams;
  const { userId } = await auth();

  const supabase = createClient();
  const { data: company } = await supabase
    .from("companies")
    .select("id, name, slug, logo_url, primary_color, teacher_code, status")
    .eq("slug", domain)
    .single();

  if (!company || company.status === "suspended") {
    notFound();
  }

  const role: "teacher" | "learner" = rawRole === "teacher" ? "teacher" : "learner";
  // Only these fields reach the browser. Never pass teacher_code to the client.
  const publicCompany = {
    id: company.id,
    name: company.name,
    slug: company.slug,
    logo_url: company.logo_url,
    primary_color: company.primary_color,
  };

  // Check if current user is already a member
  let isAlreadyMember = false;
  let memberRole: string | null = null;

  if (userId) {
    const user = await currentUser();
    const invite = resolveJoinAssignments(
      company.id,
      (user?.publicMetadata ?? null) as Parameters<typeof resolveJoinAssignments>[1]
    );
    const effectiveCourseId = invite.courseId;
    const effectiveCohortId = invite.cohortId;
    // Invite metadata is single-use: clear it once applied so it can't be replayed.
    const clearInvite = async () => {
      if (!invite.shouldClearInviteMetadata) return;
      try {
        const client = await clerkClient();
        await client.users.updateUserMetadata(userId, {
          publicMetadata: { invitedCompanyId: null, invitedCourseId: null, invitedCohortId: null },
        });
      } catch (err) {
        console.error("[join] failed to clear invite metadata", err);
      }
    };

    const { data: member } = await supabase
      .from("company_members")
      .select("role, status")
      .eq("company_id", company.id)
      .eq("profile_id", userId)
      .maybeSingle();

    if (member && member.status === "active") {
      isAlreadyMember = true;
      memberRole = member.role;

      await applyPendingLearnerAssignments({
        userId,
        companyId: company.id,
        courseId: effectiveCourseId,
        cohortId: effectiveCohortId,
      });
      await clearInvite();

      // If already a member with sufficient role, send them directly
      if (role === "teacher" && (member.role === "teacher" || member.role === "company_admin")) {
        redirect(`/academy/${company.slug}/admin`);
      }
      if (role === "learner") {
        redirect(`/academy/${company.slug}/classroom`);
      }
    }

    // Members an admin removed or suspended can't re-admit themselves through this page.
    if (member && member.status !== "active") {
      return (
        <JoinClient
          company={publicCompany}
          role={role}
          isSignedIn
          isAlreadyMember={false}
          membershipInactive
        />
      );
    }

    // Auto-join if valid credentials provided
    if (role === "teacher" && staffCodeMatches(company.teacher_code, code)) {
      await validateAndJoinStaff(company.slug, code ?? "");
      redirect(`/academy/${company.slug}/admin`);
    }

    if (role === "learner" && !isAlreadyMember) {
      await ensureTenantMembership(userId, company.id, "learner");
      await applyPendingLearnerAssignments({
        userId,
        companyId: company.id,
        courseId: effectiveCourseId,
        cohortId: effectiveCohortId,
      });
      await clearInvite();
      redirect(`/academy/${company.slug}/classroom`);
    }
  }

  return (
    <JoinClient
      company={publicCompany}
      initialCode={code}
      role={role}
      isSignedIn={Boolean(userId)}
      isAlreadyMember={isAlreadyMember}
      memberRole={memberRole}
    />
  );
}