"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export type CalloutVariant = "tip" | "warning" | "important" | "danger";

export interface CalloutBlockContent {
  variant: CalloutVariant;
  title: string;
  body: string;
}

const VARIANTS: { value: CalloutVariant; label: string; emoji: string; style: string }[] = [
  { value: "tip",       label: "Tip",       emoji: "⚡", style: "bg-green-50 border-green-200 text-green-800" },
  { value: "warning",   label: "Warning",   emoji: "⚠️", style: "bg-amber-50 border-amber-200 text-amber-800" },
  { value: "important", label: "Important", emoji: "💡", style: "bg-blue-50 border-blue-200 text-blue-800" },
  { value: "danger",    label: "Danger",    emoji: "🚫", style: "bg-red-50 border-red-200 text-red-800" },
];

export function getCalloutStyle(variant: CalloutVariant) {
  return VARIANTS.find((v) => v.value === variant) ?? VARIANTS[0];
}

export function CalloutBlockEditor({
  content,
  onChange,
}: {
  content: CalloutBlockContent;
  onChange: (c: CalloutBlockContent) => void;
}) {
  const [variant, setVariant] = useState<CalloutVariant>(content.variant ?? "tip");
  const [title, setTitle] = useState(content.title ?? "");
  const [body, setBody] = useState(content.body ?? "");
  const info = getCalloutStyle(variant);

  function emit(patch: Partial<CalloutBlockContent>) {
    onChange({ variant, title, body, ...patch });
  }

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label className="text-sm text-slate-700">Callout type</Label>
        <div className="grid grid-cols-4 gap-2">
          {VARIANTS.map((v) => (
            <button
              key={v.value}
              type="button"
              onClick={() => { setVariant(v.value); emit({ variant: v.value }); }}
              className={`rounded-lg border px-2 py-2 text-xs font-medium transition-colors ${
                variant === v.value
                  ? `${v.style} ring-2 ring-offset-1`
                  : "border-slate-300 bg-white text-slate-600 hover:border-slate-400"
              }`}
            >
              {v.emoji} {v.label}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-1.5">
        <Label className="text-sm text-slate-700">Title</Label>
        <Input
          value={title}
          onChange={(e) => { setTitle(e.target.value); emit({ title: e.target.value }); }}
          placeholder={`e.g. ${info.emoji} Pro Tip: Always shoot RAW before using Topaz AI`}
          className="border-slate-300 bg-white text-slate-900"
        />
      </div>

      <div className="space-y-1.5">
        <Label className="text-sm text-slate-700">Body</Label>
        <Textarea
          value={body}
          onChange={(e) => { setBody(e.target.value); emit({ body: e.target.value }); }}
          placeholder="Detailed explanation, extra context, or a step-by-step note…"
          rows={3}
          className="resize-none border-slate-300 bg-white text-slate-900"
        />
      </div>

      {/* Live preview */}
      {(title || body) && (
        <div className={`rounded-xl border p-4 ${info.style}`}>
          {title && <p className="font-semibold">{info.emoji} {title}</p>}
          {body && <p className="mt-1 text-sm leading-relaxed">{body}</p>}
        </div>
      )}
    </div>
  );
}
