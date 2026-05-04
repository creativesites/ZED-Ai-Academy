"use client";

import { Bookmark, FileDown, LucideIcon, Sparkles, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";

interface ActionCardProps {
  title: string;
  actionLabel: string;
  type?: "save" | "download" | "action" | "link";
  description?: string;
  href?: string;
  onAction?: () => void;
}

export function ActionCard({ title, actionLabel, type = "action", description, href, onAction }: ActionCardProps) {
  const Icon = type === "save" ? Bookmark : type === "download" ? FileDown : type === "link" ? ExternalLink : Sparkles;

  const content = (
    <div className="p-5 text-center">
      <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-blue-600 transition-transform group-hover:scale-110">
        <Icon className="h-6 w-6" />
      </div>
      <h4 className="text-sm font-bold text-slate-900">{title}</h4>
      {description && <p className="mt-2 text-xs leading-relaxed text-slate-500 px-4">{description}</p>}
      
      {href ? (
        <Link 
          href={href}
          className="mt-5 flex h-10 w-full items-center justify-center rounded-xl bg-[#fd5523] text-sm font-bold text-white shadow-sm transition-all hover:bg-[#ef4a16] hover:shadow-lg active:scale-95"
        >
          {actionLabel}
        </Link>
      ) : (
        <Button 
          onClick={onAction}
          className="mt-5 h-10 w-full rounded-xl bg-blue-600 text-white hover:bg-blue-700 shadow-sm"
        >
          {actionLabel}
        </Button>
      )}
    </div>
  );

  return (
    <div className="group my-4 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition-all hover:shadow-md">
      {content}
      <div className="bg-slate-50/80 px-4 py-2 text-center border-t border-slate-100">
        <span className="text-[10px] font-medium uppercase tracking-wider text-slate-400 italic">Actionable Deliverable</span>
      </div>
    </div>
  );
}
