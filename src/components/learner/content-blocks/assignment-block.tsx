"use client";

import { ClipboardCheck, Clock4 } from "lucide-react";

export function AssignmentBlock({ content }: { content: Record<string, unknown> }) {
  const title = (content.title as string) || "Assignment";
  const summary = content.summary as string | undefined;
  const deliverables = Array.isArray(content.deliverables)
    ? (content.deliverables as string[]).filter(Boolean)
    : [];
  const assessment = content.assessment as string | undefined;
  const estimatedMinutes = content.estimated_minutes as number | undefined;

  if (!summary && deliverables.length === 0 && !assessment) return null;

  return (
    <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
      <div className="mb-5 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
            <ClipboardCheck className="h-5 w-5" />
          </div>
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.22em] text-emerald-600">Assignment</p>
            <h3 className="text-2xl font-bold tracking-tight text-[#062e39]">{title}</h3>
          </div>
        </div>
        {estimatedMinutes ? (
          <div className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">
            <Clock4 className="h-3.5 w-3.5" />
            {estimatedMinutes} min
          </div>
        ) : null}
      </div>

      {summary && (
        <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
          <p className="text-sm leading-relaxed text-slate-700">{summary}</p>
        </div>
      )}

      {deliverables.length > 0 && (
        <div className="mt-4">
          <p className="mb-2 text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Deliverables</p>
          <div className="space-y-2">
            {deliverables.map((item, index) => (
              <div key={`${item}-${index}`} className="flex gap-3 rounded-2xl border border-slate-100 bg-white p-4">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-xs font-bold text-emerald-600">
                  {index + 1}
                </span>
                <p className="text-sm leading-relaxed text-slate-600">{item}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {assessment && (
        <div className="mt-4 rounded-2xl border border-amber-100 bg-amber-50/60 p-4">
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-amber-700">Assessment Notes</p>
          <p className="mt-2 text-sm leading-relaxed text-amber-900">{assessment}</p>
        </div>
      )}
    </div>
  );
}
