"use client";

import { ShieldAlert } from "lucide-react";

export function RiskAssessmentBlock({ content }: { content: Record<string, unknown> }) {
  const title = (content.title as string) || "Risk Assessment";
  const rows = Array.isArray(content.rows)
    ? (content.rows as { hazard?: string; risk?: string; control?: string }[]).filter(
        (row) => row.hazard || row.control
      )
    : [];

  if (!rows.length) return null;

  const getRiskClasses = (risk: string | undefined) => {
    switch ((risk || "").toLowerCase()) {
      case "critical":
        return "bg-red-100 text-red-700";
      case "high":
        return "bg-orange-100 text-orange-700";
      case "medium":
        return "bg-amber-100 text-amber-700";
      default:
        return "bg-emerald-100 text-emerald-700";
    }
  };

  return (
    <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
      <div className="mb-5 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-red-50 text-red-600">
          <ShieldAlert className="h-5 w-5" />
        </div>
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.22em] text-red-600">Safety & Compliance</p>
          <h3 className="text-2xl font-bold tracking-tight text-[#062e39]">{title}</h3>
        </div>
      </div>

      <div className="space-y-3">
        {rows.map((row, index) => (
          <div key={`${row.hazard}-${index}`} className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <p className="text-base font-bold text-[#062e39]">{row.hazard || "Hazard"}</p>
              <span className={`rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] ${getRiskClasses(row.risk)}`}>
                {row.risk || "Low"}
              </span>
            </div>
            <p className="text-sm leading-relaxed text-slate-600">
              <span className="font-semibold text-slate-700">Control:</span> {row.control || "Control measure"}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
