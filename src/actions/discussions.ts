"use server";

import { auth, currentUser } from "@clerk/nextjs/server";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function postDiscussion(courseId: string, courseSlug: string, lessonId: string, content: string, parentId?: string, isPublic: boolean = true) {
  const { userId } = await auth();
  if (!userId) throw new Error("Sign in to post.");

  const trimmed = content.trim();
  if (!trimmed) throw new Error("Message cannot be empty.");
  if (trimmed.length > 2000) throw new Error("Message too long (max 2000 chars).");

  const supabase = createClient();

  // Ensure the user has a profile row (required by FK on discussions.user_id)
  const clerkUser = await currentUser();
  if (clerkUser) {
    const email = clerkUser.emailAddresses.find(
      (e) => e.id === clerkUser.primaryEmailAddressId
    )?.emailAddress;
    await supabase.from("profiles").upsert(
      {
        id: userId,
        full_name: [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(" ") || null,
        email: email ?? null,
        avatar_url: clerkUser.imageUrl ?? null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "id", ignoreDuplicates: true }
    );
  }

  // Try insert with the new columns (requires migration 20260506000001 to be applied)
  let { error } = await supabase.from("discussions").insert({
    course_id: courseId,
    lesson_id: lessonId,
    user_id: userId,
    parent_id: parentId ?? null,
    content: trimmed,
    is_public: isPublic,
    status: 'approved',
  });

  // If the new columns don't exist yet (migration not applied), retry without them
  if (error && (error.message.includes("is_public") || error.message.includes("status"))) {
    const { error: fallbackError } = await supabase.from("discussions").insert({
      course_id: courseId,
      lesson_id: lessonId,
      user_id: userId,
      parent_id: parentId ?? null,
      content: trimmed,
    });
    if (fallbackError) {
      console.error("Discussion insert error:", fallbackError);
      throw new Error(fallbackError.message);
    }
  } else if (error) {
    console.error("Discussion insert error:", error);
    throw new Error(error.message);
  }
  
  revalidatePath(`/courses/${courseSlug}/learn`);
}

export async function updateDiscussionStatus(id: string, courseId: string, status: "approved" | "flagged" | "hidden") {
  const { userId } = await auth();
  if (!userId) throw new Error("Not authenticated.");

  const supabase = createClient();
  // Check if instructor and get slug for revalidation
  const { data: course } = await supabase.from("courses").select("slug, instructor_id").eq("id", courseId).single();
  if (course?.instructor_id !== userId) throw new Error("Only instructors can moderate.");

  await supabase.from("discussions").update({ status }).eq("id", id);
  revalidatePath(`/courses/${course.slug}/learn`);
}

export async function deleteDiscussion(id: string, courseId: string) {
  const { userId } = await auth();
  if (!userId) throw new Error("Not authenticated.");

  const supabase = createClient();
  
  // Get slug for revalidation before deleting
  const { data: course } = await supabase.from("courses").select("slug").eq("id", courseId).single();

  await supabase.from("discussions").delete().eq("id", id).eq("user_id", userId);
  
  if (course?.slug) {
    revalidatePath(`/courses/${course.slug}/learn`);
  }
}
