"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Zap } from "lucide-react";

interface ExpertNoteContent {
  title?: string;
  body: string;
}

export function ExpertNoteBlockEditor({
  content,
  onChange,
}: {
  content: ExpertNoteContent;
  onChange: (c: ExpertNoteContent) => void;
}) {
  const [title, setTitle] = useState(content.title ?? "");
  const [body, setBody] = useState(content.body ?? "");

  function emit(t: string, b: string) {
    onChange({ title: t || undefined, body: b });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-[#062e39] mb-2">
        <Zap className="h-4 w-4 text-[#fd5523]" />
        <span className="text-xs font-bold uppercase tracking-widest">Expert Deep Dive</span>
      </div>

      <div className="space-y-1.5">
        <Label className="text-sm text-slate-700">Deep Dive Title</Label>
        <Input
          value={title}
          onChange={(e) => { setTitle(e.target.value); emit(e.target.value, body); }}
          placeholder="e.g. The Math Behind the Noise Reduction"
          className="border-slate-300 bg-white text-slate-900"
        />
      </div>

      <div className="space-y-1.5">
        <Label className="text-sm text-slate-700">Content (HTML allowed)</Label>
        <Textarea
          value={body}
          onChange={(e) => { setBody(e.target.value); emit(title, e.target.value); }}
          placeholder="Enter technical details..."
          rows={4}
          className="border-slate-300 bg-white text-slate-900"
        />
      </div>
    </div>
  );
}
