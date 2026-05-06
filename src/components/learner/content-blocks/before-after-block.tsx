"use client";

import { useState } from "react";
import { ChevronsLeftRight } from "lucide-react";

export function BeforeAfterBlock({ content }: { content: Record<string, unknown> }) {
  const beforeUrl = content.before_url as string;
  const afterUrl = content.after_url as string;
  const caption = content.caption as string | undefined;
  const [pos, setPos] = useState(50);
  
  if (!beforeUrl || !afterUrl) return null;
  
  return (
    <figure className="space-y-4">
      <div className="relative select-none overflow-hidden rounded-[2.5rem] bg-slate-100 shadow-xl border border-slate-100 ring-4 ring-slate-50/50">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={beforeUrl} alt="Before" className="block w-full" draggable={false} />
        <div className="pointer-events-none absolute inset-0" style={{ clipPath: `inset(0 ${100 - pos}% 0 0)` }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={afterUrl} alt="After" className="block h-full w-full object-cover" draggable={false} />
        </div>
        <div className="pointer-events-none absolute inset-y-0" style={{ left: `${pos}%`, transform: "translateX(-50%)" }}>
          <div className="h-full w-1 bg-white shadow-2xl" />
          <div className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 flex h-10 w-10 items-center justify-center rounded-full bg-white shadow-2xl border border-slate-100">
            <ChevronsLeftRight className="h-5 w-5 text-[#062e39]" />
          </div>
        </div>
        <div className="absolute left-6 top-6 flex items-center gap-2 rounded-full bg-black/40 backdrop-blur-md px-4 py-1.5 text-[10px] font-bold uppercase tracking-[0.2em] text-white ring-1 ring-white/20">
          <span className="h-1.5 w-1.5 rounded-full bg-white" />
          Before
        </div>
        <div className="absolute right-6 top-6 flex items-center gap-2 rounded-full bg-[#fd5523]/80 backdrop-blur-md px-4 py-1.5 text-[10px] font-bold uppercase tracking-[0.2em] text-white ring-1 ring-white/20">
          <span className="h-1.5 w-1.5 rounded-full bg-white animate-pulse" />
          After
        </div>
        <input 
          type="range" 
          min={0} 
          max={100} 
          value={pos} 
          onChange={(e) => setPos(Number(e.target.value))} 
          className="absolute inset-0 h-full w-full cursor-ew-resize opacity-0 z-10" 
        />
      </div>
      {caption && <figcaption className="text-center text-sm font-medium text-slate-400 italic">{caption}</figcaption>}
    </figure>
  );
}
