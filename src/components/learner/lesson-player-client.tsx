"use client";

import { useState, useTransition, useEffect } from "react";
import { useUser } from "@clerk/nextjs";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { buttonVariants } from "@/components/ui/button-variants";
import { QuizPlayer } from "@/components/learner/quiz-player";
import { AiTutor } from "@/components/learner/ai-tutor";
import { PracticeStudio } from "@/components/learner/practice-studio";
import { LessonDiscussions } from "@/components/learner/lesson-discussions";
import type { Discussion } from "@/types/database";
import { markLessonComplete, generateCertificate } from "@/actions/certificates";
import { submitPracticeExercise } from "@/actions/practice-exercises";
import { cn } from "@/lib/utils";
import { ZoomMeeting } from "@/components/shared/zoom-meeting";
import { BookingModal } from "./booking-modal";
import {
  ArrowLeft, ArrowRight, Award, BookOpen, CheckCircle, ChevronLeft, ChevronRight,
  ChevronsLeftRight, Code2, Download, ExternalLink, FileText, GraduationCap,
  HelpCircle, Layers, Lock, Loader2, Menu, MessageCircle, Info, Table, Calendar, Users, ChevronDown,
  PlayCircle, ShieldCheck, Sparkles, Trophy, Video, X, Zap, Wand2
} from "lucide-react";
import { toast } from "sonner";
import { BlockRenderer, type Lesson, type Module, type ContentBlock, type Quiz } from "@/components/course-blocks";




// ── Learning stage metadata ────────────────────────────────────────────────

function getLearningStage(idx: number, total: number) {
  if (idx <= 0) return {
    label: "Quick Start",
    color: "bg-[#fff6ee] text-[#fd5523]",
    icon: "⚡",
    focus: "Get a visible AI-assisted win before the lesson becomes theoretical.",
    deliverable: "One practical output you can reuse immediately.",
  };
  if (idx < Math.max(2, Math.floor(total * 0.45))) return {
    label: "Frameworks",
    color: "bg-blue-50 text-blue-700",
    icon: "🧱",
    focus: "Build repeatable prompts, tool decisions, and workflow logic.",
    deliverable: "A reusable operating pattern for your prompt library.",
  };
  if (idx < Math.max(3, Math.floor(total * 0.8))) return {
    label: "Workflow Build",
    color: "bg-indigo-50 text-indigo-700",
    icon: "🔧",
    focus: "Apply the ideas to a real process from your job.",
    deliverable: "A concrete AI-assisted workflow with review steps.",
  };
  return {
    label: "Audit & Ship",
    color: "bg-green-50 text-green-700",
    icon: "🚀",
    focus: "Stress-test the output for privacy, accuracy, and quality.",
    deliverable: "A safer version of your workflow ready for scale.",
  };
}

// ── Main component ─────────────────────────────────────────────────────────

type DiscussionWithProfile = Discussion & {
  profiles: { full_name: string | null; avatar_url: string | null } | null;
};

