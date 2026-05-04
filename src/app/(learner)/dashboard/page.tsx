import { auth } from "@clerk/nextjs/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { buttonVariants } from "@/components/ui/button-variants";
import { cn } from "@/lib/utils";
import {
  ArrowRight, Award, BookOpen, Building2, Clock3, GraduationCap,
  Image as ImageIcon, Layers, MessageCircle, Play, ShieldCheck,
  Sparkles, Trophy, UserCheck, Users,
} from "lucide-react";
import { WhatsAppShare } from "@/components/shared/whatsapp-share";
import { ReferralWidget } from "@/components/shared/referral-widget";
import type { Enrollment, Certificate, Course, UserRole } from "@/types/database";

export const metadata = { title: "Dashboard" };

type EnrollmentWithCourse = Enrollment & {
  courses: Pick<Course, "id" | "slug" | "title" | "thumbnail_url" | "category"> | null;
};
type CertificateWithCourse = Certificate & { courses: { title: string } | null };

function findResumeLesson(
  modules: { lessons: { id: string; position: number }[] }[],
  completedIds: Set<string>
): string | null {
  for (const mod of modules) {
    for (const lesson of mod.lessons) {
      if (!completedIds.has(lesson.id)) return lesson.id;
    }
  }
  return null;
}

export default async function DashboardPage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const supabase = createClient();

  const { data: profileData } = await supabase
    .from("profiles")
    .select("full_name, role, onboarding_completed")
    .eq("id", userId)
    .single();

  const profile = profileData as { full_name: string | null; role: UserRole; onboarding_completed: boolean } | null;
  // Redirect to onboarding if neither flag is set (covers pre-migration rows too)
  if (!profile?.onboarding_completed && !profile?.full_name) redirect("/onboarding");

  const role = profile.role;
  const isAdmin = role === "super_admin";
  const isInstructor = role === "instructor" || isAdmin;
  const isCompanyAdmin = role === "company_admin";
  const firstName = profile.full_name?.split(" ")[0] ?? "there";

  // ── Admin stats (super_admin only, uses service client to bypass RLS) ──
  let adminStats: {
    totalUsers: number;
    totalEnrollments: number;
    pendingEnrollments: number;
    publishedCourses: number;
  } | null = null;

  if (isAdmin) {
    const svc = createServiceClient();
    const [
      { count: totalUsers },
      { count: totalEnrollments },
      { count: pendingEnrollments },
      { count: publishedCourses },
    ] = await Promise.all([
      svc.from("profiles").select("*", { head: true, count: "exact" }),
      svc.from("enrollments").select("*", { head: true, count: "exact" }),
      svc.from("enrollments").select("*", { head: true, count: "exact" }).eq("status", "pending_payment"),
      svc.from("courses").select("*", { head: true, count: "exact" }).eq("status", "published"),
    ]);
    adminStats = {
      totalUsers: totalUsers ?? 0,
      totalEnrollments: totalEnrollments ?? 0,
      pendingEnrollments: pendingEnrollments ?? 0,
      publishedCourses: publishedCourses ?? 0,
    };
  }

  // ── Learner data (all roles) ──
  const { data: enrollmentsData } = await supabase
    .from("enrollments")
    .select("*, courses(id, slug, title, thumbnail_url, category)")
    .eq("user_id", userId)
    .in("status", ["active", "pending_payment"])
    .order("enrolled_at", { ascending: false });

  const enrollments = (enrollmentsData ?? []) as EnrollmentWithCourse[];

  const { data: certificatesData } = await supabase
    .from("certificates")
    .select("*, courses(title)")
    .eq("user_id", userId);

  const certificates = (certificatesData ?? []) as CertificateWithCourse[];

  const courseIds = enrollments.map((e) => e.course_id);
  const progressMap: Record<string, { pct: number; resumeLessonId: string | null }> = {};

  if (courseIds.length > 0) {
    type ModuleRow = { course_id: string; lessons: { id: string; position: number }[] };
    const { data: modulesRaw } = await supabase
      .from("modules")
      .select("course_id, lessons(id, position)")
      .in("course_id", courseIds)
      .order("position", { ascending: true });
    const modulesData = (modulesRaw ?? []) as unknown as ModuleRow[];

    const byCourse: Record<string, { lessons: { id: string; position: number }[] }[]> = {};
    for (const mod of modulesData) {
      if (!byCourse[mod.course_id]) byCourse[mod.course_id] = [];
      byCourse[mod.course_id].push({
        lessons: [...(mod.lessons ?? [])].sort((a, b) => a.position - b.position),
      });
    }

    const allLessonIds = modulesData.flatMap((m) => (m.lessons ?? []).map((l) => l.id));
    const completedSet: Set<string> = new Set();

    if (allLessonIds.length > 0) {
      const { data: progressData } = await supabase
        .from("lesson_progress")
        .select("lesson_id")
        .eq("user_id", userId)
        .eq("completed", true)
        .in("lesson_id", allLessonIds);
      (progressData ?? []).forEach((p: { lesson_id: string }) => completedSet.add(p.lesson_id));
    }

    for (const courseId of courseIds) {
      const mods = byCourse[courseId] ?? [];
      const total = mods.reduce((n, m) => n + m.lessons.length, 0);
      const done = mods.flatMap((m) => m.lessons).filter((l) => completedSet.has(l.id)).length;
      const pct = total > 0 ? Math.round((done / total) * 100) : 0;
      progressMap[courseId] = { pct, resumeLessonId: findResumeLesson(mods, completedSet) };
    }
  }

  const { data: referralData } = await supabase
    .from("referrals")
    .select("referral_code, referred_id, status")
    .eq("referrer_id", userId);

  const referralRows = referralData ?? [];
  const referralCode = referralRows.find((r) => r.referral_code)?.referral_code ?? undefined;
  const referralTotal = referralRows.filter((r) => r.referred_id).length;
  const referralConverted = referralRows.filter((r) => r.status === "converted").length;

  const completedCount = enrollments.filter((e) => e.completed_at).length;
  const pendingCount = enrollments.filter(
    (e) => (e as unknown as { status: string }).status === "pending_payment"
  ).length;
  const inProgressCount = Math.max(enrollments.length - completedCount - pendingCount, 0);

  // Role label for hero
  const roleLabel =
    isAdmin ? "Super Admin" :
    role === "instructor" ? "Instructor" :
    isCompanyAdmin ? "Company Admin" :
    "Learning Command Center";

  return (
    <div className="container" style={{ paddingTop: "60px", paddingBottom: "120px" }}>
      <div className="space-y-12">

        {/* ── Hero ──────────────────────────────────────────────────────── */}
        <section className="marketing-shell mesh-orange noise relative overflow-hidden rounded-[3rem] border-0 p-8 shadow-2xl sm:p-12">
          <div className="relative z-10 flex flex-wrap items-start justify-between gap-8">
            <div className="max-w-2xl">
              <div className="marketing-kicker bg-white/10 text-white">
                <Sparkles className="mr-2 h-3.5 w-3.5" />
                {roleLabel}
              </div>
              <h1 className="mt-6 text-4xl font-bold text-white tracking-tight sm:text-5xl">
                Welcome back, {firstName}
              </h1>
              <p className="mt-4 text-lg leading-relaxed text-white/70">
                {isAdmin
                  ? `Platform overview — ${adminStats?.pendingEnrollments ?? 0} payment${adminStats?.pendingEnrollments !== 1 ? "s" : ""} awaiting confirmation.`
                  : isInstructor
                    ? "Manage your courses and track your own learning progress below."
                    : isCompanyAdmin
                      ? "Manage your team's learning and track your own progress below."
                      : `You have ${inProgressCount} course${inProgressCount !== 1 ? "s" : ""} in flight. Keep building your AI edge.`}
              </p>
            </div>
            <div className="flex flex-wrap gap-4">
              <Link
                href="/courses"
                className={cn(
                  buttonVariants({ variant: "default" }),
                  "rounded-full bg-white px-10 py-7 text-xl font-bold text-[#062e39] shadow-2xl transition-all hover:bg-white/90 hover:scale-105 active:scale-95 flex items-center justify-center"
                )}
              >
                Browse Courses <ArrowRight className="ml-3 h-6 w-6" />
              </Link>
              <Link
                href="/dashboard/settings"
                className={cn(
                  buttonVariants({ variant: "outline" }),
                  "rounded-full border-2 border-white/30 bg-white/10 px-8 py-7 text-lg font-bold text-white backdrop-blur-md transition-all hover:bg-white/20 flex items-center justify-center"
                )}
              >
                Manage Account
              </Link>
            </div>
          </div>
        </section>

        {/* ── Admin tools section (super_admin) ─────────────────────────── */}
        {isAdmin && adminStats && (
          <section className="space-y-6">
            <div className="flex items-center gap-3 px-1">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#062e39]">
                <ShieldCheck className="h-4 w-4 text-white" />
              </div>
              <h2 className="text-2xl font-bold tracking-tight text-[#062e39]">Admin Tools</h2>
            </div>

            {/* KPIs */}
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
              {[
                { label: "Total Users", value: adminStats.totalUsers, icon: Users, accent: "bg-blue-50 text-blue-600" },
                { label: "Published Courses", value: adminStats.publishedCourses, icon: Layers, accent: "bg-[#fff6ee] text-[#fd5523]" },
                { label: "Total Enrolments", value: adminStats.totalEnrollments, icon: GraduationCap, accent: "bg-green-50 text-green-600" },
                {
                  label: "Pending Payment",
                  value: adminStats.pendingEnrollments,
                  icon: Clock3,
                  accent: adminStats.pendingEnrollments > 0 ? "bg-amber-50 text-amber-600" : "bg-slate-50 text-slate-400",
                },
              ].map((kpi) => (
                <div key={kpi.label} className="marketing-outline-card rounded-[2rem] border-0 p-5">
                  <div className={`mb-3 flex h-10 w-10 items-center justify-center rounded-2xl ${kpi.accent}`}>
                    <kpi.icon className="h-5 w-5" />
                  </div>
                  <p className="text-3xl font-bold tracking-tight text-[#062e39]">{kpi.value}</p>
                  <p className="mt-1 text-xs font-bold uppercase tracking-widest text-slate-400">{kpi.label}</p>
                </div>
              ))}
            </div>

            {/* Tool cards */}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {[
                {
                  label: "Platform Dashboard",
                  desc: "KPIs, recent signups, and site health",
                  href: "/admin",
                  icon: ShieldCheck,
                  accent: "bg-[#062e39] text-white",
                  badge: null,
                },
                {
                  label: "Student Management",
                  desc: "Activate payments, manage access",
                  href: "/admin/students",
                  icon: UserCheck,
                  accent: "bg-amber-50 text-amber-700",
                  badge: adminStats.pendingEnrollments > 0 ? adminStats.pendingEnrollments : null,
                },
                {
                  label: "Course Builder",
                  desc: "Create and publish courses",
                  href: "/creator/courses",
                  icon: BookOpen,
                  accent: "bg-[#fff6ee] text-[#fd5523]",
                  badge: null,
                },
                {
                  label: "Media Library",
                  desc: "Manage site images and assets",
                  href: "/admin/images",
                  icon: ImageIcon,
                  accent: "bg-slate-50 text-slate-600",
                  badge: null,
                },
              ].map((tool) => (
                <Link
                  key={tool.href}
                  href={tool.href}
                  className="group marketing-card flex flex-col gap-4 rounded-[2rem] border-0 p-6 transition-all hover:-translate-y-1 hover:shadow-xl"
                >
                  <div className="flex items-start justify-between">
                    <div className={`flex h-11 w-11 items-center justify-center rounded-2xl ${tool.accent}`}>
                      <tool.icon className="h-5 w-5" />
                    </div>
                    {tool.badge !== null && (
                      <span className="flex h-6 min-w-[24px] items-center justify-center rounded-full bg-amber-500 px-2 text-[10px] font-bold text-white">
                        {tool.badge}
                      </span>
                    )}
                  </div>
                  <div>
                    <p className="font-bold text-[#062e39] group-hover:text-[#fd5523] transition-colors">
                      {tool.label}
                    </p>
                    <p className="mt-1 text-xs leading-relaxed text-slate-500">{tool.desc}</p>
                  </div>
                  <ArrowRight className="h-4 w-4 text-slate-300 transition-colors group-hover:text-[#fd5523]" />
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* ── Instructor tools (instructor only, not super_admin — already covered above) ── */}
        {role === "instructor" && (
          <section className="space-y-5">
            <div className="flex items-center gap-3 px-1">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#062e39]">
                <BookOpen className="h-4 w-4 text-white" />
              </div>
              <h2 className="text-2xl font-bold tracking-tight text-[#062e39]">Course Management</h2>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              {[
                {
                  label: "Course Builder",
                  desc: "Create, edit, and publish your courses",
                  href: "/creator/courses",
                  icon: BookOpen,
                  accent: "bg-[#fff6ee] text-[#fd5523]",
                },
                {
                  label: "Student Enrolments",
                  desc: "View who's enrolled in your courses",
                  href: "/admin/students",
                  icon: Users,
                  accent: "bg-blue-50 text-blue-600",
                },
              ].map((tool) => (
                <Link
                  key={tool.href}
                  href={tool.href}
                  className="group marketing-card flex items-center gap-5 rounded-[2rem] border-0 p-6 transition-all hover:-translate-y-1 hover:shadow-xl"
                >
                  <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${tool.accent}`}>
                    <tool.icon className="h-5 w-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-[#062e39] group-hover:text-[#fd5523] transition-colors">{tool.label}</p>
                    <p className="mt-0.5 text-xs text-slate-500">{tool.desc}</p>
                  </div>
                  <ArrowRight className="h-4 w-4 shrink-0 text-slate-300 transition-colors group-hover:text-[#fd5523]" />
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* ── Company admin tools ────────────────────────────────────────── */}
        {isCompanyAdmin && (
          <section className="space-y-5">
            <div className="flex items-center gap-3 px-1">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#062e39]">
                <Building2 className="h-4 w-4 text-white" />
              </div>
              <h2 className="text-2xl font-bold tracking-tight text-[#062e39]">Company Workspace</h2>
            </div>
            <Link
              href="/company"
              className="group marketing-card flex items-center gap-5 rounded-[2rem] border-0 p-6 transition-all hover:-translate-y-1 hover:shadow-xl"
            >
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
                <Building2 className="h-5 w-5" />
              </div>
              <div className="flex-1">
                <p className="font-bold text-[#062e39] group-hover:text-[#fd5523] transition-colors">
                  Company Learning Dashboard
                </p>
                <p className="mt-0.5 text-xs text-slate-500">
                  Manage seats, track team progress, and view analytics
                </p>
              </div>
              <ArrowRight className="h-4 w-4 shrink-0 text-slate-300 transition-colors group-hover:text-[#fd5523]" />
            </Link>
          </section>
        )}

        {/* ── Divider between tools and learning (for non-learner roles) ── */}
        {(isAdmin || isInstructor || isCompanyAdmin) && (
          <div className="flex items-center gap-4">
            <div className="h-px flex-1 bg-slate-100" />
            <span className="text-xs font-bold uppercase tracking-widest text-slate-400">My Learning</span>
            <div className="h-px flex-1 bg-slate-100" />
          </div>
        )}

        {/* ── Learner stats (all roles) ──────────────────────────────────── */}
        <section className="grid grid-cols-2 gap-6 md:grid-cols-4">
          {[
            { label: "Active Stride", value: inProgressCount, icon: Clock3, color: "text-[#fd5523]" },
            { label: "Mastered", value: completedCount, icon: GraduationCap, color: "text-green-500" },
            { label: "Certificates", value: certificates.length, icon: Trophy, color: "text-amber-500" },
            { label: "Total Library", value: enrollments.length, icon: BookOpen, color: "text-blue-500" },
          ].map((stat) => (
            <Card key={stat.label} className="marketing-card rounded-[2.5rem] border-0 p-6 shadow-xl">
              <CardContent className="p-0 space-y-4">
                <div className={`inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-50 ${stat.color}`}>
                  <stat.icon className="h-6 w-6" />
                </div>
                <div>
                  <p className="text-4xl font-bold text-[#062e39] tracking-tighter">{stat.value}</p>
                  <p className="text-sm font-bold uppercase tracking-widest text-slate-400 mt-1">{stat.label}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </section>

        {/* ── Course list ────────────────────────────────────────────────── */}
        <section className="space-y-6">
          <div className="flex items-center justify-between px-2">
            <h2 className="text-3xl font-bold text-[#062e39] tracking-tight">Active Learning</h2>
            <Link
              href="/courses"
              className="text-sm font-bold uppercase tracking-widest text-[#fd5523] hover:text-[#ef4a16] transition-colors"
            >
              Browse All Curriculums
            </Link>
          </div>

          {enrollments.length > 0 ? (
            <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
              {enrollments.map((enrollment) => {
                const course = enrollment.courses;
                if (!course) return null;
                const prog = progressMap[enrollment.course_id];
                const pct = prog?.pct ?? 0;
                const enrollmentStatus = (enrollment as unknown as { status: string }).status;
                const isPending = enrollmentStatus === "pending_payment";
                const resumeHref = prog?.resumeLessonId
                  ? `/courses/${course.slug}/learn?lesson=${prog.resumeLessonId}`
                  : `/courses/${course.slug}/learn`;

                const cardInner = (
                  <Card
                    className={`marketing-card h-full overflow-hidden border-0 rounded-[2.5rem] shadow-xl transition-all hover:-translate-y-2 hover:shadow-2xl p-0 ${isPending ? "ring-2 ring-amber-300" : ""}`}
                  >
                    <div className="aspect-[16/10] bg-slate-100 overflow-hidden relative">
                      {course.thumbnail_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={course.thumbnail_url}
                          alt={course.title}
                          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-[#fff6ee] to-[#fffaf6]">
                          <BookOpen className="h-12 w-12 text-[#fd5523]/20" />
                        </div>
                      )}
                      <div className="absolute top-4 left-4">
                        {course.category && (
                          <div className="rounded-full bg-white/90 backdrop-blur-md px-4 py-1.5 text-[10px] font-bold uppercase tracking-widest text-[#062e39] shadow-lg">
                            {course.category}
                          </div>
                        )}
                      </div>
                      <div className="absolute bottom-4 right-4">
                        <div className={`rounded-full px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest shadow-lg ${
                          enrollment.completed_at
                            ? "bg-green-500 text-white"
                            : isPending
                              ? "bg-amber-500 text-white"
                              : "bg-[#fd5523] text-white"
                        }`}>
                          {enrollment.completed_at ? "Completed" : isPending ? "Pending Payment" : `${pct}%`}
                        </div>
                      </div>
                    </div>

                    <CardContent className="space-y-4 p-8">
                      <h3 className="line-clamp-2 text-xl font-bold text-[#062e39] leading-snug group-hover:text-[#fd5523] transition-colors">
                        {course.title}
                      </h3>

                      {!enrollment.completed_at && !isPending && (
                        <div className="space-y-1.5">
                          <div className="flex justify-between text-xs font-bold uppercase tracking-wider text-slate-400">
                            <span>Progress</span>
                            <span>{pct}%</span>
                          </div>
                          <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                            <div
                              className="h-full rounded-full bg-gradient-to-r from-[#fd5523] to-[#fd8d69] transition-all duration-500"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>
                      )}

                      {isPending && (
                        <div className="rounded-xl bg-amber-50 border border-amber-200 px-3 py-2.5 text-xs text-amber-700 leading-relaxed">
                          ⏳ Module 1 unlocked. Full access activates once payment is confirmed.
                        </div>
                      )}

                      <div className="flex items-center justify-between pt-1">
                        {enrollment.completed_at ? (
                          <div className="flex items-center gap-2 text-green-600 font-bold text-sm">
                            <div className="h-2 w-2 rounded-full bg-green-500" />
                            COMPLETED
                          </div>
                        ) : isPending ? (
                          <div className="flex items-center gap-2 text-amber-600 font-bold text-sm">
                            <div className="h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
                            AWAITING PAYMENT
                          </div>
                        ) : (
                          <div className="flex items-center gap-2 text-[#fd5523] font-bold text-sm">
                            <div className="h-2 w-2 rounded-full bg-[#fd5523] animate-pulse" />
                            IN PROGRESS
                          </div>
                        )}
                        <div className="flex items-center gap-2 text-slate-400 font-bold text-xs uppercase tracking-widest group-hover:text-[#062e39] transition-colors">
                          <Play className="h-3 w-3" />
                          {enrollment.completed_at ? "Review" : isPending ? "Module 1" : "Resume"}
                        </div>
                      </div>

                      {isPending && (
                        <a
                          href={`https://wa.me/${process.env.NEXT_PUBLIC_FOUNDER_WHATSAPP ?? "260979046745"}?text=${encodeURIComponent(`Hi! I've enrolled in "${course.title}" and I'd like to confirm my payment to unlock full access.`)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#25D366] py-2.5 text-[13px] font-bold text-white transition-colors hover:bg-[#20bd5a]"
                        >
                          <MessageCircle className="h-4 w-4" />
                          Confirm Payment via WhatsApp
                        </a>
                      )}
                    </CardContent>
                  </Card>
                );

                return isPending ? (
                  <div key={enrollment.id} className="group">
                    <Link href={resumeHref}>{cardInner}</Link>
                  </div>
                ) : (
                  <Link key={enrollment.id} href={resumeHref} className="group">
                    {cardInner}
                  </Link>
                );
              })}
            </div>
          ) : (
            <div className="rounded-[3rem] border-2 border-dashed border-slate-200 bg-white py-24 text-center">
              <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-[2.5rem] bg-[#fff6ee] text-[#fd5523]">
                <BookOpen className="h-10 w-10" />
              </div>
              <h3 className="text-2xl font-bold text-[#062e39]">Your library is empty</h3>
              <p className="mx-auto mt-3 max-w-sm text-lg text-slate-500 font-medium">
                Start your professional AI journey today with our curated curriculums.
              </p>
              <Link
                href="/courses"
                className={cn(
                  buttonVariants({ variant: "default" }),
                  "mt-8 rounded-full bg-[#fd5523] px-10 py-7 text-lg font-bold text-white shadow-xl hover:bg-[#ef4a16] flex items-center justify-center"
                )}
              >
                Find Your First Course
              </Link>
            </div>
          )}
        </section>

        {/* ── Referral widget ────────────────────────────────────────────── */}
        <section>
          <ReferralWidget
            initialCode={referralCode}
            total={referralTotal}
            converted={referralConverted}
          />
        </section>

        {/* ── Certificates ──────────────────────────────────────────────── */}
        {certificates.length > 0 && (
          <section className="space-y-8">
            <h2 className="text-3xl font-bold text-[#062e39] tracking-tight">Your Achievements</h2>
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {certificates.map((cert) => (
                <Card
                  key={cert.id}
                  className="marketing-outline-card rounded-[2.5rem] border-0 bg-slate-50/50 p-8 shadow-sm"
                >
                  <div className="space-y-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-amber-500 shadow-sm">
                      <Award className="h-7 w-7" />
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-[#062e39] leading-tight">
                        {cert.courses?.title ?? "Course Certificate"}
                      </h3>
                      <p className="mt-2 text-sm font-medium text-slate-500">
                        Issued{" "}
                        {new Date(cert.issued_at).toLocaleDateString("en-US", {
                          month: "long",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-3">
                      {cert.file_url && (
                        <a
                          href={cert.file_url}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-2 text-sm font-bold uppercase tracking-widest text-[#fd5523] hover:text-[#ef4a16] transition-colors"
                        >
                          View Certificate <ArrowRight className="h-4 w-4" />
                        </a>
                      )}
                      <WhatsAppShare
                        url={`${process.env.NEXT_PUBLIC_APP_URL ?? "https://zedai.academy"}/certificates/${cert.public_id}`}
                        message={`I just earned a certificate for "${cert.courses?.title ?? "a course"}" on Zed AI Academy! 🎓`}
                        variant="icon"
                      />
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </section>
        )}

      </div>
    </div>
  );
}
