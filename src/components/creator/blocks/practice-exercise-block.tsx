"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Plus, Trash2, CheckCircle, Brain } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";

interface PracticeExerciseContent {
  title: string;
  brief: string;
  mode: "text_response" | "studio_submission" | "file_upload" | "combined";
  estimated_minutes: number;
  instructions: string[];
  deliverables: { type: string; label: string; required: boolean }[];
  allowed_file_types: string[];
  max_files: number;
  rubric: { criterion: string; weight: number }[];
  ai_scoring_enabled: boolean;
  instructor_review_required: boolean;
  resubmissions_allowed: boolean;
}

import { Sparkles, Loader2 } from "lucide-react";
import { toast } from "sonner";

export function PracticeExerciseBlockEditor({
  content,
  lessonId,
  courseId,
  onChange,
}: {
  content: PracticeExerciseContent;
  lessonId?: string;
  courseId?: string;
  onChange: (c: PracticeExerciseContent) => void;
}) {
  const [generating, setGenerating] = useState(false);
  const [data, setData] = useState<PracticeExerciseContent>({
    title: content.title ?? "Practice Exercise",
    brief: content.brief ?? "",
    mode: content.mode ?? "text_response",
    estimated_minutes: content.estimated_minutes ?? 20,
    instructions: content.instructions ?? [""],
    deliverables: content.deliverables ?? [{ type: "text", label: "Response", required: true }],
    allowed_file_types: content.allowed_file_types ?? ["image/jpeg", "image/png", "application/pdf"],
    max_files: content.max_files ?? 5,
    rubric: content.rubric ?? [],
    ai_scoring_enabled: content.ai_scoring_enabled ?? true,
    instructor_review_required: content.instructor_review_required ?? false,
    resubmissions_allowed: content.resubmissions_allowed ?? true,
  });

  function update(patch: Partial<PracticeExerciseContent>) {
    const next = { ...data, ...patch };
    setData(next);
    onChange(next);
  }

  function addInstruction() {
    update({ instructions: [...data.instructions, ""] });
  }

  function removeInstruction(idx: number) {
    update({ instructions: data.instructions.filter((_, i) => i !== idx) });
  }

  function updateInstruction(idx: number, val: string) {
    const next = [...data.instructions];
    next[idx] = val;
    update({ instructions: next });
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2 text-[#062e39]">
          <Brain className="h-4 w-4 text-emerald-600" />
          <span className="text-xs font-bold uppercase tracking-widest text-emerald-700">Practice Exercise Editor</span>
        </div>
        {lessonId && courseId && (
          <Button
            onClick={async () => {
              setGenerating(true);
              try {
                const res = await fetch("/api/ai/generate-practice-exercise", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ lessonId, courseId })
                });
                const result = await res.json();
                if (!res.ok) throw new Error(result.error || "Failed to generate");
                
                const exercise = result.exercise;
                update({
                  title: exercise.title || data.title,
                  brief: exercise.brief || data.brief,
                  mode: exercise.mode || data.mode,
                  estimated_minutes: exercise.estimated_minutes || data.estimated_minutes,
                  instructions: Array.isArray(exercise.instructions) ? exercise.instructions : data.instructions,
                  rubric: Array.isArray(exercise.rubric) ? exercise.rubric : data.rubric,
                });
                toast.success("Generated exercise with AI!");
              } catch (e: any) {
                toast.error(e.message || "Failed to generate");
              } finally {
                setGenerating(false);
              }
            }}
            disabled={generating}
            variant="outline"
            size="sm"
            className="rounded-full border-emerald-200 text-emerald-700 hover:bg-emerald-50"
          >
            {generating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4 text-emerald-600" />}
            Generate with AI
          </Button>
        )}
      </div>

      <div className="grid gap-6 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label className="text-sm font-bold text-slate-700">Exercise Title</Label>
          <Input
            value={data.title}
            onChange={(e) => update({ title: e.target.value })}
            placeholder="e.g. Apply the Rule of Thirds"
            className="border-slate-300"
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-sm font-bold text-slate-700">Submission Mode</Label>
          <Select value={data.mode} onValueChange={(v: any) => update({ mode: v })}>
            <SelectTrigger className="border-slate-300">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="text_response">Text Response Only</SelectItem>
              <SelectItem value="file_upload">File Uploads Only</SelectItem>
              <SelectItem value="combined">Text + Files</SelectItem>
              <SelectItem value="studio_submission">Studio/Code Submission</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label className="text-sm font-bold text-slate-700">The Brief / Problem Statement</Label>
        <Textarea
          value={data.brief}
          onChange={(e) => update({ brief: e.target.value })}
          placeholder="Explain what the learner needs to do and why it matters."
          className="min-h-[100px] border-slate-300"
        />
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label className="text-sm font-bold text-slate-700">Step-by-Step Instructions</Label>
          <Button variant="ghost" size="sm" onClick={addInstruction} className="text-[#fd5523] hover:text-[#fd5523] hover:bg-[#fff6ee]">
            <Plus className="mr-1.5 h-3.5 w-3.5" />
            Add Step
          </Button>
        </div>
        <div className="space-y-2">
          {data.instructions.map((inst, i) => (
            <div key={i} className="flex gap-2">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-slate-50 text-xs font-bold text-slate-400">
                {i + 1}
              </div>
              <Input
                value={inst}
                onChange={(e) => updateInstruction(i, e.target.value)}
                placeholder="e.g. Open the provided raw file in Lightroom..."
                className="border-slate-300"
              />
              <Button variant="ghost" size="icon" onClick={() => removeInstruction(i)} className="text-slate-300 hover:text-red-500">
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-2xl bg-emerald-50/50 p-6 border border-emerald-100">
        <h4 className="text-sm font-bold text-emerald-800 mb-4 flex items-center gap-2">
          <CheckCircle className="h-4 w-4" />
          AI Scoring & Feedback
        </h4>
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="text-sm font-bold text-slate-700">Enable AI Feedback</Label>
              <p className="text-xs text-slate-500">Gemini will analyze the submission and provide a score + critique.</p>
            </div>
            <Switch
              checked={data.ai_scoring_enabled}
              onCheckedChange={(v: boolean) => update({ ai_scoring_enabled: v })}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="text-sm font-bold text-slate-700">Allow Resubmissions</Label>
              <p className="text-xs text-slate-500">Learners can try again to improve their score.</p>
            </div>
            <Switch
              checked={data.resubmissions_allowed}
              onCheckedChange={(v: boolean) => update({ resubmissions_allowed: v })}
            />
          </div>

          <div className="space-y-1.5 pt-2">
            <Label className="text-sm font-bold text-slate-700">Estimated Minutes to Complete</Label>
            <Input
              type="number"
              value={data.estimated_minutes}
              onChange={(e) => update({ estimated_minutes: parseInt(e.target.value) || 0 })}
              className="max-w-[120px] border-slate-300"
            />
          </div>
        </div>
      </div>
      
      <p className="text-[10px] text-slate-400 leading-relaxed italic">
        <strong>Tip:</strong> Be specific in your brief. The better your instructions, the more accurate the AI feedback will be.
      </p>
    </div>
  );
}