export function LessonPlayerClient({
  course,
  modules,
  activeLessonId,
  blocks,
  quiz,
  completedLessonIds,
  allDone,
  existingCertificate,
  discussions,
  practiceSubmissions = [],
  bookings,
  userId,
  isPreview = false,
  isPartialEnrollment = false,
}: {
  course: {
    id: string;
    title: string;
    slug: string;
    description: string | null;
    category: string | null;
    level: string | null;
    price_type?: string | null;
    instructor_id?: string | null;
  };
  modules: Module[];
  activeLessonId: string;
  blocks: ContentBlock[];
  quiz: Quiz;
  completedLessonIds: string[];
  allDone: boolean;
  existingCertificate: { id: string; public_id: string; issued_at: string } | null;
  discussions?: DiscussionWithProfile[];
  practiceSubmissions?: any[];
  bookings?: any[];
  userId?: string | null;
  isPreview?: boolean;
  isPartialEnrollment?: boolean;
}) {
  const router = useRouter();
  const [completed, setCompleted] = useState(new Set(completedLessonIds));
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [tutorOpen, setTutorOpen] = useState(false);
  const [studioOpen, setStudioOpen] = useState(false);
  const [studioInitialTool, setStudioInitialTool] = useState<string | undefined>();
  const [studioTargetBlockId, setStudioTargetBlockId] = useState<string | null>(null);
  const [studioContext, setStudioContext] = useState<{ brief?: string; instructions?: string[] } | null>(null);

  const [marking, startMark] = useTransition();
  const [certifying, startCertify] = useTransition();
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [activeTab, setActiveTab] = useState<"content" | "discussions">("content");

  function handleOpenStudio(blockId?: string, initialTool?: string, context?: { brief?: string; instructions?: string[] }) {
    setStudioTargetBlockId(blockId || null);
    setStudioInitialTool(initialTool);
    setStudioContext(context || null);
    setStudioOpen(true);
  }

  function handleStudioOutput(toolId: string, inputs: any, output: string) {
    if (studioTargetBlockId) {
      const inputEl = document.getElementById(`studio-output-${studioTargetBlockId}`) as HTMLInputElement;
      if (inputEl) inputEl.value = output;
      
      const toolEl = document.getElementById(`studio-tool-${studioTargetBlockId}`) as HTMLInputElement;
      if (toolEl) toolEl.value = toolId;

      const inputsEl = document.getElementById(`studio-inputs-${studioTargetBlockId}`) as HTMLInputElement;
      if (inputsEl) inputsEl.value = JSON.stringify(inputs);

      const textEl = document.getElementById(`text-response-${studioTargetBlockId}`) as HTMLTextAreaElement;
      if (textEl) textEl.value = output;
      
      setStudioOpen(false);
      toast.success("Output copied to exercise!");
    }
  }

  const allLessons = modules.flatMap((m) => m.lessons);
  const currentIdx = allLessons.findIndex((l) => l.id === activeLessonId);
  const currentLesson = allLessons[currentIdx];
  const prevLesson = currentIdx > 0 ? allLessons[currentIdx - 1] : null;
  const nextLesson = currentIdx < allLessons.length - 1 ? allLessons[currentIdx + 1] : null;
  const totalLessons = allLessons.length;
  const doneCount = allLessons.filter((l) => completed.has(l.id)).length;
  const progressPct = totalLessons > 0 ? Math.round((doneCount / totalLessons) * 100) : 0;
  const isDone = completed.has(activeLessonId);
  const stage = getLearningStage(currentIdx, totalLessons);

  const isLessonLocked = (lessonId: string) => {
    if (!isPartialEnrollment) return false;
    return modules.findIndex((m) => m.lessons.some((l) => l.id === lessonId)) !== 0;
  };
  const nextLessonAllowed =
    nextLesson && !isLessonLocked(nextLesson.id) ? nextLesson : null;

  function handleMarkComplete() {
    startMark(async () => {
      try {
        await markLessonComplete(activeLessonId, course.slug);
        setCompleted((prev) => new Set([...prev, activeLessonId]));
        toast.success("Lesson marked as complete.");
        if (nextLessonAllowed) router.push(`/courses/${course.slug}/learn?lesson=${nextLessonAllowed.id}`);
      } catch {
        toast.error("Failed to mark lesson complete.");
      }
    });
  }

  function handleGetCertificate() {
    startCertify(async () => {
      try {
        const cert = await generateCertificate(course.id);
        toast.success("Certificate issued.");
        router.push(`/certificates/${cert.public_id}`);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Could not issue certificate.");
      }
    });
  }

  return (
    <div className="fixed inset-0 flex h-screen w-screen overflow-hidden bg-[#f8fafc] z-50">
      
      {/* ── Sidebar ──────────────────────────────────────────────────────── */}
      <aside
        className={cn(
          "fixed px-4 inset-y-0 left-0 z-40 flex flex-col bg-[#062e39] transition-all duration-500 ease-in-out lg:relative lg:translate-x-0",
          isSidebarCollapsed ? "lg:w-20" : "w-80",
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {/* Sidebar Header */}
        <div className={cn("p-6 border-b border-white/5", isSidebarCollapsed && "flex justify-center")}>
          {!isSidebarCollapsed ? (
            <div className="space-y-4">
              <Link href="/dashboard" className="inline-flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] text-white/40 hover:text-[#fd5523] transition-colors group">
                <ArrowLeft className="h-3 w-3 group-hover:-translate-x-1 transition-transform" />
                Back to Dashboard
              </Link>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-[#fd5523] mb-1">
                  {course.category || "AI Learning"}
                </p>
                <h2 className="text-lg font-bold text-white leading-tight line-clamp-2">
                  {course.title}
                </h2>
              </div>
            </div>
          ) : (
            <Link href="/dashboard" className="h-10 w-10 flex items-center justify-center rounded-xl bg-white/5 text-[#fd5523] hover:bg-white/10 transition-colors">
              <ArrowLeft className="h-5 w-5" />
            </Link>
          )}
        </div>

        {/* Progress Section */}
        {!isSidebarCollapsed && !isPreview && (
          <div className="p-6 bg-black/20">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/30">Course Progress</span>
              <span className="text-[10px] font-bold text-white bg-[#fd5523] px-2 py-0.5 rounded-full">{progressPct}%</span>
            </div>
            <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
              <div 
                className="h-full bg-gradient-to-r from-[#fd5523] to-[#fd8d69] transition-all duration-1000 ease-out" 
                style={{ width: `${progressPct}%` }}
              />
            </div>
          </div>
        )}

        {/* Navigation List */}
        <div className="flex-1 overflow-y-auto px-4 py-6 scrollbar-hide">
          {modules.map((mod, modIdx) => (
            <div key={mod.id} className="mb-8">
              {!isSidebarCollapsed && (
                <div className="flex items-center gap-2 px-2 mb-3">
                  <span className="h-px flex-1 bg-white/5" />
                  <p className="text-[9px] font-bold uppercase tracking-[0.3em] text-white/30 whitespace-nowrap">
                    {mod.title}
                  </p>
                  <span className="h-px flex-1 bg-white/5" />
                </div>
              )}
              <div className="space-y-1">
                {mod.lessons.map((lesson) => {
                  const locked = isPartialEnrollment && modIdx !== 0;
                  const active = lesson.id === activeLessonId;
                  const done = completed.has(lesson.id);
                  
                  if (isSidebarCollapsed) {
                    return (
                      <Link 
                        key={lesson.id} 
                        href={`/courses/${course.slug}/learn?lesson=${lesson.id}`}
                        className={cn(
                          "h-12 w-12 mx-auto flex items-center justify-center rounded-xl transition-all",
                          active ? "bg-[#fd5523] text-white shadow-lg shadow-[#fd5523]/20" : 
                          done ? "text-green-400 hover:bg-white/5" : "text-white/20 hover:bg-white/5"
                        )}
                      >
                        {locked ? <Lock className="h-4 w-4 text-white/10" /> : 
                         done ? <CheckCircle className="h-5 w-5" /> : 
                         active ? <PlayCircle className="h-5 w-5" /> : 
                         <div className="h-2 w-2 rounded-full border border-white/20" />}
                      </Link>
                    );
                  }

                  return (
                    <Link
                      key={lesson.id}
                      href={`/courses/${course.slug}/learn?lesson=${lesson.id}`}
                      className={cn(
                        "group flex items-start gap-4 p-4 rounded-2xl transition-all relative overflow-hidden",
                        active ? "bg-white/5 text-white ring-1 ring-white/10" : "text-white/40 hover:bg-white/5 hover:text-white/70",
                        locked && "opacity-30 cursor-not-allowed"
                      )}
                    >
                      {active && <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-[#fd5523] rounded-r-full" />}
                      <div className="mt-1 shrink-0">
                        {locked ? <Lock className="h-4 w-4" /> : 
                         done ? <CheckCircle className="h-4 w-4 text-green-400" /> : 
                         active ? <PlayCircle className="h-4 w-4 text-[#fd5523]" /> : 
                         <div className="h-4 w-4 rounded-full border-2 border-white/10 group-hover:border-white/30 transition-colors" />}
                      </div>
                      <div className="min-w-0">
                        <p className={cn("text-sm font-medium leading-snug line-clamp-2", active && "text-white")}>
                          {lesson.title}
                        </p>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Sidebar Footer */}
        <div className="p-4 border-t border-white/5">
          <Button 
            onClick={() => setTutorOpen(true)}
            className={cn(
              "w-full rounded-2xl bg-white/5 border border-white/10 text-white/70 hover:bg-white/10 hover:text-white transition-all",
              isSidebarCollapsed ? "h-12 w-12 p-0 mx-auto" : "py-6"
            )}
          >
            <Sparkles className={cn("h-4 w-4 text-[#fd5523]", !isSidebarCollapsed && "mr-3")} />
            {!isSidebarCollapsed && "AI Tutor"}
          </Button>
        </div>
      </aside>

      {/* ── Main Content Area ────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0 relative">
        
        {/* Header */}
        <header className="h-12 shrink-0 flex items-center justify-between gap-2 border-b border-slate-200 bg-white px-3 md:px-4 z-30">
          {/* Left: toggle + lesson info */}
          <div className="flex items-center gap-2 min-w-0">
            {/* Sidebar toggle buttons */}
            <button
              onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
              className="hidden lg:flex h-7 w-7 items-center justify-center rounded-md text-slate-400 hover:bg-slate-100 hover:text-[#062e39] transition-colors"
              title="Toggle sidebar"
            >
              <Menu className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden h-7 w-7 flex items-center justify-center rounded-md bg-slate-50 text-[#062e39]"
            >
              <Menu className="h-3.5 w-3.5" />
            </button>

            <div className="hidden sm:block h-4 w-px bg-slate-200 mx-1" />

            {/* Breadcrumb & Title */}
            <div className="min-w-0 flex flex-col justify-center">
              {(() => {
                const currentModule = modules.find((m) =>
                  m.lessons.some((l) => l.id === activeLessonId)
                );
                return (
                  <>
                    <div className="flex items-center gap-1 text-[9px] md:text-[10px] font-bold uppercase tracking-wider text-slate-400 truncate">
                      <span className="hidden sm:inline opacity-70">Course /</span>
                      <span className="truncate max-w-[80px] md:max-w-[120px] text-slate-500">
                        {currentModule?.title ?? "Module"}
                      </span>
                      <span>/</span>
                      <span className="text-[#fd5523]">
                        {currentIdx + 1}/{totalLessons}
                      </span>
                    </div>
                    {/* Compact title */}
                    <span className="hidden sm:block text-[11px] md:text-xs font-bold text-[#062e39] truncate max-w-[150px] sm:max-w-[250px] md:max-w-sm lg:max-w-lg leading-tight">
                      {currentLesson?.title ?? "Lesson"}
                    </span>
                  </>
                );
              })()}
            </div>
          </div>

          {/* Right: Actions */}
          <div className="flex items-center gap-1.5 md:gap-2 mr-2">
            {/* Practice Studio */}
            <button
              onClick={() => setStudioOpen(true)}
              className="flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[9px] md:text-[10px] font-bold uppercase tracking-widest text-[#062e39] hover:border-[#fd5523] hover:text-[#fd5523] transition-all shadow-sm active:scale-95"
            >
              <Code2 className="h-3 w-3" />
              <span className="hidden sm:inline">Practice Studio</span>
              <span className="sm:hidden">Studio</span>
            </button>

            {/* AI Coach */}
            <button
              onClick={() => setTutorOpen(true)}
              className="flex items-center gap-1.5 rounded-full bg-[#062e39] px-2.5 py-1 text-[9px] md:text-[10px] font-bold uppercase tracking-widest text-white hover:bg-[#0a4055] transition-all shadow-md active:scale-95 mr-2 md:mr-0"
            >
              <Sparkles className="h-3 w-3 text-[#fd8d69]" />
              <span className="hidden sm:inline">AI Coach</span>
              <span className="sm:hidden">AI</span>
            </button>
          </div>
        </header>

        {/* Content Scroller */}
        <div className="flex-1 overflow-y-auto bg-[#f8fafc] scrollbar-hide">
          <div className="max-w-5xl mx-auto px-8 py-12">
            
            {/* Tab Switcher */}
            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-2xl w-fit mb-10 mx-auto">
              <button 
                onClick={() => setActiveTab("content")}
                className={cn(
                  "px-6 py-2.5 rounded-xl text-xs font-bold transition-all",
                  activeTab === "content" ? "bg-white text-[#fd5523] shadow-sm" : "text-slate-400 hover:text-slate-600"
                )}
              >
                Lesson Content
              </button>
              <button 
                onClick={() => setActiveTab("discussions")}
                className={cn(
                  "px-6 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2",
                  activeTab === "discussions" ? "bg-white text-[#fd5523] shadow-sm" : "text-slate-400 hover:text-slate-600"
                )}
              >
                Discussions
                <span className="bg-slate-200 text-slate-500 text-[10px] px-1.5 py-0.5 rounded-md">
                  {discussions?.length || 0}
                </span>
              </button>
            </div>
            
            {/* Banner Alerts */}
            {(isPreview || isPartialEnrollment) && course.price_type !== "free" && (
              <div className={cn(
                "mb-12 p-6 rounded-[2rem] border-2 flex items-center justify-between gap-6 shadow-sm animate-in fade-in slide-in-from-top-4 duration-500",
                isPreview ? "bg-[#fff6ee] border-[#fd5523]/20" : "bg-amber-50 border-amber-200"
              )}>
                <div className="flex items-center gap-4">
                  <div className={cn("h-12 w-12 rounded-2xl flex items-center justify-center", isPreview ? "bg-[#fd5523]/10" : "bg-amber-500/10")}>
                    {isPreview ? <Zap className="h-6 w-6 text-[#fd5523]" /> : <Lock className="h-6 w-6 text-amber-500" />}
                  </div>
                  <div>
                    <h3 className={cn("font-bold text-lg", isPreview ? "text-[#062e39]" : "text-amber-900")}>
                      {isPreview ? "Premium Access Required" : "Payment Pending"}
                    </h3>
                    <p className={cn("text-sm opacity-70", isPreview ? "text-[#062e39]" : "text-amber-800")}>
                      {isPreview ? "This is a premium lesson. Unlock the full course to continue." : "Confirm payment to unlock all modules instantly."}
                    </p>
                  </div>
                </div>
                <Link 
                  href={`/courses/${course.slug}`}
                  className={cn("px-6 py-3 rounded-xl text-sm font-bold transition-all hover:scale-105 active:scale-95", 
                    isPreview ? "bg-[#fd5523] text-white" : "bg-amber-500 text-white")}
                >
                  {isPreview ? "Upgrade Now" : "Unlock Course"}
                </Link>
              </div>
            )}

            {activeTab === "content" ? (
              <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-12 items-start">
                {/* Main Content */}
                <div className="space-y-12">
                  {/* Lesson Header / Goal */}
                  <section className="bg-white rounded-[2.5rem] p-10 shadow-xl shadow-slate-200/50 border border-slate-100 relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-8 opacity-[0.03] group-hover:opacity-[0.06] transition-opacity group-hover:scale-110 duration-1000">
                      <GraduationCap className="h-40 w-40 text-[#062e39]" />
                    </div>
                    <div className="relative z-10">
                      <div className="flex items-center gap-3 mb-6">
                        <div className={cn("h-10 w-10 rounded-xl flex items-center justify-center", stage.color)}>
                          <Sparkles className="h-5 w-5" />
                        </div>
                        <span className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400">Current Objective</span>
                      </div>
                      <h2 className="text-3xl font-extrabold text-[#062e39] tracking-tight mb-4">
                        {stage.deliverable}
                      </h2>
                      <p className="text-lg text-slate-500 leading-relaxed max-w-2xl">
                        {stage.focus}
                      </p>
                    </div>
                    <div className="mt-8 pt-6 border-t border-slate-100 flex flex-wrap items-center gap-4">
                      {(() => {
                        const currentModule = modules.find((m) =>
                          m.lessons.some((l) => l.id === activeLessonId)
                        );
                        return (
                          <>
                            <div className="flex items-center gap-2 rounded-full bg-slate-50 px-3 py-1.5">
                              <BookOpen className="h-3.5 w-3.5 text-slate-400" />
                              <span className="text-xs font-semibold text-slate-600">
                                Lesson {currentIdx + 1} of {totalLessons}
                              </span>
                            </div>
                            {currentModule && (
                              <div className="flex items-center gap-2 rounded-full bg-slate-50 px-3 py-1.5">
                                <Layers className="h-3.5 w-3.5 text-slate-400" />
                                <span className="text-xs font-semibold text-slate-600 truncate max-w-[180px]">
                                  {currentModule.title}
                                </span>
                              </div>
                            )}
                            {!isPreview && (
                              <div className="flex items-center gap-2 rounded-full bg-slate-50 px-3 py-1.5">
                                <CheckCircle className="h-3.5 w-3.5 text-slate-400" />
                                <span className="text-xs font-semibold text-slate-600">
                                  {doneCount} completed
                                </span>
                              </div>
                            )}
                          </>
                        );
                      })()}
                    </div>
                  </section>

                  {/* Blocks Container */}
                  <div className="space-y-12">
                    {blocks.map((block) => (
                      <div key={block.id} className="animate-in fade-in slide-in-from-bottom-4 duration-700">
                        <BlockRenderer
                          block={block}
                          bookings={bookings}
                          practiceSubmissions={practiceSubmissions}
                          courseId={course.id}
                          lessonId={activeLessonId}
                          onLaunchStudio={(initialTool) => handleOpenStudio(
                            block.id, 
                            initialTool, 
                            { 
                              brief: block.content.brief as string, 
                              instructions: block.content.instructions as string[] 
                            }
                          )}
                        />
                        {block.type === "quiz" && quiz && (
                          <div className="bg-white rounded-[2.5rem] p-6 md:p-10 shadow-xl border border-slate-100 mt-8">
                            <div className="flex items-center gap-4 mb-8">
                              <div className="h-12 w-12 rounded-2xl bg-indigo-50 flex items-center justify-center">
                                <HelpCircle className="h-6 w-6 text-indigo-600" />
                              </div>
                              <div>
                                <h3 className="text-2xl font-bold text-[#062e39]">Knowledge Check</h3>
                                <p className="text-sm text-slate-500">Test your understanding of these concepts.</p>
                              </div>
                            </div>
                            <QuizPlayer
                              quiz={quiz}
                              questions={[...quiz.quiz_questions].sort((a, b) => a.position - b.position)}
                            />
                          </div>
                        )}
                      </div>
                    ))}
                  </div>

                  {/* Completion Actions */}
                  <section className="bg-[#062e39] rounded-[3rem] p-12 text-center relative overflow-hidden group">
                    <div className="absolute inset-0 mesh-orange opacity-10" />
                    
                    <div className="relative z-10 max-w-xl mx-auto">
                      {allDone && !existingCertificate && !isPreview ? (
                        <div className="space-y-6">
                          <div className="h-20 w-20 mx-auto bg-[#fd5523]/20 rounded-[2rem] flex items-center justify-center animate-bounce">
                            <Trophy className="h-10 w-10 text-[#fd5523]" />
                          </div>
                          <h3 className="text-3xl font-bold text-white">Legendary Work!</h3>
                          <p className="text-white/60">You have mastered the entire course. Claim your verified certificate now.</p>
                          <Button 
                            onClick={handleGetCertificate}
                            disabled={certifying}
                            className="w-full py-8 rounded-[2rem] bg-[#fd5523] text-white text-lg font-bold hover:bg-[#ef4a16] shadow-2xl shadow-[#fd5523]/30"
                          >
                            {certifying ? <Loader2 className="mr-2 h-6 w-6 animate-spin" /> : <Award className="mr-3 h-6 w-6" />}
                            Claim My Certificate
                          </Button>
                        </div>
                      ) : existingCertificate && !isPreview ? (
                        <div className="space-y-6">
                          <div className="h-20 w-20 mx-auto bg-green-500/20 rounded-[2rem] flex items-center justify-center">
                            <Award className="h-10 w-10 text-green-400" />
                          </div>
                          <h3 className="text-3xl font-bold text-white">Course Certified</h3>
                          <p className="text-white/60">You have successfully completed this course.</p>
                          <Link 
                            href={`/certificates/${existingCertificate.public_id}`}
                            className={cn(
                              buttonVariants({ variant: "default" }),
                              "w-full py-8 rounded-[2rem] bg-white text-[#062e39] text-lg font-bold hover:bg-slate-100 flex items-center justify-center"
                            )}
                          >
                            View Certificate
                          </Link>
                        </div>
                      ) : isDone ? (
                        <div className="space-y-6">
                          <div className="h-20 w-20 mx-auto bg-white/10 rounded-[2rem] flex items-center justify-center">
                            <CheckCircle className="h-10 w-10 text-white/40" />
                          </div>
                          <h3 className="text-2xl font-bold text-white">Lesson Complete</h3>
                          <p className="text-white/40 mb-8">Ready to take on the next challenge?</p>
                          {nextLessonAllowed && (
                            <Link 
                              href={`/courses/${course.slug}/learn?lesson=${nextLessonAllowed.id}`}
                              className={cn(
                                buttonVariants({ variant: "default" }),
                                "w-full py-8 rounded-[2rem] bg-[#fd5523] text-white text-lg font-bold hover:bg-[#ef4a16] flex items-center justify-center"
                              )}
                            >
                              Jump to Next Lesson
                              <ChevronRight className="ml-3 h-6 w-6" />
                            </Link>
                          )}
                        </div>
                      ) : (
                        <div className="space-y-6">
                          <h3 className="text-3xl font-bold text-white">Mastered this?</h3>
                          <p className="text-white/60">Mark this lesson as complete to progress towards your certificate.</p>
                          <Button 
                            onClick={handleMarkComplete}
                            disabled={marking}
                            className="w-full py-8 rounded-[2rem] bg-[#fd5523] text-white text-lg font-bold hover:bg-[#ef4a16] shadow-2xl shadow-[#fd5523]/30 group"
                          >
                            {marking ? <Loader2 className="mr-2 h-6 w-6 animate-spin" /> : <CheckCircle className="mr-3 h-6 w-6" />}
                            Complete {nextLesson ? "& Continue" : "Lesson"}
                            <ArrowRight className="ml-2 h-6 w-6 group-hover:translate-x-1 transition-transform" />
                          </Button>
                        </div>
                      )}
                    </div>
                  </section>

                  {/* Footer Nav */}
                  <div className="flex items-center justify-between pt-12 border-t border-slate-200">
                    {prevLesson ? (
                      <Link 
                        href={`/courses/${course.slug}/learn?lesson=${prevLesson.id}`}
                        className="flex items-center gap-3 text-slate-400 hover:text-[#062e39] font-bold group"
                      >
                        <div className="h-12 w-12 rounded-2xl bg-white shadow-sm border border-slate-100 flex items-center justify-center group-hover:scale-110 transition-transform">
                          <ChevronLeft className="h-5 w-5" />
                        </div>
                        <div className="hidden sm:block">
                          <p className="text-[10px] uppercase tracking-widest opacity-50">Previous</p>
                          <p className="text-sm truncate max-w-[200px]">{prevLesson.title}</p>
                        </div>
                      </Link>
                    ) : <div />}

                    {nextLessonAllowed ? (
                      <Link 
                        href={`/courses/${course.slug}/learn?lesson=${nextLessonAllowed.id}`}
                        className="flex items-center gap-3 text-slate-400 hover:text-[#062e39] font-bold text-right group"
                      >
                        <div className="hidden sm:block">
                          <p className="text-[10px] uppercase tracking-widest opacity-50">Up Next</p>
                          <p className="text-sm truncate max-w-[200px]">{nextLessonAllowed.title}</p>
                        </div>
                        <div className="h-12 w-12 rounded-2xl bg-white shadow-sm border border-slate-100 flex items-center justify-center group-hover:scale-110 transition-transform">
                          <ChevronRight className="h-5 w-5" />
                        </div>
                      </Link>
                    ) : <div />}
                  </div>
                </div>

                {/* Sidebar Info */}
                <aside className="space-y-8 sticky top-36">
                  {/* Stages info */}
                  <div className="bg-white rounded-[2.5rem] p-8 shadow-xl shadow-slate-200/50 border border-slate-100">
                     <h4 className="text-[10px] font-bold uppercase tracking-[0.25em] text-slate-400 mb-6">Learning Path</h4>
                     <div className="space-y-8">
                        {["Quick Start", "Frameworks", "Workflow Build", "Audit & Ship"].map((s, i) => {
                          const isActive = stage.label === s;
                          const isDone = i < ["Quick Start", "Frameworks", "Workflow Build", "Audit & Ship"].indexOf(stage.label);
                          return (
                            <div key={s} className={cn("flex gap-4 relative", i !== 3 && "pb-8")}>
                              {i !== 3 && <div className={cn("absolute left-4 top-10 w-0.5 h-[calc(100%-1.5rem)]", isDone ? "bg-[#fd5523]" : "bg-slate-100")} />}
                              <div className={cn("h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 z-10", 
                                isActive ? "bg-[#fd5523] text-white ring-4 ring-[#fd5523]/10" : 
                                isDone ? "bg-green-500 text-white" : "bg-slate-100 text-slate-400"
                              )}>
                                {isDone ? <CheckCircle className="h-4 w-4" /> : i + 1}
                              </div>
                              <div className={cn("min-w-0 pt-1", !isActive && !isDone && "opacity-50")}>
                                <p className={cn("text-xs font-bold uppercase tracking-widest mb-1", isActive ? "text-[#fd5523]" : "text-slate-900")}>
                                  {s}
                                </p>
                                {isActive && <p className="text-[11px] text-slate-500 leading-snug">{stage.focus}</p>}
                              </div>
                            </div>
                          )
                        })}
                     </div>
                  </div>

                  {/* Safety Card */}
                  <div className="bg-white rounded-[2.5rem] p-8 shadow-xl border border-slate-100">
                     <div className="flex items-center gap-3 mb-6">
                        <div className="h-10 w-10 rounded-xl bg-orange-50 flex items-center justify-center">
                          <ShieldCheck className="h-5 w-5 text-[#fd5523]" />
                        </div>
                        <h4 className="text-sm font-bold text-[#062e39]">Safety Checklist</h4>
                     </div>
                     <div className="space-y-4">
                        {[
                          "Sanitise client data",
                          "Verify AI references",
                          "Human-in-the-loop review"
                        ].map(item => (
                          <div key={item} className="flex items-start gap-3">
                             <div className="mt-1.5 h-1.5 w-1.5 rounded-full bg-[#fd5523]/30 shrink-0" />
                             <p className="text-xs text-slate-600 leading-relaxed font-medium">{item}</p>
                          </div>
                        ))}
                     </div>
                  </div>

                  {/* Mini Discussions */}
                  {!isPreview && (
                     <div className="bg-white rounded-[2.5rem] p-8 shadow-xl border border-slate-100">
                        <div className="flex items-center justify-between mb-6">
                          <h4 className="text-sm font-bold text-[#062e39]">Discussions</h4>
                          <span className="bg-slate-100 text-slate-500 text-[10px] font-bold px-2 py-0.5 rounded-full">
                            {discussions?.length || 0}
                          </span>
                        </div>
                        <LessonDiscussions
                          courseId={course.id}
                          courseSlug={course.slug}
                          lessonId={activeLessonId}
                          discussions={discussions ?? []}
                          userId={userId ?? null}
                          isInstructor={course.instructor_id === userId}
                          mini
                        />
                     </div>
                  )}
                </aside>
              </div>
            ) : (
              <div className="max-w-3xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">
                <LessonDiscussions
                  courseId={course.id}
                  courseSlug={course.slug}
                  lessonId={activeLessonId}
                  discussions={discussions ?? []}
                  userId={userId ?? null}
                  isInstructor={course.instructor_id === userId}
                />
              </div>
            )}

      {/* ── Overlays ───────────────────────────────────────────────────────── */}
      {tutorOpen && (() => {
          const currentModule = modules.find((m) =>
            m.lessons.some((l) => l.id === activeLessonId)
          );
          const sectionTitle = currentModule?.title;
          
          return (
            <AiTutor
              courseId={course.id}
              lessonId={activeLessonId}
              lessonTitle={currentLesson?.title ?? "Lesson"}
              courseTitle={course.title}
              moduleTitle={currentModule?.title}
              sectionTitle={sectionTitle}
              onClose={() => setTutorOpen(false)}
            />
          );
        })()}

      {studioOpen && (
        <PracticeStudio
          lessonTitle={currentLesson?.title ?? "Lesson"}
          onClose={() => setStudioOpen(false)}
          initialTool={studioInitialTool}
          exerciseContext={studioContext}
          onSelectOutput={studioTargetBlockId ? handleStudioOutput : undefined}
        />
      )}

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/60 backdrop-blur-sm lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}
    </div>
  </div>
</div>
</div>
);
}

export { LessonPlayerClient as default };
