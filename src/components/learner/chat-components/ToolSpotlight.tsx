"use client";

import { ExternalLink, Sparkles } from "lucide-react";

interface ToolSpotlightProps {
  name: string;
  description: string;
  url: string;
  category?: string;
}

export function ToolSpotlight({ name, description, url, category }: ToolSpotlightProps) {
  return (
    <div className="my-4 overflow-hidden rounded-2xl border border-indigo-200 bg-white shadow-md transition-transform hover:scale-[1.01]">
      <div className="flex items-center justify-between border-b border-indigo-100 bg-gradient-to-r from-indigo-50 to-blue-50 px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-sm">
            <Sparkles className="h-4 w-4" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-indigo-900">{name}</h4>
            {category && <p className="text-[10px] font-medium uppercase text-indigo-500 tracking-wider">{category}</p>}
          </div>
        </div>
        <a 
          href={url} 
          target="_blank" 
          rel="noopener noreferrer"
          className="rounded-full bg-white p-1.5 text-indigo-600 shadow-sm hover:bg-indigo-600 hover:text-white transition-colors"
        >
          <ExternalLink className="h-4 w-4" />
        </a>
      </div>
      <div className="p-4">
        <p className="text-sm leading-relaxed text-slate-600">{description}</p>
      </div>
    </div>
  );
}
