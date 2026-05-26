"use client";

import { useState } from "react";
import { BookMarked, Plus, Trash2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

type GlossaryTerm = { term: string; definition: string };
type GlossaryContent = { title?: string; terms: GlossaryTerm[] };

export function GlossaryBlockEditor({
  content,
  onChange,
}: {
  content: GlossaryContent;
  onChange: (c: GlossaryContent) => void;
}) {
  const [title, setTitle] = useState(content.title ?? "Glossary");
  const [terms, setTerms] = useState<GlossaryTerm[]>(
    content.terms?.length ? content.terms : [{ term: "", definition: "" }]
  );

  function emit(nextTerms: GlossaryTerm[], nextTitle?: string) {
    onChange({ title: (nextTitle ?? title) || undefined, terms: nextTerms });
  }

  function updateTerm(index: number, patch: Partial<GlossaryTerm>) {
    const next = terms.map((item, idx) => (idx === index ? { ...item, ...patch } : item));
    setTerms(next);
    emit(next);
  }

  function addTerm() {
    const next = [...terms, { term: "", definition: "" }];
    setTerms(next);
    emit(next);
  }

  function removeTerm(index: number) {
    const next = terms.filter((_, idx) => idx !== index);
    setTerms(next);
    emit(next);
  }

  return (
    <div className="space-y-4">
      <div className="mb-2 flex items-center gap-2 text-[#062e39]">
        <BookMarked className="h-4 w-4 text-[#fd5523]" />
        <span className="text-xs font-bold uppercase tracking-widest">Glossary</span>
      </div>

      <div className="space-y-1.5">
        <Label className="text-sm text-slate-700">Block Heading</Label>
        <Input
          value={title}
          onChange={(e) => {
            setTitle(e.target.value);
            emit(terms, e.target.value);
          }}
          placeholder="Glossary"
          className="border-slate-300 bg-white text-slate-900"
        />
      </div>

      <div className="space-y-3">
        {terms.map((item, index) => (
          <div key={index} className="space-y-2 rounded-2xl border border-slate-100 bg-slate-50 p-4">
            <div className="flex items-start gap-2">
              <Input
                value={item.term}
                onChange={(e) => updateTerm(index, { term: e.target.value })}
                placeholder="Term"
                className="border-slate-200 bg-white text-slate-900"
              />
              <button
                onClick={() => removeTerm(index)}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-slate-400 transition-colors hover:bg-red-50 hover:text-red-500"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
            <Input
              value={item.definition}
              onChange={(e) => updateTerm(index, { definition: e.target.value })}
              placeholder="Simple learner-friendly definition"
              className="border-slate-200 bg-white text-slate-900"
            />
          </div>
        ))}
      </div>

      <Button
        onClick={addTerm}
        variant="outline"
        className="w-full border-dashed border-slate-300 text-slate-500 hover:border-[#fd5523] hover:text-[#fd5523]"
      >
        <Plus className="mr-2 h-4 w-4" />
        Add Term
      </Button>
    </div>
  );
}
