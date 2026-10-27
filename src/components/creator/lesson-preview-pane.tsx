"use client";

import { useMemo, useState } from "react";
import {
  Smartphone,
  Tablet,
  Monitor,
  PlayCircle,
  HelpCircle,
  Lock,
  Wifi,
  Battery,
  Maximize2,
  Minimize2,
  RotateCcw,
  Sparkles,
  CheckCircle2,
} from "lucide-react";
import { BlockRenderer, type Quiz } from "@/components/course-blocks";
import { QuizPlayer } from "@/components/learner/quiz-player";
import { cn } from "@/lib/utils";
import type { ContentBlockType, Json } from "@/types/database";

type Block = {
  id: string;
  type: ContentBlockType;
  position: number;
  content: Json;
};

type PreviewViewport = "mobile" | "tablet" | "desktop";

const VIEWPORTS: { id: PreviewViewport; label: string; icon: React.ElementType; widthDesc: string }[] = [
  { id: "mobile", label: "Phone", icon: Smartphone, widthDesc: "390px" },
  { id: "tablet", label: "Tablet", icon: Tablet, widthDesc: "768px" },
  { id: "desktop", label: "Desktop", icon: Monitor, widthDesc: "100%" },
];

export function LessonPreviewPane({
  title,
  moduleTitle,
  blocks,
  quiz,
  isLiveSync = true,
}: {
  title: string;
  moduleTitle: string;
  blocks: Block[];
  quiz?: Quiz | null;
  isLiveSync?: boolean;
}) {
  const [viewport, setViewport] = useState<PreviewViewport>("mobile");
  const [isExpanded, setIsExpanded] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const previewBlocks = useMemo(
    () =>
      blocks.map((block) => ({
        id: block.id,
        type: block.type,
        position: block.position,
        content: block.content as Record<string, unknown>,
      })),
    [blocks]
  );

  const hasQuizBlock = useMemo(() => blocks.some((b) => b.type === "quiz"), [blocks]);

  const renderedContent = (
    <div key={refreshKey} className="space-y-6">
      {/* Lesson Header Banner */}
      <section className="overflow-hidden rounded-2xl sm:rounded-[2rem] border border-slate-100 bg-white shadow-sm">
        <div className="border-b border-slate-100 bg-gradient-to-r from-[#062e39] via-[#083b49] to-[#0c4a5c] px-4 py-5 sm:px-6 sm:py-6 text-white">
          <div className="flex items-center justify-between gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 backdrop-blur-sm px-3 py-1 text-[10px] font-black uppercase tracking-[0.2em] text-[#fd8d69]">
              <Sparkles className="h-3 w-3" />
              Learner Experience
            </span>
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/20 px-2.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-emerald-300">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Live Sync
            </span>
          </div>

          <h3 className="mt-3 text-lg sm:text-2xl font-black text-white tracking-tight leading-snug">
            {title || "Untitled Lesson"}
          </h3>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.15em] text-white/80">
              <PlayCircle className="h-3 w-3 text-[#fd8d69]" />
              {moduleTitle || "General Module"}
            </span>
            <span className="inline-flex rounded-full bg-white/10 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.15em] text-white/70">
              {blocks.length} block{blocks.length === 1 ? "" : "s"}
            </span>
          </div>
        </div>

        {/* Content Blocks List */}
        <div className="space-y-6 bg-[#f8fafc] p-3 sm:p-6">
          {previewBlocks.length > 0 ? (
            previewBlocks.map((block) => (
              <div key={block.id} className="transition-all">
                <BlockRenderer block={block} previewMode />
                {block.type === "quiz" && quiz && (
                  <div className="mt-6 rounded-[2rem] border border-slate-100 bg-white p-6 shadow-sm">
                    <div className="mb-6 flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600">
                        <HelpCircle className="h-5 w-5" />
                      </div>
                      <div>
                        <h4 className="font-bold text-[#062e39]">Knowledge Check</h4>
                        <p className="text-xs text-slate-500">Preview of the learner quiz experience.</p>
                      </div>
                    </div>
                    <QuizPlayer
                      quiz={quiz}
                      questions={[...quiz.quiz_questions].sort((a, b) => a.position - b.position)}
                    />
                  </div>
                )}
              </div>
            ))
          ) : (
            <div className="rounded-2xl sm:rounded-[2rem] border border-dashed border-slate-200 bg-white p-8 text-center">
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-[#fff6ee] text-[#fd5523]">
                <Sparkles className="h-6 w-6" />
              </div>
              <h4 className="text-sm font-bold text-[#062e39]">Preview Canvas Ready</h4>
              <p className="mt-1 text-xs text-slate-500">
                Add content blocks or use AI Co-Author to see how learners will interact with this lesson.
              </p>
            </div>
          )}

          {/* If there is a quiz attached to the lesson but no quiz block was explicitly placed, show knowledge check at end */}
          {!hasQuizBlock && quiz && quiz.quiz_questions?.length > 0 && (
            <div className="mt-6 rounded-[2rem] border border-slate-100 bg-white p-6 shadow-sm">
              <div className="mb-6 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600">
                  <HelpCircle className="h-5 w-5" />
                </div>
                <div>
                  <h4 className="font-bold text-[#062e39]">Knowledge Check</h4>
                  <p className="text-xs text-slate-500">End-of-lesson knowledge verification.</p>
                </div>
              </div>
              <QuizPlayer
                quiz={quiz}
                questions={[...quiz.quiz_questions].sort((a, b) => a.position - b.position)}
              />
            </div>
          )}
        </div>
      </section>
    </div>
  );

  return (
    <section
      className={cn(
        "overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-xl transition-all duration-300 sm:rounded-[2.5rem]",
        isExpanded && "fixed inset-4 z-50 overflow-y-auto bg-slate-900/40 backdrop-blur-md p-4 sm:p-8 flex flex-col justify-center items-center"
      )}
    >
      <div className={cn("w-full bg-white rounded-2xl sm:rounded-[2.5rem] overflow-hidden border border-slate-200/60 shadow-2xl flex flex-col", isExpanded && "max-w-6xl max-h-[92vh]")}>
        {/* Top Control Bar */}
        <div className="border-b border-slate-100 bg-[#fffaf6] px-4 py-3 sm:px-6 sm:py-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#fff0e6] text-[#fd5523]">
                <Smartphone className="h-4 w-4" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <p className="text-[10px] font-black uppercase tracking-[0.25em] text-[#fd5523]">
                    Device Preview
                  </p>
                  <span className="hidden sm:inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[9px] font-bold text-emerald-600">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    Instant Sync
                  </span>
                </div>
                <h2 className="text-sm sm:text-base font-bold text-[#062e39]">Learner Surface</h2>
              </div>
            </div>

            {/* Viewport switch & actions */}
            <div className="flex items-center gap-2">
              <div className="flex rounded-full border border-slate-200 bg-white p-1 shadow-xs">
                {VIEWPORTS.map(({ id, label, icon: Icon }) => (
                  <button
                    key={id}
                    onClick={() => setViewport(id)}
                    className={cn(
                      "flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-[0.16em] transition-all",
                      viewport === id
                        ? "bg-[#062e39] text-white shadow-sm"
                        : "text-slate-400 hover:text-[#062e39]"
                    )}
                    title={`Switch to ${label} view`}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    <span className="hidden md:inline">{label}</span>
                  </button>
                ))}
              </div>

              <button
                onClick={() => setRefreshKey((k) => k + 1)}
                className="flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 hover:text-[#062e39] transition-colors"
                title="Reset preview scroll"
              >
                <RotateCcw className="h-3.5 w-3.5" />
              </button>

              <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 hover:text-[#062e39] transition-colors"
                title={isExpanded ? "Collapse preview" : "Expand preview modal"}
              >
                {isExpanded ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
              </button>
            </div>
          </div>
        </div>

        {/* Device Stage Canvas */}
        <div className="flex-1 bg-gradient-to-b from-slate-100 via-slate-100/80 to-slate-200 p-3 sm:p-6 overflow-y-auto">
          {/* PHONE SHELL */}
          {viewport === "mobile" && (
            <div className="mx-auto w-full max-w-[390px] transition-all duration-300">
              <div className="relative rounded-[50px] border-[10px] border-slate-900 bg-slate-950 p-2 shadow-2xl ring-1 ring-slate-800">
                {/* Side volume / lock buttons decorative accents */}
                <div className="absolute -left-[13px] top-24 h-12 w-[3px] rounded-l-md bg-slate-800" />
                <div className="absolute -left-[13px] top-40 h-12 w-[3px] rounded-l-md bg-slate-800" />
                <div className="absolute -right-[13px] top-28 h-16 w-[3px] rounded-r-md bg-slate-800" />

                {/* Top Status Bar & Dynamic Island */}
                <div className="relative z-10 px-5 pt-2 pb-1 text-white">
                  <div className="flex items-center justify-between text-[11px] font-semibold tracking-tight text-white/90">
                    <span>9:41</span>
                    {/* Dynamic Island Pill */}
                    <div className="h-6 w-24 rounded-full bg-black px-2 flex items-center justify-between shadow-inner">
                      <div className="h-2 w-2 rounded-full bg-slate-900 ring-1 ring-slate-800" />
                      <div className="h-2.5 w-2.5 rounded-full bg-[#0a101f] ring-1 ring-blue-950/80 flex items-center justify-center">
                        <div className="h-1 w-1 rounded-full bg-blue-500/50" />
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 text-white/90">
                      <Wifi className="h-3 w-3" />
                      <Battery className="h-3.5 w-3.5" />
                    </div>
                  </div>
                </div>

                {/* Inner Screen Content Viewport */}
                <div className="mt-1 max-h-[660px] overflow-y-auto rounded-[36px] bg-slate-50 p-2 sm:p-3 scrollbar-thin scrollbar-thumb-slate-300">
                  {renderedContent}
                </div>

                {/* Bottom Home Indicator Bar */}
                <div className="flex justify-center py-2">
                  <div className="h-1 w-28 rounded-full bg-slate-700/80" />
                </div>
              </div>
            </div>
          )}

          {/* TABLET SHELL */}
          {viewport === "tablet" && (
            <div className="mx-auto w-full max-w-[720px] transition-all duration-300">
              <div className="relative rounded-[36px] border-[12px] border-slate-900 bg-slate-950 p-3 shadow-2xl ring-1 ring-slate-800">
                {/* Tablet Top Camera */}
                <div className="flex justify-center pb-2">
                  <div className="h-2 w-2 rounded-full bg-slate-800 ring-1 ring-slate-700" />
                </div>

                {/* Tablet Screen Content Viewport */}
                <div className="max-h-[720px] overflow-y-auto rounded-[24px] bg-slate-50 p-4 sm:p-6 scrollbar-thin scrollbar-thumb-slate-300">
                  {renderedContent}
                </div>

                {/* Bottom Home Bar */}
                <div className="flex justify-center pt-2.5">
                  <div className="h-1 w-36 rounded-full bg-slate-700/80" />
                </div>
              </div>
            </div>
          )}

          {/* DESKTOP BROWSER SHELL */}
          {viewport === "desktop" && (
            <div className="mx-auto w-full max-w-5xl transition-all duration-300">
              <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl ring-1 ring-slate-100">
                {/* Browser Window Header */}
                <div className="flex items-center justify-between border-b border-slate-200 bg-slate-100 px-4 py-3">
                  <div className="flex items-center gap-2">
                    <span className="h-3 w-3 rounded-full bg-[#ff5f56] border border-black/10 inline-block" />
                    <span className="h-3 w-3 rounded-full bg-[#ffbd2e] border border-black/10 inline-block" />
                    <span className="h-3 w-3 rounded-full bg-[#27c93f] border border-black/10 inline-block" />
                  </div>

                  {/* Browser Address Bar */}
                  <div className="flex h-7 w-full max-w-md items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-[11px] font-mono text-slate-500 shadow-xs">
                    <Lock className="h-3 w-3 text-emerald-600" />
                    <span className="truncate">https://academy.zedai.org/courses/preview/lesson</span>
                  </div>

                  <div className="w-12 text-right">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">100%</span>
                  </div>
                </div>

                {/* Desktop Viewport Content */}
                <div className="max-h-[760px] overflow-y-auto bg-slate-50 p-6 sm:p-10 scrollbar-thin scrollbar-thumb-slate-300">
                  {renderedContent}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
