"use server";

import { auth, currentUser } from "@clerk/nextjs/server";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function getClassroomDiscussions(companyId: string) {
  const { userId } = await auth();
  if (!userId) return [];

  const supabase = createClient();
  // Using the discussions table. We'll need to ensure company_id is a column or use a metadata field.
  // Assuming we use company_id for classroom-wide discussions.
  const { data, error } = await supabase
    .from("discussions")
    .select("*")
    .eq("company_id", companyId)
    .is("lesson_id", null) // Classroom level discussions don't have a lesson_id
    .order("created_at", { ascending: false });

  if (error) {
    // If company_id column doesn't exist yet, return empty
    console.error("Discussions fetch error:", error);
    return [];
  }
  
  if (!data || data.length === 0) return [];
  
  const discussionUserIds = [...new Set(data.map((d: any) => d.user_id as string))];
  const { data: profilesData } = await supabase
    .from("profiles")
    .select("id, full_name, avatar_url")
    .in("id", discussionUserIds);
    
  const profileMap: Record<string, any> = {};
  for (const p of profilesData ?? []) {
    profileMap[(p as any).id] = { full_name: (p as any).full_name, avatar_url: (p as any).avatar_url };
  }
  
  return data.map((d: any) => ({
    ...d,
    profiles: profileMap[d.user_id] ?? null
  }));
}

export async function postClassroomDiscussion(companyId: string, companySlug: string, content: string) {
  const { userId } = await auth();
  if (!userId) throw new Error("Sign in to post.");

  const trimmed = content.trim();
  if (!trimmed) throw new Error("Message cannot be empty.");

  const supabase = createClient();

  // Classroom discussions currently use the 'discussions' table which requires a course_id (NOT NULL).
  // We'll find a valid course_id for this user/company to satisfy the constraint and RLS policies.
  
  // 1. Try to find a course the user is enrolled in within this company
  const { data: enrollment } = await supabase
    .from("enrollments")
    .select("course_id")
    .eq("user_id", userId)
    .eq("company_id", companyId)
    .eq("status", "active")
    .limit(1)
    .maybeSingle();

  let validCourseId = enrollment?.course_id;

  // 2. If no enrollment (e.g. admin/teacher), just pick any course from the company
  if (!validCourseId) {
    const { data: companyCourse } = await supabase
      .from("courses")
      .select("id")
      .eq("company_id", companyId)
      .limit(1)
      .maybeSingle();
    validCourseId = companyCourse?.id;
  }

  if (!validCourseId) {
    throw new Error("This academy needs at least one course to enable discussions.");
  }

  const { error } = await supabase.from("discussions").insert({
    company_id: companyId,
    course_id: validCourseId,
    user_id: userId,
    content: trimmed,
    is_public: true,
    status: 'approved',
  } as any);

  if (error) {
    console.error("Discussion post error:", error);
    throw new Error(error.message);
  }

  revalidatePath(`/classroom/${companySlug}`);
}
