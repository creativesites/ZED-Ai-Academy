import "server-only";

import { createServiceClient } from "@/lib/supabase/server";
import { isTeachingRole } from "@/lib/tenants/roles";
import type { CompanyMemberRole } from "@/types/database";

export type CourseEditorAccess = {
  courseId: string;
  companyId: string | null;
  /** The caller may delete the course (owner-level), not just edit it. */
  canDelete: boolean;
};

/**
 * Who may edit a course: its instructor, a platform super admin, or an active
 * teaching member (company_admin / instructor / teacher) of the academy that
 * owns it. Decided from company_members — never from profiles.role or the
 * Clerk active organization, which can point at another academy.
 */
export async function getCourseEditorAccess(courseId: string, userId: string): Promise<CourseEditorAccess | null> {
  const supabase = createServiceClient();
  const { data: course } = await supabase
    .from("courses")
    .select("id, instructor_id, company_id")
    .eq("id", courseId)
    .maybeSingle();
  if (!course) return null;

  const [{ data: profile }, { data: member }] = await Promise.all([
    supabase.from("profiles").select("role").eq("id", userId).maybeSingle(),
    course.company_id
      ? supabase
          .from("company_members")
          .select("role")
          .eq("company_id", course.company_id)
          .eq("profile_id", userId)
          .eq("status", "active")
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  const memberRole = (member?.role ?? null) as CompanyMemberRole | null;
  const isSuperAdmin = profile?.role === "super_admin";
  const isInstructor = course.instructor_id === userId;
  if (!isSuperAdmin && !isInstructor && !isTeachingRole(memberRole)) return null;

  return {
    courseId: course.id,
    companyId: course.company_id,
    canDelete: isSuperAdmin || isInstructor || memberRole === "company_admin",
  };
}

export async function requireCourseEditor(courseId: string, userId: string): Promise<CourseEditorAccess> {
  const access = await getCourseEditorAccess(courseId, userId);
  if (!access) throw new Error("Unauthorized");
  return access;
}
