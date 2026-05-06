"use client";

import { ExternalLink } from "lucide-react";

export function ToolSpotlightBlock({ content }: { content: Record<string, unknown> }) {
  const name = content.name as string;
  const description = content.description as string | undefined;
  const url = content.url as string | undefined;
  const icon = content.icon as string | undefined;

  if (!name) return null;

  const inner = (
    <div className="group flex items-start gap-4 rounded-3xl bg-white p-6 shadow-xl border border-slate-100 transition-all duration-300 hover:shadow-2xl hover:-translate-y-1">
      {icon && (
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#fff6ee] text-[#fd5523] shadow-inner">
          <span className="text-2xl">{icon}</span>
        </div>
      )}
      <div className="flex-1 min-w-0 pt-1">
        <div className="flex items-center gap-2">
          <p className="font-bold text-[#062e39] text-lg">{name}</p>
          {url && <ExternalLink className="h-4 w-4 text-[#fd5523] opacity-0 group-hover:opacity-100 transition-opacity" />}
        </div>
        {description && <p className="mt-2 text-sm leading-relaxed text-slate-500">{description}</p>}
      </div>
    </div>
  );

  return url ? <a href={url} target="_blank" rel="noreferrer" className="block">{inner}</a> : inner;
}
