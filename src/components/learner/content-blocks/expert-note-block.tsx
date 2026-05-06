"use client";

import { GraduationCap } from "lucide-react";

export function ExpertNoteBlock({ content }: { content: Record<string, unknown> }) {
  const author = content.author as string | undefined;
  const note = content.note as string;
  
  if (!note) return null;
  
  return (
    <div className="rounded-[2.5rem] bg-[#062e39] p-8 md:p-10 text-white shadow-2xl relative overflow-hidden group">
      <div className="absolute inset-0 mesh-orange opacity-20 transition-opacity group-hover:opacity-30" />
      <div className="relative z-10">
        <div className="flex items-center gap-4 mb-6">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10 text-[#fd5523] backdrop-blur-md border border-white/10">
            <GraduationCap className="h-6 w-6" />
          </div>
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.25em] text-[#fd8d69]">{author ?? "Expert Note"}</p>
            <p className="text-xl font-bold tracking-tight">Pro Insight</p>
          </div>
        </div>
        <div className="text-lg leading-relaxed text-white/80 font-medium italic">
          "{note}"
        </div>
      </div>
    </div>
  );
}
