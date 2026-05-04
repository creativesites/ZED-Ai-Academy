"use server";

import { auth } from "@clerk/nextjs/server";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function submitReview(courseId: string, courseSlug: string, formData: FormData) {
  const { userId } = await auth();
  if (!userId) throw new Error("Sign in to leave a review.");

  const rating = Number(formData.get("rating"));
  const comment = (formData.get("comment") as string)?.trim() || null;

  if (!rating || rating < 1 || rating > 5) throw new Error("Select a rating between 1 and 5.");

  const supabase = createClient();

  // Verify enrollment
  const { data: enrollment } = await supabase
    .from("enrollments")
    .select("id")
    .eq("user_id", userId)
    .eq("course_id", courseId)
    .maybeSingle();

  if (!enrollment) throw new Error("Enroll in this course before reviewing.");

  const { error } = await supabase
    .from("reviews")
    .upsert({ user_id: userId, course_id: courseId, rating, comment }, { onConflict: "user_id,course_id" });

  if (error) throw new Error(error.message);

  revalidatePath(`/courses/${courseSlug}`);
}

export async function deleteReview(courseId: string, courseSlug: string) {
  const { userId } = await auth();
  if (!userId) throw new Error("Not authenticated.");

  const supabase = createClient();
  await supabase.from("reviews").delete().eq("user_id", userId).eq("course_id", courseId);
  revalidatePath(`/courses/${courseSlug}`);
}
