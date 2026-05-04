"use client";

import { ArrowRight, Sparkles, XCircle } from "lucide-react";

interface PromptIterationProps {
  before: string;
  after: string;
  labelBefore?: string;
  labelAfter?: string;
  reasoning?: string;
}

export function PromptIteration({ before, after, labelBefore = "Original", labelAfter = "Improved", reasoning }: PromptIterationProps) {
  return (
    <div className="my-4 space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden flex flex-col shadow-sm">
          <div className="flex items-center gap-2 border-b border-slate-100 bg-slate-50 px-3 py-2">
            <XCircle className="h-3.5 w-3.5 text-slate-400" />
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{labelBefore}</span>
          </div>
          <div className="p-3 text-xs leading-relaxed text-slate-600 font-mono italic">
            "{before}"
          </div>
        </div>

        <div className="rounded-2xl border border-blue-200 bg-blue-50/30 overflow-hidden flex flex-col shadow-sm">
          <div className="flex items-center gap-2 border-b border-blue-100 bg-blue-100/50 px-3 py-2">
            <Sparkles className="h-3.5 w-3.5 text-blue-600" />
            <span className="text-[10px] font-bold uppercase tracking-wider text-blue-700">{labelAfter}</span>
          </div>
          <div className="p-3 text-xs leading-relaxed text-slate-800 font-mono font-medium">
            "{after}"
          </div>
        </div>
      </div>
      
      {reasoning && (
        <div className="flex gap-2 rounded-xl bg-slate-50 p-3 text-[11px] leading-relaxed text-slate-600 border border-slate-100">
          <ArrowRight className="mt-0.5 h-3 w-3 shrink-0 text-blue-500" />
          <p><span className="font-bold text-slate-900">Why this works:</span> {reasoning}</p>
        </div>
      )}
    </div>
  );
}
