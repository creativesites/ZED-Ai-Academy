"use client";

import { BookOpen } from "lucide-react";

export function CaseStudyBlock({ content }: { content: Record<string, unknown> }) {
  const title = content.title as string;
  const body = content.body as string;
  const outcome = content.outcome as string | undefined;
  
  if (!title || !body) return null;
  
  return (
    <div className="rounded-[2.5rem] border-2 border-slate-100 bg-white overflow-hidden shadow-xl">
      <div className="bg-[#062e39] px-8 py-6 text-white flex items-center gap-4">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/10 text-[#fd5523]">
          <BookOpen className="h-5 w-5" />
        </div>
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.25em] text-[#fd8d69]">Case Study</p>
          <h3 className="text-xl font-bold tracking-tight">{title}</h3>
        </div>
      </div>
      <div className="p-8 md:p-10 space-y-6">
        <div className="prose prose-slate max-w-none prose-p:text-lg prose-p:leading-relaxed text-slate-600" dangerouslySetInnerHTML={{ __html: body }} />
        {outcome && (
          <div className="rounded-2xl bg-emerald-50 border border-emerald-100 p-6">
            <p className="text-[10px] font-black uppercase tracking-widest text-emerald-600 mb-2">Key Outcome</p>
            <p className="text-emerald-900 font-bold leading-relaxed">{outcome}</p>
          </div>
        )}
      </div>
    </div>
  );
}
