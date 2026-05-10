import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = createClient();
  const { userId } = await auth();

  const { data: courses } = await supabase
    .from("courses")
    .select("id, slug, title, description, thumbnail_url, category, level, price_type, price_amount, is_featured")
    .eq("status", "published")
    .order("is_featured", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(10);

  const { data: uniqueUsers } = await supabase
    .from("enrollments")
    .select("user_id")
    .eq("status", "active");
  const uniqueStudentCount = new Set(uniqueUsers?.map((e) => e.user_id)).size;

  const totalCourses = courses?.length ?? 0;
  const freeCourses = courses?.filter((c) => c.price_type === "free").length ?? 0;

  const { data: allReviews } = await supabase.from("reviews").select("rating");
  const avgRating =
    allReviews && allReviews.length > 0
      ? (allReviews.reduce((s, r) => s + r.rating, 0) / allReviews.length).toFixed(1)
      : null;

  const { data: enrollData } = await supabase
    .from("enrollments")
    .select("course_id")
    .eq("status", "active");

  const enrollMap: Record<string, number> = {};
  for (const e of enrollData ?? []) {
    enrollMap[e.course_id] = (enrollMap[e.course_id] ?? 0) + 1;
  }

  const enrichedCourses = (courses ?? []).map((c) => ({
    ...c,
    enrollmentCount: enrollMap[c.id] ?? 0,
  }));

  let enrolledCourseIds: string[] = [];
  if (userId) {
    const { data: myEnrollments } = await supabase
      .from("enrollments")
      .select("course_id")
      .eq("user_id", userId)
      .eq("status", "active");
    enrolledCourseIds = (myEnrollments ?? []).map((e) => e.course_id);
  }

  return NextResponse.json({
    courses: enrichedCourses,
    enrolledCourseIds,
    stats: {
      totalCourses,
      freeCourses,
      uniqueStudents: uniqueStudentCount,
      avgRating,
      totalReviews: allReviews?.length ?? 0,
    },
  }, {
    headers: { "Cache-Control": "private, no-cache" },
  });
}
