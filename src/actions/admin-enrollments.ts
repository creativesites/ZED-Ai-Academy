"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@clerk/nextjs/server";
import { createServiceClient } from "@/lib/supabase/server";
import { ensureTenantMembership } from "@/actions/tenants";
import { canAccessTenantAdmin } from "@/lib/tenants/admin-helpers";

async function requireEnrollmentAccess(companyId?: string | null) {
  const { userId } = await auth();
  if (!userId) throw new Error("Not authenticated");

  const supabase = createServiceClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .single();

  if (profile?.role === "super_admin" || profile?.role === "instructor") {
    return { userId, supabase };
  }

  if (companyId) {
    const [{ data: company }, { data: member }] = await Promise.all([
      supabase.from("companies").select("admin_id").eq("id", companyId).maybeSingle(),
      supabase
        .from("company_members")
        .select("role")
        .eq("company_id", companyId)
        .eq("profile_id", userId)
        .eq("status", "active")
        .maybeSingle(),
    ]);

    if (
      canAccessTenantAdmin({
        userId,
        companyAdminId: company?.admin_id ?? null,
        isSuperAdmin: false,
        tenantRole: member?.role ?? null,
      })
    ) {
      return { userId, supabase };
    }
  }

  throw new Error("Not authorized");
}

async function requireAdmin() {
  return requireEnrollmentAccess(null);
}

export async function activateEnrollment(enrollmentId: string) {
  const service = createServiceClient();
  const { data: existing } = await service
    .from("enrollments")
    .select("company_id")
    .eq("id", enrollmentId)
    .maybeSingle();

  const { supabase } = await requireEnrollmentAccess(existing?.company_id ?? null);

  const { data, error } = await supabase
    .from("enrollments")
    .update({ status: "active" })
    .eq("id", enrollmentId)
    .select("course_id, user_id, company_id, courses(slug)")
    .single();

  if (error || !data) throw new Error(error?.message || "Enrollment not found");

  const enrollmentData = data as unknown as {
    course_id: string;
    user_id: string;
    company_id: string | null;
    courses: { slug: string } | null;
  };

  // AUTOMATIC TENANT JOIN ON ACTIVATION
  if (enrollmentData.company_id) {
    await ensureTenantMembership(enrollmentData.user_id, enrollmentData.company_id, "learner");
  }

  const slug = enrollmentData.courses?.slug;
  revalidatePath("/admin/students");
  if (slug) {
    revalidatePath(`/courses/${slug}`);
    revalidatePath("/dashboard");
  }
}

export async function revokeEnrollment(enrollmentId: string) {
  const service = createServiceClient();
  const { data: existing } = await service
    .from("enrollments")
    .select("company_id")
    .eq("id", enrollmentId)
    .maybeSingle();

  const { supabase } = await requireEnrollmentAccess(existing?.company_id ?? null);

  const { data, error } = await supabase
    .from("enrollments")
    .update({ status: "revoked" })
    .eq("id", enrollmentId)
    .select("courses(slug)")
    .single();

  if (error) throw new Error(error.message);

  const slug = (data as unknown as { courses: { slug: string } | null }).courses?.slug;
  revalidatePath("/admin/students");
  if (slug) revalidatePath(`/courses/${slug}`);
}

export async function createManualEnrollment(
  targetUserId: string,
  courseId: string,
  notes?: string
) {
  const { supabase } = await requireAdmin();

  const { data: existing } = await supabase
    .from("enrollments")
    .select("id, status")
    .eq("user_id", targetUserId)
    .eq("course_id", courseId)
    .maybeSingle();

  if (existing) {
    if (existing.status === "active") throw new Error("User is already enrolled");
    // If revoked or pending, re-activate
    const { error } = await supabase
      .from("enrollments")
      .update({ status: "active", notes: notes ?? null })
      .eq("id", existing.id);
    if (error) throw new Error(error.message);
  } else {
    const { data: course } = await supabase.from("courses").select("company_id").eq("id", courseId).single();
    const { error } = await supabase.from("enrollments").insert({
      user_id: targetUserId,
      course_id: courseId,
      company_id: course?.company_id,
      source: "manual_admin",
      status: "active",
      notes: notes ?? null,
    });
    if (error) throw new Error(error.message);

    // AUTOMATIC TENANT JOIN ON MANUAL ENROLLMENT
    if (course?.company_id) {
      await ensureTenantMembership(targetUserId, course.company_id, "learner");
    }
  }

  revalidatePath("/admin/students");
  revalidatePath("/dashboard");
}

export async function activateAllPending() {
  const { supabase } = await requireAdmin();

  const { data, error } = await supabase
    .from("enrollments")
    .update({ status: "active" })
    .eq("status", "pending_payment")
    .select("id");

  if (error) throw new Error(error.message);

  revalidatePath("/admin/students");
  revalidatePath("/dashboard");
  return { count: data?.length ?? 0 };
}
