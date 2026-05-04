import { auth } from "@clerk/nextjs/server";
import { createClient } from "@/lib/supabase/server";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { CourseSettingsForm } from "@/components/creator/course-settings-form";
import { CurriculumBuilder } from "@/components/creator/curriculum-builder";
import { PublishButton } from "@/components/creator/publish-button";
import {
  ArrowLeft,
  BookOpen,
  CheckCircle2,
  Eye,
  FileText,
  Layers,
  ListChecks,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  Users,
  XCircle,
} from "lucide-react";
import { Toaster } from "@/components/ui/sonner";
import type { Course, Lesson, Module } from "@/types/database";

export async function generateMetadata({ params }: { params: Promise<{ courseId: string }> }) {
  const { courseId } = await params;
  const supabase = createClient();
  const { data } = await supabase.from("courses").select("title").eq("id", courseId).single();
  return { title: data ? `${data.title} — Course Builder` : "Course Builder" };
}

type LessonRow = Pick<Lesson, "id" | "title" | "position" | "is_preview">;
type ModuleRow = Pick<Module, "id" | "title" | "position"> & { lessons: LessonRow[] };

type ChecklistItem = { label: string; done: boolean; detail: string };

const STATUS_PILL: Record<Course["status"], string> = {
  published: "bg-green-100 text-green-700 border-0",
  draft:     "bg-amber-100 text-amber-700 border-0",
  archived:  "bg-slate-100 text-slate-600 border-0",
};

