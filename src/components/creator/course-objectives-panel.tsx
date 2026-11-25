"use client";

import { useState, useTransition } from "react";
import { Loader2, Pencil, RotateCcw, Target, Archive, Check, X } from "lucide-react";
import { toast } from "sonner";
import {
  listCourseObjectivesAction,
  updateCourseObjectiveAction,
} from "@/actions/tutor-objectives";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { RegisteredObjective } from "@/lib/tutor/learner/objectives";

/**
 * Studio "Course objectives" review list (P2-01). Objectives land here when a lesson flow is saved from the
 * lesson AI teacher panel or created by Autopilot ("accept all"); authors fix wording inline or retire
 * objectives that should not be tracked. Loads on demand so the course page stays fast.
 */
export function CourseObjectivesPanel({ courseId }: { courseId: string }) {
  const [open, setOpen] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [available, setAvailable] = useState(true);
  const [objectives, setObjectives] = useState<RegisteredObjective[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [loading, startLoading] = useTransition();
  const [saving, startSaving] = useTransition();

  function load() {
    startLoading(async () => {
      try {
        const res = await listCourseObjectivesAction(courseId);
        setAvailable(res.available);
        setObjectives(res.objectives);
        setLoaded(true);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Could not load objectives");
      }
    });
  }

  function toggle() {
    const next = !open;
    setOpen(next);
    if (next && !loaded) load();
  }

  function save(id: string, patch: { text?: string; status?: "active" | "retired" }) {
    startSaving(async () => {
      try {
        const res = await updateCourseObjectiveAction({ courseId, id, ...patch });
        if (!res.available || !res.objective) {
          toast.error("Objective registry is not available yet.");
          return;
        }
        const updated = res.objective;
        setObjectives((prev) => prev.map((o) => (o.id === id ? updated : o)));
        setEditingId(null);
        toast.success("Objective updated");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Could not update objective");
      }
    });
  }

  const active = objectives.filter((o) => o.status !== "retired");
  const retired = objectives.filter((o) => o.status === "retired");

  return (
    <div className="rounded-3xl border border-slate-200/80 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="flex items-center gap-2 text-base font-bold text-ink">
            <Target className="h-4 w-4" /> Course objectives
          </h3>
          <p className="text-xs text-slate-500">
            What the AI teacher tracks for each learner. Saved automatically from lesson flows and Autopilot; edit or
            retire them here.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={toggle}
          className="h-9 rounded-xl text-xs font-bold text-ink"
        >
          {open ? "Hide objectives" : "Review objectives"}
        </Button>
      </div>

      {open && (
        <div className="mt-5 border-t border-slate-100 pt-5">
          {loading && !loaded ? (
            <p className="flex items-center gap-2 text-xs text-slate-500">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading objectives…
            </p>
          ) : !available ? (
            <p className="text-xs text-slate-500">
              The objective registry is not enabled on this environment yet. Flows keep working as before.
            </p>
          ) : objectives.length === 0 ? (
            <p className="text-xs text-slate-500">
              No objectives yet. Draft a flow from a lesson (AI teacher panel) or run Autopilot to add them.
            </p>
          ) : (
            <ul className="space-y-2">
              {[...active, ...retired].map((o) => (
                <li
                  key={o.id}
                  className={`rounded-2xl border p-3 ${o.status === "retired" ? "border-slate-100 bg-slate-50 opacity-70" : "border-slate-200"}`}
                >
                  <div className="flex items-start gap-3">
                    <span className="mt-0.5 shrink-0 rounded-md bg-ink/10 px-1.5 py-0.5 font-mono text-[11px] font-bold text-ink">
                      {o.code}
                    </span>
                    <div className="min-w-0 flex-1">
                      {editingId === o.id ? (
                        <div className="space-y-2">
                          <Textarea
                            value={draft}
                            onChange={(e) => setDraft(e.target.value)}
                            rows={2}
                            maxLength={500}
                            className="resize-none text-sm"
                          />
                          <div className="flex gap-2">
                            <Button
                              type="button"
                              size="sm"
                              disabled={saving || draft.trim().length < 3}
                              onClick={() => save(o.id, { text: draft })}
                              className="h-8 rounded-lg text-xs"
                            >
                              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                              Save
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              onClick={() => setEditingId(null)}
                              className="h-8 rounded-lg text-xs"
                            >
                              <X className="h-3.5 w-3.5" /> Cancel
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <p className="text-sm text-slate-800">{o.text}</p>
                          {o.evidenceCriteria && (
                            <p className="mt-0.5 text-xs text-slate-500">Evidence: {o.evidenceCriteria}</p>
                          )}
                        </>
                      )}
                    </div>
                    {editingId !== o.id && (
                      <div className="flex shrink-0 gap-1">
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          aria-label="Edit objective"
                          onClick={() => {
                            setEditingId(o.id);
                            setDraft(o.text);
                          }}
                          className="h-8 w-8 rounded-lg p-0"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          disabled={saving}
                          aria-label={o.status === "retired" ? "Restore objective" : "Retire objective"}
                          onClick={() => save(o.id, { status: o.status === "retired" ? "active" : "retired" })}
                          className="h-8 w-8 rounded-lg p-0"
                        >
                          {o.status === "retired" ? <RotateCcw className="h-3.5 w-3.5" /> : <Archive className="h-3.5 w-3.5" />}
                        </Button>
                      </div>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
