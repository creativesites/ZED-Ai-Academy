"use client";

import { BookMarked } from "lucide-react";

export function GlossaryBlock({ content }: { content: Record<string, unknown> }) {
  const title = (content.title as string) || "Glossary";
  const terms = Array.isArray(content.terms)
    ? (content.terms as { term?: string; definition?: string }[]).filter((item) => item.term || item.definition)
    : [];

  if (!terms.length) return null;

  return (
    <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
      <div className="mb-5 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-violet-50 text-violet-600">
          <BookMarked className="h-5 w-5" />
        </div>
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.22em] text-violet-600">Key Terms</p>
          <h3 className="text-2xl font-bold tracking-tight text-[#062e39]">{title}</h3>
        </div>
      </div>

      <div className="space-y-3">
        {terms.map((item, index) => (
          <div key={`${item.term}-${index}`} className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
            <p className="text-sm font-bold text-[#062e39]">{item.term || "Term"}</p>
            <p className="mt-1 text-sm leading-relaxed text-slate-600">{item.definition || "Definition"}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
