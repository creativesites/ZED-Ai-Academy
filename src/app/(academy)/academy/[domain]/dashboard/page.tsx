import { auth } from "@clerk/nextjs/server";
import { createClient } from "@/lib/supabase/server";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { 
  ArrowRight, Award, BookMarked, BookOpen, Clock3, Flame, GraduationCap, 
  History, Play, Sparkles, Trophy, Users, Layout, Building2, Mic
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { Enrollment, Course } from "@/types/database";
import { getCurrentTenantAccess } from "@/lib/tenants/access";
import { loadLearnerTutorOverview } from "@/lib/tutor/server/learner-overview";

export const metadata = { title: "Student Dashboard" };

type EnrollmentWithCourse = Enrollment & {
  courses: Pick<Course, "id" | "slug" | "title" | "thumbnail_url" | "category"> | null;
};

import { TenantNavbar } from "@/components/tenant/TenantNavbar";

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
  const enrolledCourseIds = enrollments
    .map((e) => e.courses?.id)
    .filter((id): id is string => Boolean(id));

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

  return (
    <div className="bg-slate-50 min-h-screen">
      <TenantNavbar tenant={company} />
      
      <div className="py-12">
        <div className="container max-w-7xl space-y-12">

        
        {/* Hero Section */}
        <section className="relative overflow-hidden rounded-[4rem] bg-[#062e39] p-10 md:p-24 text-white shadow-2xl">
          <div className="absolute top-0 right-0 p-12 opacity-10 pointer-events-none">
             <GraduationCap className="h-64 w-64" />
          </div>
          <div className="absolute bottom-[-100px] left-[-100px] w-80 h-80 bg-[#fd5523] rounded-full blur-[120px] opacity-20" />
          
          <div className="relative z-10 max-w-3xl">
            <div className="inline-flex items-center gap-3 px-6 py-2.5 rounded-full bg-white/10 text-white text-[10px] font-black uppercase tracking-[0.3em] border border-white/10 mb-10">
              <Sparkles className="h-4 w-4 text-yellow-400" /> Student Dashboard
            </div>
            <h1 className="text-4xl md:text-7xl font-black tracking-tighter mb-8 uppercase leading-[0.9]">
              Welcome back, <br/>
              <span className="text-[#fd5523]">{firstName}</span>
            </h1>
            <p className="text-white/60 text-lg md:text-xl font-medium leading-relaxed mb-12 max-w-lg">
              Continue your journey at {company.name}. You have {inProgressCount} course{inProgressCount !== 1 ? "s" : ""} active.
            </p>
            <div className="flex flex-wrap gap-4">
              <Link
                href={`/academy/${company.slug}/classroom`}
                className="group h-20 px-12 rounded-[2rem] bg-[#fd5523] text-white text-xs font-black uppercase tracking-[0.2em] flex items-center gap-4 hover:scale-[1.02] active:scale-95 transition-all shadow-2xl shadow-[#fd5523]/30"
              >
                Enter Classroom 
                <div className="h-8 w-8 rounded-full bg-white/20 flex items-center justify-center group-hover:rotate-12 transition-transform">
                  <Layout className="h-4 w-4" />
                </div>
              </Link>
              <Link
                href={`/academy/${company.slug}/practice`}
                className="group h-20 px-10 rounded-[2rem] bg-white/10 hover:bg-white/20 text-white border border-white/15 text-xs font-black uppercase tracking-[0.2em] flex items-center gap-4 hover:scale-[1.02] active:scale-95 transition-all"
              >
                Practice with AI Teacher
                <div className="h-8 w-8 rounded-full bg-[#fd5523]/30 flex items-center justify-center">
                  <Mic className="h-4 w-4 text-amber-300" />
                </div>
              </Link>
            </div>
          </div>
        </section>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
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
            <div key={stat.label} className="bg-white rounded-[2.5rem] p-6 border border-slate-100 shadow-sm">
              <div className={cn("h-10 w-10 rounded-2xl flex items-center justify-center mb-4 shadow-inner", stat.accent)}>
                <stat.icon className="h-5 w-5" />
              </div>
              <div className="text-3xl font-black text-[#062e39] tracking-tight">{stat.value}</div>
              <div className="text-[10px] font-black uppercase tracking-widest text-slate-400 mt-1">{stat.label}</div>
            </div>
          ))}
        </div>

        {/* AI Teacher Quick Links Strip */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Link
            href={`/academy/${company.slug}/practice`}
            className="group flex items-center justify-between gap-3 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-[#fd5523]/40 hover:shadow-md"
          >
            <div className="flex items-center gap-3.5">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#fff6ee] text-[#fd5523]">
                <Mic className="h-5 w-5" />
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Teacher&apos;s Room</p>
                <p className="text-sm font-black text-[#062e39]">
                  {tutorOverview && tutorOverview.assignments.filter((a) => !a.completed).length > 0
                    ? `${tutorOverview.assignments.filter((a) => !a.completed).length} assigned scene(s)`
                    : "Start speaking practice"}
                </p>
              </div>
            </div>
            <ArrowRight className="h-4 w-4 text-slate-400 transition-transform group-hover:translate-x-0.5 group-hover:text-[#fd5523]" />
          </Link>

          <Link
            href={`/academy/${company.slug}/practice/deck`}
            className="group flex items-center justify-between gap-3 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-amber-300 hover:shadow-md"
          >
            <div className="flex items-center gap-3.5">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-amber-50 text-amber-600">
                <BookMarked className="h-5 w-5" />
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Vocabulary Deck</p>
                <p className="text-sm font-black text-[#062e39]">
                  {tutorOverview && tutorOverview.deck.dueNow > 0
                    ? `${tutorOverview.deck.dueNow} flashcards due`
                    : "Review flashcards"}
                </p>
              </div>
            </div>
            <ArrowRight className="h-4 w-4 text-slate-400 transition-transform group-hover:translate-x-0.5 group-hover:text-amber-600" />
          </Link>

          <Link
            href={`/academy/${company.slug}/practice/history`}
            className="group flex items-center justify-between gap-3 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-blue-300 hover:shadow-md"
          >
            <div className="flex items-center gap-3.5">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
                <History className="h-5 w-5" />
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Speaking Reports</p>
                <p className="text-sm font-black text-[#062e39]">
                  {tutorOverview && tutorOverview.completedSessionsCount > 0
                    ? `${tutorOverview.completedSessionsCount} past report${tutorOverview.completedSessionsCount === 1 ? "" : "s"}`
                    : "View past feedback"}
                </p>
              </div>
            </div>
            <ArrowRight className="h-4 w-4 text-slate-400 transition-transform group-hover:translate-x-0.5 group-hover:text-blue-600" />
          </Link>
        </div>

        {/* Course List */}
        <section className="space-y-8">
           <div className="flex items-center justify-between px-2">
              <h2 className="text-2xl font-black text-[#062e39] uppercase tracking-tight flex items-center gap-3">
                <BookOpen className="h-6 w-6 text-[#fd5523]" /> 
                My Learning
              </h2>
              <Link href={`/academy/${company.slug}#courses`} className="text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-[#fd5523] transition-colors">
                Browse More
              </Link>
           </div>

           {enrollments.length > 0 ? (
             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
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
                    <Card key={enrollment.id} className="group bg-white rounded-[2.5rem] border border-slate-100 shadow-sm hover:shadow-2xl hover:border-[#fd5523]/20 transition-all overflow-hidden flex flex-col h-full">
                      <div className="aspect-[16/10] bg-slate-50 relative overflow-hidden">
                        {course.thumbnail_url ? (
                          <img src={course.thumbnail_url} alt="" className="h-full w-full object-cover group-hover:scale-110 transition-transform duration-700" />
                        ) : (
                          <div className="h-full w-full flex items-center justify-center bg-slate-100/50">
                             <BookOpen className="h-16 w-16 text-slate-200" />
                          </div>
                        )}
                        <div className="absolute top-6 left-6">
                           <div className="px-4 py-1.5 rounded-full bg-white/90 backdrop-blur-md text-[10px] font-black uppercase tracking-[0.2em] text-[#062e39] shadow-xl border border-white">
                             {course.category || "General"}
                           </div>
                        </div>
                      </div>
                      <CardContent className="p-8 flex flex-col flex-1">
                        <h3 className="text-2xl font-black text-[#062e39] leading-tight group-hover:text-[#fd5523] transition-colors mb-4">{course.title}</h3>

                        {!isPending && totalLessons > 0 && (
                          <div className="mb-6 space-y-2">
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
                        
                        <div className="mt-auto space-y-4">
                           {isPending ? (
                             <div className="p-6 rounded-[2rem] bg-amber-50 border border-amber-100 flex flex-col gap-4">
                                <div className="flex items-center gap-2">
                                  <div className="h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
                                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-amber-700">Awaiting Confirmation</p>
                                </div>
                                <a 
                                  href={`https://wa.me/260979046745?text=Hi, I have enrolled in ${course.title} and would like to confirm my payment.`}
                                  target="_blank"
                                  className="h-12 rounded-xl bg-[#25D366] text-white text-[10px] font-black uppercase tracking-[0.2em] flex items-center justify-center gap-2 hover:scale-[1.02] active:scale-95 transition-all shadow-lg shadow-[#25D366]/20"
                                >
                                  Confirm on WhatsApp
                                </a>
                             </div>
                           ) : (
                             <div className="flex flex-wrap items-center justify-between gap-2">
                                {certPublicId ? (
                                  <Link
                                    href={`/certificates/${certPublicId}`}
                                    className="inline-flex items-center gap-1.5 rounded-xl bg-amber-50 px-3 py-2 text-[10px] font-black uppercase tracking-wider text-amber-700 hover:bg-amber-100"
                                  >
                                    <Trophy className="h-3.5 w-3.5" />
                                    Certificate
                                  </Link>
                                ) : (
                                  <div className="flex items-center gap-2.5">
                                    <div className={cn("h-2.5 w-2.5 rounded-full", pct === 100 ? "bg-emerald-500" : "bg-[#fd5523] animate-pulse")} />
                                    <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                                      {pct === 100 ? "Completed" : pct > 0 ? "In Progress" : "Not Started"}
                                    </span>
                                  </div>
                                )}
                                <Link 
                                  href={`/courses/${course.slug}/learn`}
                                  className="h-12 px-6 rounded-xl bg-[#062e39] text-white text-[10px] font-black uppercase tracking-[0.2em] hover:bg-[#fd5523] transition-all flex items-center gap-2.5 shadow-xl shadow-[#062e39]/10"
                                >
                                  {pct === 0 ? "Start" : pct === 100 ? "Review" : "Continue"} <ArrowRight className="h-4 w-4" />
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
             <div className="py-24 text-center bg-white rounded-[4rem] border-2 border-dashed border-slate-100">
                <BookOpen className="h-20 w-20 text-slate-50 mx-auto mb-6" />
                <h3 className="text-2xl font-black text-[#062e39]">No active courses</h3>
                <p className="text-slate-400 font-medium mt-2 max-w-xs mx-auto">Explore {company.name}'s curriculum to start learning.</p>
                <Link href={`/academy/${company.slug}#courses`} className="mt-8 inline-flex h-14 px-8 rounded-2xl bg-[#062e39] text-white text-[10px] font-black uppercase tracking-widest hover:bg-[#fd5523] transition-all">
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
