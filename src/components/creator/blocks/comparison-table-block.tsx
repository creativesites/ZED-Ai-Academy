"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Table, Trash2, Plus } from "lucide-react";

interface ComparisonTableContent {
  headers: string[];
  rows: string[][];
}

export function ComparisonTableEditor({
  content,
  onChange,
}: {
  content: ComparisonTableContent;
  onChange: (c: ComparisonTableContent) => void;
}) {
  const [headers, setHeaders] = useState<string[]>(content.headers?.length ? content.headers : ["Feature", "Method A", "Method B"]);
  const [rows, setRows] = useState<string[][]>(content.rows?.length ? content.rows : [["", "", ""]]);

  function emit(h: string[], r: string[][]) {
    onChange({ headers: h, rows: r });
  }

  function addColumn() {
    const nextH = [...headers, "New Column"];
    const nextR = rows.map(r => [...r, ""]);
    setHeaders(nextH);
    setRows(nextR);
    emit(nextH, nextR);
  }

  function removeColumn(i: number) {
    if (headers.length <= 1) return;
    const nextH = headers.filter((_, idx) => idx !== i);
    const nextR = rows.map(r => r.filter((_, idx) => idx !== i));
    setHeaders(nextH);
    setRows(nextR);
    emit(nextH, nextR);
  }

  function addRow() {
    const nextR = [...rows, headers.map(() => "")];
    setRows(nextR);
    emit(headers, nextR);
  }

  function removeRow(i: number) {
    const nextR = rows.filter((_, idx) => idx !== i);
    setRows(nextR);
    emit(headers, nextR);
  }

  function updateHeader(i: number, val: string) {
    const next = [...headers];
    next[i] = val;
    setHeaders(next);
    emit(next, rows);
  }

  function updateCell(ri: number, ci: number, val: string) {
    const next = [...rows];
    next[ri] = [...next[ri]];
    next[ri][ci] = val;
    setRows(next);
    emit(headers, next);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 text-[#062e39] mb-2">
        <Table className="h-4 w-4 text-violet-500" />
        <span className="text-xs font-bold uppercase tracking-widest">Comparison Table</span>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-slate-200">
        <table className="w-full text-left border-collapse">
          <thead className="bg-slate-50">
            <tr>
              {headers.map((h, i) => (
                <th key={i} className="p-3 border-b border-slate-200 min-w-[120px]">
                  <div className="flex items-center gap-2">
                    <Input
                      value={h}
                      onChange={(e) => updateHeader(i, e.target.value)}
                      className="h-8 text-xs font-bold bg-white"
                    />
                    <button onClick={() => removeColumn(i)} className="text-slate-300 hover:text-red-500">
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                </th>
              ))}
              <th className="p-3 border-b border-slate-200 w-10">
                <button onClick={addColumn} className="h-8 w-8 flex items-center justify-center rounded-lg bg-white border border-slate-200 text-slate-400 hover:text-[#fd5523]">
                  <Plus className="h-4 w-4" />
                </button>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, ri) => (
              <tr key={ri}>
                {row.map((cell, ci) => (
                  <td key={ci} className="p-3 border-b border-slate-100">
                    <Input
                      value={cell}
                      onChange={(e) => updateCell(ri, ci, e.target.value)}
                      className="h-8 text-xs bg-white border-transparent focus:border-slate-200"
                    />
                  </td>
                ))}
                <td className="p-3 border-b border-slate-100">
                   <button onClick={() => removeRow(ri)} className="text-slate-300 hover:text-red-500">
                      <Trash2 className="h-3 w-3" />
                   </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Button
        onClick={addRow}
        variant="outline"
        size="sm"
        className="w-full border-dashed border-slate-300 text-slate-500 hover:border-[#fd5523] hover:text-[#fd5523]"
      >
        <Plus className="mr-2 h-4 w-4" />
        Add Row
      </Button>
    </div>
  );
}
