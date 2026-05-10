"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@clerk/nextjs/server";
import { createServiceClient } from "@/lib/supabase/server";

async function requireAdmin() {
  const { userId } = await auth();
  if (!userId) throw new Error("Not authenticated");

  const supabase = createServiceClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .single();

  if (profile?.role !== "super_admin" && profile?.role !== "instructor") {
    throw new Error("Not authorized");
  }
  return { userId, supabase };
}

export async function activateEnrollment(enrollmentId: string) {
  const { supabase } = await requireAdmin();

  const { data, error } = await supabase
    .from("enrollments")
    .update({ status: "active" })
    .eq("id", enrollmentId)
    .select("course_id, user_id, courses(slug)")
    .single();

  if (error) throw new Error(error.message);

  const slug = (data as unknown as { courses: { slug: string } | null }).courses?.slug;
  revalidatePath("/admin/students");
  if (slug) {
    revalidatePath(`/courses/${slug}`);
    revalidatePath("/dashboard");
  }
}

export async function revokeEnrollment(enrollmentId: string) {
  const { supabase } = await requireAdmin();

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
