"use client";

import { useState } from "react";
import { Target, Plus, Trash2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

type LearningObjectivesContent = {
  title?: string;
  objectives: string[];
};

export function LearningObjectivesBlockEditor({
  content,
  onChange,
}: {
  content: LearningObjectivesContent;
  onChange: (c: LearningObjectivesContent) => void;
}) {
  const [title, setTitle] = useState(content.title ?? "Learning Objectives");
  const [objectives, setObjectives] = useState<string[]>(
    content.objectives?.length ? content.objectives : [""]
  );

  function emit(nextObjectives: string[], nextTitle?: string) {
    onChange({
      title: (nextTitle ?? title) || undefined,
      objectives: nextObjectives,
    });
  }

  function updateObjective(index: number, value: string) {
    const next = objectives.map((item, idx) => (idx === index ? value : item));
    setObjectives(next);
    emit(next);
  }

  function addObjective() {
    const next = [...objectives, ""];
    setObjectives(next);
    emit(next);
  }

  function removeObjective(index: number) {
    const next = objectives.filter((_, idx) => idx !== index);
    setObjectives(next);
    emit(next);
  }

  return (
    <div className="space-y-4">
      <div className="mb-2 flex items-center gap-2 text-[#062e39]">
        <Target className="h-4 w-4 text-[#fd5523]" />
        <span className="text-xs font-bold uppercase tracking-widest">Learning Objectives</span>
      </div>

      <div className="space-y-1.5">
        <Label className="text-sm text-slate-700">Block Heading</Label>
        <Input
          value={title}
          onChange={(e) => {
            setTitle(e.target.value);
            emit(objectives, e.target.value);
          }}
          placeholder="Learning Objectives"
          className="border-slate-300 bg-white text-slate-900"
        />
      </div>

      <div className="space-y-3">
        {objectives.map((objective, index) => (
          <div key={index} className="flex gap-3 rounded-2xl border border-slate-100 bg-slate-50 p-4">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[#062e39] text-sm font-black text-white">
              {index + 1}
            </div>
            <Input
              value={objective}
              onChange={(e) => updateObjective(index, e.target.value)}
              placeholder="Learners will be able to..."
              className="border-slate-200 bg-white text-slate-900"
            />
            <button
              onClick={() => removeObjective(index)}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-slate-400 transition-colors hover:bg-red-50 hover:text-red-500"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>

      <Button
        onClick={addObjective}
        variant="outline"
        className="w-full border-dashed border-slate-300 text-slate-500 hover:border-[#fd5523] hover:text-[#fd5523]"
      >
        <Plus className="mr-2 h-4 w-4" />
        Add Objective
      </Button>
    </div>
  );
}