export default async function CourseDetailPage({
  params,
}: {
  params: Promise<{ courseId: string }>;
}) {
  const { courseId } = await params;
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const supabase = createClient();
  const { data: course } = await supabase
    .from("courses")
    .select("*")
    .eq("id", courseId)
    .eq("instructor_id", userId)
    .single();

  if (!course) notFound();

  const { data: modulesRaw } = (await supabase
    .from("modules")
    .select("id, title, position, lessons(id, title, position, is_preview)")
    .eq("course_id", courseId)
    .order("position", { ascending: true })) as { data: ModuleRow[] | null; error: unknown };

  const modules: ModuleRow[] = (modulesRaw ?? []).map((m) => ({
    ...m,
    lessons: (m.lessons ?? []).sort((a, b) => a.position - b.position),
  }));

  const lessonIds = modules.flatMap((m) => m.lessons.map((l) => l.id));
  const lessonCount = lessonIds.length;
  const previewLessonCount = modules.flatMap((m) => m.lessons).filter((l) => l.is_preview).length;

  let contentBlockCount = 0;
  if (lessonIds.length > 0) {
    const { count } = await supabase
      .from("content_blocks")
      .select("*", { head: true, count: "exact" })
      .in("lesson_id", lessonIds);
    contentBlockCount = count ?? 0;
  }

  let quizCount = 0;
  if (lessonIds.length > 0) {
    const { count } = await supabase
      .from("quizzes")
      .select("*", { head: true, count: "exact" })
      .in("lesson_id", lessonIds);
    quizCount = count ?? 0;
  }

  // ── Analytics ──────────────────────────────────────────────────────────────
  const { data: enrollmentsData } = await supabase
    .from("enrollments")
    .select("id, enrolled_at, completed_at, source")
    .eq("course_id", courseId);

  const enrollmentRows = enrollmentsData ?? [];
  const totalEnrollments = enrollmentRows.length;
  const completedEnrollments = enrollmentRows.filter((e) => e.completed_at).length;
  const completionRate = totalEnrollments > 0
    ? Math.round((completedEnrollments / totalEnrollments) * 100)
    : 0;

  const { data: ordersData } = await supabase
    .from("orders")
    .select("amount")
    .eq("course_id", courseId)
    .eq("status", "paid");

  const totalRevenue = (ordersData ?? []).reduce((sum, o) => sum + (o.amount ?? 0), 0);

  const { data: reviewsData } = await supabase
    .from("reviews")
    .select("rating")
    .eq("course_id", courseId);

  const reviewRows = reviewsData ?? [];
  const avgRating = reviewRows.length > 0
    ? reviewRows.reduce((s, r) => s + r.rating, 0) / reviewRows.length
    : null;

  // Recent enrollments by week (last 8 weeks)
  const now = new Date();
  const weeklyData: { week: string; count: number }[] = Array.from({ length: 8 }).map((_, i) => {
    const d = new Date(now);
    d.setDate(d.getDate() - (7 - i) * 7);
    return { week: d.toLocaleDateString("en-GB", { day: "numeric", month: "short" }), count: 0 };
  });
  for (const enr of enrollmentRows) {
    const enrolled = new Date(enr.enrolled_at);
    const weeksAgo = Math.floor((now.getTime() - enrolled.getTime()) / (7 * 24 * 3600 * 1000));
    const idx = 7 - weeksAgo;
    if (idx >= 0 && idx < 8) weeklyData[idx].count++;
  }

  const checklist: ChecklistItem[] = [
    {
      label: "Course basics",
      done: Boolean(course.title?.trim() && course.description?.trim()),
      detail: "Title and transformation summary are set.",
    },
    {
      label: "Audience metadata",
      done: Boolean(course.category && course.level),
      detail: "Category and difficulty level are defined.",
    },
    {
      label: "Curriculum structure",
      done: modules.length > 0 && lessonCount > 0,
      detail: `${modules.length} module${modules.length !== 1 ? "s" : ""} · ${lessonCount} lesson${lessonCount !== 1 ? "s" : ""}`,
    },
    {
      label: "Lesson content",
      done: contentBlockCount > 0,
      detail: `${contentBlockCount} content block${contentBlockCount !== 1 ? "s" : ""} created.`,
    },
  ];

  const readinessScore = Math.round((checklist.filter((c) => c.done).length / checklist.length) * 100);
  const isReady = readinessScore === 100;

  return (
    <>
      <Toaster />
      <div className="container" style={{ paddingTop: "40px", paddingBottom: "80px" }}>

        {/* ── Page header ─────────────────────────────────────────────── */}
        <div className="mb-8">
          <div className="mb-4 flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              className="rounded-full text-slate-500 hover:bg-[#fff6ee] hover:text-[#062e39]"
              render={<Link href="/creator/courses" />}
            >
              <ArrowLeft className="mr-1 h-4 w-4" />
              Studio
            </Button>
            <span className="text-slate-300">/</span>
            <Badge className={STATUS_PILL[course.status]}>{course.status}</Badge>
          </div>

          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <h1 className="text-3xl font-bold tracking-tight text-[#062e39]">{course.title}</h1>
              {course.description && (
                <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-slate-500 line-clamp-2">
                  {course.description}
                </p>
              )}
            </div>
            <div className="flex shrink-0 gap-3">
              <Button
                variant="outline"
                className="rounded-full border-slate-200 text-[#062e39] hover:bg-[#fff6ee]"
                render={<Link href={`/courses/${course.slug}`} target="_blank" />}
              >
                <Eye className="mr-2 h-4 w-4" />
                {course.status === "published" ? "View Live" : "Preview"}
              </Button>
              <PublishButton courseId={courseId} status={course.status} />
            </div>
          </div>
        </div>

        {/* ── Stats row ─────────────────────────────────────────────── */}
        <div className="mb-10 grid grid-cols-2 gap-4 md:grid-cols-4">
          {[
            { label: "Readiness", value: `${readinessScore}%`, icon: ShieldCheck,
              accent: isReady ? "bg-green-50 text-green-600" : "bg-[#fff6ee] text-[#fd5523]" },
            { label: "Modules",   value: String(modules.length),      icon: Layers,    accent: "bg-[#fff6ee] text-[#fd5523]" },
            { label: "Lessons",   value: String(lessonCount),          icon: BookOpen,  accent: "bg-[#fff6ee] text-[#fd5523]" },
            { label: "Blocks",    value: String(contentBlockCount),    icon: FileText,  accent: "bg-[#fff6ee] text-[#fd5523]" },
          ].map((item) => (
            <div key={item.label} className="marketing-outline-card rounded-[2rem] border-0 p-5">
              <div className={`mb-4 flex h-10 w-10 items-center justify-center rounded-2xl ${item.accent}`}>
                <item.icon className="h-5 w-5" />
              </div>
              <p className="text-3xl font-bold tracking-tight text-[#062e39]">{item.value}</p>
              <p className="mt-1 text-xs font-bold uppercase tracking-widest text-slate-400">{item.label}</p>
            </div>
          ))}
        </div>

        {/* ── Tabs ──────────────────────────────────────────────────── */}
        <Tabs defaultValue="overview">
          <TabsList className="mb-8 h-12 w-full justify-start gap-1 rounded-2xl bg-[#062e39]/5 p-1 sm:w-auto">
            <TabsTrigger
              value="overview"
              className="h-10 rounded-xl px-5 text-sm font-semibold text-slate-500 data-[state=active]:bg-white data-[state=active]:text-[#062e39] data-[state=active]:shadow-sm"
            >
              <ListChecks className="mr-2 h-4 w-4" />
              Overview
            </TabsTrigger>
            <TabsTrigger
              value="curriculum"
              className="h-10 rounded-xl px-5 text-sm font-semibold text-slate-500 data-[state=active]:bg-white data-[state=active]:text-[#062e39] data-[state=active]:shadow-sm"
            >
              <Layers className="mr-2 h-4 w-4" />
              Curriculum
            </TabsTrigger>
            <TabsTrigger
              value="settings"
              className="h-10 rounded-xl px-5 text-sm font-semibold text-slate-500 data-[state=active]:bg-white data-[state=active]:text-[#062e39] data-[state=active]:shadow-sm"
            >
              <FileText className="mr-2 h-4 w-4" />
              Settings
            </TabsTrigger>
            <TabsTrigger
              value="analytics"
              className="h-10 rounded-xl px-5 text-sm font-semibold text-slate-500 data-[state=active]:bg-white data-[state=active]:text-[#062e39] data-[state=active]:shadow-sm"
            >
              <TrendingUp className="mr-2 h-4 w-4" />
              Analytics
            </TabsTrigger>
          </TabsList>

          {/* Overview tab */}
          <TabsContent value="overview" className="mt-0">
            <div className="grid gap-6 lg:grid-cols-5">

              {/* Checklist — 3 cols */}
              <div className="marketing-card rounded-[2.5rem] border-0 p-8 lg:col-span-3">
                <div className="mb-6 flex items-center gap-4">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#fff6ee] text-[#fd5523]">
                    <ListChecks className="h-6 w-6" />
                  </div>
                  <div className="flex-1">
                    <h2 className="text-xl font-bold text-[#062e39]">Publish Checklist</h2>
                    <p className="text-sm text-slate-500">Complete all items before going live</p>
                  </div>
                  <div className="text-right">
                    <p
                      className="text-4xl font-bold tracking-tight"
                      style={{ color: isReady ? "#16a34a" : "#fd5523" }}
                    >
                      {readinessScore}%
                    </p>
                    <p className="text-xs font-bold uppercase tracking-widest text-slate-400">ready</p>
                  </div>
                </div>

                <div className="space-y-3">
                  {checklist.map((item) => (
                    <div
                      key={item.label}
                      className={`flex items-center gap-4 rounded-2xl border p-4 transition-all ${
                        item.done
                          ? "border-green-200/60 bg-green-50/40"
                          : "border-amber-200/60 bg-amber-50/30"
                      }`}
                    >
                      <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${
                        item.done ? "bg-green-100 text-green-600" : "bg-amber-100 text-amber-600"
                      }`}>
                        {item.done
                          ? <CheckCircle2 className="h-5 w-5" />
                          : <XCircle className="h-5 w-5" />
                        }
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-[#062e39]">{item.label}</p>
                        <p className="text-xs text-slate-500">{item.detail}</p>
                      </div>
                      <Badge className={item.done
                        ? "shrink-0 bg-green-100 text-green-700 border-0"
                        : "shrink-0 bg-amber-100 text-amber-700 border-0"
                      }>
                        {item.done ? "Done" : "Pending"}
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>

              {/* Summary — 2 cols */}
              <div className="space-y-6 lg:col-span-2">
                <div className="marketing-outline-card rounded-[2.5rem] border-0 p-6">
                  <div className="mb-5 flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-[#fd5523]" />
                    <h3 className="text-xs font-bold uppercase tracking-widest text-[#062e39]">Course Summary</h3>
                  </div>
                  <dl className="space-y-4 text-sm">
                    {[
                      {
                        label: "Pricing",
                        value: course.price_type === "free"
                          ? "Free"
                          : course.price_type === "subscription_only"
                            ? "Subscription"
                            : course.price_amount
                              ? `ZMW ${course.price_amount}`
                              : "Paid (amount not set)",
                      },
                      { label: "Category",  value: course.category  ?? "Not set" },
                      { label: "Level",     value: course.level ? course.level[0].toUpperCase() + course.level.slice(1) : "Not set" },
                      { label: "Previews",  value: `${previewLessonCount} lesson${previewLessonCount !== 1 ? "s" : ""}` },
                      { label: "Quizzes",   value: String(quizCount) },
                    ].map(({ label, value }) => (
                      <div key={label} className="flex items-center justify-between gap-3">
                        <dt className="font-medium text-slate-400">{label}</dt>
                        <dd className="font-bold text-[#062e39] text-right">{value}</dd>
                      </div>
                    ))}
                  </dl>
                </div>

                {/* Thumbnail preview */}
                {course.thumbnail_url && (
                  <div className="overflow-hidden rounded-[2rem]">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={course.thumbnail_url}
                      alt={course.title}
                      className="aspect-video w-full object-cover"
                    />
                  </div>
                )}

                {/* Launch CTA */}
                {course.status !== "published" && (
                  <div className="rounded-[2rem] bg-[#062e39] p-6 text-white">
                    <p className="text-xs font-bold uppercase tracking-widest text-[#fd8d69] mb-2">
                      {isReady ? "Ready to launch" : "Almost there"}
                    </p>
                    <p className="text-sm leading-relaxed text-white/75 mb-4">
                      {isReady
                        ? "All checklist items are complete. Publish your course to make it live."
                        : `Complete ${4 - checklist.filter(c => c.done).length} more item${4 - checklist.filter(c => c.done).length !== 1 ? "s" : ""} to be publish-ready.`}
                    </p>
                    <PublishButton courseId={courseId} status={course.status} />
                  </div>
                )}
              </div>
            </div>
          </TabsContent>

          {/* Curriculum tab */}
          <TabsContent value="curriculum" className="mt-0">
            <CurriculumBuilder courseId={courseId} initialModules={modules} />
          </TabsContent>

          {/* Settings tab */}
          <TabsContent value="settings" className="mt-0">
            <CourseSettingsForm course={course} />
          </TabsContent>

          {/* Analytics tab */}
          <TabsContent value="analytics" className="mt-0">
            <div className="space-y-8">

              {/* KPI row */}
              <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                {[
                  { label: "Enrollments", value: totalEnrollments, icon: Users, accent: "bg-[#fff6ee] text-[#fd5523]" },
                  { label: "Completed", value: completedEnrollments, icon: CheckCircle2, accent: "bg-green-50 text-green-600" },
                  { label: "Completion Rate", value: `${completionRate}%`, icon: TrendingUp, accent: completionRate >= 50 ? "bg-green-50 text-green-600" : "bg-amber-50 text-amber-600" },
                  { label: "Revenue (ZMW)", value: totalRevenue > 0 ? totalRevenue.toLocaleString() : "–", icon: Sparkles, accent: "bg-[#fff6ee] text-[#fd5523]" },
                ].map((item) => (
                  <div key={item.label} className="marketing-outline-card rounded-[2rem] border-0 p-5">
                    <div className={`mb-4 flex h-10 w-10 items-center justify-center rounded-2xl ${item.accent}`}>
                      <item.icon className="h-5 w-5" />
                    </div>
                    <p className="text-3xl font-bold tracking-tight text-[#062e39]">{item.value}</p>
                    <p className="mt-1 text-xs font-bold uppercase tracking-widest text-slate-400">{item.label}</p>
                  </div>
                ))}
              </div>

              <div className="grid gap-6 lg:grid-cols-2">

                {/* Weekly enrollment chart (simple bar) */}
                <div className="marketing-card rounded-[2.5rem] border-0 p-8">
                  <h3 className="mb-6 text-sm font-bold uppercase tracking-widest text-[#062e39]">Enrollments — Last 8 Weeks</h3>
                  {weeklyData.every((w) => w.count === 0) ? (
                    <p className="text-sm text-slate-400">No enrollments yet.</p>
                  ) : (
                    <div className="flex items-end gap-2 h-32">
                      {weeklyData.map((w) => {
                        const max = Math.max(...weeklyData.map((x) => x.count), 1);
                        const heightPct = Math.round((w.count / max) * 100);
                        return (
                          <div key={w.week} className="flex flex-1 flex-col items-center gap-1.5">
                            <span className="text-xs font-bold text-[#062e39]">{w.count > 0 ? w.count : ""}</span>
                            <div className="w-full rounded-t-lg bg-[#fd5523]/15 relative overflow-hidden" style={{ height: "80px" }}>
                              <div
                                className="absolute bottom-0 w-full rounded-t-lg bg-[#fd5523] transition-all"
                                style={{ height: `${heightPct}%` }}
                              />
                            </div>
                            <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400 text-center leading-tight">{w.week}</span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Rating + reviews summary */}
                <div className="marketing-outline-card rounded-[2.5rem] border-0 p-8">
                  <h3 className="mb-6 text-sm font-bold uppercase tracking-widest text-[#062e39]">Student Feedback</h3>
                  {reviewRows.length === 0 ? (
                    <p className="text-sm text-slate-400">No reviews yet. Publish your course to start collecting feedback.</p>
                  ) : (
                    <div className="space-y-6">
                      <div className="flex items-center gap-4">
                        <p className="text-5xl font-bold tracking-tight text-[#062e39]">
                          {avgRating !== null ? avgRating.toFixed(1) : "–"}
                        </p>
                        <div>
                          <div className="flex gap-0.5">
                            {[1, 2, 3, 4, 5].map((i) => (
                              <span key={i} style={{ color: avgRating !== null && i <= Math.round(avgRating) ? "#fd5523" : "#e5e7eb", fontSize: "18px" }}>★</span>
                            ))}
                          </div>
                          <p className="text-xs text-slate-400 mt-1">{reviewRows.length} review{reviewRows.length !== 1 ? "s" : ""}</p>
                        </div>
                      </div>
                      {[5, 4, 3, 2, 1].map((star) => {
                        const count = reviewRows.filter((r) => r.rating === star).length;
                        const pct = reviewRows.length > 0 ? Math.round((count / reviewRows.length) * 100) : 0;
                        return (
                          <div key={star} className="flex items-center gap-3 text-sm">
                            <span className="w-4 text-right font-bold text-[#062e39]">{star}</span>
                            <span className="text-[#fd5523]">★</span>
                            <div className="flex-1 h-2 rounded-full bg-slate-100 overflow-hidden">
                              <div className="h-full bg-[#fd5523] rounded-full" style={{ width: `${pct}%` }} />
                            </div>
                            <span className="w-8 text-xs font-bold text-slate-400">{pct}%</span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

              </div>

              {/* Enrollment source breakdown */}
              <div className="marketing-card rounded-[2.5rem] border-0 p-8">
                <h3 className="mb-6 text-sm font-bold uppercase tracking-widest text-[#062e39]">Enrollment Sources</h3>
                {totalEnrollments === 0 ? (
                  <p className="text-sm text-slate-400">No enrollments yet.</p>
                ) : (
                  <div className="grid gap-4 sm:grid-cols-3">
                    {(["individual_purchase", "subscription", "company_seat"] as const).map((src) => {
                      const count = enrollmentRows.filter((e) => e.source === src).length;
                      const labels: Record<string, string> = {
                        individual_purchase: "Direct Purchase",
                        subscription: "Subscription",
                        company_seat: "Company Seat",
                      };
                      return (
                        <div key={src} className="marketing-outline-card rounded-[1.5rem] border-0 p-5">
                          <p className="text-2xl font-bold text-[#062e39]">{count}</p>
                          <p className="mt-1 text-xs font-bold uppercase tracking-widest text-slate-400">{labels[src]}</p>
                          <div className="mt-3 h-1.5 rounded-full bg-slate-100">
                            <div
                              className="h-full rounded-full bg-[#fd5523]"
                              style={{ width: totalEnrollments > 0 ? `${Math.round((count / totalEnrollments) * 100)}%` : "0%" }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

            </div>
          </TabsContent>
        </Tabs>

      </div>
    </>
  );
}
