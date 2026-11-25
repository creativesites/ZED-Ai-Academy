"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { QuizPlayer } from "@/components/learner/quiz-player";
import { TeacherDock } from "@/components/learner/ai-tutor";
import { TutorSessionBlock } from "@/components/learner/content-blocks/tutor-session-block";
import { PracticeStudio } from "@/components/learner/practice-studio";
import { LessonDiscussions } from "@/components/learner/lesson-discussions";
import type { Discussion } from "@/types/database";
import { markLessonComplete, generateCertificate } from "@/actions/certificates";
import { cn } from "@/lib/utils";
import {
  ArrowLeft,
  Award,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Code2,
  Eye,
  HelpCircle,
  Loader2,
  Lock,
  Menu,
  MessageCircle,
  PanelLeftClose,
  PanelLeftOpen,
  PencilLine,
  Sparkles,
  Trophy,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { courseTeacher } from "@/lib/tutor/course-teacher";
import { Toaster } from "@/components/ui/sonner";
import { BlockRenderer, type Module, type ContentBlock, type Quiz } from "@/components/course-blocks";
import {
  parseTutorSessionBlock,
  REQUIRED_TUTOR_HINT,
  type TutorScenarioView,
} from "@/lib/tutor/tutor-session-block";

type DiscussionWithProfile = Discussion & {
  profiles: { full_name: string | null; avatar_url: string | null } | null;
};

export type PlacedTeacherMoment = {
  id: string;
  scenario_id: string;
  after_block_id: string | null;
  position: number;
  title: string | null;
  prompt: string | null;
  required: boolean;
};

export function LessonPlayerClient({
  course,
  modules,
  activeLessonId,
  blocks,
  quiz,
  initialQuizAttempt,
  quizAttemptsUsed = 0,
  completedLessonIds,
  allDone,
  existingCertificate,
  discussions,
  practiceSubmissions = [],
  bookings,
  userId,
  isPreview = false,
  isPartialEnrollment = false,
  isManager = false,
  coursePublished = true,
  tutorScenarios = {},
  tutorCompletedScenarioIds = [],
  teacherMoments = [],
  vivaStatus = null,
}: {
  course: {
    id: string;
    title: string;
    slug: string;
    description: string | null;
    category: string | null;
    level: string | null;
    price_type?: string | null;
    company_slug?: string | null;
    company_name?: string | null;
  };
  modules: Module[];
  activeLessonId: string;
  blocks: ContentBlock[];
  quiz: Quiz;
  initialQuizAttempt?: {
    score: number;
    passed: boolean;
    answers?: Record<string, number[]>;
  } | null;
  quizAttemptsUsed?: number;
  completedLessonIds: string[];
  allDone: boolean;
  existingCertificate: { id: string; public_id: string; issued_at: string } | null;
  discussions?: DiscussionWithProfile[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  practiceSubmissions?: any[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  bookings?: any[];
  userId?: string | null;
  isPreview?: boolean;
  isPartialEnrollment?: boolean;
  isManager?: boolean;
  coursePublished?: boolean;
  tutorScenarios?: Record<string, TutorScenarioView>;
  tutorCompletedScenarioIds?: string[];
  teacherMoments?: PlacedTeacherMoment[];
  vivaStatus?: {
    required: boolean;
    passed: boolean;
    scenarioId: string | null;
    scenario: TutorScenarioView | null;
    reason: string | null;
  } | null;
}) {
  const router = useRouter();
  const [completed, setCompleted] = useState(new Set(completedLessonIds));
  const [tutorDone, setTutorDone] = useState(new Set(tutorCompletedScenarioIds));
  const [certificate, setCertificate] = useState(existingCertificate);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [tutorOpen, setTutorOpen] = useState(false);
  // One teacher per course: the dock uses the same character as the course's AI Teacher moments.
  const teacher = courseTeacher(Object.values(tutorScenarios));
  const [studioOpen, setStudioOpen] = useState(false);
  const [studioInitialTool, setStudioInitialTool] = useState<string | undefined>();
  const [studioTargetBlockId, setStudioTargetBlockId] = useState<string | null>(null);
  const [studioContext, setStudioContext] = useState<{ brief?: string; instructions?: string[] } | null>(null);
  const [activeTab, setActiveTab] = useState<"lesson" | "discussion">("lesson");
  const [marking, startMark] = useTransition();
  const [certifying, startCertify] = useTransition();
  const scrollRef = useRef<HTMLDivElement>(null);

  const isGuest = !userId;
  const allLessons = modules.flatMap((m) => m.lessons);
  const isOpenGuestShowcase =
    isGuest && course.price_type === "free" && allLessons.some((l) => l.is_preview);
  const guestStorageKey = `zedai_guest_progress_${course.id}`;

  // Server-provided progress is the source of truth whenever signed-in progress changes.
  const [syncedProgress, setSyncedProgress] = useState(completedLessonIds);
  if (syncedProgress !== completedLessonIds) {
    setSyncedProgress(completedLessonIds);
    if (!isOpenGuestShowcase) {
      setCompleted(new Set(completedLessonIds));
    }
  }

  // Hydrate local guest progress so open free-showcase visitors can track progress without login.
  useEffect(() => {
    if (!isOpenGuestShowcase) return;
    try {
      const raw = window.localStorage.getItem(guestStorageKey);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          setCompleted(new Set(parsed.filter((v): v is string => typeof v === "string")));
        }
      }
    } catch {
      // Ignore storage errors in private browsing
    }
  }, [isOpenGuestShowcase, guestStorageKey]);

  function markGuestLessonDone(lessonId: string) {
    setCompleted((prev) => {
      const next = new Set([...prev, lessonId]);
      try {
        window.localStorage.setItem(guestStorageKey, JSON.stringify([...next]));
      } catch {
        // Ignore storage errors
      }
      return next;
    });
  }

  // New lesson → close the mobile drawer and go back to the lesson tab…
  const [syncedLesson, setSyncedLesson] = useState(activeLessonId);
  if (syncedLesson !== activeLessonId) {
    setSyncedLesson(activeLessonId);
    setDrawerOpen(false);
    setActiveTab("lesson");
  }
  // …and start reading from the top.
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0 });
  }, [activeLessonId]);

  const learnHref = (lessonId: string) => `/courses/${course.slug}/learn?lesson=${lessonId}`;
  const currentIdx = allLessons.findIndex((l) => l.id === activeLessonId);
  const currentLesson = allLessons[currentIdx];
  const currentModule = modules.find((m) => m.lessons.some((l) => l.id === activeLessonId));
  const prevLesson = currentIdx > 0 ? allLessons[currentIdx - 1] : null;
  const nextLesson = currentIdx < allLessons.length - 1 ? allLessons[currentIdx + 1] : null;
  const totalLessons = allLessons.length;
  const doneCount = allLessons.filter((l) => completed.has(l.id)).length;
  const progressPct = totalLessons > 0 ? Math.round((doneCount / totalLessons) * 100) : 0;
  const isDone = completed.has(activeLessonId);
  const courseComplete = !isPreview && totalLessons > 0 && (allDone || doneCount === totalLessons);
  const courseHref = course.company_slug ? `/academy/${course.company_slug}/courses/${course.slug}` : `/courses/${course.slug}`;
  const backHref = isGuest
    ? courseHref
    : course.company_slug
      ? `/academy/${course.company_slug}/classroom`
      : "/dashboard";
  const signInHref = `/sign-in?redirect_url=${encodeURIComponent(courseHref)}`;

  const isLessonLocked = (lessonId: string) => {
    const lesson = allLessons.find((l) => l.id === lessonId);
    if (isPreview) return !lesson?.is_preview;
    if (!isPartialEnrollment) return false;
    return modules.findIndex((m) => m.lessons.some((l) => l.id === lessonId)) !== 0;
  };
  const nextAllowed = nextLesson && !isLessonLocked(nextLesson.id) ? nextLesson : null;
  const prevAllowed = prevLesson && !isLessonLocked(prevLesson.id) ? prevLesson : null;

  const hasQuiz = Boolean(quiz && quiz.quiz_questions?.length > 0);
  const quizPassed = Boolean(initialQuizAttempt?.passed) || (hasQuiz && isDone);

  // Required speaking practice & teacher moments still to do (the server enforces the same rule).
  const pendingRequiredTutor = [
    ...blocks.flatMap((b) => {
      if (b.type !== "tutor_session") return [];
      const parsed = parseTutorSessionBlock(b.content);
      if (!parsed?.required || !tutorScenarios[parsed.scenarioId]) return [];
      return tutorDone.has(parsed.scenarioId) ? [] : [parsed.scenarioId];
    }),
    ...teacherMoments.flatMap((m) => {
      if (!m.required || !tutorScenarios[m.scenario_id]) return [];
      return tutorDone.has(m.scenario_id) ? [] : [m.scenario_id];
    }),
  ];

  const blockIdSet = new Set(blocks.map((b) => b.id));
  const momentsByAfterBlock = new Map<string, PlacedTeacherMoment[]>();
  const trailingMoments: PlacedTeacherMoment[] = [];
  for (const moment of teacherMoments) {
    if (moment.after_block_id && blockIdSet.has(moment.after_block_id)) {
      const list = momentsByAfterBlock.get(moment.after_block_id) ?? [];
      list.push(moment);
      momentsByAfterBlock.set(moment.after_block_id, list);
    } else {
      trailingMoments.push(moment);
    }
  }

  function handleOpenStudio(blockId?: string, initialTool?: string, context?: { brief?: string; instructions?: string[] }) {
    setStudioTargetBlockId(blockId || null);
    setStudioInitialTool(initialTool);
    setStudioContext(context || null);
    setStudioOpen(true);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function handleStudioOutput(toolId: string, inputs: any, output: string) {
    if (!studioTargetBlockId) return;
    const set = (id: string, value: string) => {
      const el = document.getElementById(id) as HTMLInputElement | HTMLTextAreaElement | null;
      if (el) el.value = value;
    };
    set(`studio-output-${studioTargetBlockId}`, output);
    set(`studio-tool-${studioTargetBlockId}`, toolId);
    set(`studio-inputs-${studioTargetBlockId}`, JSON.stringify(inputs));
    set(`text-response-${studioTargetBlockId}`, output);
    setStudioOpen(false);
    toast.success("Output copied to the exercise");
  }

  function handleMarkComplete() {
    if (isOpenGuestShowcase) {
      markGuestLessonDone(activeLessonId);
      if (nextAllowed) {
        toast.success("Lesson complete — on to the next one!");
        router.push(learnHref(nextAllowed.id));
      } else {
        toast.success("You finished the open showcase! Sign in anytime to claim your certificate.");
      }
      return;
    }
    startMark(async () => {
      try {
        await markLessonComplete(activeLessonId, course.slug);
        setCompleted((prev) => new Set([...prev, activeLessonId]));
        if (nextAllowed) {
          toast.success("Lesson complete — on to the next one");
          router.push(learnHref(nextAllowed.id));
        } else {
          toast.success("Lesson complete");
        }
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Couldn't mark the lesson complete.");
      }
    });
  }

  function handleGetCertificate() {
    startCertify(async () => {
      try {
        const cert = await generateCertificate(course.id);
        setCertificate(cert);
        toast.success("Certificate issued 🎉");
        router.push(`/certificates/${cert.public_id}`);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Could not issue certificate.");
      }
    });
  }

  // ── Primary action for the sticky bar / completion card ──
  type Primary =
    | { kind: "enroll" }
    | { kind: "certificate" }
    | { kind: "view-certificate" }
    | { kind: "next"; href: string }
    | { kind: "complete" }
    | { kind: "quiz" }
    | { kind: "done" };
  const primary: Primary = isPreview && !isOpenGuestShowcase
    ? { kind: "enroll" }
    : courseComplete && !certificate
      ? { kind: "certificate" }
      : courseComplete && certificate
        ? { kind: "view-certificate" }
        : isDone
          ? nextAllowed
            ? { kind: "next", href: learnHref(nextAllowed.id) }
            : isOpenGuestShowcase
              ? { kind: "enroll" }
              : { kind: "done" }
          : hasQuiz && !quizPassed
            ? { kind: "quiz" }
            : { kind: "complete" };

  function renderPrimary(compact = false) {
    const base = cn(
      "inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition-colors disabled:opacity-60",
      compact ? "h-11 px-4 text-sm" : "h-12 w-full px-5 text-[15px] sm:w-auto"
    );
    switch (primary.kind) {
      case "enroll":
        return (
          <Link href={isOpenGuestShowcase ? signInHref : courseHref} className={cn(base, "bg-brand text-white hover:bg-brand-hover")}>
            {isOpenGuestShowcase ? "Sign in to save & earn certificate" : "Enrol to continue"}
          </Link>
        );
      case "certificate":
        return (
          <button type="button" onClick={handleGetCertificate} disabled={certifying} className={cn(base, "bg-brand text-white hover:bg-brand-hover")}>
            {certifying ? <Loader2 className="h-4 w-4 animate-spin" /> : <Award className="h-4 w-4" />}
            Claim certificate
          </button>
        );
      case "view-certificate":
        return (
          <Link href={`/certificates/${certificate?.public_id}`} className={cn(base, "bg-white text-ink ring-1 ring-inset ring-slate-200 hover:bg-slate-50")}>
            <Award className="h-4 w-4" />
            View certificate
          </Link>
        );
      case "next":
        return (
          <Link href={primary.href} className={cn(base, "bg-ink text-white hover:bg-ink-hover")}>
            Next lesson
            <ChevronRight className="h-4 w-4" />
          </Link>
        );
      case "quiz":
        return (
          <a href="#knowledge-check" className={cn(base, "bg-ink text-white hover:bg-ink-hover")}>
            <HelpCircle className="h-4 w-4" />
            Take the quiz
          </a>
        );
      case "done":
        return (
          <span className={cn(base, "bg-emerald-50 text-emerald-700")}>
            <CheckCircle2 className="h-4 w-4" />
            Completed
          </span>
        );
      default:
        return (
          <button
            type="button"
            onClick={handleMarkComplete}
            disabled={marking || (!isOpenGuestShowcase && pendingRequiredTutor.length > 0)}
            className={cn(base, "bg-brand text-white hover:bg-brand-hover")}
          >
            {marking ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            {nextAllowed ? "Complete & continue" : "Mark complete"}
          </button>
        );
    }
  }

  const outline = (
    <nav aria-label="Course outline" className="space-y-5">
      {modules.map((mod, modIdx) => {
        const modDone = mod.lessons.filter((l) => completed.has(l.id)).length;
        return (
          <div key={mod.id}>
            <div className="mb-1.5 flex items-baseline justify-between gap-2 px-2">
              <p className="truncate text-[11px] font-semibold uppercase tracking-wider text-white/45">
                {modIdx + 1}. {mod.title}
              </p>
              {!isPreview && (
                <span className="shrink-0 text-[10px] tabular-nums text-white/35">
                  {modDone}/{mod.lessons.length}
                </span>
              )}
            </div>
            <ul className="space-y-0.5">
              {mod.lessons.map((lesson, i) => {
                const locked = isLessonLocked(lesson.id);
                const active = lesson.id === activeLessonId;
                const done = completed.has(lesson.id);
                const row = (
                  <>
                    <span
                      className={cn(
                        "mt-px flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold",
                        done
                          ? "bg-emerald-500 text-white"
                          : active
                            ? "bg-brand text-white"
                            : locked
                              ? "text-white/30"
                              : "border border-white/20 text-white/50"
                      )}
                    >
                      {done ? <Check className="h-3 w-3" /> : locked ? <Lock className="h-3 w-3" /> : i + 1}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="line-clamp-2 text-[13px] leading-snug">{lesson.title}</span>
                      {isPreview && lesson.is_preview && (
                        <span className="mt-0.5 inline-flex items-center gap-1 text-[10px] font-semibold text-brand-electric">
                          <Eye className="h-3 w-3" /> Free preview
                        </span>
                      )}
                    </span>
                  </>
                );
                const cls = cn(
                  "flex items-start gap-2.5 rounded-lg px-2 py-2 transition-colors",
                  active ? "bg-white/10 text-white" : locked ? "cursor-not-allowed text-white/30" : "text-white/70 hover:bg-white/5 hover:text-white"
                );
                return (
                  <li key={lesson.id}>
                    {locked ? (
                      <div className={cls} aria-disabled="true" title={isPreview ? "Enrol to unlock" : "Unlocks after payment is confirmed"}>
                        {row}
                      </div>
                    ) : (
                      <Link href={learnHref(lesson.id)} className={cls} aria-current={active ? "page" : undefined}>
                        {row}
                      </Link>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
    </nav>
  );

  const sidebarHeader = (
    <div className="space-y-4 border-b border-white/10 p-4">
      <Link
        href={backHref}
        className="inline-flex items-center gap-1.5 text-xs font-medium text-white/50 transition-colors hover:text-white"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        {course.company_name ? course.company_name : "Dashboard"}
      </Link>
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-wider text-brand-electric">{course.category || "Course"}</p>
        <h2 className="mt-0.5 line-clamp-2 text-base font-bold leading-snug text-white">{course.title}</h2>
      </div>
      {(!isPreview || isOpenGuestShowcase) && (
        <div>
          <div className="mb-1.5 flex items-center justify-between text-xs">
            <span className="text-white/50">
              {doneCount} of {totalLessons} lessons
            </span>
            <span className="font-semibold tabular-nums text-white">{progressPct}%</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full rounded-full bg-gradient-to-r from-brand to-brand-electric transition-all duration-700"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>
      )}
    </div>
  );

  return (
    <div className="app-surface fixed inset-0 z-50 flex h-[100dvh] w-screen overflow-hidden bg-[#f8fafc]">
      <Toaster position="top-center" />

      {/* ── Desktop sidebar ─────────────────────────────────────────── */}
      <aside
        className={cn(
          "hidden shrink-0 flex-col bg-ink transition-[width] duration-300 lg:flex",
          sidebarCollapsed ? "w-0 overflow-hidden" : "w-80"
        )}
      >
        {sidebarHeader}
        <div className="scrollbar-hide flex-1 overflow-y-auto p-3">{outline}</div>
      </aside>

      {/* ── Mobile drawer ───────────────────────────────────────────── */}
      {drawerOpen && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Course outline">
          <button
            type="button"
            aria-label="Close outline"
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setDrawerOpen(false)}
          />
          <div className="absolute inset-y-0 left-0 flex w-[85vw] max-w-sm flex-col bg-ink shadow-2xl animate-in slide-in-from-left duration-200">
            <button
              type="button"
              onClick={() => setDrawerOpen(false)}
              className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-lg text-white/60 hover:bg-white/10"
              aria-label="Close outline"
            >
              <X className="h-5 w-5" />
            </button>
            {sidebarHeader}
            <div className="scrollbar-hide flex-1 overflow-y-auto p-3 pb-8">{outline}</div>
          </div>
        </div>
      )}

      {/* ── Main ────────────────────────────────────────────────────── */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 shrink-0 items-center gap-2 border-b border-slate-200 bg-white px-2 sm:px-4">
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            className="flex h-10 w-10 items-center justify-center rounded-lg text-ink hover:bg-slate-100 lg:hidden"
            aria-label="Open course outline"
          >
            <Menu className="h-5 w-5" />
          </button>
          <button
            type="button"
            onClick={() => setSidebarCollapsed((v) => !v)}
            className="hidden h-10 w-10 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-ink lg:flex"
            aria-label={sidebarCollapsed ? "Show course outline" : "Hide course outline"}
          >
            {sidebarCollapsed ? <PanelLeftOpen className="h-5 w-5" /> : <PanelLeftClose className="h-5 w-5" />}
          </button>

          <div className="min-w-0 flex-1">
            <p className="truncate text-[11px] text-slate-500">
              {currentModule?.title ?? course.title}
            </p>
            <p className="truncate text-sm font-semibold text-ink">
              {currentIdx + 1}/{totalLessons} · {currentLesson?.title ?? "Lesson"}
            </p>
          </div>

          {isManager && (
            <span className="hidden shrink-0 rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-semibold text-amber-700 ring-1 ring-inset ring-amber-200 md:inline">
              {coursePublished ? "Instructor view" : "Draft preview"}
            </span>
          )}

          {(!isPreview || isOpenGuestShowcase) && (
            <button
              type="button"
              onClick={() => handleOpenStudio()}
              className="flex h-10 shrink-0 items-center gap-1.5 rounded-lg px-2.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 hover:text-ink"
              aria-label="Practice studio"
            >
              <Code2 className="h-4 w-4" />
              <span className="hidden md:inline">Practice</span>
            </button>
          )}
          <button
            type="button"
            onClick={() => setTutorOpen(true)}
            className="flex h-10 shrink-0 items-center gap-1.5 rounded-lg bg-ink px-3 text-xs font-semibold text-white hover:bg-ink-hover"
          >
            <Sparkles className="h-4 w-4 text-brand-electric" />
            <span className="hidden sm:inline">Ask {teacher.name}</span>
            <span className="sm:hidden">{teacher.name}</span>
          </button>
        </header>

        {/* Mobile progress hairline */}
        {!isPreview && (
          <div className="h-0.5 w-full bg-slate-100 lg:hidden">
            <div className="h-full bg-brand transition-all duration-700" style={{ width: `${progressPct}%` }} />
          </div>
        )}

        <div ref={scrollRef} className="scrollbar-hide flex-1 overflow-y-auto">
          <article className="mx-auto w-full max-w-3xl px-4 pb-32 pt-6 sm:px-6 sm:pt-10 lg:pb-16">
            {/* Access banners */}
            {isOpenGuestShowcase ? (
              <div className="mb-6 flex flex-col gap-3 rounded-2xl border border-emerald-200 bg-emerald-50/70 p-4 sm:flex-row sm:items-center">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-ink">
                    Free Open Showcase · No login required
                  </p>
                  <p className="text-xs text-slate-600 sm:text-sm">
                    Explore every lesson, interactive quiz, and live 3D/2D AI Teacher session freely. Sign in anytime to save progress &amp; earn a certificate.
                  </p>
                </div>
                <Link
                  href={signInHref}
                  className="inline-flex h-10 shrink-0 items-center justify-center rounded-xl bg-ink px-4 text-xs font-semibold text-white hover:bg-ink-hover"
                >
                  Sign in to save
                </Link>
              </div>
            ) : isPreview ? (
              <div className="mb-6 flex flex-col gap-3 rounded-2xl border border-brand/20 bg-brand-soft p-4 sm:flex-row sm:items-center">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-ink">You&apos;re watching a free preview</p>
                  <p className="text-sm text-slate-600">Enrol to unlock every lesson, quizzes and your certificate.</p>
                </div>
                <Link
                  href={courseHref}
                  className="inline-flex h-10 shrink-0 items-center justify-center rounded-xl bg-brand px-4 text-sm font-semibold text-white hover:bg-brand-hover"
                >
                  View course
                </Link>
              </div>
            ) : null}
            {isPartialEnrollment && (
              <div className="mb-6 flex flex-col gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 sm:flex-row sm:items-center">
                <Lock className="hidden h-5 w-5 shrink-0 text-amber-600 sm:block" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-amber-900">Payment pending</p>
                  <p className="text-sm text-amber-800">Module 1 is open now. The rest unlocks as soon as your payment is confirmed.</p>
                </div>
              </div>
            )}
            {isManager && !coursePublished && (
              <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-600">
                This course is a <span className="font-semibold text-ink">draft</span> — only you and your team can see it.
              </div>
            )}

            {/* Lesson heading */}
            <header className="mb-6 sm:mb-8">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-brand-text">
                Lesson {currentIdx + 1} of {totalLessons}
                {currentModule ? <span className="text-slate-400"> · {currentModule.title}</span> : null}
              </p>
              <h1 className="text-2xl font-bold leading-tight tracking-tight text-ink sm:text-[2rem]">
                {currentLesson?.title ?? "Lesson"}
              </h1>
              {isDone && (!isPreview || isOpenGuestShowcase) && (
                <p className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                  <CheckCircle2 className="h-3.5 w-3.5" /> Completed
                </p>
              )}
            </header>

            {/* Lesson / discussion tabs */}
            {!isPreview && (
              <div className="mb-6 flex gap-6 border-b border-slate-200" role="tablist">
                {(
                  [
                    { id: "lesson", label: "Lesson", icon: PencilLine, count: null },
                    { id: "discussion", label: "Discussion", icon: MessageCircle, count: discussions?.length ?? 0 },
                  ] as const
                ).map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    role="tab"
                    aria-selected={activeTab === tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={cn(
                      "-mb-px inline-flex items-center gap-1.5 border-b-2 pb-2.5 text-sm font-semibold transition-colors",
                      activeTab === tab.id ? "border-brand text-ink" : "border-transparent text-slate-500 hover:text-ink"
                    )}
                  >
                    {tab.label}
                    {tab.count !== null && (
                      <span className="rounded-md bg-slate-100 px-1.5 text-[11px] tabular-nums text-slate-500">{tab.count}</span>
                    )}
                  </button>
                ))}
              </div>
            )}

            {activeTab === "discussion" && !isPreview ? (
              <LessonDiscussions
                courseId={course.id}
                courseSlug={course.slug}
                lessonId={activeLessonId}
                discussions={discussions ?? []}
                userId={userId ?? null}
                isInstructor={isManager}
              />
            ) : (
              <>
                {blocks.length === 0 && !hasQuiz && (
                  <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-8 text-center text-sm text-slate-500">
                    This lesson doesn&apos;t have any content yet.
                  </div>
                )}

                <div className="space-y-8 sm:space-y-10">
                  {blocks.map((block) => {
                    const placedAfter = momentsByAfterBlock.get(block.id) ?? [];
                    const renderedMoments = placedAfter.map((moment) => (
                      <div key={`moment-${moment.id}`} className="pt-2">
                        <TutorSessionBlock
                          content={{
                            scenarioId: moment.scenario_id,
                            title: moment.title ?? undefined,
                            intro: moment.prompt ?? undefined,
                            required: moment.required,
                          }}
                          lessonId={activeLessonId}
                          scenario={tutorScenarios[moment.scenario_id]}
                          done={tutorDone.has(moment.scenario_id)}
                          isGuest={isGuest}
                          onComplete={(scenarioId: string) => {
                            setTutorDone((prev) => new Set([...prev, scenarioId]));
                            toast.success("AI Teacher check-in complete");
                          }}
                        />
                      </div>
                    ));

                    if (block.type === "quiz") {
                      if (!hasQuiz) return renderedMoments.length > 0 ? <div key={block.id}>{renderedMoments}</div> : null;
                      return (
                        <div key={block.id} data-lesson-block-id={block.id} className="space-y-8 sm:space-y-10">
                          <section id="knowledge-check" className="scroll-mt-6">
                            <QuizPlayer
                              quiz={quiz!}
                              questions={[...quiz!.quiz_questions].sort((a, b) => a.position - b.position)}
                              initialAttempt={initialQuizAttempt}
                              attemptsUsed={quizAttemptsUsed}
                              disabled={isPreview && !isOpenGuestShowcase}
                              guestMode={isOpenGuestShowcase}
                              lessonId={activeLessonId}
                              courseSlug={course.slug}
                              onPassed={() => {
                                if (isOpenGuestShowcase) {
                                  markGuestLessonDone(activeLessonId);
                                } else {
                                  setCompleted((prev) => new Set([...prev, activeLessonId]));
                                }
                                toast.success("Quiz passed — lesson complete");
                              }}
                            />
                          </section>
                          {renderedMoments}
                        </div>
                      );
                    }
                    return (
                      <div key={block.id} data-lesson-block-id={block.id} className="space-y-8 sm:space-y-10">
                        <BlockRenderer
                          block={block}
                          bookings={bookings}
                          practiceSubmissions={practiceSubmissions}
                          courseId={course.id}
                          lessonId={activeLessonId}
                          previewMode={isOpenGuestShowcase}
                          tutor={{
                            scenarios: tutorScenarios,
                            completedScenarioIds: [...tutorDone],
                            isGuest,
                            onComplete: (scenarioId: string) => {
                              setTutorDone((prev) => new Set([...prev, scenarioId]));
                              toast.success("AI Teacher check-in complete");
                            },
                          }}
                          onLaunchStudio={(initialTool) =>
                            handleOpenStudio(block.id, initialTool, {
                              brief: block.content.brief as string,
                              instructions: block.content.instructions as string[],
                            })
                          }
                        />
                        {renderedMoments}
                      </div>
                    );
                  })}

                  {trailingMoments.map((moment) => (
                    <div key={`moment-${moment.id}`}>
                      <TutorSessionBlock
                        content={{
                          scenarioId: moment.scenario_id,
                          title: moment.title ?? undefined,
                          intro: moment.prompt ?? undefined,
                          required: moment.required,
                        }}
                        lessonId={activeLessonId}
                        scenario={tutorScenarios[moment.scenario_id]}
                        done={tutorDone.has(moment.scenario_id)}
                        isGuest={isGuest}
                        onComplete={(scenarioId: string) => {
                          setTutorDone((prev) => new Set([...prev, scenarioId]));
                          toast.success("AI Teacher check-in complete");
                        }}
                      />
                    </div>
                  ))}

                  {/* Quiz without an explicit block */}
                  {!blocks.some((b) => b.type === "quiz") && hasQuiz && (
                    <section id="knowledge-check" className="scroll-mt-6">
                      <QuizPlayer
                        quiz={quiz!}
                        questions={[...quiz!.quiz_questions].sort((a, b) => a.position - b.position)}
                        initialAttempt={initialQuizAttempt}
                        attemptsUsed={quizAttemptsUsed}
                        disabled={isPreview && !isOpenGuestShowcase}
                        guestMode={isOpenGuestShowcase}
                        lessonId={activeLessonId}
                        courseSlug={course.slug}
                        onPassed={() => {
                          if (isOpenGuestShowcase) {
                            markGuestLessonDone(activeLessonId);
                          } else {
                            setCompleted((prev) => new Set([...prev, activeLessonId]));
                          }
                          toast.success("Quiz passed — lesson complete");
                        }}
                      />
                    </section>
                  )}
                </div>

                {/* Completion card */}
                <section
                  className={cn(
                    "mt-10 rounded-2xl p-5 sm:p-6",
                    courseComplete ? "bg-gradient-to-br from-ink to-[#0d4d5e] text-white" : "border border-slate-200 bg-white"
                  )}
                >
                  {courseComplete ? (
                    <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center">
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-brand">
                        <Trophy className="h-6 w-6 text-white" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-lg font-bold">You finished the course!</p>
                        <p className="text-sm text-white/70">
                          {certificate
                            ? "Your certificate is ready to share."
                            : vivaStatus?.required && !vivaStatus.passed
                              ? vivaStatus.reason ?? `Complete your oral Certificate Viva with ${teacher.name} to unlock your certificate.`
                              : "Claim your verified certificate to share your achievement."}
                        </p>
                      </div>
                      {(!vivaStatus?.required || vivaStatus.passed || certificate) && renderPrimary()}
                    </div>
                  ) : isPreview && !isOpenGuestShowcase ? (
                    <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center">
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-ink">Enjoying the preview?</p>
                        <p className="text-sm text-slate-500">Enrol to unlock all {totalLessons} lessons and earn a certificate.</p>
                      </div>
                      {renderPrimary()}
                    </div>
                  ) : (
                    <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center">
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-ink">
                          {isDone ? "Nice work — lesson complete" : hasQuiz && !quizPassed ? "Pass the quiz to finish" : "Finished this lesson?"}
                        </p>
                        <p className="text-sm text-slate-500">
                          {pendingRequiredTutor.length > 0
                            ? REQUIRED_TUTOR_HINT
                            : `${doneCount} of ${totalLessons} lessons complete · ${progressPct}%`}
                        </p>
                      </div>
                      {renderPrimary()}
                    </div>
                  )}
                </section>

                {courseComplete && !certificate && vivaStatus?.required && !vivaStatus.passed && vivaStatus.scenarioId && vivaStatus.scenario && (
                  <div className="mt-4">
                    <TutorSessionBlock
                      origin="practice"
                      content={{
                        scenarioId: vivaStatus.scenarioId,
                        title: `Certificate Viva with ${vivaStatus.scenario.persona?.displayName ?? vivaStatus.scenario.persona?.name ?? teacher.name}`,
                        intro: vivaStatus.reason ?? "Demonstrate what you learned in a short oral check to unlock your certificate.",
                        required: true,
                      }}
                      scenario={vivaStatus.scenario}
                      done={false}
                      onComplete={() => {
                        toast.success("Certificate Viva completed — checking certificate eligibility");
                        router.refresh();
                      }}
                    />
                  </div>
                )}

                {/* Prev / next */}
                <div className="mt-6 grid grid-cols-2 gap-3">
                  {prevAllowed ? (
                    <Link
                      href={learnHref(prevAllowed.id)}
                      className="group flex min-w-0 items-center gap-2 rounded-xl border border-slate-200 bg-white p-3 text-left hover:border-slate-300"
                    >
                      <ChevronLeft className="h-4 w-4 shrink-0 text-slate-400 group-hover:text-ink" />
                      <span className="min-w-0">
                        <span className="block text-[11px] text-slate-400">Previous</span>
                        <span className="block truncate text-sm font-medium text-ink">{prevAllowed.title}</span>
                      </span>
                    </Link>
                  ) : (
                    <span />
                  )}
                  {nextAllowed ? (
                    <Link
                      href={learnHref(nextAllowed.id)}
                      className="group flex min-w-0 items-center justify-end gap-2 rounded-xl border border-slate-200 bg-white p-3 text-right hover:border-slate-300"
                    >
                      <span className="min-w-0">
                        <span className="block text-[11px] text-slate-400">Next</span>
                        <span className="block truncate text-sm font-medium text-ink">{nextAllowed.title}</span>
                      </span>
                      <ChevronRight className="h-4 w-4 shrink-0 text-slate-400 group-hover:text-ink" />
                    </Link>
                  ) : (
                    <span />
                  )}
                </div>
              </>
            )}
          </article>
        </div>

        {/* ── Mobile sticky action bar ─────────────────────────────── */}
        <div className="pb-safe fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 px-3 pt-2 backdrop-blur lg:hidden">
          <div className="mx-auto flex max-w-md items-center gap-2">
            {prevAllowed ? (
              <Link
                href={learnHref(prevAllowed.id)}
                aria-label="Previous lesson"
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-slate-200 text-slate-600"
              >
                <ChevronLeft className="h-5 w-5" />
              </Link>
            ) : (
              <span className="h-11 w-11 shrink-0" />
            )}
            <div className="flex-1 [&>*]:w-full">
              {renderPrimary(true)}
            </div>
            {nextAllowed && primary.kind !== "next" ? (
              <Link
                href={learnHref(nextAllowed.id)}
                aria-label="Next lesson"
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-slate-200 text-slate-600"
              >
                <ChevronRight className="h-5 w-5" />
              </Link>
            ) : (
              <span className="h-11 w-11 shrink-0" />
            )}
          </div>
        </div>
      </div>

      {/* ── Overlays ────────────────────────────────────────────────── */}
      {tutorOpen && (
        <TeacherDock
          courseId={course.id}
          lessonId={activeLessonId}
          lessonTitle={currentLesson?.title ?? "Lesson"}
          courseTitle={course.title}
          moduleTitle={currentModule?.title}
          sectionTitle={currentModule?.title}
          teacher={teacher}
          onClose={() => setTutorOpen(false)}
        />
      )}
      {studioOpen && (
        <PracticeStudio
          lessonTitle={currentLesson?.title ?? "Lesson"}
          onClose={() => setStudioOpen(false)}
          initialTool={studioInitialTool}
          exerciseContext={studioContext}
          onSelectOutput={studioTargetBlockId ? handleStudioOutput : undefined}
        />
      )}
    </div>
  );
}

export { LessonPlayerClient as default };
