"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { GripVertical, Trash2, Plus, ListOrdered } from "lucide-react";

interface Step {
  title: string;
  body: string;
}

interface StepsContent {
  title?: string;
  steps: Step[];
}

export function StepsBlockEditor({
  content,
  onChange,
}: {
  content: StepsContent;
  onChange: (c: StepsContent) => void;
}) {
  const [blockTitle, setBlockTitle] = useState(content.title ?? "");
  const [steps, setSteps] = useState<Step[]>(content.steps?.length ? content.steps : [{ title: "", body: "" }]);

  function emit(newSteps: Step[], newTitle?: string) {
    onChange({ title: (newTitle ?? blockTitle) || undefined, steps: newSteps });
  }

  function updateStep(i: number, patch: Partial<Step>) {
    const next = steps.map((s, idx) => idx === i ? { ...s, ...patch } : s);
    setSteps(next);
    emit(next);
  }

  function addStep() {
    const next = [...steps, { title: "", body: "" }];
    setSteps(next);
    emit(next);
  }

  function removeStep(i: number) {
    const next = steps.filter((_, idx) => idx !== i);
    setSteps(next);
    emit(next);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-[#062e39] mb-2">
        <ListOrdered className="h-4 w-4 text-[#fd5523]" />
        <span className="text-xs font-bold uppercase tracking-widest">Step-by-Step Block</span>
      </div>

      <div className="space-y-1.5">
        <Label className="text-sm text-slate-700">Block Heading (optional)</Label>
        <Input
          value={blockTitle}
          onChange={(e) => { setBlockTitle(e.target.value); emit(steps, e.target.value); }}
          placeholder="e.g. How to Run Your First AI Edit"
          className="border-slate-300 bg-white text-slate-900"
        />
      </div>

      <div className="space-y-3">
        {steps.map((step, i) => (
          <div key={i} className="flex gap-3 rounded-2xl border border-slate-100 bg-slate-50 p-4">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[#062e39] text-sm font-black text-white">
              {i + 1}
            </div>
            <div className="flex-1 space-y-2">
              <Input
                value={step.title}
                onChange={(e) => updateStep(i, { title: e.target.value })}
                placeholder="Step title"
                className="border-slate-200 bg-white text-slate-900"
              />
              <Textarea
                value={step.body}
                onChange={(e) => updateStep(i, { body: e.target.value })}
                placeholder="Explain what to do in this step..."
                rows={2}
                className="border-slate-200 bg-white text-sm text-slate-900"
              />
            </div>
            <button
              onClick={() => removeStep(i)}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-slate-400 hover:bg-red-50 hover:text-red-500 transition-colors"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>

      <Button
        onClick={addStep}
        variant="outline"
        className="w-full border-dashed border-slate-300 text-slate-500 hover:border-[#fd5523] hover:text-[#fd5523]"
      >
        <Plus className="mr-2 h-4 w-4" />
        Add Step
      </Button>
    </div>
  );
}
