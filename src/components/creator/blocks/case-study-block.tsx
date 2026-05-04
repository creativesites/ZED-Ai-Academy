"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { BookOpen } from "lucide-react";

interface CaseStudyContent {
  title: string;
  context: string;
  action: string;
  result: string;
}

export function CaseStudyBlockEditor({
  content,
  onChange,
}: {
  content: CaseStudyContent;
  onChange: (c: CaseStudyContent) => void;
}) {
  const [data, setData] = useState<CaseStudyContent>({
    title: content.title ?? "",
    context: content.context ?? "",
    action: content.action ?? "",
    result: content.result ?? "",
  });

  function update(patch: Partial<CaseStudyContent>) {
    const next = { ...data, ...patch };
    setData(next);
    onChange(next);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-[#062e39] mb-2">
        <BookOpen className="h-4 w-4 text-indigo-600" />
        <span className="text-xs font-bold uppercase tracking-widest">Case Study Card</span>
      </div>

      <div className="space-y-1.5">
        <Label className="text-sm text-slate-700">Case Study Title</Label>
        <Input
          value={data.title}
          onChange={(e) => update({ title: e.target.value })}
          placeholder="e.g. Scaling a Real Estate Photo Workflow"
          className="border-slate-300 bg-white"
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="space-y-1.5">
          <Label className="text-xs font-bold text-slate-500 uppercase">Context</Label>
          <Textarea
            value={data.context}
            onChange={(e) => update({ context: e.target.value })}
            placeholder="The situation..."
            rows={4}
            className="text-xs bg-slate-50 border-slate-200"
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs font-bold text-[#fd5523] uppercase">Action</Label>
          <Textarea
            value={data.action}
            onChange={(e) => update({ action: e.target.value })}
            placeholder="What was done..."
            rows={4}
            className="text-xs bg-[#fffaf6] border-[#fd5523]/20"
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs font-bold text-green-600 uppercase">Result</Label>
          <Textarea
            value={data.result}
            onChange={(e) => update({ result: e.target.value })}
            placeholder="The outcome..."
            rows={4}
            className="text-xs bg-green-50 border-green-200"
          />
        </div>
      </div>
    </div>
  );
}
