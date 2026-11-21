import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { CourseSettingsForm } from "@/components/creator/course-settings-form";
import { CurriculumBuilder } from "@/components/creator/curriculum-builder";
import { PublishButton } from "@/components/creator/publish-button";
import { CourseAIReview } from "@/components/creator/course-ai-review";
import { CourseTutorTab } from "@/components/creator/course-tutor-tab";
import { StudioTabs } from "@/components/creator/studio/studio-tabs";
import { getCourseListPath } from "@/lib/courses/course-routes";
import {
  listAvailablePersonasForCourse,
  listScenariosForCourseStudio,
} from "@/actions/tutor-authoring";
import { ZEDAI_TENANT_ID } from "@/lib/tenants/constants";
import {
  ArrowLeft,
  BarChart3,
  CheckCircle2,
  Circle,
  ExternalLink,
  ImageIcon,
  Layers,
  ListChecks,
  Mic,
  Settings2,
  Star,
  Users,
} from "lucide-react";
import { Toaster } from "@/components/ui/sonner";
import { cn } from "@/lib/utils";
import type { Course, Lesson, Module } from "@/types/database";

type LessonRow = Pick<Lesson, "id" | "title" | "position" | "is_preview"> & {
  content_block_count?: number;
  has_quiz?: boolean;
};
type ModuleRow = Pick<Module, "id" | "title" | "position"> & { lessons: LessonRow[] };
type ChecklistItem = {
  id: string;
  label: string;
  detail: string;
  done: boolean;
  required: boolean;
  tab: string;
};

const STATUS_STYLES: Record<Course["status"], { label: string; dot: string; pill: string }> = {
  published: { label: "Live", dot: "bg-emerald-500", pill: "bg-emerald-50 text-emerald-700 ring-emerald-200" },
  draft: { label: "Draft", dot: "bg-amber-500", pill: "bg-amber-50 text-amber-700 ring-amber-200" },
  archived: { label: "Archived", dot: "bg-slate-400", pill: "bg-slate-100 text-slate-600 ring-slate-200" },
};

function formatPrice(course: Course) {
  if (course.price_type === "free") return "Free";
  if (course.price_type === "subscription_only") return "Subscription";
  return course.price_amount ? `ZMW ${Number(course.price_amount).toLocaleString()}` : "Price not set";
}

