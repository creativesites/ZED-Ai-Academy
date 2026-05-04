"use client";

interface ComparisonTableProps {
  headers: string[];
  rows: string[][];
  caption?: string;
}

export function ComparisonTable({ headers, rows, caption }: ComparisonTableProps) {
  return (
    <div className="my-4 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm border-collapse">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              {headers.map((header, i) => (
                <th key={i} className="px-4 py-3 font-semibold text-slate-900 first:pl-6 last:pr-6">
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((row, i) => (
              <tr key={i} className="hover:bg-slate-50/50 transition-colors">
                {row.map((cell, j) => (
                  <td key={j} className="px-4 py-3 text-slate-600 first:pl-6 last:pr-6 first:font-medium first:text-slate-900">
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {caption && (
        <div className="border-t border-slate-100 bg-slate-50/50 px-4 py-2">
          <p className="text-[10px] text-slate-500 italic">{caption}</p>
        </div>
      )}
    </div>
  );
}
