"use client";

import { useMemo, useState } from "react";
import { Smartphone, Tablet, Monitor, PlayCircle, HelpCircle } from "lucide-react";
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

const VIEWPORTS: { id: PreviewViewport; label: string; icon: React.ElementType }[] = [
  { id: "mobile", label: "Phone", icon: Smartphone },
  { id: "tablet", label: "Tablet", icon: Tablet },
  { id: "desktop", label: "Desktop", icon: Monitor },
];

export function LessonPreviewPane({
  title,
  moduleTitle,
  blocks,
  quiz,
}: {
  title: string;
  moduleTitle: string;
  blocks: Block[];
  quiz?: Quiz | null;
}) {
  const [viewport, setViewport] = useState<PreviewViewport>("mobile");

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

  const content = (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-[2rem] border border-slate-100 bg-white shadow-sm">
        <div className="border-b border-slate-100 bg-gradient-to-r from-[#062e39] to-[#0a4055] px-5 py-5 text-white">
          <p className="text-[10px] font-black uppercase tracking-[0.25em] text-[#fd8d69]">
            Learner Preview
          </p>
          <h3 className="mt-2 text-xl text-white font-bold tracking-tight">{title || "Untitled Lesson"}</h3>
          <div className="mt-3 flex flex-wrap gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-white/70">
              <PlayCircle className="h-3.5 w-3.5 text-[#fd8d69]" />
              {moduleTitle}
            </span>
            <span className="inline-flex rounded-full bg-white/10 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-white/70">
              {blocks.length} block{blocks.length === 1 ? "" : "s"}
            </span>
          </div>
        </div>
        <div className="space-y-8 bg-[#f8fafc] py-5 px-2">
          {previewBlocks.length > 0 ? (
            previewBlocks.map((block) => (
              <div key={block.id}>
                <BlockRenderer block={block} previewMode />
                {block.type === "quiz" && quiz && (
                  <div className="mt-6 rounded-[2rem] border border-slate-100 bg-white p-6 shadow-sm">
                    <div className="mb-6 flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600">
                        <HelpCircle className="h-5 w-5" />
                      </div>
                      <div>
                        <h4 className="font-bold text-[#062e39]">Knowledge Check</h4>
                        <p className="text-sm text-slate-500">Preview of the learner quiz experience.</p>
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
            <div className="rounded-[2rem] border border-dashed border-slate-200 bg-white p-8 text-center">
              <p className="text-sm font-semibold text-slate-500">Add blocks to see a learner-ready preview.</p>
            </div>
          )}
        </div>
      </section>
    </div>
  );

  return (
    <section className="overflow-hidden px-2 max-w-100 rounded-2xl border border-slate-100 bg-white shadow-xl sm:rounded-[2.5rem]">
      <div className="border-b border-slate-100 bg-[#fffaf6] px-4 py-4 sm:px-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.25em] text-[#fd5523]">Preview</p>
            <h2 className="text-lg font-bold text-[#062e39]">Learner Surface</h2>
          </div>
          <div className="flex rounded-full border border-slate-200 bg-white p-1">
            {VIEWPORTS.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setViewport(id)}
                className={cn(
                  "flex items-center gap-1.5 rounded-full px-3 py-2 text-[10px] font-bold uppercase tracking-[0.18em] transition-colors",
                  viewport === id ? "bg-[#062e39] text-white" : "text-slate-400 hover:text-[#062e39]"
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">{label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="bg-gradient-to-b from-slate-100 to-slate-200 p-2 mr-2 max-w-100 sm:p-6">
        {viewport === "mobile" ? (
          <div className="mx-auto w-full max-w-[390px] overflow-hidden rounded-[2.5rem] border-[10px] border-slate-900 bg-slate-50 shadow-2xl">
            <div className="flex justify-center py-3">
              <div className="h-1.5 w-20 rounded-full bg-slate-700" />
            </div>
            <div className="max-h-[780px] overflow-y-auto px-0 pb-4">{content}</div>
          </div>
        ) : (
          <div
            className={cn(
              "mx-auto overflow-hidden rounded-[2rem] border border-slate-200 bg-slate-50 shadow-xl",
              viewport === "tablet" ? "max-w-3xl" : "max-w-full"
            )}
          >
            <div className="max-h-[780px] overflow-y-auto p-4 sm:p-6">{content}</div>
          </div>
        )}
      </div>
    </section>
  );
}
