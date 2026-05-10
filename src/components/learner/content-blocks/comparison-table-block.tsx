"use client";

import { ShieldCheck, X, Zap } from "lucide-react";

export function ComparisonTableBlock({ content }: { content: Record<string, unknown> }) {
  const title = content.title as string | undefined;
  const headers = (content.headers as string[]) ?? ["Feature", "Option A", "Option B"];
  const rows = (content.rows as { label: string; values: (string | boolean)[] }[]) ?? [];
  
  if (!rows.length) return null;
  
  return (
    <div className="space-y-6">
      {title && <h3 className="text-2xl font-bold text-[#062e39] tracking-tight">{title}</h3>}
      <div className="overflow-hidden rounded-[2.5rem] border border-slate-100 bg-white shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[#062e39] text-white">
                {headers.map((h, i) => (
                  <th key={i} className="px-6 py-5 text-sm font-black uppercase tracking-widest first:rounded-tl-[2.5rem] last:rounded-tr-[2.5rem]">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((row, i) => (
                <tr key={i} className="hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-5 text-sm font-bold text-[#062e39] bg-slate-50/50">{row.label}</td>
                  {Array.isArray(row.values) && row.values.map((v, j) => (
                    <td key={j} className="px-6 py-5 text-sm">
                      {typeof v === "boolean" ? (
                        v ? <ShieldCheck className="h-5 w-5 text-emerald-500" /> : <X className="h-5 w-5 text-slate-300" />
                      ) : (
                        <span className="flex items-center gap-2 font-medium text-slate-600">
                          {v.toString().toLowerCase().includes("best") && <Zap className="h-4 w-4 text-[#fd5523]" />}
                          {v}
                        </span>
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
