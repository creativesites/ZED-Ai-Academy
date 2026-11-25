"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { History, Loader2, RotateCcw } from "lucide-react";
import { listScenarioVersions, restoreScenarioVersion, type ScenarioRecord } from "@/actions/tutor-authoring";
import type { ScenarioVersionSummary } from "@/lib/tutor/authoring/versions";
import { Button } from "@/components/ui/button";

// Versions of a saved flow (P1-04). Loads on demand; hidden when versioning is not available yet.
// Restoring publishes the old content as a new version; sessions already running keep the version they pinned.

export function FlowVersionsPanel({
  scenarioId,
  onRestored,
}: {
  scenarioId: string;
  onRestored: (saved: ScenarioRecord) => void;
}) {
  const [state, setState] = useState<
    | { status: "idle" }
    | { status: "unavailable" }
    | { status: "loaded"; publishedVersion: number | null; versions: ScenarioVersionSummary[] }
  >({ status: "idle" });
  const [isLoading, startLoading] = useTransition();
  const [restoring, setRestoring] = useState<number | null>(null);

  function load() {
    startLoading(async () => {
      try {
        const res = await listScenarioVersions(scenarioId);
        setState(
          res.available
            ? { status: "loaded", publishedVersion: res.publishedVersion, versions: res.versions }
            : { status: "unavailable" },
        );
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Could not load versions");
      }
    });
  }

  async function restore(version: number) {
    setRestoring(version);
    try {
      const saved = await restoreScenarioVersion(scenarioId, version);
      toast.success(`Restored v${version} as a new version.`);
      onRestored(saved);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not restore that version");
    } finally {
      setRestoring(null);
    }
  }

  if (state.status === "unavailable") return null;

  return (
    <div className="space-y-2 rounded-xl border border-slate-100 bg-slate-50/60 p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-500">
          <History className="h-3.5 w-3.5" />
          Versions
        </p>
        {state.status === "idle" && (
          <Button type="button" variant="outline" size="sm" disabled={isLoading} onClick={load} className="h-8 rounded-lg text-xs">
            {isLoading && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
            Show versions
          </Button>
        )}
      </div>
      {state.status === "loaded" && (
        state.versions.length === 0 ? (
          <p className="text-xs text-slate-500">No versions yet. Saving this flow creates v1.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {state.versions.map((v) => {
              const isPublished = v.version === state.publishedVersion;
              return (
                <li key={v.version} className="flex min-h-11 items-center justify-between gap-3 py-1.5 text-xs">
                  <div className="min-w-0">
                    <p className="font-bold text-ink">
                      v{v.version}
                      {isPublished && (
                        <span className="ml-1.5 rounded-full bg-emerald-50 px-1.5 py-0.5 text-[10px] font-bold text-emerald-700">
                          Live
                        </span>
                      )}
                      <span className="ml-1.5 font-normal text-slate-600">{v.title}</span>
                    </p>
                    <p className="truncate text-slate-400">
                      {v.createdAt ? new Date(v.createdAt).toLocaleString() : ""}
                      {v.note ? ` · ${v.note}` : ""}
                    </p>
                  </div>
                  {!isPublished && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={restoring !== null}
                      onClick={() => void restore(v.version)}
                      className="h-8 shrink-0 rounded-lg text-xs"
                    >
                      {restoring === v.version ? (
                        <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <RotateCcw className="mr-1 h-3.5 w-3.5" />
                      )}
                      Restore
                    </Button>
                  )}
                </li>
              );
            })}
          </ul>
        )
      )}
      <p className="text-[11px] text-slate-400">Sessions already running keep the version they started with.</p>
    </div>
  );
}
