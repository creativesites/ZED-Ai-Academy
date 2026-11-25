"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { getCourseVivaRubric, updateCourseVivaRubric } from "@/actions/viva-reviews";

type Fields = {
  minMetShare: number;
  minTaskScore: number;
  minMasteryShare: number;
  requireHumanApproval: boolean;
  allowAppeal: boolean;
};

/** P2-08: minimal per-course oral check rubric editor (shown under the viva gate in the course AI tab). */
export function VivaRubricEditor({ courseId, reviewsHref }: { courseId: string; reviewsHref?: string | null }) {
  const [available, setAvailable] = useState<boolean | null>(null);
  const [fields, setFields] = useState<Fields | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;
    getCourseVivaRubric(courseId)
      .then((res) => {
        if (!active) return;
        setAvailable(res.available);
        setFields({
          minMetShare: res.rubric.minMetShare,
          minTaskScore: res.rubric.minTaskScore,
          minMasteryShare: res.rubric.minMasteryShare,
          requireHumanApproval: res.rubric.requireHumanApproval,
          allowAppeal: res.rubric.allowAppeal,
        });
      })
      .catch(() => {
        if (active) setAvailable(false);
      });
    return () => {
      active = false;
    };
  }, [courseId]);

  async function save() {
    if (!fields) return;
    setSaving(true);
    try {
      const res = await updateCourseVivaRubric({ courseId, rubric: fields });
      setAvailable(res.available);
      if (res.available) toast.success("Oral check rubric saved");
      else toast.info("Apply migration 20261125000501 to save a rubric.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save the rubric");
    } finally {
      setSaving(false);
    }
  }

  if (available === null || !fields) return null;

  const pctInput = (key: "minMetShare" | "minMasteryShare", label: string, hint: string) => (
    <label className="flex flex-col gap-1 text-[11px] font-semibold text-ink">
      {label}
      <span className="flex items-center gap-1">
        <input
          type="number"
          min={key === "minMetShare" ? 10 : 0}
          max={100}
          step={5}
          value={Math.round(fields[key] * 100)}
          disabled={!available || saving}
          onChange={(e) => {
            const v = Number(e.target.value);
            if (Number.isFinite(v)) setFields({ ...fields, [key]: Math.max(0, Math.min(100, v)) / 100 });
          }}
          className="h-8 w-20 rounded-lg border border-slate-200 px-2 text-xs"
        />
        <span className="text-slate-500">%</span>
      </span>
      <span className="font-normal text-slate-500">{hint}</span>
    </label>
  );

  return (
    <div className="space-y-3 rounded-2xl border border-slate-200 p-3">
      <p className="text-xs font-bold text-ink">How the oral check is decided</p>
      {!available && (
        <p className="rounded-lg bg-amber-50 px-2 py-1.5 text-[11px] text-amber-800">
          Rubric settings need database update 20261125000501. Until then the standard rule applies.
        </p>
      )}
      <div className="grid gap-3 sm:grid-cols-3">
        {pctInput("minMetShare", "Checks met to pass", "Share of oral check questions answered well.")}
        <label className="flex flex-col gap-1 text-[11px] font-semibold text-ink">
          Score to pass (no checks)
          <input
            type="number"
            min={1}
            max={100}
            value={fields.minTaskScore}
            disabled={!available || saving}
            onChange={(e) => {
              const v = Math.round(Number(e.target.value));
              if (Number.isFinite(v)) setFields({ ...fields, minTaskScore: Math.max(1, Math.min(100, v)) });
            }}
            className="h-8 w-20 rounded-lg border border-slate-200 px-2 text-xs"
          />
          <span className="font-normal text-slate-500">Used when the session recorded no checks.</span>
        </label>
        {pctInput("minMasteryShare", "Course objectives practised", "0 turns this off. Below it, a pass goes to a teacher.")}
      </div>
      <label className="flex items-center gap-2 text-[11px] font-semibold text-ink">
        <input
          type="checkbox"
          checked={fields.requireHumanApproval}
          disabled={!available || saving}
          onChange={(e) => setFields({ ...fields, requireHumanApproval: e.target.checked })}
          className="h-4 w-4 accent-brand"
        />
        A teacher confirms every pass
      </label>
      <label className="flex items-center gap-2 text-[11px] font-semibold text-ink">
        <input
          type="checkbox"
          checked={fields.allowAppeal}
          disabled={!available || saving}
          onChange={(e) => setFields({ ...fields, allowAppeal: e.target.checked })}
          className="h-4 w-4 accent-brand"
        />
        Learners can ask for a teacher review once
      </label>
      <div className="flex flex-wrap items-center gap-3">
        <Button type="button" size="sm" disabled={!available || saving} onClick={() => void save()} className="rounded-xl text-xs">
          Save rubric
        </Button>
        {reviewsHref && (
          <a href={reviewsHref} className="text-xs font-semibold text-ink underline">
            Open reviews
          </a>
        )}
      </div>
    </div>
  );
}
