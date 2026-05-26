// app/creator/courses/[courseId]/page.tsx
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

type LessonRow = Pick<Lesson, "id" | "title" | "position" | "is_preview"> & { content_block_count?: number };
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

  let modules: ModuleRow[] = (modulesRaw ?? []).map((m) => ({
    ...m,
    lessons: (m.lessons ?? []).sort((a, b) => a.position - b.position),
  }));

  const lessonIds = modules.flatMap((m) => m.lessons.map((l) => l.id));
  const lessonCount = lessonIds.length;
  const previewLessonCount = modules.flatMap((m) => m.lessons).filter((l) => l.is_preview).length;

  let contentBlockCount = 0;
  let blockCountByLessonId: Record<string, number> = {};
  if (lessonIds.length > 0) {
    const { count, data: blockRows } = await supabase
      .from("content_blocks")
      .select("lesson_id", { count: "exact" })
      .in("lesson_id", lessonIds);
    contentBlockCount = count ?? 0;
    blockCountByLessonId = Object.fromEntries(lessonIds.map((id) => [id, 0]));
    for (const row of blockRows ?? []) {
      const lessonId = (row as { lesson_id: string }).lesson_id;
      blockCountByLessonId[lessonId] = (blockCountByLessonId[lessonId] ?? 0) + 1;
    }
  }

  modules = modules.map((module) => ({
    ...module,
    lessons: module.lessons.map((lesson) => ({
      ...lesson,
      content_block_count: blockCountByLessonId[lesson.id] ?? 0,
    })),
  }));

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
      {/* Mobile-first container: full width on mobile, padding adjusted responsively */}
      <div className="w-full px-4 py-6 sm:px-6 md:px-8 lg:container lg:mx-auto lg:py-10 xl:px-0" style={{ paddingBottom: "80px" }}>

        {/* ── Page header (stacked on mobile, inline on larger) ── */}
        <div className="mb-6 sm:mb-8 md:mb-10 px-1">
        <div className="mb-6 sm:mb-8 md:mb-10 px-1">
  
        {/* Breadcrumbs & Status Row */}
        <div className="mb-4 flex items-center gap-2.5 sm:gap-3">
          <Button
            variant="ghost"
            size="sm"
            className="h-9 rounded px-2.5 text-slate-500 hover:bg-slate-100 hover:text-[#062e39] transition-colors"
          >
            <Link href="/creator/courses" className="inline-flex items-center justify-center gap-2 text-sm font-bold">
              {/* icon and text are tightly locked in a flex row */}
              <ArrowLeft className="h-4 w-4 shrink-0" />
              <span className="hidden text-sm sm:block">Studio</span>
              <span className="sm:hidden">Back</span>
            </Link>
          </Button>
          
          <span className="text-slate-300 font-light select-none">/</span>
          
          <Badge className={`${STATUS_PILL[course.status]} text-xs sm:text-sm font-black tracking-wide px-2.5 py-0.5 rounded-lg shrink-0`}>
            {course.status}
          </Badge>
        </div>

        {/* Main Heading & Action Blocks */}
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between lg:gap-8 max-w-100">
          
          {/* Title and Description */}
          <div className="min-w-0 flex-1 space-y-1.5">
            <h1 className="text-2xl font-bold tracking-tight text-[#062e39] sm:text-3xl md:text-4xl break-words">
              {course.title}
            </h1>
            {course.description && (
              <p className="text-base sm:text-sm leading-relaxed text-slate-500 line-clamp-2 max-w-3xl">
                {course.description}
              </p>
            )}
          </div>

          {/* Responsive Action Buttons Container */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full sm:flex sm:w-auto sm:shrink-0 sm:items-center">
            <Button
              variant="outline"
              className="h-11 sm:h-10 w-full sm:w-auto rounded border-slate-200 px-4 text-base sm:text-sm font-bold text-[#062e39] hover:bg-[#fff6ee] active:scale-98 transition-all shadow-sm"
              style={{borderRadius:'12px'}}
            >
              {/* inline-flex + items-center locks the icon and text to the exact same center line */}
              <Link 
                href={`/courses/${course.slug}`} 
                target="_blank" 
                className="flex direction-row items-center justify-center gap-2 w-full h-full"
              >
                <Eye className="h-4 w-4 shrink-0" />
                <span className="text-sm">{course.status === "published" ? "View Live" : "Preview"}</span>
              </Link>
            </Button>
            
            {/* Container wrapper to ensure custom publish button inherits responsive rules perfectly */}
            <div className="w-full sm:w-auto [&>button]:w-full [&>button]:h-11 sm:[&>button]:h-10 [&>button]:rounded-xl">
              <PublishButton courseId={courseId} status={course.status} />
            </div>
          </div>

        </div>
      </div>

 
    </div>

        {/* ── Stats row - 2 columns on mobile, 4 on tablet+ ── */}
        <div className="mb-8 grid grid-cols-2 gap-3 sm:mb-10 sm:gap-4 md:grid-cols-4">
          {[
            { label: "Readiness", value: `${readinessScore}%`, icon: ShieldCheck,
              accent: isReady ? "bg-green-50 text-green-600" : "bg-[#fff6ee] text-[#fd5523]" },
            { label: "Modules",   value: String(modules.length),      icon: Layers,    accent: "bg-[#fff6ee] text-[#fd5523]" },
            { label: "Lessons",   value: String(lessonCount),          icon: BookOpen,  accent: "bg-[#fff6ee] text-[#fd5523]" },
            { label: "Blocks",    value: String(contentBlockCount),    icon: FileText,  accent: "bg-[#fff6ee] text-[#fd5523]" },
          ].map((item) => (
            <div key={item.label} className="rounded-2xl border-0 bg-white p-4 shadow-sm sm:p-5">
              <div className={`mb-3 flex h-9 w-9 items-center justify-center rounded-xl sm:mb-4 sm:h-10 sm:w-10 sm:rounded-2xl ${item.accent}`}>
                <item.icon className="h-4 w-4 sm:h-5 sm:w-5" />
              </div>
              <p className="text-2xl font-bold tracking-tight text-[#062e39] sm:text-3xl">{item.value}</p>
              <p className="mt-0.5 text-[10px] font-bold uppercase tracking-wider text-slate-400 sm:mt-1 sm:text-xs">{item.label}</p>
            </div>
          ))}
        </div>

        {/* ── Tabs (scrollable on mobile) ── */}
        <Tabs defaultValue="overview">
          <div className="overflow-x-auto pb-2 sm:overflow-visible">
            <TabsList className="mb-6 inline-flex h-auto w-auto min-w-full gap-1 rounded-2xl bg-[#062e39]/5 p-1 sm:mb-8 sm:w-full sm:justify-start">
              <TabsTrigger
                value="overview"
                className="h-9 shrink-0 rounded-xl px-3 text-xs font-semibold text-slate-500 data-[state=active]:bg-white data-[state=active]:text-[#062e39] data-[state=active]:shadow-sm sm:h-10 sm:px-5 sm:text-sm"
              >
                <ListChecks className="mr-1.5 h-3.5 w-3.5 sm:mr-2 sm:h-4 sm:w-4" />
                Overview
              </TabsTrigger>
              <TabsTrigger
                value="curriculum"
                className="h-9 shrink-0 rounded-xl px-3 text-xs font-semibold text-slate-500 data-[state=active]:bg-white data-[state=active]:text-[#062e39] data-[state=active]:shadow-sm sm:h-10 sm:px-5 sm:text-sm"
              >
                <Layers className="mr-1.5 h-3.5 w-3.5 sm:mr-2 sm:h-4 sm:w-4" />
                Curriculum
              </TabsTrigger>
              <TabsTrigger
                value="settings"
                className="h-9 shrink-0 rounded-xl px-3 text-xs font-semibold text-slate-500 data-[state=active]:bg-white data-[state=active]:text-[#062e39] data-[state=active]:shadow-sm sm:h-10 sm:px-5 sm:text-sm"
              >
                <FileText className="mr-1.5 h-3.5 w-3.5 sm:mr-2 sm:h-4 sm:w-4" />
                Settings
              </TabsTrigger>
              <TabsTrigger
                value="analytics"
                className="h-9 shrink-0 rounded-xl px-3 text-xs font-semibold text-slate-500 data-[state=active]:bg-white data-[state=active]:text-[#062e39] data-[state=active]:shadow-sm sm:h-10 sm:px-5 sm:text-sm"
              >
                <TrendingUp className="mr-1.5 h-3.5 w-3.5 sm:mr-2 sm:h-4 sm:w-4" />
                Analytics
              </TabsTrigger>
            </TabsList>
          </div>

          {/* Overview tab */}
          <TabsContent value="overview" className="mt-0">
            {/* Stack on mobile, grid on tablet+ */}
            <div className="flex flex-col gap-6 lg:flex-row lg:gap-6">

              {/* Checklist - takes full width on mobile, 3/5 on desktop */}
              <div className="w-full lg:flex-[3]">
                <div className="rounded-2xl border-0 bg-white p-5 shadow-sm sm:rounded-[2rem] sm:p-6 md:p-8">
                  <div className="mb-5 flex flex-col gap-4 sm:mb-6 sm:flex-row sm:items-center sm:gap-6">
                    <div className="flex items-center gap-3 sm:gap-4">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#fff6ee] text-[#fd5523] sm:h-12 sm:w-12 sm:rounded-2xl">
                        <ListChecks className="h-5 w-5 sm:h-6 sm:w-6" />
                      </div>
                      <div>
                        <h2 className="text-lg font-bold text-[#062e39] sm:text-xl">Publish Checklist</h2>
                        <p className="text-xs text-slate-500 sm:text-sm">Complete all items before going live</p>
                      </div>
                    </div>
                    <div className="ml-auto text-left sm:text-right">
                      <p
                        className="text-3xl font-bold tracking-tight sm:text-4xl"
                        style={{ color: isReady ? "#16a34a" : "#fd5523" }}
                      >
                        {readinessScore}%
                      </p>
                      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 sm:text-xs">ready</p>
                    </div>
                  </div>

                  <div className="space-y-3">
                    {checklist.map((item) => (
                      <div
                        key={item.label}
                        className={`flex items-center gap-3 rounded-xl border p-3 transition-all sm:gap-4 sm:rounded-2xl sm:p-4 ${
                          item.done
                            ? "border-green-200/60 bg-green-50/40"
                            : "border-amber-200/60 bg-amber-50/30"
                        }`}
                      >
                        <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg sm:h-9 sm:w-9 sm:rounded-xl ${
                          item.done ? "bg-green-100 text-green-600" : "bg-amber-100 text-amber-600"
                        }`}>
                          {item.done
                            ? <CheckCircle2 className="h-4 w-4 sm:h-5 sm:w-5" />
                            : <XCircle className="h-4 w-4 sm:h-5 sm:w-5" />
                          }
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-[#062e39]">{item.label}</p>
                          <p className="text-xs text-slate-500">{item.detail}</p>
                        </div>
                        <Badge className={`shrink-0 text-[10px] sm:text-xs ${
                          item.done
                            ? "bg-green-100 text-green-700 border-0"
                            : "bg-amber-100 text-amber-700 border-0"
                        }`}>
                          {item.done ? "Done" : "Pending"}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Summary - full width on mobile, 2/5 on desktop */}
              <div className="flex w-full flex-col gap-6 lg:flex-[2]">
                <div className="rounded-2xl border-0 bg-white p-5 shadow-sm sm:rounded-[2rem] sm:p-6 md:p-8">
                  <div className="mb-4 flex items-center gap-2 sm:mb-5">
                    <Sparkles className="h-3.5 w-3.5 text-[#fd5523] sm:h-4 sm:w-4" />
                    <h3 className="text-[10px] font-bold uppercase tracking-wider text-[#062e39] sm:text-xs">Course Summary</h3>
                  </div>
                  <dl className="space-y-3 text-sm sm:space-y-4">
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
                        <dt className="text-xs font-medium text-slate-400 sm:text-sm">{label}</dt>
                        <dd className="text-right text-sm font-bold text-[#062e39] sm:text-base">{value}</dd>
                      </div>
                    ))}
                  </dl>
                </div>

                {/* Thumbnail preview */}
                {course.thumbnail_url && (
                  <div className="overflow-hidden rounded-2xl sm:rounded-[2rem]">
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
                  <div className="rounded-2xl bg-[#062e39] p-5 text-white sm:rounded-[2rem] sm:p-6">
                    <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-[#fd8d69] sm:text-xs">
                      {isReady ? "Ready to launch" : "Almost there"}
                    </p>
                    <p className="mb-4 text-sm leading-relaxed text-white/75">
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
            <div className="space-y-6 sm:space-y-8">

              {/* KPI row - 2 columns on mobile, 4 on tablet+ */}
              <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-4">
                {[
                  { label: "Enrollments", value: totalEnrollments, icon: Users, accent: "bg-[#fff6ee] text-[#fd5523]" },
                  { label: "Completed", value: completedEnrollments, icon: CheckCircle2, accent: "bg-green-50 text-green-600" },
                  { label: "Completion Rate", value: `${completionRate}%`, icon: TrendingUp, accent: completionRate >= 50 ? "bg-green-50 text-green-600" : "bg-amber-50 text-amber-600" },
                  { label: "Revenue (ZMW)", value: totalRevenue > 0 ? totalRevenue.toLocaleString() : "–", icon: Sparkles, accent: "bg-[#fff6ee] text-[#fd5523]" },
                ].map((item) => (
                  <div key={item.label} className="rounded-2xl border-0 bg-white p-4 shadow-sm sm:p-5">
                    <div className={`mb-3 flex h-9 w-9 items-center justify-center rounded-xl sm:mb-4 sm:h-10 sm:w-10 sm:rounded-2xl ${item.accent}`}>
                      <item.icon className="h-4 w-4 sm:h-5 sm:w-5" />
                    </div>
                    <p className="text-2xl font-bold tracking-tight text-[#062e39] sm:text-3xl">{item.value}</p>
                    <p className="mt-0.5 text-[10px] font-bold uppercase tracking-wider text-slate-400 sm:mt-1 sm:text-xs">{item.label}</p>
                  </div>
                ))}
              </div>

              <div className="flex flex-col gap-6 lg:flex-row lg:gap-6">

                {/* Weekly enrollment chart */}
                <div className="w-full rounded-2xl border-0 bg-white p-5 shadow-sm sm:rounded-[2rem] sm:p-6 md:p-8 lg:flex-1">
                  <h3 className="mb-4 text-xs font-bold uppercase tracking-wider text-[#062e39] sm:mb-6 sm:text-sm">Enrollments — Last 8 Weeks</h3>
                  {weeklyData.every((w) => w.count === 0) ? (
                    <p className="text-sm text-slate-400">No enrollments yet.</p>
                  ) : (
                    <div className="flex h-32 items-end gap-1 sm:h-40 sm:gap-2">
                      {weeklyData.map((w) => {
                        const max = Math.max(...weeklyData.map((x) => x.count), 1);
                        const heightPct = Math.round((w.count / max) * 100);
                        return (
                          <div key={w.week} className="flex flex-1 flex-col items-center gap-1 sm:gap-1.5">
                            <span className="text-xs font-bold text-[#062e39]">{w.count > 0 ? w.count : ""}</span>
                            <div className="relative h-16 w-full overflow-hidden rounded-t-lg bg-[#fd5523]/10 sm:h-24">
                              <div
                                className="absolute bottom-0 w-full rounded-t-lg bg-[#fd5523] transition-all"
                                style={{ height: `${heightPct}%` }}
                              />
                            </div>
                            <span className="text-center text-[8px] font-bold uppercase leading-tight tracking-wider text-slate-400 sm:text-[10px]">{w.week}</span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Rating + reviews summary */}
                <div className="w-full rounded-2xl border-0 bg-white p-5 shadow-sm sm:rounded-[2rem] sm:p-6 md:p-8 lg:flex-1">
                  <h3 className="mb-4 text-xs font-bold uppercase tracking-wider text-[#062e39] sm:mb-6 sm:text-sm">Student Feedback</h3>
                  {reviewRows.length === 0 ? (
                    <p className="text-sm text-slate-400">No reviews yet. Publish your course to start collecting feedback.</p>
                  ) : (
                    <div className="space-y-5 sm:space-y-6">
                      <div className="flex items-center gap-4">
                        <p className="text-4xl font-bold tracking-tight text-[#062e39] sm:text-5xl">
                          {avgRating !== null ? avgRating.toFixed(1) : "–"}
                        </p>
                        <div>
                          <div className="flex gap-0.5">
                            {[1, 2, 3, 4, 5].map((i) => (
                              <span key={i} style={{ color: avgRating !== null && i <= Math.round(avgRating) ? "#fd5523" : "#e5e7eb", fontSize: "16px" }} className="sm:text-lg">★</span>
                            ))}
                          </div>
                          <p className="mt-1 text-xs text-slate-400">{reviewRows.length} review{reviewRows.length !== 1 ? "s" : ""}</p>
                        </div>
                      </div>
                      <div className="space-y-2 sm:space-y-3">
                        {[5, 4, 3, 2, 1].map((star) => {
                          const count = reviewRows.filter((r) => r.rating === star).length;
                          const pct = reviewRows.length > 0 ? Math.round((count / reviewRows.length) * 100) : 0;
                          return (
                            <div key={star} className="flex items-center gap-2 text-xs sm:gap-3 sm:text-sm">
                              <span className="w-4 text-right font-bold text-[#062e39]">{star}</span>
                              <span className="text-[#fd5523]">★</span>
                              <div className="h-1.5 flex-1 rounded-full bg-slate-100 overflow-hidden sm:h-2">
                                <div className="h-full rounded-full bg-[#fd5523]" style={{ width: `${pct}%` }} />
                              </div>
                              <span className="w-8 text-xs font-bold text-slate-400">{pct}%</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>

              </div>

              {/* Enrollment source breakdown */}
              <div className="rounded-2xl border-0 bg-white p-5 shadow-sm sm:rounded-[2rem] sm:p-6 md:p-8">
                <h3 className="mb-4 text-xs font-bold uppercase tracking-wider text-[#062e39] sm:mb-6 sm:text-sm">Enrollment Sources</h3>
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
                      const percentage = totalEnrollments > 0 ? Math.round((count / totalEnrollments) * 100) : 0;
                      return (
                        <div key={src} className="rounded-xl border-0 bg-[#f8fafc] p-4 sm:rounded-2xl sm:p-5">
                          <p className="text-xl font-bold text-[#062e39] sm:text-2xl">{count}</p>
                          <p className="mt-0.5 text-[10px] font-bold uppercase tracking-wider text-slate-400 sm:mt-1 sm:text-xs">{labels[src]}</p>
                          <div className="mt-2 h-1.5 rounded-full bg-slate-200 sm:mt-3">
                            <div
                              className="h-full rounded-full bg-[#fd5523]"
                              style={{ width: `${percentage}%` }}
                            />
                          </div>
                          <p className="mt-1 text-right text-[10px] font-medium text-slate-500 sm:text-xs">{percentage}%</p>
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
