"use client";

import { useState } from "react";
import { ShieldAlert, Plus, Trash2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

type RiskRow = { hazard: string; risk: string; control: string };
type RiskAssessmentContent = { title?: string; rows: RiskRow[] };

export function RiskAssessmentBlockEditor({
  content,
  onChange,
}: {
  content: RiskAssessmentContent;
  onChange: (c: RiskAssessmentContent) => void;
}) {
  const [title, setTitle] = useState(content.title ?? "Risk Assessment");
  const [rows, setRows] = useState<RiskRow[]>(
    content.rows?.length ? content.rows : [{ hazard: "", risk: "Medium", control: "" }]
  );

  function emit(nextRows: RiskRow[], nextTitle?: string) {
    onChange({ title: (nextTitle ?? title) || undefined, rows: nextRows });
  }

  function updateRow(index: number, patch: Partial<RiskRow>) {
    const next = rows.map((row, idx) => (idx === index ? { ...row, ...patch } : row));
    setRows(next);
    emit(next);
  }

  function addRow() {
    const next = [...rows, { hazard: "", risk: "Medium", control: "" }];
    setRows(next);
    emit(next);
  }

  function removeRow(index: number) {
    const next = rows.filter((_, idx) => idx !== index);
    setRows(next);
    emit(next);
  }

  return (
    <div className="space-y-4">
      <div className="mb-2 flex items-center gap-2 text-[#062e39]">
        <ShieldAlert className="h-4 w-4 text-[#fd5523]" />
        <span className="text-xs font-bold uppercase tracking-widest">Risk Assessment</span>
      </div>

      <div className="space-y-1.5">
        <Label className="text-sm text-slate-700">Block Heading</Label>
        <Input
          value={title}
          onChange={(e) => {
            setTitle(e.target.value);
            emit(rows, e.target.value);
          }}
          placeholder="Risk Assessment"
          className="border-slate-300 bg-white text-slate-900"
        />
      </div>

      <div className="space-y-3">
        {rows.map((row, index) => (
          <div key={index} className="space-y-2 rounded-2xl border border-slate-100 bg-slate-50 p-4">
            <div className="grid gap-2 sm:grid-cols-[1.2fr_140px_1.4fr_auto]">
              <Input
                value={row.hazard}
                onChange={(e) => updateRow(index, { hazard: e.target.value })}
                placeholder="Hazard"
                className="border-slate-200 bg-white text-slate-900"
              />
              <select
                value={row.risk}
                onChange={(e) => updateRow(index, { risk: e.target.value })}
                className="flex h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium text-slate-900 outline-none"
              >
                <option value="Low">Low</option>
                <option value="Medium">Medium</option>
                <option value="High">High</option>
                <option value="Critical">Critical</option>
              </select>
              <Input
                value={row.control}
                onChange={(e) => updateRow(index, { control: e.target.value })}
                placeholder="Control measure"
                className="border-slate-200 bg-white text-slate-900"
              />
              <button
                onClick={() => removeRow(index)}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-slate-400 transition-colors hover:bg-red-50 hover:text-red-500"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </div>
        ))}
      </div>

      <Button
        onClick={addRow}
        variant="outline"
        className="w-full border-dashed border-slate-300 text-slate-500 hover:border-[#fd5523] hover:text-[#fd5523]"
      >
        <Plus className="mr-2 h-4 w-4" />
        Add Risk Row
      </Button>
    </div>
  );
}
