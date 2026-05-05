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

    // 4. Enroll in Free Course (if configured)
    const { data: setting } = await (supabase as any)
      .from("site_settings")
      .select("value")
      .eq("key", "onboarding_course_id")
      .single();

    const courseId = setting?.value as string;
    if (courseId && courseId !== "00000000-0000-0000-0000-000000000000") {
      // Check if already enrolled
      const { data: existing } = await supabase
        .from("enrollments")
        .select("id")
        .eq("user_id", userId)
        .eq("course_id", courseId)
        .maybeSingle();

      if (!existing) {
        await supabase.from("enrollments").insert({
          user_id: userId,
          course_id: courseId,
          status: "active",
        });
      }
    }

    return { success: true };
  } catch (err: any) {
    console.error("Onboarding Error:", err);
    return { error: err.message || "There was an error updating your profile." };
  }
}
