import { createClient } from "@/lib/supabase/server";
import { evaluateCourseManageAccess } from "./course-auth";

export async function canManageCourse(
  supabase: ReturnType<typeof createClient>,
  courseId: string,
  userId: string
): Promise<{
  allowed: boolean;
  course: { id: string; instructor_id: string | null; company_id: string | null } | null;
}> {
  const { data: course } = await supabase
    .from("courses")
    .select("id, instructor_id, company_id")
    .eq("id", courseId)
    .maybeSingle();

  if (!course) {
    return { allowed: false, course: null };
  }

  const [{ data: profile }, memberResult, companyResult] = await Promise.all([
    supabase.from("profiles").select("role").eq("id", userId).maybeSingle(),
    course.company_id
      ? supabase
          .from("company_members")
          .select("role, status")
          .eq("company_id", course.company_id)
          .eq("profile_id", userId)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    course.company_id
      ? supabase
          .from("companies")
          .select("admin_id")
          .eq("id", course.company_id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  const allowed = evaluateCourseManageAccess({
    userId,
    courseInstructorId: course.instructor_id,
    courseCompanyId: course.company_id,
    profileRole: profile?.role,
    companyAdminId: companyResult.data?.admin_id ?? null,
    membershipStatus: memberResult.data?.status ?? null,
    membershipRole: memberResult.data?.role ?? null,
  });

  return { allowed, course };
}

export async function assertCanManageCourse(
  supabase: ReturnType<typeof createClient>,
  courseId: string,
  userId: string
) {
  const { allowed, course } = await canManageCourse(supabase, courseId, userId);
  if (!course) throw new Error("Course not found.");
  if (!allowed) throw new Error("Unauthorized");
  return course;
}
