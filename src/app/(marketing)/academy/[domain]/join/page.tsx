import { auth, currentUser } from "@clerk/nextjs/server";
import { notFound, redirect } from "next/navigation";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { JoinClient } from "./join-client";
import { ensureTenantMembership, validateAndJoinStaff } from "@/actions/tenants";

export const metadata = {
  title: "Join Academy",
};

interface JoinPageProps {
  params: Promise<{ domain: string }>;
  searchParams: Promise<{ code?: string; role?: string; courseId?: string; cohortId?: string }>;
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
      } else if (existingEnroll.status !== "active") {
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
        .select("id")
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
  const { code, role: rawRole, courseId: queryCourseId, cohortId: queryCohortId } = await searchParams;
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

  // Check if current user is already a member
  let isAlreadyMember = false;
  let memberRole: string | null = null;

  if (userId) {
    const user = await currentUser();
    const meta = (user?.publicMetadata ?? {}) as {
      invitedCompanyId?: string;
      invitedCourseId?: string | null;
      invitedCohortId?: string | null;
    };
    const effectiveCourseId =
      queryCourseId || (meta.invitedCompanyId === company.id ? meta.invitedCourseId : null);
    const effectiveCohortId =
      queryCohortId || (meta.invitedCompanyId === company.id ? meta.invitedCohortId : null);

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

      // If already a member with sufficient role, send them directly
      if (role === "teacher" && (member.role === "teacher" || member.role === "company_admin")) {
        redirect(`/academy/${company.slug}/admin`);
      }
      if (role === "learner") {
        redirect(`/academy/${company.slug}/classroom`);
      }
    }

    // Auto-join if valid credentials provided
    if (role === "teacher" && code && code === company.teacher_code) {
      await validateAndJoinStaff(company.slug, code);
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
      redirect(`/academy/${company.slug}/classroom`);
    }
  }

  return (
    <JoinClient
      company={company}
      initialCode={code}
      role={role}
      isSignedIn={Boolean(userId)}
      isAlreadyMember={isAlreadyMember}
      memberRole={memberRole}
    />
  );
}