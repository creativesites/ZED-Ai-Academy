"use client";

import { useState } from "react";
import { CheckCircle2, Circle } from "lucide-react";

interface ChecklistProps {
  title: string;
  items: string[];
}

export function Checklist({ title, items }: ChecklistProps) {
  const [checked, setChecked] = useState<Set<number>>(new Set());

  const toggle = (idx: number) => {
    const next = new Set(checked);
    if (next.has(idx)) next.delete(idx);
    else next.add(idx);
    setChecked(next);
  };

  return (
    <div className="my-4 rounded-2xl border border-slate-200 bg-white px-1 py-3 shadow-sm">
      <h6 className="mb-4 px-2 text-sm font-bold text-slate-900 flex items-center gap-2">
        <CheckCircle2 className="h-4 w-4 text-green-600" />
        {title}
      </h6>
      <div className="space-y-2">
        {items.map((item, idx) => (
          <button
            key={idx}
            onClick={() => toggle(idx)}
            className={`flex w-full items-start gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition-all ${
              checked.has(idx) ? "bg-green-50 text-slate-500" : "bg-slate-50 text-slate-700 hover:bg-slate-100"
            }`}
          >
            <div className="mt-0.5 shrink-0">
              {checked.has(idx) ? (
                <CheckCircle2 className="h-4 w-4 text-green-600" />
              ) : (
                <Circle className="h-4 w-4 text-slate-300" />
              )}
            </div>
            <span className={checked.has(idx) ? "line-through decoration-green-600/30" : ""}>{item}</span>
          </button>
        ))}
      </div>
      <div className="mt-4 flex items-center justify-between">
        <div className="h-1.5 flex-1 rounded-full bg-slate-100 overflow-hidden">
          <div 
            className="h-full bg-green-500 transition-all duration-500" 
            style={{ width: `${(checked.size / items.length) * 100}%` }}
          />
        </div>
        <span className="ml-3 text-[10px] font-bold text-slate-400 tabular-nums">
          {checked.size}/{items.length}
        </span>
      </div>
    </div>
  );
}
