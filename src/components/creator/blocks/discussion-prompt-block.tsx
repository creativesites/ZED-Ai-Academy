"use client";

import { useState } from "react";
import { MessagesSquare } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type DiscussionPromptContent = {
  title?: string;
  prompt: string;
  guidance?: string[];
  mode?: "individual" | "group";
};

export function DiscussionPromptBlockEditor({
  content,
  onChange,
}: {
  content: DiscussionPromptContent;
  onChange: (c: DiscussionPromptContent) => void;
}) {
  const [title, setTitle] = useState(content.title ?? "Discussion Prompt");
  const [prompt, setPrompt] = useState(content.prompt ?? "");
  const [guidance, setGuidance] = useState((content.guidance ?? []).join("\n"));
  const [mode, setMode] = useState<"individual" | "group">(content.mode ?? "group");

  function emit(next: Partial<DiscussionPromptContent>) {
    const nextTitle = next.title ?? title;
    const nextPrompt = next.prompt ?? prompt;
    const nextGuidance = next.guidance ?? guidance.split("\n").map((item) => item.trim()).filter(Boolean);
    const nextMode = next.mode ?? mode;
    onChange({
      title: nextTitle || undefined,
      prompt: nextPrompt,
      guidance: nextGuidance,
      mode: nextMode,
    });
  }

  return (
    <div className="space-y-4">
      <div className="mb-2 flex items-center gap-2 text-[#062e39]">
        <MessagesSquare className="h-4 w-4 text-[#fd5523]" />
        <span className="text-xs font-bold uppercase tracking-widest">Discussion Prompt</span>
      </div>

      <div className="space-y-1.5">
        <Label className="text-sm text-slate-700">Block Heading</Label>
        <Input
          value={title}
          onChange={(e) => {
            setTitle(e.target.value);
            emit({ title: e.target.value });
          }}
          placeholder="Discussion Prompt"
          className="border-slate-300 bg-white text-slate-900"
        />
      </div>

      <div className="space-y-1.5">
        <Label className="text-sm text-slate-700">Prompt</Label>
        <Textarea
          value={prompt}
          onChange={(e) => {
            setPrompt(e.target.value);
            emit({ prompt: e.target.value });
          }}
          rows={4}
          placeholder="What should learners debate, explain, or reflect on?"
          className="border-slate-300 bg-white text-slate-900"
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label className="text-sm text-slate-700">Mode</Label>
          <select
            value={mode}
            onChange={(e) => {
              const nextMode = e.target.value as "individual" | "group";
              setMode(nextMode);
              emit({ mode: nextMode });
            }}
            className="flex h-10 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm font-medium text-slate-900 outline-none"
          >
            <option value="group">Group discussion</option>
            <option value="individual">Individual reflection</option>
          </select>
        </div>

        <div className="space-y-1.5">
          <Label className="text-sm text-slate-700">Facilitation Notes</Label>
          <Textarea
            value={guidance}
            onChange={(e) => {
              setGuidance(e.target.value);
              emit({
                guidance: e.target.value
                  .split("\n")
                  .map((item) => item.trim())
                  .filter(Boolean),
              });
            }}
            rows={4}
            placeholder="One note per line"
            className="border-slate-300 bg-white text-slate-900"
          />
        </div>
      </div>
    </div>
  );
}
