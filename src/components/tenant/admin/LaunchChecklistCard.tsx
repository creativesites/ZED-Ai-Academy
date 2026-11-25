"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  CheckCircle2,
  Circle,
  ChevronRight,
  Rocket,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";

export interface LaunchChecklistItem {
  id: string;
  title: string;
  description: string;
  href: string;
  cta: string;
  done: boolean;
}

export function LaunchChecklistCard({
  companySlug,
  items,
}: {
  companySlug: string;
  items: LaunchChecklistItem[];
}) {
  const storageKey = `zed_launch_checklist_dismissed_${companySlug}`;
  const [dismissed, setDismissed] = useState(false);

  const completedCount = items.filter((i) => i.done).length;
  const totalCount = items.length;
  const allDone = completedCount === totalCount;
  const percent = Math.round((completedCount / Math.max(1, totalCount)) * 100);

  useEffect(() => {
    try {
      if (localStorage.getItem(storageKey) === "1") {
        setDismissed(true);
      }
    } catch {
      // Ignore storage errors
    }
  }, [storageKey]);

  if (dismissed || allDone) return null;

  const handleDismiss = () => {
    setDismissed(true);
    try {
      localStorage.setItem(storageKey, "1");
    } catch {
      // Ignore storage errors
    }
  };

  return (
    <div className="mb-6 bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 bg-gradient-to-r from-ink to-ink-hover text-white flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <div className="h-9 w-9 rounded-xl bg-white/10 flex items-center justify-center shrink-0">
            <Rocket className="h-4.5 w-4.5 text-brand-text" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-black tracking-tight truncate">
                Academy Launch Checklist
              </h2>
              <span className="px-2 py-0.5 rounded-full bg-white/15 text-[10px] font-bold">
                {completedCount}/{totalCount}
              </span>
            </div>
            <p className="text-[11px] text-white/70 truncate mt-0.5">
              Complete these essentials to make your academy ready for learners.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <div className="hidden sm:flex items-center gap-2">
            <div className="w-24 h-1.5 rounded-full bg-white/15 overflow-hidden">
              <div
                className="h-full rounded-full bg-brand transition-all duration-500"
                style={{ width: `${percent}%` }}
              />
            </div>
            <span className="text-[11px] font-black text-white/90">{percent}%</span>
          </div>

          <button
            type="button"
            onClick={handleDismiss}
            className="h-7 w-7 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center text-white/70 hover:text-white transition-colors cursor-pointer"
            title="Dismiss checklist"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Steps */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-slate-100">
        {items.map((item) => (
          <Link
            key={item.id}
            href={item.href}
            className={cn(
              "p-4 flex flex-col justify-between gap-3 transition-colors group",
              item.done ? "bg-slate-50/60" : "hover:bg-surface"
            )}
          >
            <div className="flex items-start gap-2.5">
              {item.done ? (
                <CheckCircle2 className="h-4.5 w-4.5 text-emerald-500 shrink-0 mt-0.5" />
              ) : (
                <Circle className="h-4.5 w-4.5 text-slate-300 group-hover:text-brand-text shrink-0 mt-0.5 transition-colors" />
              )}
              <div className="min-w-0">
                <p
                  className={cn(
                    "text-xs font-bold leading-snug",
                    item.done ? "text-slate-400 line-through" : "text-ink"
                  )}
                >
                  {item.title}
                </p>
                <p className="text-[11px] text-slate-500 mt-0.5 leading-snug">
                  {item.description}
                </p>
              </div>
            </div>

            {!item.done && (
              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-brand-text group-hover:translate-x-0.5 transition-transform pl-7">
                <span>{item.cta}</span>
                <ChevronRight className="h-3 w-3" />
              </span>
            )}
          </Link>
        ))}
      </div>
    </div>
  );
}
