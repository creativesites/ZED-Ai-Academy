"use client";

export function StepsBlock({ content }: { content: Record<string, unknown> }) {
  const title = content.title as string | undefined;
  const steps = (content.steps as { title: string; body: string }[]) ?? [];
  
  if (!steps.length) return null;
  
  return (
    <div className="space-y-4">
      {title && <h3 className="text-xl font-bold text-[#062e39] tracking-tight">{title}</h3>}
      <div className="space-y-3">
        {steps.map((step, i) => (
          <div key={i} className="flex flex-col sm:flex-row gap-5 rounded-[1.5rem] border border-slate-100 bg-white p-6 shadow-sm">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[#062e39] text-sm font-black text-white shadow-lg">
              {i + 1}
            </div>
            <div className="flex-1 min-w-0 pt-0.5">
              {step.title && <p className="font-bold text-[#062e39] mb-2">{step.title}</p>}
              {step.body && <p className="text-sm leading-relaxed text-slate-600">{step.body}</p>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
