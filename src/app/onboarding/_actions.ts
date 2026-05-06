"use server";

import { auth, clerkClient } from "@clerk/nextjs/server";
import { createServiceClient } from "@/lib/supabase/server";

export async function completeOnboarding(formData: FormData) {
  const { userId, sessionClaims } = await auth();

  if (!userId) {
    return { error: "No signed-in user" };
  }

  const fullName = formData.get("fullName") as string;
  const platform = sessionClaims?.sourse_platform || "web";

  if (!fullName) {
    return { error: "Full name is required" };
  }

  const client = await clerkClient();
  const supabase = createServiceClient();

  try {
    // 1. Update Clerk Metadata
    await client.users.updateUser(userId, {
      publicMetadata: {
        onboardingComplete: true,
      },
    });

    // 2. Update Profiles table
    await supabase
      .from("profiles")
      .update({
        full_name: fullName,
        onboarding_completed: true,
      })
      .eq("id", userId);

    // 3. Track Platform
    await (supabase as any)
      .from("user_platforms")
      .upsert({
        user_id: userId,
        platform: platform,
        last_seen_at: new Date().toISOString(),
      });

    const enrollCourseSlug = formData.get("enrollCourse") as string;
    let redirectUrl = "/dashboard";

    // 4. Handle Specific Course Auto-Enrollment (if requested via query param)
    if (enrollCourseSlug) {
      const { data: requestedCourse } = await supabase
        .from("courses")
        .select("id, slug, price_type")
        .eq("slug", enrollCourseSlug)
        .single();

      if (requestedCourse) {
        if (requestedCourse.price_type === "free") {
          // Auto-enroll in free course
          await (supabase as any).from("enrollments").upsert({
            user_id: userId,
            course_id: requestedCourse.id,
            status: "active",
            source: "individual_purchase",
          }, { onConflict: "user_id,course_id" });
          redirectUrl = `/courses/${requestedCourse.slug}/learn`;
        } else {
          // Redirect to paid course page (where popup logic can trigger)
          redirectUrl = `/courses/${requestedCourse.slug}?action=enroll`;
        }
      }
    } else {
      // 5. Fallback: Enroll in Global Onboarding Course (if configured)
      const { data: setting } = await (supabase as any)
        .from("site_settings")
        .select("value")
        .eq("key", "onboarding_course_id")
        .single();

      const globalCourseId = setting?.value as string;
      if (globalCourseId && globalCourseId !== "00000000-0000-0000-0000-000000000000") {
        await (supabase as any).from("enrollments").upsert({
          user_id: userId,
          course_id: globalCourseId,
          status: "active",
          source: "manual_admin",
        }, { onConflict: "user_id,course_id" });
      }
    }

    return { success: true, redirectUrl };
  } catch (err: any) {
    console.error("Onboarding Error:", err);
    return { error: err.message || "There was an error updating your profile." };
  }
}
