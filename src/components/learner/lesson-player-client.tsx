"use client";

import { useState, useTransition, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { QuizPlayer } from "@/components/learner/quiz-player";
import { AiTutor } from "@/components/learner/ai-tutor";
import { PracticeStudio } from "@/components/learner/practice-studio";
import { LessonDiscussions } from "@/components/learner/lesson-discussions";
import type { Discussion } from "@/types/database";
import { markLessonComplete, generateCertificate } from "@/actions/certificates";
import { cn } from "@/lib/utils";
import {
  ArrowLeft, ArrowRight, Award, BookOpen, CheckCircle, ChevronLeft, ChevronRight,
  ChevronsLeftRight, Code2, Download, ExternalLink, FileText, GraduationCap,
  HelpCircle, Layers, Lock, Loader2, Menu, MessageCircle,
  PlayCircle, ShieldCheck, Sparkles, Trophy, Video, X, Zap
} from "lucide-react";
import { toast } from "sonner";

type Lesson = { id: string; title: string; position: number; is_preview: boolean };
type Module = { id: string; title: string; position: number; lessons: Lesson[] };
type ContentBlock = { id: string; type: string; position: number; content: Record<string, unknown> };

type QuizQuestion = {
  id: string;
  question: string;
  options: string[];
  correct_indices: number[];
  explanation: string | null;
  position: number;
};

type Quiz = {
  id: string;
  title: string | null;
  pass_threshold: number;
  max_attempts: number;
  quiz_questions: QuizQuestion[];
} | null;

// ── Content block renderers ────────────────────────────────────────────────

function VideoBlock({ content }: { content: Record<string, unknown> }) {
  const youtubeId = content.youtube_id as string;
  const title = content.title as string | undefined;
  if (!youtubeId) return (
    <div className="flex aspect-video items-center justify-center rounded-3xl bg-slate-100 border-2 border-dashed border-slate-200">
      <div className="text-center">
        <Video className="mx-auto mb-3 h-12 w-12 text-slate-300" />
        <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">No video configured</p>
      </div>
    </div>
  );
  return (
    <div className="space-y-4">
      {title && <h3 className="text-xl font-bold text-[#062e39] tracking-tight">{title}</h3>}
      <div className="group relative aspect-video overflow-hidden rounded-[2.5rem] bg-black shadow-2xl shadow-black/20 ring-1 ring-white/10">
        <iframe
          src={`https://www.youtube.com/embed/${youtubeId}?rel=0&modestbranding=1&autoplay=0`}
          title={title ?? "Video"}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          className="absolute inset-0 h-full w-full"
        />
      </div>
    </div>
  );
}

function TextBlock({ content }: { content: Record<string, unknown> }) {
  const html = content.html as string;
  if (!html) return null;
  return (
    <div
      className="prose prose-slate max-w-none 
        prose-headings:font-bold prose-headings:text-[#062e39] prose-headings:tracking-tight
        prose-p:text-slate-600 prose-p:leading-relaxed prose-p:text-lg
        prose-a:text-[#fd5523] prose-a:font-bold prose-a:no-underline hover:prose-a:underline 
        prose-strong:text-[#062e39] 
        prose-code:bg-[#fff6ee] prose-code:text-[#fd5523] prose-code:rounded-lg prose-code:px-2 prose-code:py-0.5 prose-code:text-[0.85em] prose-code:before:content-none prose-code:after:content-none
        prose-pre:bg-[#062e39] prose-pre:rounded-2xl prose-pre:shadow-xl
        prose-blockquote:border-l-[#fd5523] prose-blockquote:bg-[#fff6ee]/50 prose-blockquote:rounded-r-2xl prose-blockquote:py-1 prose-blockquote:px-6
        prose-li:text-slate-600 prose-li:marker:text-[#fd5523]"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

function ImageBlock({ content }: { content: Record<string, unknown> }) {
  const url = content.url as string;
  const caption = content.caption as string | undefined;
  const alt = (content.alt as string) || caption || "Course image";
  const full = content.display === "full";
  if (!url) return null;
  return (
    <figure className={`space-y-4 ${full ? "" : "mx-auto max-w-3xl"}`}>
      <div className="overflow-hidden rounded-[2.5rem] shadow-xl border border-slate-100 ring-4 ring-slate-50/50">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={url} alt={alt} className="w-full object-contain" />
      </div>
      {caption && <figcaption className="text-center text-sm font-medium text-slate-400 italic">{caption}</figcaption>}
    </figure>
  );
}

const CALLOUT_STYLES: Record<string, { container: string; emoji: string; iconColor: string }> = {
  tip:       { container: "bg-[#fff6ee] border-[#fd5523]/20 text-[#062e39]",   emoji: "⚡", iconColor: "text-[#fd5523]" },
  warning:   { container: "bg-amber-50 border-amber-200 text-amber-900",       emoji: "⚠️", iconColor: "text-amber-600" },
  important: { container: "bg-indigo-50 border-indigo-100 text-indigo-900",    emoji: "💡", iconColor: "text-indigo-600" },
  danger:    { container: "bg-red-50 border-red-100 text-red-900",             emoji: "🚫", iconColor: "text-red-600" },
};

function CalloutBlock({ content }: { content: Record<string, unknown> }) {
  const variant = (content.variant as string) || "tip";
  const title = content.title as string | undefined;
  const body = content.body as string | undefined;
  const s = CALLOUT_STYLES[variant] ?? CALLOUT_STYLES.tip;
  if (!title && !body) return null;
  return (
    <div className={cn("rounded-[2rem] border-2 p-6 sm:p-8 flex gap-5", s.container)}>
      <span className="text-2xl shrink-0">{s.emoji}</span>
      <div>
        {title && <p className="font-bold text-lg tracking-tight mb-1">{title}</p>}
        {body && <p className="text-base leading-relaxed opacity-80">{body}</p>}
      </div>
    </div>
  );
}

function ToolSpotlightBlock({ content }: { content: Record<string, unknown> }) {
  const name = content.name as string;
  const description = content.description as string | undefined;
  const url = content.url as string | undefined;
  const iconUrl = content.icon_url as string | undefined;
  if (!name) return null;
  const inner = (
    <div className="flex items-start gap-5 rounded-[2rem] border-2 border-slate-100 bg-white p-6 transition-all hover:border-[#fd5523]/30 hover:shadow-xl hover:shadow-[#fd5523]/5 group">
      {iconUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={iconUrl} alt={name} className="h-14 w-14 rounded-2xl object-contain shadow-sm border border-slate-50" />
      ) : (
        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-[#fff6ee] text-lg font-bold text-[#fd5523]">
          {name[0]?.toUpperCase()}
        </div>
      )}
      <div className="flex-1 min-w-0 pt-1">
        <div className="flex items-center gap-2">
          <p className="font-bold text-[#062e39] text-lg">{name}</p>
          {url && <ExternalLink className="h-4 w-4 text-[#fd5523] opacity-0 group-hover:opacity-100 transition-opacity" />}
        </div>
        {description && <p className="mt-2 text-sm leading-relaxed text-slate-500">{description}</p>}
      </div>
    </div>
  );
  return url ? <a href={url} target="_blank" rel="noreferrer" className="block">{inner}</a> : inner;
}

function BeforeAfterBlock({ content }: { content: Record<string, unknown> }) {
  const beforeUrl = content.before_url as string;
  const afterUrl = content.after_url as string;
  const caption = content.caption as string | undefined;
  const [pos, setPos] = useState(50);
  if (!beforeUrl || !afterUrl) return null;
  return (
    <figure className="space-y-4">
      <div className="relative select-none overflow-hidden rounded-[2.5rem] bg-slate-100 shadow-xl border border-slate-100 ring-4 ring-slate-50/50">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={beforeUrl} alt="Before" className="block w-full" draggable={false} />
        <div className="pointer-events-none absolute inset-0" style={{ clipPath: `inset(0 ${100 - pos}% 0 0)` }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={afterUrl} alt="After" className="block h-full w-full object-cover" draggable={false} />
        </div>
        <div className="pointer-events-none absolute inset-y-0" style={{ left: `${pos}%`, transform: "translateX(-50%)" }}>
          <div className="h-full w-1 bg-white shadow-2xl" />
          <div className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 flex h-10 w-10 items-center justify-center rounded-full bg-white shadow-2xl border border-slate-100">
            <ChevronsLeftRight className="h-5 w-5 text-[#062e39]" />
          </div>
        </div>
        <div className="absolute left-6 top-6 flex items-center gap-2 rounded-full bg-black/40 backdrop-blur-md px-4 py-1.5 text-[10px] font-bold uppercase tracking-[0.2em] text-white ring-1 ring-white/20">
          <span className="h-1.5 w-1.5 rounded-full bg-white" />
          Before
        </div>
        <div className="absolute right-6 top-6 flex items-center gap-2 rounded-full bg-[#fd5523]/80 backdrop-blur-md px-4 py-1.5 text-[10px] font-bold uppercase tracking-[0.2em] text-white ring-1 ring-white/20">
          <span className="h-1.5 w-1.5 rounded-full bg-white animate-pulse" />
          After
        </div>
        <input type="range" min={0} max={100} value={pos} onChange={(e) => setPos(Number(e.target.value))} className="absolute inset-0 h-full w-full cursor-ew-resize opacity-0 z-10" />
      </div>
      {caption && <figcaption className="text-center text-sm font-medium text-slate-400 italic">{caption}</figcaption>}
    </figure>
  );
}

function ResourceBlock({ content }: { content: Record<string, unknown> }) {
  const fileUrl = content.file_url as string;
  const fileName = (content.file_name as string) || "Resource";
  const fileSize = content.file_size as number | undefined;
  const description = content.description as string | undefined;
  const formatBytes = (b: number) => b < 1024 * 1024 ? `${(b / 1024).toFixed(1)} KB` : `${(b / (1024 * 1024)).toFixed(1)} MB`;
  if (!fileUrl) return null;
  return (
    <div className="flex items-center gap-5 rounded-[2rem] border-2 border-slate-100 bg-white p-6 hover:shadow-lg transition-all group">
      <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-[#fff6ee] group-hover:scale-110 transition-transform">
        <FileText className="h-6 w-6 text-[#fd5523]" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-bold text-[#062e39] text-lg truncate mb-1">{fileName}</p>
        <p className="text-sm text-slate-500">
          {fileSize ? formatBytes(fileSize) : "Document"}
          {description ? ` · ${description}` : ""}
        </p>
      </div>
      <a href={fileUrl} target="_blank" rel="noreferrer"
        className="flex shrink-0 items-center gap-2 rounded-2xl bg-[#062e39] px-6 py-3 text-sm font-bold text-white transition-all hover:bg-[#0a4055] hover:scale-105 active:scale-95 shadow-lg shadow-[#062e39]/10">
        <Download className="h-4 w-4" />
        Download
      </a>
    </div>
  );
}

function AiPromptBlock({ content }: { content: Record<string, unknown> }) {
  const prompt = content.prompt as string;
  const tool = content.tool as string | undefined;
  const label = content.label as string | undefined;
  const [copied, setCopied] = useState(false);
  if (!prompt) return null;

  function handleCopy() {
    navigator.clipboard.writeText(prompt);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="rounded-[2rem] border-2 border-[#fd5523]/20 bg-[#fff8f5] overflow-hidden">
      <div className="flex items-center justify-between px-6 py-4 bg-[#fd5523]/10 border-b border-[#fd5523]/15">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#fd5523] shadow-md shadow-[#fd5523]/20">
            <Sparkles className="h-4 w-4 text-white" />
          </div>
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-[#fd5523]">{label ?? "AI Prompt"}</p>
            {tool && <p className="text-xs font-bold text-slate-500">{tool}</p>}
          </div>
        </div>
        <button
          onClick={handleCopy}
          className="flex items-center gap-2 rounded-xl bg-[#fd5523] px-4 py-2 text-xs font-bold text-white transition-all hover:bg-[#ef4a16] active:scale-95 shadow-md shadow-[#fd5523]/20"
        >
          {copied ? <CheckCircle className="h-3.5 w-3.5" /> : <Code2 className="h-3.5 w-3.5" />}
          {copied ? "Copied!" : "Copy Prompt"}
        </button>
      </div>
      <pre className="whitespace-pre-wrap p-6 text-sm leading-relaxed text-[#062e39] font-mono">{prompt}</pre>
    </div>
  );
}

function StepsBlock({ content }: { content: Record<string, unknown> }) {
  const title = content.title as string | undefined;
  const steps = (content.steps as { title: string; body: string }[]) ?? [];
  if (!steps.length) return null;
  return (
    <div className="space-y-4">
      {title && <h3 className="text-xl font-bold text-[#062e39] tracking-tight">{title}</h3>}
      <div className="space-y-3">
        {steps.map((step, i) => (
          <div key={i} className="flex gap-5 rounded-[1.5rem] border border-slate-100 bg-white p-5 shadow-sm">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[#062e39] text-sm font-black text-white shadow-lg">
              {i + 1}
            </div>
            <div className="flex-1 min-w-0 pt-0.5">
              {step.title && <p className="font-bold text-[#062e39] mb-1">{step.title}</p>}
              {step.body && <p className="text-sm leading-relaxed text-slate-600">{step.body}</p>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ChecklistBlock({ content }: { content: Record<string, unknown> }) {
  const title = content.title as string | undefined;
  const items = (content.items as string[]) ?? [];
  const [checked, setChecked] = useState<Set<number>>(new Set());
  if (!items.length) return null;

  function toggle(i: number) {
    setChecked(prev => {
      const next = new Set(prev);
      next.has(i) ? next.delete(i) : next.add(i);
      return next;
    });
  }

  return (
    <div className="rounded-[2rem] border-2 border-emerald-100 bg-emerald-50/40 p-6">
      {title && <h3 className="text-lg font-bold text-[#062e39] mb-4 tracking-tight">{title}</h3>}
      <div className="space-y-3">
        {items.map((item, i) => (
          <label key={i} className="flex cursor-pointer items-start gap-4 group">
            <div
              onClick={() => toggle(i)}
              className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border-2 transition-all ${
                checked.has(i)
                  ? "border-emerald-500 bg-emerald-500"
                  : "border-slate-300 bg-white group-hover:border-emerald-400"
              }`}
            >
              {checked.has(i) && <CheckCircle className="h-4 w-4 text-white" />}
            </div>
            <span className={`text-sm leading-relaxed transition-colors ${checked.has(i) ? "line-through text-slate-400" : "text-[#062e39] font-medium"}`}>
              {item}
            </span>
          </label>
        ))}
      </div>
      {items.length > 0 && (
        <p className="mt-4 text-xs font-bold text-slate-400 uppercase tracking-widest">
          {checked.size}/{items.length} completed
        </p>
      )}
    </div>
  );
}

function KeyTakeawayBlock({ content }: { content: Record<string, unknown> }) {
  const title = content.title as string | undefined;
  const points = (content.points as string[]) ?? [];
  if (!points.length) return null;
  return (
    <div className="rounded-[2rem] bg-[#062e39] p-8 shadow-2xl shadow-[#062e39]/20">
      <div className="flex items-center gap-3 mb-6">
        <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#fd5523] shadow-lg shadow-[#fd5523]/30">
          <Zap className="h-5 w-5 text-white" />
        </div>
        <h3 className="text-xl font-bold text-white tracking-tight">{title ?? "Key Takeaways"}</h3>
      </div>
      <ul className="space-y-4">
        {points.map((point, i) => (
          <li key={i} className="flex items-start gap-4">
            <CheckCircle className="mt-0.5 h-5 w-5 shrink-0 text-[#fd5523]" />
            <span className="text-white/80 text-sm leading-relaxed">{point}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

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
  };
  modules: Module[];
  activeLessonId: string;
  blocks: ContentBlock[];
  quiz: Quiz;
  completedLessonIds: string[];
  allDone: boolean;
  existingCertificate: { id: string; public_id: string; issued_at: string } | null;
  discussions?: DiscussionWithProfile[];
  userId?: string | null;
  isPreview?: boolean;
  isPartialEnrollment?: boolean;
}) {
  const router = useRouter();
  const [completed, setCompleted] = useState(new Set(completedLessonIds));
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [tutorOpen, setTutorOpen] = useState(false);
  const [studioOpen, setStudioOpen] = useState(false);
  const [marking, startMark] = useTransition();
  const [certifying, startCertify] = useTransition();
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

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
    <div className="-mx-4 py-6 -my-8 sm:-mx-6 lg:-mx-8 flex h-screen overflow-hidden bg-[#f8fafc]">
      
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
        <header className="h-14 shrink-0 flex items-center justify-between gap-4 border-b border-slate-200 bg-white px-4 z-30">
          {/* Left: toggle + lesson info */}
          <div className="flex items-center gap-3 min-w-0">
            {/* Desktop sidebar toggle */}
            <button
              onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
              className="hidden lg:flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-[#062e39] transition-colors"
              title="Toggle sidebar"
            >
              <Menu className="h-4 w-4" />
            </button>
            {/* Mobile sidebar open */}
            <button
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden h-8 w-8 shrink-0 flex items-center justify-center rounded-lg bg-slate-100 text-[#062e39]"
            >
              <Menu className="h-4 w-4" />
            </button>

            {/* Divider */}
            <div className="hidden sm:block h-5 w-px bg-slate-200 shrink-0" />

            {/* Lesson breadcrumb */}
            <div className="min-w-0">
              {(() => {
                const currentModule = modules.find((m) =>
                  m.lessons.some((l) => l.id === activeLessonId)
                );
                return (
                  <div className="flex items-center gap-1.5 text-xs text-slate-400 mb-0.5 truncate">
                    <span className="hidden sm:inline truncate max-w-[120px]">{course.title}</span>
                    <span className="hidden sm:inline">/</span>
                    <span className="truncate max-w-[140px] font-medium text-slate-500">
                      {currentModule?.title ?? ""}
                    </span>
                    <span>/</span>
                    <span className="font-semibold text-[#062e39]">
                      {currentIdx + 1} of {totalLessons}
                    </span>
                    {(isPreview || isPartialEnrollment) && (
                      <span className={cn(
                        "ml-1 rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider",
                        isPreview ? "bg-[#fff6ee] text-[#fd5523]" : "bg-amber-100 text-amber-700"
                      )}>
                        {isPreview ? "Preview" : "Pending Payment"}
                      </span>
                    )}
                  </div>
                );
              })()}
              <h1 className="text-sm font-bold text-[#062e39] truncate max-w-[320px] sm:max-w-lg lg:max-w-2xl leading-tight">
                {currentLesson?.title ?? "Lesson"}
              </h1>
            </div>
          </div>

          {/* Right: progress + actions */}
          <div className="flex items-center gap-2 shrink-0">
            {/* Progress pill (desktop) */}
            {!isPreview && (
              <div className="hidden md:flex items-center gap-2">
                <div className="h-1.5 w-20 rounded-full bg-slate-100 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-[#fd5523] transition-all duration-700"
                    style={{ width: `${progressPct}%` }}
                  />
                </div>
                <span className="text-xs font-bold tabular-nums text-slate-400">{progressPct}%</span>
              </div>
            )}

            {/* Studio button */}
            <button
              onClick={() => setStudioOpen(true)}
              className="hidden sm:flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-600 hover:border-[#fd5523] hover:text-[#fd5523] transition-all"
            >
              <Code2 className="h-3.5 w-3.5" />
              <span className="hidden lg:inline">Practice Studio</span>
              <span className="lg:hidden">Studio</span>
            </button>

            {/* AI Coach button */}
            <button
              onClick={() => setTutorOpen(true)}
              className="flex items-center gap-1.5 rounded-lg bg-[#062e39] px-3 py-1.5 text-xs font-bold text-white hover:bg-[#0a4055] transition-colors"
            >
              <Sparkles className="h-3.5 w-3.5 text-[#fd8d69]" />
              <span>AI Coach</span>
            </button>
          </div>
        </header>

        {/* Content Scroller */}
        <div className="flex-1 overflow-y-auto bg-[#f8fafc] scrollbar-hide">
          <div className="max-w-5xl mx-auto px-8 py-12">
            
            {/* Banner Alerts */}
            {(isPreview || isPartialEnrollment) && (
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
                      {isPreview ? "Free Preview Mode" : "Payment Pending"}
                    </h3>
                    <p className={cn("text-sm opacity-70", isPreview ? "text-[#062e39]" : "text-amber-800")}>
                      {isPreview ? "You are viewing a preview lesson. Enroll for full access." : "Confirm payment to unlock all modules instantly."}
                    </p>
                  </div>
                </div>
                <Link 
                  href={`/courses/${course.slug}`}
                  className={cn("px-6 py-3 rounded-xl text-sm font-bold transition-all hover:scale-105 active:scale-95", 
                    isPreview ? "bg-[#fd5523] text-white" : "bg-amber-500 text-white")}
                >
                  {isPreview ? "Enroll Now" : "Unlock Course"}
                </Link>
              </div>
            )}

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
                      {block.type === "video" && <VideoBlock content={block.content} />}
                      {block.type === "text" && <TextBlock content={block.content} />}
                      {block.type === "image" && <ImageBlock content={block.content} />}
                      {block.type === "callout" && <CalloutBlock content={block.content} />}
                      {block.type === "tool_spotlight" && <ToolSpotlightBlock content={block.content} />}
                      {block.type === "before_after" && <BeforeAfterBlock content={block.content} />}
                      {block.type === "resource" && <ResourceBlock content={block.content} />}
                      {block.type === "ai_prompt" && <AiPromptBlock content={block.content} />}
                      {block.type === "steps" && <StepsBlock content={block.content} />}
                      {block.type === "checklist" && <ChecklistBlock content={block.content} />}
                      {block.type === "key_takeaway" && <KeyTakeawayBlock content={block.content} />}
                      {block.type === "quiz" && quiz && (
                        <div className="bg-white rounded-[2.5rem] p-10 shadow-xl border border-slate-100">
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
                        <p className="text-white/60">You've mastered the entire course. Claim your verified certificate now.</p>
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
                        <Button 
                          render={<Link href={`/certificates/${existingCertificate.public_id}`} />}
                          className="w-full py-8 rounded-[2rem] bg-white text-[#062e39] text-lg font-bold hover:bg-slate-100"
                        >
                          View Certificate
                        </Button>
                      </div>
                    ) : isDone ? (
                      <div className="space-y-6">
                        <div className="h-20 w-20 mx-auto bg-white/10 rounded-[2rem] flex items-center justify-center">
                          <CheckCircle className="h-10 w-10 text-white/40" />
                        </div>
                        <h3 className="text-2xl font-bold text-white">Lesson Complete</h3>
                        <p className="text-white/40 mb-8">Ready to take on the next challenge?</p>
                        {nextLessonAllowed && (
                          <Button 
                            render={<Link href={`/courses/${course.slug}/learn?lesson=${nextLessonAllowed.id}`} />}
                            className="w-full py-8 rounded-[2rem] bg-[#fd5523] text-white text-lg font-bold hover:bg-[#ef4a16]"
                          >
                            Jump to Next Lesson
                            <ChevronRight className="ml-3 h-6 w-6" />
                          </Button>
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
                        lessonId={activeLessonId}
                        discussions={discussions ?? []}
                        userId={userId ?? null}
                        mini
                      />
                   </div>
                )}
              </aside>
            </div>
          </div>
        </div>
      </div>

      {/* ── Overlays ───────────────────────────────────────────────────────── */}
      {tutorOpen && (
        <AiTutor
          courseId={course.id}
          lessonId={activeLessonId}
          lessonTitle={currentLesson?.title ?? "Lesson"}
          courseTitle={course.title}
          onClose={() => setTutorOpen(false)}
        />
      )}

      {studioOpen && (
        <PracticeStudio
          lessonTitle={currentLesson?.title ?? "Lesson"}
          onClose={() => setStudioOpen(false)}
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
  );
}

export { LessonPlayerClient as default };
