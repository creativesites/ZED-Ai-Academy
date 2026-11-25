"use client";

import React from "react";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import type { AssignmentWithMeta } from "@/actions/classroom-assignments";

export function AssignmentCard({
  assignment,
  isSelected,
  onSelect,
  statusBadge,
}: {
  assignment: AssignmentWithMeta;
  isSelected: boolean;
  onSelect: () => void;
  statusBadge: React.ReactNode;
}) {
  return (
    <div
      onClick={onSelect}
      className={cn(
        "p-4 rounded-2xl border transition-all cursor-pointer space-y-2 group",
        isSelected
          ? "bg-sky-50/70 border-sky-300 shadow-sm shadow-sky-500/5 ring-1 ring-sky-300"
          : "bg-white border-slate-100 hover:border-slate-200 hover:bg-slate-50/40",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <h4 className="text-xs font-black text-ink group-hover:text-sky-700 transition-colors line-clamp-1">
          {assignment.title}
        </h4>
        <ChevronRight
          className={cn(
            "h-4 w-4 shrink-0 transition-transform",
            isSelected ? "text-sky-600 translate-x-0.5" : "text-slate-300",
          )}
        />
      </div>

      <div className="flex items-center justify-between gap-2 pt-0.5">
        <div>{statusBadge}</div>
        <span className="text-[10px] text-slate-400 font-medium">
          Due{" "}
          {new Date(assignment.due_date).toLocaleDateString([], {
            month: "short",
            day: "numeric",
          })}
        </span>
      </div>
    </div>
  );
}
