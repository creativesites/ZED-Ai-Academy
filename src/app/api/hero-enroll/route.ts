import { NextRequest, NextResponse } from "next/server";
import { auth, currentUser } from "@clerk/nextjs/server";
import { createClient } from "@/lib/supabase/server";
import { sendEnrollmentConfirmation } from "@/lib/email/emailjs";

/**
 * POST /api/hero-enroll
 * Quick-enroll a signed-in user into a free course from the hero section.
 */
export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const { courseId, courseSlug } = await req.json();
  if (!courseId || !courseSlug) {
    return NextResponse.json({ error: "Missing courseId or courseSlug" }, { status: 400 });
  }

  const supabase = createClient();

  const { data: course } = await supabase
    .from("courses")
    .select("id, title, price_type, status, slug")
    .eq("id", courseId)
    .single();

  if (!course || course.status !== "published") {
    return NextResponse.json({ error: "Course not available" }, { status: 404 });
  }

  if (course.price_type !== "free") {
    // Not free — redirect to course page instead
    return NextResponse.json({ redirect: `/courses/${courseSlug}` });
  }

  // Check existing enrollment
  const { data: existing } = await supabase
    .from("enrollments")
    .select("id")
    .eq("user_id", userId)
    .eq("course_id", courseId)
    .maybeSingle();

  if (existing) {
    return NextResponse.json({ redirect: `/courses/${courseSlug}/learn` });
  }

  // Ensure profile exists
  const clerkUser = await currentUser();
  const email = clerkUser?.emailAddresses.find(
    (e) => e.id === clerkUser.primaryEmailAddressId
  )?.emailAddress;

  await supabase.from("profiles").upsert({
    id: userId,
    full_name: [clerkUser?.firstName, clerkUser?.lastName].filter(Boolean).join(" ") || null,
    email,
    avatar_url: clerkUser?.imageUrl,
    updated_at: new Date().toISOString(),
  }, { onConflict: "id", ignoreDuplicates: true });

  // Enroll
  const { error } = await supabase.from("enrollments").insert({
    user_id: userId,
    course_id: courseId,
    source: "individual_purchase",
    status: "active",
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Send confirmation email (non-blocking)
  if (email) {
    const firstName = clerkUser?.firstName ?? "there";
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
    sendEnrollmentConfirmation({
      toEmail: email,
      toName: firstName,
      courseTitle: course.title,
      courseUrl: `${appUrl}/courses/${courseSlug}/learn`,
    }).catch(console.error);
  }

  return NextResponse.json({ redirect: `/courses/${courseSlug}/learn` });
}
