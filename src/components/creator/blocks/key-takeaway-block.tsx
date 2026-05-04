"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Zap, Trash2, Plus } from "lucide-react";

interface KeyTakeawayContent {
  title?: string;
  points: string[];
}

export function KeyTakeawayBlockEditor({
  content,
  onChange,
}: {
  content: KeyTakeawayContent;
  onChange: (c: KeyTakeawayContent) => void;
}) {
  const [blockTitle, setBlockTitle] = useState(content.title ?? "Key Takeaways");
  const [points, setPoints] = useState<string[]>(content.points?.length ? content.points : [""]);

  function emit(newPoints: string[], newTitle?: string) {
    onChange({ title: (newTitle ?? blockTitle) || undefined, points: newPoints });
  }

  function updatePoint(i: number, value: string) {
    const next = points.map((p, idx) => idx === i ? value : p);
    setPoints(next);
    emit(next);
  }

  function addPoint() {
    const next = [...points, ""];
    setPoints(next);
    emit(next);
  }

  function removePoint(i: number) {
    const next = points.filter((_, idx) => idx !== i);
    setPoints(next);
    emit(next);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-[#fd5523] mb-2">
        <Zap className="h-4 w-4" />
        <span className="text-xs font-bold uppercase tracking-widest">Key Takeaways Block</span>
      </div>

      <div className="space-y-1.5">
        <Label className="text-sm text-slate-700">Heading</Label>
        <Input
          value={blockTitle}
          onChange={(e) => { setBlockTitle(e.target.value); emit(points, e.target.value); }}
          placeholder="Key Takeaways"
          className="border-slate-300 bg-white text-slate-900"
        />
      </div>

      <div className="space-y-2">
        {points.map((point, i) => (
          <div key={i} className="flex items-center gap-3">
            <div className="h-5 w-5 shrink-0 text-[#fd5523]">
              <svg viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
            </div>
            <Input
              value={point}
              onChange={(e) => updatePoint(i, e.target.value)}
              placeholder={`Takeaway ${i + 1}`}
              className="border-slate-200 bg-white text-slate-900"
            />
            <button
              onClick={() => removePoint(i)}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-slate-400 hover:bg-red-50 hover:text-red-500 transition-colors"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>

      <Button
        onClick={addPoint}
        variant="outline"
        className="w-full border-dashed border-slate-300 text-slate-500 hover:border-[#fd5523] hover:text-[#fd5523]"
      >
        <Plus className="mr-2 h-4 w-4" />
        Add Takeaway
      </Button>

      <div className="rounded-2xl bg-[#062e39] p-4 mt-2">
        <p className="text-[10px] font-black uppercase tracking-widest text-[#fd5523] mb-2">Preview</p>
        <ul className="space-y-1">
          {points.filter(Boolean).map((p, i) => (
            <li key={i} className="text-xs text-white/70">✓ {p}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}
