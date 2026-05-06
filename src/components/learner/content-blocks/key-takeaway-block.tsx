"use client";

import { Trophy } from "lucide-react";

export function KeyTakeawayBlock({ content }: { content: Record<string, unknown> }) {
  const title = content.title as string | undefined;
  const points = (content.points as string[]) ?? [];
  
  if (!points.length) return null;
  
  return (
    <div className="relative group overflow-hidden">
      <div className="absolute -inset-1 bg-gradient-to-r from-[#fd5523] to-[#fd8d69] rounded-[2.5rem] opacity-20 blur transition duration-1000 group-hover:opacity-30 group-hover:duration-200" />
      <div className="relative rounded-[2rem] bg-white border border-slate-100 p-8 shadow-xl">
        <div className="flex items-center gap-4 mb-6">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-[#fd5523] to-[#fd8d69] text-white shadow-lg shadow-[#fd5523]/20">
            <Trophy className="h-6 w-6" />
          </div>
          <h3 className="text-2xl font-bold tracking-tight text-[#062e39]">{title ?? "Key Takeaways"}</h3>
        </div>
        <ul className="grid gap-4 sm:grid-cols-2">
          {points.map((point, i) => (
            <li key={i} className="flex items-start gap-3 p-4 rounded-2xl bg-[#fff6ee]/50 border border-[#fd5523]/10 text-slate-700 font-medium">
              <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-[#fd5523]" />
              {point}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
