"use client";

import { Target, CheckCircle2 } from "lucide-react";

export function LearningObjectivesBlock({ content }: { content: Record<string, unknown> }) {
  const title = (content.title as string) || "Learning Objectives";
  const objectives = Array.isArray(content.objectives)
    ? (content.objectives as string[]).filter(Boolean)
    : [];

  if (!objectives.length) return null;

  return (
    <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
      <div className="mb-5 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#fff6ee] text-[#fd5523]">
          <Target className="h-5 w-5" />
        </div>
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[#fd5523]">Learning Path</p>
          <h3 className="text-2xl font-bold tracking-tight text-[#062e39]">{title}</h3>
        </div>
      </div>

      <div className="space-y-3">
        {objectives.map((objective, index) => (
          <div key={`${objective}-${index}`} className="flex gap-3 rounded-2xl border border-slate-100 bg-slate-50 p-4">
            <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-500" />
            <p className="text-sm leading-relaxed text-slate-700">{objective}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
