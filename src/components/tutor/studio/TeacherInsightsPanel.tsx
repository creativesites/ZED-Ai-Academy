"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { AlertTriangle, BarChart3, CheckCircle2, Clock, ExternalLink, Loader2, RefreshCw, Sparkles, Users } from "lucide-react";
import { createFixItFlowFromMisconception } from "@/actions/tutor-authoring";
import type { TenantInsightsSummary } from "@/lib/tutor/insights/misconceptions";
import { Button } from "@/components/ui/button";

export function TeacherInsightsPanel({
  companyId,
  courseId,
}: {
  companyId: string;
  courseId?: string;
}) {
  const [summary, setSummary] = useState<TenantInsightsSummary | null>(null);
  const [masteryAvailable, setMasteryAvailable] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [creatingKey, setCreatingKey] = useState<string | null>(null);
  const [createdFlows, setCreatedFlows] = useState<Record<string, { id: string; title: string }>>({});

  async function handleCreateFixIt(item: TenantInsightsSummary["topMisconceptions"][number]) {
    if (creatingKey) return;
    setCreatingKey(item.objectiveKey);
    try {
      const created = await createFixItFlowFromMisconception({
        companyId,
        courseId: courseId ?? null,
        objectiveText: item.objectiveText,
        sampleDetails: item.sampleDetails,
        misconceptionCount: item.misconceptionCount,
        partialCount: item.partialCount,
      });
      setCreatedFlows((prev) => ({ ...prev, [item.objectiveKey]: created }));
      toast.success(`Published "${created.title}"`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not create Fix-It flow");
    } finally {
      setCreatingKey(null);
    }
  }

  const fetchInsights = useCallback(async () => {
    const params = new URLSearchParams({ companyId });
    if (courseId) params.set("courseId", courseId);
    const res = await fetch(`/api/tutor/insights?${params.toString()}`, {
      credentials: "same-origin",
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      throw new Error(data?.error ?? "Could not load insights");
    }
    return data as { summary: TenantInsightsSummary; masteryAvailable: boolean };
  }, [companyId, courseId]);

  useEffect(() => {
    let active = true;
    fetchInsights()
      .then((data) => {
        if (!active) return;
        setSummary(data.summary);
        setMasteryAvailable(Boolean(data.masteryAvailable));
        setError(null);
        setLoading(false);
      })
      .catch((err) => {
        if (!active) return;
        setError(err instanceof Error ? err.message : "Could not load insights");
        setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [fetchInsights]);

  async function handleRefresh() {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchInsights();
      setSummary(data.summary);
      setMasteryAvailable(Boolean(data.masteryAvailable));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load insights");
    } finally {
      setLoading(false);
    }
  }

  if (loading && !summary) {
    return (
      <div className="flex items-center justify-center rounded-3xl border border-slate-200 bg-white p-12 text-xs text-slate-500">
        <Loader2 className="mr-2 h-4 w-4 animate-spin text-brand-text" />
        Loading learner mastery &amp; misconceptions...
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-3xl border border-red-200 bg-red-50/70 p-6 text-sm text-red-700">
        {error}
      </div>
    );
  }

  if (!summary) return null;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div>
          <h2 className="text-base font-bold text-ink">
            Insights &amp; Misconceptions
          </h2>
          <p className="text-xs text-slate-500">
            Where learners hesitate, recurring misconceptions flagged by AI teachers, and mastery progress across flows.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={loading}
          onClick={() => void handleRefresh()}
          className="h-9 rounded-xl text-xs font-bold"
        >
          {loading ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="mr-1.5 h-3.5 w-3.5" />}
          Refresh
        </Button>
      </div>

      {!masteryAvailable && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50/70 p-4 text-xs text-amber-900">
          Objective mastery tables (<code className="font-mono">learner_mastery</code> / <code className="font-mono">learner_evidence</code>) are not applied to this database yet. Apply the Phase 2 migration to populate objective-level misconceptions.
        </div>
      )}

      {/* Top stats */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-500">
            <BarChart3 className="h-4 w-4 text-brand-text" />
            Sessions run
          </div>
          <p className="mt-2 text-2xl font-black text-ink">{summary.totalSessions}</p>
          <p className="mt-0.5 text-[11px] text-slate-400">
            {summary.completedSessions} completed ({summary.completionRatePct}%)
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-500">
            <Users className="h-4 w-4 text-emerald-600" />
            Active learners
          </div>
          <p className="mt-2 text-2xl font-black text-ink">{summary.uniqueLearners}</p>
          <p className="mt-0.5 text-[11px] text-slate-400">
            Across {summary.trackedObjectives} tracked objectives
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-500">
            <Clock className="h-4 w-4 text-sky-600" />
            Speaking time
          </div>
          <p className="mt-2 text-2xl font-black text-ink">{summary.totalSpeakingMinutes} min</p>
          <p className="mt-0.5 text-[11px] text-slate-400">Combined teacher &amp; learner turns</p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-500">
            <AlertTriangle className="h-4 w-4 text-amber-600" />
            Misconception clusters
          </div>
          <p className="mt-2 text-2xl font-black text-ink">{summary.topMisconceptions.length}</p>
          <p className="mt-0.5 text-[11px] text-slate-400">Objectives needing clarification</p>
        </div>
      </div>

      {/* Top Misconceptions */}
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-3 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-ink">
              Top Recurring Misconceptions
            </h3>
            <span className="text-[11px] font-semibold text-slate-400">
              Ranked by frequency
            </span>
          </div>

          {summary.topMisconceptions.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-200 p-6 text-center text-xs text-slate-400">
              No misconceptions recorded yet. As learners complete AI Teacher sessions, common stumbling blocks will appear here.
            </div>
          ) : (
            <ul className="space-y-3">
              {summary.topMisconceptions.map((item) => (
                <li
                  key={item.objectiveKey}
                  className="rounded-2xl border border-slate-200/80 bg-slate-50/70 p-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <p className="text-sm font-bold text-ink">{item.objectiveText}</p>
                    <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase">
                      {item.misconceptionCount > 0 && (
                        <span className="rounded-full bg-rose-50 px-2 py-0.5 text-rose-700">
                          {item.misconceptionCount} misconceptions
                        </span>
                      )}
                      {item.partialCount > 0 && (
                        <span className="rounded-full bg-amber-50 px-2 py-0.5 text-amber-700">
                          {item.partialCount} partial
                        </span>
                      )}
                    </div>
                  </div>
                  <p className="mt-1 text-[11px] text-slate-500">
                    Seen across {item.learnerCount} {item.learnerCount === 1 ? "learner" : "learners"} · Avg mastery {item.avgMasteryLevel}/3
                  </p>
                  {item.sampleDetails.length > 0 && (
                    <ul className="mt-2.5 space-y-1 border-t border-slate-200/70 pt-2 text-xs text-slate-600">
                      {item.sampleDetails.map((detail, i) => (
                        <li key={i} className="flex items-start gap-1.5">
                          <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-brand" />
                          <span>{detail}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                  <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-slate-200/60 pt-2.5">
                    {createdFlows[item.objectiveKey] ? (
                      <Link
                        href={`/practice/${createdFlows[item.objectiveKey].id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-[11px] font-bold text-emerald-800 transition hover:bg-emerald-100"
                      >
                        <ExternalLink className="h-3 w-3" />
                        Open Fix-It Flow →
                      </Link>
                    ) : (
                      <button
                        type="button"
                        disabled={creatingKey !== null}
                        onClick={() => void handleCreateFixIt(item)}
                        className="inline-flex items-center gap-1.5 rounded-full border border-brand/30 bg-brand-tint px-3 py-1 text-[11px] font-bold text-brand-hover transition hover:bg-[#ffe5d4] disabled:opacity-50"
                      >
                        {creatingKey === item.objectiveKey ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <Sparkles className="h-3 w-3" />
                        )}
                        {creatingKey === item.objectiveKey ? "Creating..." : "Create 3-min Fix-It Flow"}
                      </button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Objective Mastery Breakdown */}
        <div className="space-y-3 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-ink">
              Objective Mastery Breakdown
            </h3>
            <span className="text-[11px] font-semibold text-slate-400">
              Weakest first
            </span>
          </div>

          {summary.objectives.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-200 p-6 text-center text-xs text-slate-400">
              No objective mastery records yet.
            </div>
          ) : (
            <ul className="space-y-3">
              {summary.objectives.map((obj) => {
                const pct = Math.min(100, Math.round((obj.avgLevel / 3) * 100));
                return (
                  <li
                    key={obj.objectiveKey}
                    className="rounded-2xl border border-slate-100 bg-slate-50/70 p-3.5"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-xs font-bold text-ink">{obj.objectiveText}</p>
                      <span className="shrink-0 text-[11px] font-bold text-slate-600 tabular-nums">
                        {obj.avgLevel}/3
                      </span>
                    </div>
                    <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-200">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-brand to-emerald-600"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <div className="mt-2 flex flex-wrap gap-3 text-[11px] text-slate-500">
                      <span className="inline-flex items-center gap-1 text-emerald-700">
                        <CheckCircle2 className="h-3 w-3" /> {obj.metCount} solid
                      </span>
                      <span>{obj.developingCount} developing</span>
                      <span className="text-rose-600">{obj.reviewCount} needs review</span>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
