"use client";

import { useState } from "react";
import { ClipboardCheck } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type AssignmentContent = {
  title?: string;
  summary: string;
  deliverables?: string[];
  assessment?: string;
  estimated_minutes?: number;
};

export function AssignmentBlockEditor({
  content,
  onChange,
}: {
  content: AssignmentContent;
  onChange: (c: AssignmentContent) => void;
}) {
  const [title, setTitle] = useState(content.title ?? "Assignment");
  const [summary, setSummary] = useState(content.summary ?? "");
  const [deliverables, setDeliverables] = useState((content.deliverables ?? []).join("\n"));
  const [assessment, setAssessment] = useState(content.assessment ?? "");
  const [estimatedMinutes, setEstimatedMinutes] = useState(String(content.estimated_minutes ?? 30));

  function emit(next: Partial<AssignmentContent>) {
    onChange({
      title: (next.title ?? title) || undefined,
      summary: next.summary ?? summary,
      deliverables:
        next.deliverables ??
        deliverables
          .split("\n")
          .map((item) => item.trim())
          .filter(Boolean),
      assessment: next.assessment ?? assessment,
      estimated_minutes: next.estimated_minutes ?? (Number(estimatedMinutes || "0") || 0),
    });
  }

  return (
    <div className="space-y-4">
      <div className="mb-2 flex items-center gap-2 text-[#062e39]">
        <ClipboardCheck className="h-4 w-4 text-[#fd5523]" />
        <span className="text-xs font-bold uppercase tracking-widest">Assignment</span>
      </div>

      <div className="grid gap-4 sm:grid-cols-[1fr_140px]">
        <div className="space-y-1.5">
          <Label className="text-sm text-slate-700">Title</Label>
          <Input
            value={title}
            onChange={(e) => {
              setTitle(e.target.value);
              emit({ title: e.target.value });
            }}
            placeholder="Assignment"
            className="border-slate-300 bg-white text-slate-900"
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-sm text-slate-700">Minutes</Label>
          <Input
            type="number"
            min="0"
            value={estimatedMinutes}
            onChange={(e) => {
              setEstimatedMinutes(e.target.value);
              emit({ estimated_minutes: Number(e.target.value || "0") || 0 });
            }}
            className="border-slate-300 bg-white text-slate-900"
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label className="text-sm text-slate-700">Summary</Label>
        <Textarea
          value={summary}
          onChange={(e) => {
            setSummary(e.target.value);
            emit({ summary: e.target.value });
          }}
          rows={4}
          placeholder="Describe the task learners must complete."
          className="border-slate-300 bg-white text-slate-900"
        />
      </div>

      <div className="space-y-1.5">
        <Label className="text-sm text-slate-700">Deliverables</Label>
        <Textarea
          value={deliverables}
          onChange={(e) => {
            setDeliverables(e.target.value);
            emit({
              deliverables: e.target.value
                .split("\n")
                .map((item) => item.trim())
                .filter(Boolean),
            });
          }}
          rows={4}
          placeholder="One deliverable per line"
          className="border-slate-300 bg-white text-slate-900"
        />
      </div>

      <div className="space-y-1.5">
        <Label className="text-sm text-slate-700">Assessment Notes</Label>
        <Textarea
          value={assessment}
          onChange={(e) => {
            setAssessment(e.target.value);
            emit({ assessment: e.target.value });
          }}
          rows={3}
          placeholder="How will this be assessed?"
          className="border-slate-300 bg-white text-slate-900"
        />
      </div>
    </div>
  );
}
