"use server";

import { auth } from "@clerk/nextjs/server";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export async function completeOnboarding(formData: FormData) {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const fullName = (formData.get("full_name") as string)?.trim();
  const level = formData.get("level") as string;
  const goal = formData.get("goal") as string;

  if (!fullName) throw new Error("Please enter your name.");

  const supabase = createClient();
  const { error } = await supabase
    .from("profiles")
    .update({
      full_name: fullName,
      bio: goal ? `Goal: ${goal}` : null,
      onboarding_completed: true,
      updated_at: new Date().toISOString(),
    })
    .eq("id", userId);

  if (error) throw new Error(error.message);

  // Recommend a starter course based on level if available
  const { data: starter } = await supabase
    .from("courses")
    .select("slug")
    .eq("status", "published")
    .eq("level", (level || "beginner") as import("@/types/database").CourseLevel)
    .limit(1)
    .single();

  if (starter) redirect(`/courses/${starter.slug}`);
  redirect("/courses");
}
