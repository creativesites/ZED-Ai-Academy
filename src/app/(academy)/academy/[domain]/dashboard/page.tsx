import { auth } from "@clerk/nextjs/server";
import { createClient } from "@/lib/supabase/server";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import {
  ArrowRight, Award, BookOpen, Clock3, Flame, GraduationCap,
  Sparkles, Trophy, Layout, Mic
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { Enrollment, Course } from "@/types/database";
import { getCurrentTenantAccess, isTeachingRole } from "@/lib/tenants/access";
import { loadLearnerTutorOverview } from "@/lib/tutor/server/learner-overview";

export const metadata = { title: "Student Dashboard" };

type EnrollmentWithCourse = Enrollment & {
  courses: Pick<Course, "id" | "slug" | "title" | "thumbnail_url" | "category"> | null;
};

import { TenantNavbar } from "@/components/tenant/TenantNavbar";
import { TeacherUpNextCard } from "@/components/tutor/TeacherUpNextCard";
import { loadTeacherUpNext } from "@/lib/tutor/server/up-next";
import { academyHref, lessonHref } from "@/lib/tutor/academy-href";
import { ZEDAI_TENANT_ID } from "@/lib/tenants/constants";

export default async function TenantStudentDashboardPage({
  params,
}: {
  params: Promise<{ domain: string }>;
}) {
  const { domain } = await params;
  const { userId } = await auth();
  if (!userId) redirect(`/sign-in?redirect_url=/academy/${domain}/dashboard`);

  const supabase = createClient();
  
  // 1. Fetch Company
  const { data: company } = await supabase
    .from("companies")
    .select("id, name, slug, logo_url, primary_color, admin_id")
    .eq("slug", domain)
    .single();

  if (!company) notFound();

  // Enforce tenant membership: non-members cannot view the private tenant dashboard
  const access = await getCurrentTenantAccess(company.id);
  const isMember = Boolean(access?.isMember || access?.isSuperAdmin || company.admin_id === userId);

  if (!isMember) {
    redirect(`/academy/${company.slug}`);
  }

  // 2. Fetch User Profile
  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("id", userId)
    .single();

  const firstName = profile?.full_name?.split(" ")[0] ?? "there";

  // 3. Fetch Enrollments for THIS company
  const { data: enrollmentsData } = await supabase
    .from("enrollments")
    .select("*, courses(id, slug, title, thumbnail_url, category)")
    .eq("user_id", userId)
    .eq("company_id", company.id)
    .in("status", ["active", "pending_payment"])
    .order("enrolled_at", { ascending: false });

  const enrollments = (enrollmentsData ?? []) as EnrollmentWithCourse[];
  const enrolledCourseIds = Array.from(
    new Set(enrollments.map((e) => e.courses?.id ?? e.course_id).filter(Boolean))
  );

  // 4. Fetch real lesson progress, certificates, and AI teacher overview in parallel
  const [modulesRes, certsRes, tutorOverview] = await Promise.all([
    enrolledCourseIds.length > 0
      ? supabase
          .from("modules")
          .select("course_id, lessons(id)")
          .in("course_id", enrolledCourseIds)
      : Promise.resolve({ data: [] }),
    enrolledCourseIds.length > 0
      ? supabase
          .from("certificates")
          .select("course_id, public_id")
          .eq("user_id", userId)
          .in("course_id", enrolledCourseIds)
      : Promise.resolve({ data: [] }),
    loadLearnerTutorOverview(userId, { kind: "tenant", companyId: company.id }).catch(() => null),
  ]);

  // "Up next with <Teacher>" (P1-09): one card for the teacher's next step, scoped to this academy.
  const upNextData = await loadTeacherUpNext({
    userId,
    companyId: company.id,
    academySlug: company.slug,
    overview: tutorOverview,
  });

  const lessonsByCourse = new Map<string, string[]>();
  for (const mod of (modulesRes.data ?? []) as Array<{
    course_id: string;
    lessons: Array<{ id: string }> | null;
  }>) {
    const existing = lessonsByCourse.get(mod.course_id) ?? [];
    for (const l of mod.lessons ?? []) existing.push(l.id);
    lessonsByCourse.set(mod.course_id, existing);
  }

  const allLessonIds = [...lessonsByCourse.values()].flat();
  const { data: progressRows } = allLessonIds.length
    ? await supabase
        .from("lesson_progress")
        .select("lesson_id")
        .eq("user_id", userId)
        .eq("completed", true)
        .in("lesson_id", allLessonIds)
    : { data: [] };

  const completedLessonSet = new Set((progressRows ?? []).map((p) => p.lesson_id));
  const certByCourse = new Map(
    (certsRes.data ?? []).map((c) => [c.course_id, c.public_id]),
  );

  const completedCount = enrollments.filter((e) => e.completed_at).length;
  const inProgressCount = enrollments.length - completedCount;
  const certificatesCount = certByCourse.size;

  const isStaff = Boolean(
    access?.isSuperAdmin ||
      access?.isOwner ||
      company.admin_id === userId ||
      isTeachingRole(access?.tenantRole)
  );
  const staffRole = access?.isSuperAdmin
    ? "super_admin"
    : access?.isOwner || company.admin_id === userId
    ? "company_admin"
    : access?.tenantRole ?? null;
  const isAdmin = staffRole === "super_admin" || staffRole === "company_admin";

  return (
    <div className="bg-slate-50 min-h-screen">
      <TenantNavbar tenant={company} staffRole={isStaff ? staffRole : null} />

      {isStaff && (
        <div className="bg-[#062e39] text-white border-b border-white/10">
          <div className="container max-w-7xl px-4 sm:px-6 md:px-8 py-2.5 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-xs font-medium text-white/85">
              <span className="inline-block h-2 w-2 rounded-full bg-[#fd5523]" />
              <span>
                You are previewing the <strong className="text-white">Student Dashboard</strong> for {company.name}.
              </span>
            </div>
            <Link
              href={`/academy/${company.slug}/admin`}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-[#fd5523] hover:bg-[#e84b1c] text-white text-xs font-bold transition-colors"
            >
              <span>{isAdmin ? "Return to Admin Hub" : "Return to Teacher Hub"}</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      )}
      
      <div className="py-6 sm:py-10">
        <div className="container max-w-7xl px-4 space-y-6 sm:space-y-8">

        {/* Hero Section */}
        <section className="relative overflow-hidden rounded-2xl sm:rounded-3xl bg-[#062e39] p-6 sm:p-10 text-white shadow-sm">
          <div className="absolute top-0 right-0 p-6 opacity-10 pointer-events-none hidden sm:block">
             <GraduationCap className="h-40 w-40" />
          </div>
          
          <div className="relative z-10 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 text-white text-[10px] font-bold uppercase tracking-wider border border-white/10 mb-4">
              <Sparkles className="h-3.5 w-3.5 text-amber-300" /> Student Dashboard
            </div>
            <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold tracking-tight mb-2 leading-tight">
              Welcome back, <span className="text-[#fd5523]">{firstName}</span>
            </h1>
            <p className="text-white/75 text-sm sm:text-base leading-relaxed mb-6 max-w-lg">
              Continue your learning at {company.name}. You have {inProgressCount} active course{inProgressCount !== 1 ? "s" : ""}.
            </p>
            <div className="flex flex-wrap gap-2.5">
              <Link
                href={`/academy/${company.slug}/classroom`}
                className="group h-10 px-5 rounded-xl bg-[#fd5523] hover:bg-[#e0481d] text-white text-xs font-semibold flex items-center gap-2 transition-all shadow-xs"
              >
                <Layout className="h-4 w-4" />
                <span>Enter Classroom</span>
              </Link>
              <Link
                href={`/academy/${company.slug}/practice`}
                className="group h-10 px-4 rounded-xl bg-white/10 hover:bg-white/20 text-white border border-white/15 text-xs font-semibold flex items-center gap-2 transition-all"
              >
                <Mic className="h-4 w-4 text-amber-300" />
                <span>Learn with {upNextData.teacher.name}</span>
              </Link>
            </div>
          </div>
        </section>

        {/* Up next with <Teacher> (replaces the daily plan and the three teacher tiles) */}
        <TeacherUpNextCard
          teacher={upNextData.teacher}
          upNext={upNextData.upNext}
          teacherHomeHref={academyHref(company.slug, "/practice")}
          startHref={`/academy/${company.slug}#courses`}
          academyName={company.name}
        />

        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
          {[
            { label: "Active Courses", value: inProgressCount, icon: Clock3, accent: "bg-[#fff6ee] text-[#fd5523]" },
            { label: "Completed", value: completedCount, icon: Award, accent: "bg-emerald-50 text-emerald-600" },
            { label: "Certificates", value: certificatesCount, icon: Trophy, accent: "bg-amber-50 text-amber-600" },
            {
              label: tutorOverview && tutorOverview.streakDays > 0 ? "Speaking Streak" : "Total Library",
              value:
                tutorOverview && tutorOverview.streakDays > 0
                  ? `${tutorOverview.streakDays}d`
                  : enrollments.length,
              icon: tutorOverview && tutorOverview.streakDays > 0 ? Flame : BookOpen,
              accent: "bg-blue-50 text-blue-600",
            },
          ].map((stat) => (
            <div key={stat.label} className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200/80 shadow-xs">
              <div className={cn("h-9 w-9 rounded-xl flex items-center justify-center mb-3", stat.accent)}>
                <stat.icon className="h-4.5 w-4.5" />
              </div>
              <div className="text-xl sm:text-2xl font-bold text-[#062e39] tracking-tight">{stat.value}</div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mt-1">{stat.label}</div>
            </div>
          ))}
        </div>

        {/* Course List */}
        <section className="space-y-4">
           <div className="flex items-center justify-between gap-2">
              <h2 className="text-lg sm:text-xl font-bold text-[#062e39] tracking-tight flex items-center gap-2">
                <BookOpen className="h-5 w-5 text-[#fd5523]" />
                My Learning
              </h2>
              <Link href={`/academy/${company.slug}#courses`} className="text-xs font-semibold text-slate-500 hover:text-[#fd5523] transition-colors">
                Browse More
              </Link>
           </div>

           {enrollments.length > 0 ? (
             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
                {enrollments.map((enrollment) => {
                  const course = enrollment.courses;
                  if (!course) return null;
                  const isPending = enrollment.status === "pending_payment";
                  const courseLessonIds = lessonsByCourse.get(course.id) ?? [];
                  const doneLessons = courseLessonIds.filter((id) => completedLessonSet.has(id)).length;
                  const totalLessons = courseLessonIds.length;
                  const pct = totalLessons > 0 ? Math.round((doneLessons / totalLessons) * 100) : 0;
                  const certPublicId = certByCourse.get(course.id);

                  return (
                    <Card key={enrollment.id} className="group bg-white rounded-2xl border border-slate-200/80 shadow-xs hover:shadow-md hover:border-[#fd5523]/30 transition-all overflow-hidden flex flex-col h-full">
                      <div className="aspect-[16/10] bg-slate-50 relative overflow-hidden">
                        {course.thumbnail_url ? (
                          <img src={course.thumbnail_url} alt="" className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-500" />
                        ) : (
                          <div className="h-full w-full flex items-center justify-center bg-slate-100/60">
                             <BookOpen className="h-12 w-12 text-slate-300" />
                          </div>
                        )}
                        <div className="absolute top-3 left-3">
                           <div className="px-2.5 py-1 rounded-full bg-white/95 backdrop-blur-md text-[10px] font-bold uppercase tracking-wider text-[#062e39] shadow-xs">
                             {course.category || "General"}
                           </div>
                        </div>
                      </div>
                      <CardContent className="p-5 flex flex-col flex-1">
                        <h3 className="text-base sm:text-lg font-bold text-[#062e39] leading-snug group-hover:text-[#fd5523] transition-colors mb-3 line-clamp-2">{course.title}</h3>

                        {!isPending && totalLessons > 0 && (
                          <div className="mb-4 space-y-1.5">
                            <div className="flex items-center justify-between text-[11px] font-bold text-slate-500">
                              <span>{doneLessons} of {totalLessons} lessons</span>
                              <span className="text-[#062e39]">{pct}%</span>
                            </div>
                            <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                              <div
                                className={cn(
                                  "h-full rounded-full transition-all",
                                  pct === 100 ? "bg-emerald-500" : "bg-[#fd5523]"
                                )}
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                          </div>
                        )}
                        
                        <div className="mt-auto space-y-3">
                           {isPending ? (
                             <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-100 flex flex-col gap-2.5">
                                <div className="flex items-center gap-2">
                                  <div className="h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
                                  <p className="text-[10px] font-bold uppercase tracking-wider text-amber-700">Awaiting Confirmation</p>
                                </div>
                                {company.id === ZEDAI_TENANT_ID ? (
                                  <a
                                    href={`https://wa.me/260979046745?text=${encodeURIComponent(`Hi, I have enrolled in ${course.title} and would like to confirm my payment.`)}`}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="h-9 rounded-xl bg-[#25D366] text-white text-xs font-semibold flex items-center justify-center gap-2 hover:opacity-95 transition-all"
                                  >
                                    Confirm on WhatsApp
                                  </a>
                                ) : (
                                  // Academies have their own contact details; never send their learners to the platform's number.
                                  <Link
                                    href={`/academy/${company.slug}/courses/${course.slug}`}
                                    className="h-9 rounded-xl bg-[#062e39] text-white text-xs font-semibold flex items-center justify-center gap-2 hover:bg-[#fd5523] transition-all"
                                  >
                                    View payment status
                                  </Link>
                                )}
                             </div>
                           ) : (
                             <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100">
                                {certPublicId ? (
                                  <Link
                                    href={`/certificates/${certPublicId}`}
                                    className="inline-flex items-center gap-1.5 rounded-xl bg-amber-50 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-amber-700 hover:bg-amber-100"
                                  >
                                    <Trophy className="h-3.5 w-3.5" />
                                    Certificate
                                  </Link>
                                ) : (
                                  <div className="flex items-center gap-2">
                                    <div className={cn("h-2 w-2 rounded-full", pct === 100 ? "bg-emerald-500" : "bg-[#fd5523]")} />
                                    <span className="text-xs font-medium text-slate-500">
                                      {pct === 100 ? "Completed" : pct > 0 ? "In Progress" : "Not Started"}
                                    </span>
                                  </div>
                                )}
                                <Link 
                                  href={lessonHref(course.slug)}
                                  className="h-9 px-4 rounded-xl bg-[#062e39] text-white text-xs font-semibold hover:bg-[#fd5523] transition-all flex items-center gap-1.5"
                                >
                                  {pct === 0 ? "Start" : pct === 100 ? "Review" : "Continue"} <ArrowRight className="h-3.5 w-3.5" />
                                </Link>
                             </div>
                           )}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
             </div>
           ) : (
             <div className="py-14 text-center bg-white rounded-2xl border-2 border-dashed border-slate-200/80 px-4">
                <BookOpen className="h-12 w-12 text-slate-300 mx-auto mb-3" />
                <h3 className="text-lg font-bold text-[#062e39]">No active courses</h3>
                <p className="text-slate-500 text-xs sm:text-sm mt-1 max-w-xs mx-auto">Explore {company.name}&apos;s curriculum to start learning.</p>
                <Link href={`/academy/${company.slug}#courses`} className="mt-5 inline-flex items-center justify-center h-10 px-5 rounded-xl bg-[#062e39] text-white text-xs font-semibold hover:bg-[#fd5523] transition-all">
                   Browse Courses
                </Link>
             </div>
           )}
        </section>
      </div>
    </div>
  </div>
);
}
