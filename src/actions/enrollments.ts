"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth, currentUser } from "@clerk/nextjs/server";
import { createClient } from "@/lib/supabase/server";
import { sendEnrollmentConfirmation } from "@/lib/email/emailjs";

export type ManualEnrollResult =
  | { success: true; enrollmentId: string; courseTitle: string; priceLabel: string }
  | { success: false; error: string };

export async function enrollManual(
  courseId: string,
  courseSlug: string,
  studentPhone: string
): Promise<ManualEnrollResult> {
  const { userId } = await auth();
  if (!userId) return { success: false, error: "Not signed in" };

  const supabase = createClient();

  const { data: course } = await supabase
    .from("courses")
    .select("id, title, price_type, price_amount, status, slug")
    .eq("id", courseId)
    .single();

  if (!course || course.status !== "published")
    return { success: false, error: "Course not available" };

  const { data: existing } = await supabase
    .from("enrollments")
    .select("id, status")
    .eq("user_id", userId)
    .eq("course_id", courseId)
    .maybeSingle();

  if (existing) {
    if (existing.status === "active") return { success: false, error: "already_enrolled" };
    if (existing.status === "pending_payment") return { success: false, error: "already_pending" };
  }

  const { data: enrollment, error } = await supabase
    .from("enrollments")
    .insert({
      user_id: userId,
      course_id: courseId,
      source: "individual_purchase",
      status: "pending_payment",
      student_phone: studentPhone,
    })
    .select("id")
    .single();

  if (error || !enrollment)
    return { success: false, error: error?.message ?? "Enrollment failed" };

  const priceLabel = course.price_amount
    ? `ZK ${Number(course.price_amount).toLocaleString()}`
    : "See pricing";

  revalidatePath(`/courses/${courseSlug}`);
  revalidatePath("/dashboard");

  return { success: true, enrollmentId: enrollment.id, courseTitle: course.title, priceLabel };
}

export async function enrollFree(courseId: string, courseSlug: string) {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const supabase = createClient();

  const { data: course } = await supabase
    .from("courses")
    .select("id, title, price_type, status, slug")
    .eq("id", courseId)
    .single();

  if (!course || course.status !== "published") throw new Error("Course not available");
  if (course.price_type !== "free") throw new Error("This course requires payment");

  const { data: existing } = await supabase
    .from("enrollments")
    .select("id")
    .eq("user_id", userId)
    .eq("course_id", courseId)
    .maybeSingle();

  if (existing) redirect(`/courses/${courseSlug}/learn`);

  const { error } = await supabase.from("enrollments").insert({
    user_id: userId,
    course_id: courseId,
    source: "individual_purchase",
  });

  if (error) throw new Error(error.message);

  // Send confirmation email (non-blocking)
  const clerkUser = await currentUser();
  const email = clerkUser?.emailAddresses.find(
    (e) => e.id === clerkUser.primaryEmailAddressId
  )?.emailAddress;

  if (email) {
    const firstName = clerkUser?.firstName ?? clerkUser?.fullName?.split(" ")[0] ?? "there";
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
    sendEnrollmentConfirmation({
      toEmail: email,
      toName: firstName,
      courseTitle: course.title,
      courseUrl: `${appUrl}/courses/${courseSlug}/learn`,
    }).catch(console.error);
  }

  revalidatePath("/dashboard");
  revalidatePath(`/courses/${courseSlug}`);
  redirect(`/courses/${courseSlug}/learn`);
}
