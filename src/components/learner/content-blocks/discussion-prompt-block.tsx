"use client";

import { MessagesSquare } from "lucide-react";

export function DiscussionPromptBlock({ content }: { content: Record<string, unknown> }) {
  const title = (content.title as string) || "Discussion Prompt";
  const prompt = content.prompt as string | undefined;
  const guidance = Array.isArray(content.guidance)
    ? (content.guidance as string[]).filter(Boolean)
    : [];
  const mode = (content.mode as string) || "group";

  if (!prompt) return null;

  return (
    <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
      <div className="mb-5 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-sky-50 text-sky-600">
          <MessagesSquare className="h-5 w-5" />
        </div>
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.22em] text-sky-600">
            {mode === "individual" ? "Reflection" : "Discussion"}
          </p>
          <h3 className="text-2xl font-bold tracking-tight text-[#062e39]">{title}</h3>
        </div>
      </div>

      <div className="rounded-2xl border border-sky-100 bg-sky-50/60 p-4">
        <p className="text-base font-medium leading-relaxed text-[#062e39]">{prompt}</p>
      </div>

      {guidance.length > 0 && (
        <div className="mt-4 space-y-2">
          {guidance.map((item, index) => (
            <div key={`${item}-${index}`} className="flex gap-3 rounded-2xl border border-slate-100 bg-slate-50 p-4">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white text-xs font-bold text-sky-600 shadow-sm">
                {index + 1}
              </span>
              <p className="text-sm leading-relaxed text-slate-600">{item}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
