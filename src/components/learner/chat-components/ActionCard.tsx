"use client";

import { Bookmark, FileDown, LucideIcon, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ActionCardProps {
  title: string;
  actionLabel: string;
  type?: "save" | "download" | "action";
  description?: string;
  onAction?: () => void;
}

export function ActionCard({ title, actionLabel, type = "action", description, onAction }: ActionCardProps) {
  const Icon = type === "save" ? Bookmark : type === "download" ? FileDown : Sparkles;

  return (
    <div className="my-4 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition-all hover:shadow-md">
      <div className="p-5 text-center">
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
          <Icon className="h-6 w-6" />
        </div>
        <h4 className="text-sm font-bold text-slate-900">{title}</h4>
        {description && <p className="mt-2 text-xs leading-relaxed text-slate-500 px-4">{description}</p>}
        <Button 
          onClick={onAction}
          className="mt-5 h-10 w-full rounded-xl bg-blue-600 text-white hover:bg-blue-700 shadow-sm"
        >
          {actionLabel}
        </Button>
      </div>
      <div className="bg-slate-50/80 px-4 py-2 text-center border-t border-slate-100">
        <span className="text-[10px] font-medium uppercase tracking-wider text-slate-400 italic">Actionable Deliverable</span>
      </div>
    </div>
  );
}
