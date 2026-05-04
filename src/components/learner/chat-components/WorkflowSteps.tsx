"use client";

import { CheckCircle2, Circle } from "lucide-react";

interface WorkflowStepsProps {
  steps: { title: string; description?: string }[];
}

export function WorkflowSteps({ steps }: WorkflowStepsProps) {
  return (
    <div className="my-4 space-y-3">
      {steps.map((step, idx) => (
        <div key={idx} className="flex gap-4 rounded-2xl border border-slate-100 bg-white p-4 shadow-sm transition-all hover:border-blue-200">
          <div className="flex flex-col items-center gap-1">
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-blue-100 text-xs font-bold text-blue-700">
              {idx + 1}
            </div>
            {idx < steps.length - 1 && <div className="h-full w-0.5 bg-slate-100" />}
          </div>
          <div className="flex-1 pb-1">
            <h5 className="text-sm font-semibold text-slate-900">{step.title}</h5>
            {step.description && <p className="mt-1 text-xs leading-relaxed text-slate-500">{step.description}</p>}
          </div>
        </div>
      ))}
    </div>
  );
}
