"use client";

import { Download, FileText, Link2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ResourceLinkProps {
  title: string;
  url: string;
  type?: "pdf" | "link" | "doc";
  description?: string;
}

export function ResourceLink({ title, url, type = "link", description }: ResourceLinkProps) {
  const Icon = type === "pdf" ? FileText : type === "doc" ? FileText : Link2;

  return (
    <div className="my-4 flex items-center gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition-all hover:shadow-md hover:border-blue-200 group">
      <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${
        type === "pdf" ? "bg-red-50 text-red-600" : type === "doc" ? "bg-blue-50 text-blue-600" : "bg-indigo-50 text-indigo-600"
      }`}>
        <Icon className="h-6 w-6" />
      </div>
      <div className="flex-1 min-w-0">
        <h4 className="truncate text-sm font-bold text-slate-900 group-hover:text-blue-600 transition-colors">{title}</h4>
        {description && <p className="mt-0.5 truncate text-xs text-slate-500">{description}</p>}
      </div>
      <a href={url} target="_blank" rel="noopener noreferrer">
        <Button size="sm" variant="outline" className="h-9 rounded-xl border-slate-200 bg-white px-3 text-slate-700 hover:bg-slate-50">
          {type === "link" ? <Link2 className="h-3.5 w-3.5 mr-1.5" /> : <Download className="h-3.5 w-3.5 mr-1.5" />}
          {type === "link" ? "Visit" : "Download"}
        </Button>
      </a>
    </div>
  );
}
