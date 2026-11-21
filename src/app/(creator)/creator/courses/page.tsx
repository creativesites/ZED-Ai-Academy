import { auth } from "@clerk/nextjs/server";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { formatPrice } from "@/lib/course-experience";
import { ArrowRight, BookOpen, GraduationCap, Layers, Palette, Plus, Sparkles } from "lucide-react";
import type { Course } from "@/types/database";

export const metadata = { title: "My Courses — Creator" };

const STATUS_COLORS: Record<Course["status"], string> = {
  published: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  draft: "bg-amber-50 text-amber-700 ring-amber-200",
  archived: "bg-slate-100 text-slate-600 ring-slate-200",
};

export default async function CreatorCoursesPage() {
  const { userId, orgId } = await auth();
  if (!userId) redirect("/sign-in");

  const supabase = createClient();
  let query = supabase.from("courses").select("*").order("created_at", { ascending: false });

  if (orgId) {
    query = query.eq("company_id", orgId);
  } else {
    query = query.eq("instructor_id", userId);
  }

  const { data: courses } = await query;
  const courseIds = (courses ?? []).map((c) => c.id);

  // Lesson + learner counts per course, so the list shows real progress at a glance.
  const [modulesRes, enrollRes] = await Promise.all([
    courseIds.length
      ? supabase.from("modules").select("id, course_id").in("course_id", courseIds)
      : Promise.resolve({ data: [] as { id: string; course_id: string }[] }),
    courseIds.length
      ? supabase.from("enrollments").select("course_id").in("course_id", courseIds)
      : Promise.resolve({ data: [] as { course_id: string }[] }),
  ]);
  const moduleToCourse = new Map(((modulesRes.data ?? []) as { id: string; course_id: string }[]).map((m) => [m.id, m.course_id]));
  const lessonsRes = moduleToCourse.size
    ? await supabase.from("lessons").select("module_id").in("module_id", [...moduleToCourse.keys()])
    : { data: [] as { module_id: string }[] };
  const lessonCounts: Record<string, number> = {};
  for (const l of (lessonsRes.data ?? []) as { module_id: string }[]) {
    const cid = moduleToCourse.get(l.module_id);
    if (cid) lessonCounts[cid] = (lessonCounts[cid] ?? 0) + 1;
  }
  const learnerCounts: Record<string, number> = {};
  for (const e of (enrollRes.data ?? []) as { course_id: string }[]) {
    learnerCounts[e.course_id] = (learnerCounts[e.course_id] ?? 0) + 1;
  }
  const totalLearners = Object.values(learnerCounts).reduce((a, b) => a + b, 0);

  const publishedCount = courses?.filter((course) => course.status === "published").length ?? 0;
  const draftCount = courses?.filter((course) => course.status === "draft").length ?? 0;

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6 px-4 py-6 sm:py-10">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[#062e39] sm:text-3xl">Your courses</h1>
          <p className="mt-1 text-sm text-slate-500">
            {courses?.length ?? 0} course{courses?.length === 1 ? "" : "s"} · {publishedCount} live · {draftCount} draft
            {draftCount === 1 ? "" : "s"} · {totalLearners} learner{totalLearners === 1 ? "" : "s"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/creator/settings"
            className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-[#062e39] hover:bg-slate-50"
          >
            <Palette className="h-4 w-4 text-slate-500" />
            Settings
          </Link>
          <Link
            href="/creator/courses/new"
            className="inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-xl bg-[#fd5523] px-5 text-sm font-semibold text-white shadow-sm hover:bg-[#ef4a16] sm:flex-none"
          >
            <Plus className="h-4 w-4" />
            New course
          </Link>
        </div>
      </div>

      {courses && courses.length > 0 ? (
        <ul className="space-y-3">
          {courses.map((course) => {
            const lessons = lessonCounts[course.id] ?? 0;
            const learners = learnerCounts[course.id] ?? 0;
            return (
              <li key={course.id}>
                <Link
                  href={`/creator/courses/${course.id}`}
                  className="group flex items-center gap-3 rounded-2xl border border-slate-200/80 bg-white p-3 transition-all hover:border-slate-300 hover:shadow-sm sm:gap-4 sm:p-4"
                >
                  <div className="relative aspect-video w-24 shrink-0 overflow-hidden rounded-xl bg-gradient-to-br from-[#062e39] to-[#0d4d5e] sm:w-40">
                    {course.thumbnail_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={course.thumbnail_url} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center">
                        <BookOpen className="h-6 w-6 text-white/30" />
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="mb-1 flex items-center gap-2">
                      <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-px text-[11px] font-semibold ring-1 ring-inset", STATUS_COLORS[course.status])}>
                        {course.status === "published" ? "Live" : course.status === "draft" ? "Draft" : "Archived"}
                      </span>
                      <span className="truncate text-xs text-slate-500">{formatPrice(course.price_type, course.price_amount)}</span>
                    </div>
                    <h2 className="line-clamp-2 text-[15px] font-semibold leading-snug text-[#062e39] group-hover:text-[#fd5523] sm:text-base">
                      {course.title}
                    </h2>
                    <p className="mt-1 flex flex-wrap gap-x-3 text-xs text-slate-500">
                      <span className="inline-flex items-center gap-1"><Layers className="h-3.5 w-3.5" />{lessons} lesson{lessons === 1 ? "" : "s"}</span>
                      <span className="inline-flex items-center gap-1"><GraduationCap className="h-3.5 w-3.5" />{learners} learner{learners === 1 ? "" : "s"}</span>
                    </p>
                  </div>
                  <ArrowRight className="hidden h-5 w-5 shrink-0 text-slate-300 transition-transform group-hover:translate-x-0.5 group-hover:text-[#fd5523] sm:block" />
                </Link>
              </li>
            );
          })}
        </ul>
      ) : (
        <div className="rounded-2xl border-2 border-dashed border-slate-200 bg-white px-4 py-14 text-center sm:py-20">
          <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#fff6ee] text-[#fd5523]">
            <Sparkles className="h-7 w-7" />
          </div>
          <h2 className="text-xl font-bold text-[#062e39]">Create your first course</h2>
          <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-slate-500">
            Describe your idea and AI drafts the outline — or start from scratch. You can publish when it&apos;s ready.
          </p>
          <Link
            href="/creator/courses/new"
            className="mt-6 inline-flex h-11 items-center gap-2 rounded-xl bg-[#fd5523] px-6 text-sm font-semibold text-white hover:bg-[#ef4a16]"
          >
            Create course
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      )}
    </div>
  );
}
