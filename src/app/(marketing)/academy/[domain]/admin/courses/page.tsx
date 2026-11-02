import { auth } from "@clerk/nextjs/server";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getCurrentTenantAccess, isTeachingRole } from "@/lib/tenants/access";
import { 
  BookOpen, Plus, Eye, Pencil, Users, 
  Sparkles, Layers, ArrowRight, ShieldCheck, CheckCircle2, Clock
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { formatPrice } from "@/lib/course-experience";
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
  const { userId } = await auth();

  if (!userId) {
    redirect(`/sign-in?redirect_url=/academy/${domain}/admin/courses`);
  }

  const supabase = createClient();
  const { data: company } = await supabase
    .from("companies")
    .select("id, name, slug, primary_color")
    .eq("slug", domain)
    .single();

  if (!company) notFound();

  const access = await getCurrentTenantAccess(company.id);
  const isAuthorized = access?.isSuperAdmin || isTeachingRole(access?.tenantRole);

  if (!isAuthorized) {
    redirect(`/academy/${company.slug}/classroom`);
  }

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
    <div className="container max-w-7xl px-4 py-8 md:py-12">
      {/* Top Header */}
      <div className="mb-10 flex flex-col gap-6 md:flex-row md:items-center justify-between">
        <div>
          <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-[#fd5523]/10 text-[#fd5523] text-xs font-black uppercase tracking-wider mb-3">
            <Sparkles className="h-3.5 w-3.5" />
            <span>Curriculum Studio</span>
          </div>
          <h1 className="text-3xl md:text-5xl font-black text-[#062e39] tracking-tight leading-tight md:leading-none uppercase break-words">
            {company.name} <span className="text-[#fd5523]">Courses</span>
          </h1>
          <p className="mt-2 text-slate-500 text-sm sm:text-base font-medium">
            Manage your courses, modular lessons, and monetization for this academy.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href={`/academy/${company.slug}/admin/courses/new`}
            className="flex items-center gap-2 h-14 px-8 rounded-2xl bg-[#fd5523] text-white text-xs font-black uppercase tracking-[0.2em] hover:scale-105 active:scale-95 transition-all shadow-xl shadow-[#fd5523]/20"
          >
            <Plus className="h-4 w-4" />
            <span>Create Course</span>
          </Link>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-10">
        <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm flex items-center gap-4">
          <div className="h-12 w-12 rounded-2xl bg-slate-50 text-[#062e39] flex items-center justify-center shrink-0">
            <BookOpen className="h-6 w-6" />
          </div>
          <div>
            <p className="text-2xl font-black text-[#062e39]">{courses.length}</p>
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Total Curricula</p>
          </div>
        </div>

        <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm flex items-center gap-4">
          <div className="h-12 w-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
            <CheckCircle2 className="h-6 w-6" />
          </div>
          <div>
            <p className="text-2xl font-black text-[#062e39]">{publishedCount}</p>
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Live & Published</p>
          </div>
        </div>

        <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm flex items-center gap-4">
          <div className="h-12 w-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
            <Clock className="h-6 w-6" />
          </div>
          <div>
            <p className="text-2xl font-black text-[#062e39]">{draftCount}</p>
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Drafts in Progress</p>
          </div>
        </div>
      </div>

      {/* Courses Grid */}
      {courses.length === 0 ? (
        <div className="bg-white rounded-[2rem] sm:rounded-[2.5rem] p-6 sm:p-12 text-center border border-slate-100 shadow-sm max-w-xl mx-auto my-8 sm:my-12">
          <div className="h-16 w-16 rounded-2xl bg-[#fff6ee] text-[#fd5523] flex items-center justify-center mx-auto mb-4">
            <BookOpen className="h-8 w-8" />
          </div>
          <h2 className="text-xl font-black text-[#062e39]">No courses created yet</h2>
          <p className="text-sm text-slate-500 mt-2 mb-6">
            Start building your academy curriculum. You can design self-paced modules, interactive quizzes, and AI tutor prompts.
          </p>
          <Link
            href={`/academy/${company.slug}/admin/courses/new`}
            className="inline-flex items-center gap-2 px-8 py-4 rounded-xl bg-[#fd5523] text-white text-xs font-black uppercase tracking-widest hover:scale-105 active:scale-95 transition-all shadow-lg"
          >
            <Plus className="h-4 w-4" />
            <span>Create First Course</span>
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {courses.map((course) => {
            const statusConfig = STATUS_BADGES[course.status as Course["status"]] || STATUS_BADGES.draft;
            const studentsCount = enrollmentMap.get(course.id) ?? 0;
            const priceLabel = formatPrice(course.price_type, course.price_amount);

            return (
              <div
                key={course.id}
                className="bg-white rounded-[2rem] border border-slate-100 shadow-sm hover:shadow-xl transition-all duration-300 flex flex-col justify-between overflow-hidden group hover:-translate-y-1"
              >
                <div>
                  {/* Thumbnail / Header */}
                  <div className="h-44 w-full bg-slate-100 relative overflow-hidden">
                    {course.thumbnail_url ? (
                      <img
                        src={course.thumbnail_url}
                        alt={course.title}
                        className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-500"
                      />
                    ) : (
                      <div className="h-full w-full flex items-center justify-center bg-gradient-to-br from-[#062e39] to-[#0a4055] text-white/20">
                        <BookOpen className="h-12 w-12" />
                      </div>
                    )}
                    <div className="absolute top-4 left-4">
                      <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border shadow-sm ${statusConfig.className}`}>
                        {statusConfig.label}
                      </span>
                    </div>
                    <div className="absolute top-4 right-4 bg-white/95 backdrop-blur-sm px-3 py-1 rounded-full text-xs font-black text-[#062e39] shadow-sm">
                      {priceLabel}
                    </div>
                  </div>

                  {/* Body Content */}
                  <div className="p-6">
                    <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-[#fd5523] mb-2">
                      <span>{course.category || "General"}</span>
                      {course.level && (
                        <>
                          <span>•</span>
                          <span className="text-slate-400 capitalize">{course.level}</span>
                        </>
                      )}
                    </div>

                    <h3 className="text-lg font-black text-[#062e39] tracking-tight group-hover:text-[#fd5523] transition-colors line-clamp-2">
                      {course.title}
                    </h3>
                    
                    {course.description && (
                      <p className="mt-2 text-xs text-slate-500 line-clamp-2 leading-relaxed">
                        {course.description}
                      </p>
                    )}

                    <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                      <div className="flex items-center gap-1.5">
                        <Users className="h-3.5 w-3.5 text-slate-400" />
                        <span className="font-bold text-slate-700">{studentsCount}</span> enrolled
                      </div>
                      <span className="text-[10px] text-slate-400 font-mono">
                        /{course.slug}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Footer Actions */}
                <div className="p-6 pt-0 flex items-center gap-2">
                  <Link
                    href={`/creator/courses/${course.id}`}
                    className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-slate-50 hover:bg-[#062e39] text-[#062e39] hover:text-white text-xs font-bold transition-all shadow-sm"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                    <span>Edit Curriculum</span>
                  </Link>

                  <Link
                    href={`/academy/${company.slug}/courses/${course.slug}`}
                    target="_blank"
                    className="h-10 w-10 flex items-center justify-center rounded-xl bg-slate-50 hover:bg-[#fd5523] text-slate-400 hover:text-white transition-all shadow-sm"
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