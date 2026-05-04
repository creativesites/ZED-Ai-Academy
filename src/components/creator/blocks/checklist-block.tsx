"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { CheckSquare, Trash2, Plus } from "lucide-react";

interface ChecklistContent {
  title?: string;
  items: string[];
}

export function ChecklistBlockEditor({
  content,
  onChange,
}: {
  content: ChecklistContent;
  onChange: (c: ChecklistContent) => void;
}) {
  const [blockTitle, setBlockTitle] = useState(content.title ?? "");
  const [items, setItems] = useState<string[]>(content.items?.length ? content.items : [""]);

  function emit(newItems: string[], newTitle?: string) {
    onChange({ title: (newTitle ?? blockTitle) || undefined, items: newItems });
  }

  function updateItem(i: number, value: string) {
    const next = items.map((it, idx) => idx === i ? value : it);
    setItems(next);
    emit(next);
  }

  function addItem() {
    const next = [...items, ""];
    setItems(next);
    emit(next);
  }

  function removeItem(i: number) {
    const next = items.filter((_, idx) => idx !== i);
    setItems(next);
    emit(next);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-emerald-600 mb-2">
        <CheckSquare className="h-4 w-4" />
        <span className="text-xs font-bold uppercase tracking-widest">Checklist Block</span>
      </div>

      <div className="space-y-1.5">
        <Label className="text-sm text-slate-700">Heading (optional)</Label>
        <Input
          value={blockTitle}
          onChange={(e) => { setBlockTitle(e.target.value); emit(items, e.target.value); }}
          placeholder="e.g. Before You Submit Your Project"
          className="border-slate-300 bg-white text-slate-900"
        />
      </div>

      <div className="space-y-2">
        {items.map((item, i) => (
          <div key={i} className="flex items-center gap-3">
            <div className="h-5 w-5 shrink-0 rounded border-2 border-slate-300 bg-white" />
            <Input
              value={item}
              onChange={(e) => updateItem(i, e.target.value)}
              placeholder={`Item ${i + 1}`}
              className="border-slate-200 bg-white text-slate-900"
            />
            <button
              onClick={() => removeItem(i)}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-slate-400 hover:bg-red-50 hover:text-red-500 transition-colors"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>

      <Button
        onClick={addItem}
        variant="outline"
        className="w-full border-dashed border-slate-300 text-slate-500 hover:border-emerald-500 hover:text-emerald-600"
      >
        <Plus className="mr-2 h-4 w-4" />
        Add Item
      </Button>
    </div>
  );
}
