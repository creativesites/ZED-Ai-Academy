"use client";

import { useState } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sparkles } from "lucide-react";

interface AiPromptContent {
  prompt: string;
  tool?: string;
  label?: string;
}

export function AiPromptBlockEditor({
  content,
  onChange,
}: {
  content: AiPromptContent;
  onChange: (c: AiPromptContent) => void;
}) {
  const [prompt, setPrompt] = useState(content.prompt ?? "");
  const [tool, setTool] = useState(content.tool ?? "");
  const [label, setLabel] = useState(content.label ?? "");

  function emit(patch: Partial<AiPromptContent>) {
    onChange({ prompt, tool: tool || undefined, label: label || undefined, ...patch });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-[#fd5523] mb-2">
        <Sparkles className="h-4 w-4" />
        <span className="text-xs font-bold uppercase tracking-widest">AI Prompt Block</span>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label className="text-sm text-slate-700">Label</Label>
          <Input
            value={label}
            onChange={(e) => { setLabel(e.target.value); emit({ label: e.target.value || undefined }); }}
            placeholder="e.g. Try This Prompt"
            className="border-slate-300 bg-white text-slate-900"
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-sm text-slate-700">Tool (optional)</Label>
          <Input
            value={tool}
            onChange={(e) => { setTool(e.target.value); emit({ tool: e.target.value || undefined }); }}
            placeholder="e.g. ChatGPT, Midjourney"
            className="border-slate-300 bg-white text-slate-900"
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label className="text-sm text-slate-700">Prompt Text</Label>
        <Textarea
          value={prompt}
          onChange={(e) => { setPrompt(e.target.value); emit({ prompt: e.target.value }); }}
          placeholder="You are a professional photographer. Analyse this image and suggest..."
          rows={6}
          className="border-slate-300 bg-white font-mono text-sm text-slate-900 placeholder:text-slate-400"
        />
        <p className="text-xs text-slate-400">{prompt.length} characters</p>
      </div>

      {prompt && (
        <div className="rounded-2xl border-2 border-[#fd5523]/20 bg-[#fff8f5] p-4">
          <p className="text-[10px] font-black uppercase tracking-widest text-[#fd5523] mb-2">Preview</p>
          <pre className="whitespace-pre-wrap text-xs text-slate-700 font-mono">{prompt}</pre>
        </div>
      )}
    </div>
  );
}
