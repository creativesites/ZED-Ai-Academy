import Link from "next/link";
import {
  BookOpen, Plus, Eye, Pencil, Users,
  Sparkles, CheckCircle2, Clock
} from "lucide-react";
import { formatPrice } from "@/lib/course-experience";
import { requireTenantAdminPage } from "@/lib/tenants/admin-guard";
import type { Course } from "@/types/database";

export const metadata = {
  title: "Manage Courses — Academy Admin",
};

const STATUS_BADGES: Record<Course["status"], { label: string; className: string }> = {
  published: { label: "Published", className: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  draft: { label: "Draft", className: "bg-amber-50 text-amber-700 border-amber-200" },
  archived: { label: "Archived", className: "bg-slate-100 text-slate-600 border-slate-200" },
};

export default async function TenantAdminCoursesPage({
  params,
}: {
  params: Promise<{ domain: string }>;
}) {
  const { domain } = await params;
  const { supabase, company } = await requireTenantAdminPage(domain);

  // Fetch courses belonging to this tenant
  const { data: coursesRaw } = await supabase
    .from("courses")
    .select("*, profiles(full_name, email)")
    .eq("company_id", company.id)
    .order("created_at", { ascending: false });

  const courses = (coursesRaw ?? []) as any[];

  // Fetch enrollment counts for these courses
  const courseIds = courses.map((c) => c.id);
  const { data: enrollmentRows } = courseIds.length > 0
    ? await supabase.from("enrollments").select("course_id").in("course_id", courseIds)
    : { data: [] };

  const enrollmentMap = new Map<string, number>();
  (enrollmentRows ?? []).forEach((row) => {
    enrollmentMap.set(row.course_id, (enrollmentMap.get(row.course_id) ?? 0) + 1);
  });

  const publishedCount = courses.filter((c) => c.status === "published").length;
  const draftCount = courses.filter((c) => c.status === "draft").length;

  return (
    <div className="container max-w-7xl px-4 py-6 sm:py-8">
      {/* Top Header */}
      <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-center justify-between">
        <div>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#fd5523]/10 text-[#fd5523] text-[10px] font-bold uppercase tracking-wider mb-1.5">
            <Sparkles className="h-3 w-3" />
            <span>Curriculum Studio</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-[#062e39] tracking-tight">
            {company.name} <span className="text-[#fd5523]">Courses</span>
          </h1>
          <p className="mt-1 text-slate-500 text-xs sm:text-sm">
            Manage courses, modular lessons, and monetization for this academy.
          </p>
        </div>

        <div className="flex items-center">
          <Link
            href={`/academy/${company.slug}/admin/courses/new`}
            className="w-full sm:w-auto justify-center flex items-center gap-1.5 h-10 px-4 rounded-xl bg-[#fd5523] text-white text-xs font-semibold hover:bg-[#ef4a16] transition-all shadow-xs"
          >
            <Plus className="h-4 w-4" />
            <span>Create Course</span>
          </Link>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-3 gap-3 sm:gap-4 mb-8">
        <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200/80 shadow-xs flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-slate-100 text-[#062e39] flex items-center justify-center shrink-0">
            <BookOpen className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xl sm:text-2xl font-black text-[#062e39] leading-none">{courses.length}</p>
            <p className="text-[10px] font-black uppercase tracking-wider text-slate-400 mt-1">Total</p>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200/80 shadow-xs flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
            <CheckCircle2 className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xl sm:text-2xl font-black text-[#062e39] leading-none">{publishedCount}</p>
            <p className="text-[10px] font-black uppercase tracking-wider text-slate-400 mt-1">Published</p>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200/80 shadow-xs flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
            <Clock className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xl sm:text-2xl font-black text-[#062e39] leading-none">{draftCount}</p>
            <p className="text-[10px] font-black uppercase tracking-wider text-slate-400 mt-1">Drafts</p>
          </div>
        </div>
      </div>

      {/* Courses Grid */}
      {courses.length === 0 ? (
        <div className="bg-white rounded-2xl sm:rounded-3xl p-8 sm:p-12 text-center border-2 border-dashed border-slate-200 max-w-xl mx-auto my-8">
          <div className="h-14 w-14 rounded-2xl bg-[#fff6ee] text-[#fd5523] flex items-center justify-center mx-auto mb-4">
            <BookOpen className="h-7 w-7" />
          </div>
          <h2 className="text-xl font-black text-[#062e39]">No courses created yet</h2>
          <p className="text-sm text-slate-500 mt-2 mb-6">
            Start building your academy curriculum with modular lessons, interactive quizzes, and AI assistance.
          </p>
          <Link
            href={`/academy/${company.slug}/admin/courses/new`}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-[#fd5523] text-white text-xs font-black uppercase tracking-wider hover:bg-[#ef4a16] transition-all shadow-md"
          >
            <Plus className="h-4 w-4" />
            <span>Create First Course</span>
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {courses.map((course) => {
            const statusConfig = STATUS_BADGES[course.status as Course["status"]] || STATUS_BADGES.draft;
            const studentsCount = enrollmentMap.get(course.id) ?? 0;
            const priceLabel = formatPrice(course.price_type, course.price_amount);

            return (
              <div
                key={course.id}
                className="bg-white rounded-2xl border border-slate-200/80 shadow-xs hover:shadow-md transition-all duration-200 flex flex-col justify-between overflow-hidden group"
              >
                <div>
                  {/* 16:9 Thumbnail */}
                  <div className="aspect-video w-full bg-slate-100 relative overflow-hidden">
                    {course.thumbnail_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={course.thumbnail_url}
                        alt={course.title}
                        className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                    ) : (
                      <div className="h-full w-full flex items-center justify-center bg-gradient-to-br from-[#062e39] to-[#0a4055] text-white/25">
                        <BookOpen className="h-10 w-10" />
                      </div>
                    )}
                    <div className="absolute top-3 left-3">
                      <span className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider border shadow-xs ${statusConfig.className}`}>
                        {statusConfig.label}
                      </span>
                    </div>
                    <div className="absolute top-3 right-3 bg-white/95 backdrop-blur-sm px-2.5 py-1 rounded-lg text-[11px] font-black text-[#062e39] shadow-xs">
                      {priceLabel}
                    </div>
                  </div>

                  {/* Body Content */}
                  <div className="p-5">
                    <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-[#fd5523] mb-1.5">
                      <span>{course.category || "General"}</span>
                      {course.level && (
                        <>
                          <span>•</span>
                          <span className="text-slate-400 capitalize">{course.level}</span>
                        </>
                      )}
                    </div>

                    <h3 className="text-base sm:text-lg font-bold text-[#062e39] tracking-tight group-hover:text-[#fd5523] transition-colors line-clamp-2">
                      {course.title}
                    </h3>

                    {course.description && (
                      <p className="mt-1.5 text-xs text-slate-500 line-clamp-2 leading-relaxed">
                        {course.description}
                      </p>
                    )}

                    <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                      <div className="flex items-center gap-1.5">
                        <Users className="h-3.5 w-3.5 text-slate-400" />
                        <span className="font-bold text-slate-700">{studentsCount}</span> enrolled
                      </div>
                      <span className="text-[10px] text-slate-400 font-mono truncate max-w-[120px]">
                        /{course.slug}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Footer Actions */}
                <div className="px-5 pb-5 pt-0 flex items-center gap-2">
                  <Link
                    href={`/academy/${company.slug}/admin/courses/${course.id}`}
                    className="flex-1 flex items-center justify-center gap-2 h-10 rounded-xl bg-[#062e39] hover:bg-[#0a4055] text-white text-xs font-bold transition-all"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                    <span>Open Studio</span>
                  </Link>

                  <Link
                    href={`/academy/${company.slug}/courses/${course.slug}`}
                    target="_blank"
                    className="h-10 w-10 flex items-center justify-center rounded-xl border border-slate-200 bg-white hover:bg-[#fff6ee] text-slate-500 hover:text-[#fd5523] transition-all"
                    title="Preview Course"
                  >
                    <Eye className="h-4 w-4" />
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}