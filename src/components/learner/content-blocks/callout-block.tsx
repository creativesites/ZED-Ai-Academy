"use client";

import { cn } from "@/lib/utils";

const CALLOUT_STYLES: Record<string, { container: string; emoji: string; iconColor: string }> = {
  tip:       { container: "bg-[#fff6ee] border-[#fd5523]/20 text-[#062e39]",   emoji: "⚡", iconColor: "text-[#fd5523]" },
  warning:   { container: "bg-amber-50 border-amber-200 text-amber-900",       emoji: "⚠️", iconColor: "text-amber-600" },
  important: { container: "bg-indigo-50 border-indigo-100 text-indigo-900",    emoji: "💡", iconColor: "text-indigo-600" },
  danger:    { container: "bg-red-50 border-red-100 text-red-900",             emoji: "🚫", iconColor: "text-red-600" },
};

export function CalloutBlock({ content }: { content: Record<string, unknown> }) {
  const variant = (content.variant as string) || "tip";
  const title = content.title as string | undefined;
  const body = content.body as string | undefined;
  const s = CALLOUT_STYLES[variant] ?? CALLOUT_STYLES.tip;
  
  if (!title && !body) return null;
  
  return (
    <div className={cn("rounded-[2rem] border-2 p-6 md:p-8 flex flex-col sm:flex-row gap-5", s.container)}>
      <span className="text-2xl shrink-0">{s.emoji}</span>
      <div>
        {title && <p className="font-bold text-lg tracking-tight mb-1">{title}</p>}
        {body && <p className="text-base leading-relaxed opacity-80">{body}</p>}
      </div>
    </div>
  );
}