export async function CourseStudioView({
  course,
  tenantSlug,
}: {
  course: Course;
  tenantSlug?: string;
}) {
  const supabase = createClient();
  const courseId = course.id;
  const backHref = getCourseListPath(tenantSlug);
  const previewHref = tenantSlug ? `/academy/${tenantSlug}/courses/${course.slug}` : `/courses/${course.slug}`;

  const { data: modulesRaw } = (await supabase
    .from("modules")
    .select("id, title, position, lessons(id, title, position, is_preview)")
    .eq("course_id", courseId)
    .order("position", { ascending: true })) as { data: ModuleRow[] | null; error: unknown };

  let modules: ModuleRow[] = (modulesRaw ?? []).map((m) => ({
    ...m,
    lessons: [...(m.lessons ?? [])].sort((a, b) => a.position - b.position),
  }));

  const lessonIds = modules.flatMap((m) => m.lessons.map((l) => l.id));
  const lessonCount = lessonIds.length;

  const [blocksRes, quizzesRes, enrollmentsRes, ordersRes, reviewsRes, groupsRes] = await Promise.all([
    lessonIds.length
      ? supabase.from("content_blocks").select("lesson_id").in("lesson_id", lessonIds)
      : Promise.resolve({ data: [] as { lesson_id: string }[] }),
    lessonIds.length
      ? supabase.from("quizzes").select("lesson_id").in("lesson_id", lessonIds)
      : Promise.resolve({ data: [] as { lesson_id: string }[] }),
    supabase.from("enrollments").select("id, enrolled_at, completed_at, status").eq("course_id", courseId),
    supabase.from("orders").select("amount").eq("course_id", courseId).eq("status", "paid"),
    supabase.from("reviews").select("rating").eq("course_id", courseId),
    course.company_id
      ? supabase.from("classroom_groups").select("id, name, course_id").eq("company_id", course.company_id).order("name")
      : Promise.resolve({ data: [] as { id: string; name: string; course_id: string | null }[] }),
  ]);

  const blockCountByLesson: Record<string, number> = {};
  for (const row of (blocksRes.data ?? []) as { lesson_id: string }[]) {
    blockCountByLesson[row.lesson_id] = (blockCountByLesson[row.lesson_id] ?? 0) + 1;
  }
  const quizLessonIds = new Set(((quizzesRes.data ?? []) as { lesson_id: string }[]).map((q) => q.lesson_id));

  modules = modules.map((module) => ({
    ...module,
    lessons: module.lessons.map((lesson) => ({
      ...lesson,
      content_block_count: blockCountByLesson[lesson.id] ?? 0,
      has_quiz: quizLessonIds.has(lesson.id),
    })),
  }));

  const allLessons = modules.flatMap((m) => m.lessons);
  const emptyLessons = allLessons.filter((l) => (l.content_block_count ?? 0) === 0);
  const previewLessonCount = allLessons.filter((l) => l.is_preview).length;
  const contentBlockCount = Object.values(blockCountByLesson).reduce((a, b) => a + b, 0);
  const quizCount = quizLessonIds.size;

  const enrollmentRows = (enrollmentsRes.data ?? []) as {
    id: string;
    enrolled_at: string;
    completed_at: string | null;
    status: string;
  }[];
  const totalEnrollments = enrollmentRows.length;
  const completedEnrollments = enrollmentRows.filter((e) => e.completed_at).length;
  const completionRate = totalEnrollments > 0 ? Math.round((completedEnrollments / totalEnrollments) * 100) : 0;
  const totalRevenue = ((ordersRes.data ?? []) as { amount: number | null }[]).reduce((s, o) => s + (o.amount ?? 0), 0);
  const reviewRows = (reviewsRes.data ?? []) as { rating: number }[];
  const avgRating = reviewRows.length > 0 ? reviewRows.reduce((s, r) => s + r.rating, 0) / reviewRows.length : null;
  const companyClasses = (groupsRes.data ?? []) as { id: string; name: string; course_id: string | null }[];

  let tutorPersonas: Awaited<ReturnType<typeof listAvailablePersonasForCourse>>["personas"] = [];
  let tutorScenarios: Awaited<ReturnType<typeof listScenariosForCourseStudio>> = [];
  let tutorCompanyId = course.company_id ?? ZEDAI_TENANT_ID;
  try {
    const [personaCtx, scenarioList] = await Promise.all([
      listAvailablePersonasForCourse(courseId),
      listScenariosForCourseStudio(courseId),
    ]);
    tutorCompanyId = personaCtx.companyId;
    tutorPersonas = personaCtx.personas;
    tutorScenarios = scenarioList;
  } catch {
    // Non-fatal if tutor tables are not yet populated in this environment
  }

  const now = new Date();
  const weeklyData = Array.from({ length: 8 }).map((_, i) => {
    const d = new Date(now);
    d.setDate(d.getDate() - (7 - i) * 7);
    return { week: d.toLocaleDateString("en-GB", { day: "numeric", month: "short" }), count: 0 };
  });
  for (const enr of enrollmentRows) {
    const weeksAgo = Math.floor((now.getTime() - new Date(enr.enrolled_at).getTime()) / (7 * 24 * 3600 * 1000));
    const idx = 7 - weeksAgo;
    if (idx >= 0 && idx < 8) weeklyData[idx].count++;
  }
  const weeklyMax = Math.max(...weeklyData.map((w) => w.count), 1);

  const needsPrice = course.price_type === "one_time" || course.price_type === "both";
  const checklist: ChecklistItem[] = [
    {
      id: "basics",
      label: "Title & promise",
      detail: course.description?.trim() ? "Learners know what they will achieve." : "Add a short description of the outcome.",
      done: Boolean(course.title?.trim() && course.description?.trim()),
      required: true,
      tab: "details",
    },
    {
      id: "audience",
      label: "Category & level",
      detail: course.category && course.level ? `${course.category} · ${course.level}` : "Helps learners find the right course.",
      done: Boolean(course.category && course.level),
      required: true,
      tab: "details",
    },
    {
      id: "pricing",
      label: "Pricing",
      detail: needsPrice && !course.price_amount ? "Set a price for this paid course." : formatPrice(course),
      done: !needsPrice || Boolean(course.price_amount && course.price_amount > 0),
      required: true,
      tab: "details",
    },
    {
      id: "curriculum",
      label: "Curriculum outline",
      detail: `${modules.length} module${modules.length !== 1 ? "s" : ""} · ${lessonCount} lesson${lessonCount !== 1 ? "s" : ""}`,
      done: modules.length > 0 && lessonCount > 0,
      required: true,
      tab: "curriculum",
    },
    {
      id: "content",
      label: "Every lesson has content",
      detail:
        lessonCount === 0
          ? "Add lessons first."
          : emptyLessons.length === 0
            ? "All lessons have content."
            : `${emptyLessons.length} empty lesson${emptyLessons.length !== 1 ? "s" : ""} — learners will see a blank page.`,
      done: lessonCount > 0 && emptyLessons.length === 0,
      required: true,
      tab: "curriculum",
    },
    {
      id: "cover",
      label: "Cover image",
      detail: course.thumbnail_url ? "Looks great in the catalog." : "Courses with covers get noticeably more clicks.",
      done: Boolean(course.thumbnail_url),
      required: false,
      tab: "details",
    },
    {
      id: "preview",
      label: "Free preview lesson",
      detail: previewLessonCount > 0 ? `${previewLessonCount} preview lesson${previewLessonCount !== 1 ? "s" : ""}` : "Let visitors try one lesson before enrolling.",
      done: previewLessonCount > 0,
      required: false,
      tab: "curriculum",
    },
    {
      id: "quiz",
      label: "Knowledge checks",
      detail: quizCount > 0 ? `${quizCount} quiz${quizCount !== 1 ? "zes" : ""}` : "Quizzes make certificates meaningful.",
      done: quizCount > 0,
      required: false,
      tab: "curriculum",
    },
  ];

  const required = checklist.filter((c) => c.required);
  const requiredDone = required.filter((c) => c.done).length;
  const isReady = requiredDone === required.length;
  const nextStep = checklist.find((c) => !c.done && c.required) ?? checklist.find((c) => !c.done) ?? null;
  const status = STATUS_STYLES[course.status] ?? STATUS_STYLES.draft;
  const readinessPct = Math.round((requiredDone / required.length) * 100);

  const curriculumPanel = (
    <CurriculumBuilder
      courseId={courseId}
      initialModules={modules}
      tenantSlug={tenantSlug}
      courseCategory={course.category}
    />
  );

  const launchPanel = (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
      <div className="rounded-2xl border border-slate-200/80 bg-white p-4 sm:p-6">
        <div className="mb-4 flex items-end justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-[#062e39]">Launch checklist</h2>
            <p className="text-sm text-slate-500">
              {isReady ? "Everything required is done." : `${required.length - requiredDone} required step${required.length - requiredDone !== 1 ? "s" : ""} left before you can publish.`}
            </p>
          </div>
          <p className={cn("text-2xl font-bold tabular-nums", isReady ? "text-emerald-600" : "text-[#fd5523]")}>
            {readinessPct}%
          </p>
        </div>
        <ul className="divide-y divide-slate-100">
          {checklist.map((item) => (
            <li key={item.id} className="flex items-start gap-3 py-3">
              {item.done ? (
                <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-500" />
              ) : (
                <Circle className={cn("mt-0.5 h-5 w-5 shrink-0", item.required ? "text-amber-400" : "text-slate-300")} />
              )}
              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-center gap-2 text-sm font-semibold text-[#062e39]">
                  {item.label}
                  {!item.required && (
                    <span className="rounded-md bg-slate-100 px-1.5 py-px text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                      Recommended
                    </span>
                  )}
                </p>
                <p className="text-xs text-slate-500">{item.detail}</p>
              </div>
              {!item.done && (
                <Link
                  href={`?tab=${item.tab}`}
                  className="shrink-0 rounded-lg px-2 py-1 text-xs font-semibold text-[#fd5523] hover:bg-[#fff6ee]"
                >
                  Fix
                </Link>
              )}
            </li>
          ))}
        </ul>
        {emptyLessons.length > 0 && (
          <div className="mt-4 rounded-xl bg-amber-50 p-3 text-xs text-amber-900">
            <p className="mb-1.5 font-semibold">Empty lessons</p>
            <ul className="space-y-1">
              {emptyLessons.slice(0, 6).map((l) => (
                <li key={l.id} className="truncate">• {l.title}</li>
              ))}
              {emptyLessons.length > 6 && <li>…and {emptyLessons.length - 6} more</li>}
            </ul>
          </div>
        )}
      </div>

      <div className="space-y-5">
        <div className="rounded-2xl bg-[#062e39] p-5 text-white">
          <p className="text-xs font-semibold uppercase tracking-wider text-[#fd8d69]">
            {course.status === "published" ? "Live in your catalog" : isReady ? "Ready to launch" : "Not ready yet"}
          </p>
          <p className="mt-1.5 text-sm leading-relaxed text-white/75">
            {course.status === "published"
              ? "Learners can find and enrol in this course. Unpublishing hides it from the catalog; enrolled learners keep access."
              : isReady
                ? "Publish to make this course visible in your catalog."
                : "Finish the required steps, then publish. You can keep editing after launch."}
          </p>
          <div className="mt-4">
            <PublishButton courseId={courseId} status={course.status} tenantSlug={tenantSlug} ready={isReady} variant="dark" />
          </div>
        </div>
        <dl className="grid grid-cols-2 gap-3 text-sm">
          {[
            { label: "Price", value: formatPrice(course) },
            { label: "Lessons", value: String(lessonCount) },
            { label: "Content blocks", value: String(contentBlockCount) },
            { label: "Quizzes", value: String(quizCount) },
          ].map((s) => (
            <div key={s.label} className="rounded-2xl border border-slate-200/80 bg-white p-3.5">
              <dt className="text-xs text-slate-500">{s.label}</dt>
              <dd className="mt-0.5 font-bold text-[#062e39]">{s.value}</dd>
            </div>
          ))}
        </dl>
      </div>

      <div className="lg:col-span-2">
        <CourseAIReview courseId={courseId} />
      </div>
    </div>
  );

  const insightsPanel = (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {[
          { label: "Learners", value: String(totalEnrollments) },
          { label: "Completed", value: String(completedEnrollments) },
          { label: "Completion rate", value: `${completionRate}%` },
          { label: "Revenue (ZMW)", value: totalRevenue > 0 ? totalRevenue.toLocaleString() : "—" },
        ].map((s) => (
          <div key={s.label} className="rounded-2xl border border-slate-200/80 bg-white p-4">
            <p className="text-xs text-slate-500">{s.label}</p>
            <p className="mt-1 text-2xl font-bold tabular-nums text-[#062e39]">{s.value}</p>
          </div>
        ))}
      </div>
      <div className="grid gap-5 lg:grid-cols-2">
        <div className="rounded-2xl border border-slate-200/80 bg-white p-4 sm:p-6">
          <h3 className="mb-4 text-sm font-bold text-[#062e39]">New learners · last 8 weeks</h3>
          {weeklyData.every((w) => w.count === 0) ? (
            <p className="py-8 text-center text-sm text-slate-400">No enrollments yet.</p>
          ) : (
            <div className="flex h-36 items-end gap-1.5 sm:gap-2">
              {weeklyData.map((w) => (
                <div key={w.week} className="flex flex-1 flex-col items-center gap-1">
                  <span className="text-[11px] font-semibold tabular-nums text-[#062e39]">{w.count || ""}</span>
                  <div className="relative h-24 w-full overflow-hidden rounded-md bg-[#fd5523]/10">
                    <div
                      className="absolute bottom-0 w-full rounded-md bg-[#fd5523]"
                      style={{ height: `${Math.round((w.count / weeklyMax) * 100)}%` }}
                    />
                  </div>
                  <span className="text-[10px] text-slate-400">{w.week}</span>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="rounded-2xl border border-slate-200/80 bg-white p-4 sm:p-6">
          <h3 className="mb-4 text-sm font-bold text-[#062e39]">Learner feedback</h3>
          {reviewRows.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-400">No reviews yet.</p>
          ) : (
            <div className="flex items-center gap-4">
              <p className="text-5xl font-bold tabular-nums text-[#062e39]">{avgRating?.toFixed(1)}</p>
              <div>
                <div className="flex gap-0.5">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <Star
                      key={i}
                      className={cn(
                        "h-4 w-4",
                        avgRating !== null && i <= Math.round(avgRating) ? "fill-[#fd5523] text-[#fd5523]" : "text-slate-200"
                      )}
                    />
                  ))}
                </div>
                <p className="mt-1 text-xs text-slate-500">
                  {reviewRows.length} review{reviewRows.length !== 1 ? "s" : ""}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <>
      <Toaster position="top-center" />
      <div className="app-surface mx-auto w-full max-w-6xl px-4 pb-24 pt-4 sm:pt-6">
        {/* ── Studio header ─────────────────────────────────────────── */}
        <header className="mb-1">
          <Link
            href={backHref}
            className="mb-3 inline-flex items-center gap-1.5 rounded-lg py-1 text-sm font-medium text-slate-500 transition-colors hover:text-[#062e39]"
          >
            <ArrowLeft className="h-4 w-4" />
            All courses
          </Link>

          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 items-center gap-3 sm:gap-4">
              <div className="relative h-14 w-20 shrink-0 overflow-hidden rounded-xl bg-gradient-to-br from-[#062e39] to-[#0d4d5e] sm:h-16 sm:w-24">
                {course.thumbnail_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={course.thumbnail_url} alt="" className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-white/40">
                    <ImageIcon className="h-5 w-5" />
                  </div>
                )}
              </div>
              <div className="min-w-0">
                <div className="mb-1 flex items-center gap-2">
                  <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset", status.pill)}>
                    <span className={cn("h-1.5 w-1.5 rounded-full", status.dot)} />
                    {status.label}
                  </span>
                  <span className="truncate text-xs text-slate-500">
                    {[course.category, course.level && course.level[0].toUpperCase() + course.level.slice(1), formatPrice(course)]
                      .filter(Boolean)
                      .join(" · ")}
                  </span>
                </div>
                <h1 className="line-clamp-2 text-xl font-bold leading-tight tracking-tight text-[#062e39] sm:text-2xl">
                  {course.title}
                </h1>
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-2">
              <Link
                href={previewHref}
                target="_blank"
                className="inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-[#062e39] transition-colors hover:bg-slate-50 sm:flex-none"
              >
                <ExternalLink className="h-4 w-4" />
                {course.status === "published" ? "View live" : "Preview"}
              </Link>
              <div className="flex-1 sm:flex-none">
                <PublishButton courseId={courseId} status={course.status} tenantSlug={tenantSlug} ready={isReady} />
              </div>
            </div>
          </div>

          {/* Next-step nudge — keeps creators moving without a wall of stats */}
          {course.status !== "published" && nextStep && (
            <Link
              href={`?tab=${nextStep.tab}`}
              className="mt-4 flex items-center gap-3 rounded-2xl border border-slate-200/80 bg-white p-3 transition-colors hover:border-[#fd5523]/40"
            >
              <div className="relative h-10 w-10 shrink-0">
                <svg viewBox="0 0 36 36" className="h-10 w-10 -rotate-90">
                  <circle cx="18" cy="18" r="15.5" fill="none" stroke="#f1f5f9" strokeWidth="4" />
                  <circle
                    cx="18"
                    cy="18"
                    r="15.5"
                    fill="none"
                    stroke="#fd5523"
                    strokeWidth="4"
                    strokeLinecap="round"
                    strokeDasharray={`${(readinessPct / 100) * 97.4} 97.4`}
                  />
                </svg>
                <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-[#062e39]">
                  {requiredDone}/{required.length}
                </span>
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium text-slate-500">Next step</p>
                <p className="truncate text-sm font-semibold text-[#062e39]">
                  {nextStep.label}
                  <span className="font-normal text-slate-500"> — {nextStep.detail}</span>
                </p>
              </div>
              <span className="shrink-0 text-xs font-semibold text-[#fd5523]">Go →</span>
            </Link>
          )}
        </header>

        <StudioTabs
          defaultTab="curriculum"
          tabs={[
            {
              id: "curriculum",
              label: "Curriculum",
              icon: <Layers className="h-4 w-4" />,
              badge: lessonCount || null,
              content: curriculumPanel,
            },
            {
              id: "launch",
              label: "Launch",
              icon: <ListChecks className="h-4 w-4" />,
              badge: course.status === "published" ? null : `${requiredDone}/${required.length}`,
              content: launchPanel,
            },
            {
              id: "details",
              label: "Details",
              icon: <Settings2 className="h-4 w-4" />,
              content: <CourseSettingsForm course={course} tenantSlug={tenantSlug} companyClasses={companyClasses} />,
            },
            {
              id: "ai-teacher",
              label: "AI Teacher",
              icon: <Mic className="h-4 w-4" />,
              badge: tutorScenarios.length || null,
              content: (
                <CourseTutorTab
                  courseId={courseId}
                  companyId={tutorCompanyId}
                  tenantSlug={tenantSlug}
                  initialPersonas={tutorPersonas}
                  initialScenarios={tutorScenarios}
                />
              ),
            },
            {
              id: "insights",
              label: "Insights",
              icon: totalEnrollments > 0 ? <Users className="h-4 w-4" /> : <BarChart3 className="h-4 w-4" />,
              badge: totalEnrollments || null,
              content: insightsPanel,
            },
          ]}
        />
      </div>
    </>
  );
}
