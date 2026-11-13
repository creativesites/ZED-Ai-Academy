"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Check, Loader2, Sparkles, WandSparkles } from "lucide-react";

export type CourseBlueprintResponse = {
  title: string;
  description: string;
  category: string;
  level: "beginner" | "intermediate" | "advanced";
  price_type: "free" | "one_time" | "subscription_only" | "both";
  audience: string;
  quick_win: string;
  capstone: string;
  module_outline: string[];
};

export function CourseBlueprintAssistant({
  onApply,
}: {
  onApply: (blueprint: CourseBlueprintResponse) => void;
}) {
  const [brief, setBrief] = useState(
    "Build an AI course for professionals who want to save time on real work, not study theory."
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [blueprint, setBlueprint] = useState<CourseBlueprintResponse | null>(null);

  async function handleGenerate() {
    if (!brief.trim()) return;
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/ai/generate-course-blueprint", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ brief }),
      });

      if (!response.ok) {
        throw new Error("Unable to generate a course blueprint right now.");
      }

      const payload = (await response.json()) as CourseBlueprintResponse;
      setBlueprint(payload);
    } catch (err) {
      setBlueprint(null);
      setError(err instanceof Error ? err.message : "Failed to generate blueprint.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="rounded-2xl sm:rounded-3xl bg-gradient-to-br from-[#062e39] to-[#0b3f4d] p-5 sm:p-7 text-white shadow-lg border border-white/10">
      <div className="flex flex-col gap-6 lg:grid lg:grid-cols-[1.15fr_0.85fr] lg:items-start">
        <div className="space-y-4">
          <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-[#fd8d69]">
            <Sparkles className="h-3.5 w-3.5" />
            AI Course Architect
          </div>
          <div>
            <h2 className="text-xl sm:text-2xl font-bold tracking-tight">
              Draft a course blueprint from an idea
            </h2>
            <p className="mt-1.5 text-sm leading-relaxed text-white/75">
              Describe your target audience and the workflow you want to teach. Review the proposal and apply it to prefill your course form.
            </p>
          </div>

          <Textarea
            value={brief}
            onChange={(event) => setBrief(event.target.value)}
            rows={3}
            className="resize-none rounded-xl border-white/15 bg-white/10 p-3.5 text-sm font-medium text-white placeholder:text-white/40 focus:border-[#fd8d69] focus:ring-[#fd8d69]/20"
            placeholder="Example: AI course for law firms to speed up document review and summarize case files."
          />

          {error && (
            <p className="text-xs font-medium text-red-300 bg-red-500/15 border border-red-400/20 rounded-xl px-3 py-2">
              {error}
            </p>
          )}

          <div className="flex flex-wrap items-center gap-3">
            <Button
              type="button"
              onClick={handleGenerate}
              disabled={loading || !brief.trim()}
              className="h-10 rounded-xl bg-[#fd5523] px-5 text-xs sm:text-sm font-bold text-white shadow-md hover:bg-[#ef4a16] disabled:opacity-60"
            >
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <WandSparkles className="mr-2 h-4 w-4" />}
              {loading ? "Generating..." : "Generate Blueprint"}
            </Button>

            {blueprint && (
              <Button
                type="button"
                onClick={() => onApply(blueprint)}
                className="h-10 rounded-xl bg-white px-5 text-xs sm:text-sm font-bold text-[#062e39] hover:bg-slate-100"
              >
                <Check className="mr-1.5 h-4 w-4 text-emerald-600" />
                Apply to Form
              </Button>
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/5 p-4 sm:p-5">
          {blueprint ? (
            <div className="space-y-4">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-[#fd8d69]">
                  Proposed Course
                </p>
                <h3 className="mt-1 text-base sm:text-lg font-bold leading-snug">{blueprint.title}</h3>
                <p className="mt-1.5 text-xs leading-relaxed text-white/75 line-clamp-3">
                  {blueprint.description}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-2.5 text-xs">
                <div className="rounded-xl bg-white/5 p-3 border border-white/5">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-white/45">Audience</p>
                  <p className="mt-1 font-semibold text-white line-clamp-2">{blueprint.audience}</p>
                </div>
                <div className="rounded-xl bg-white/5 p-3 border border-white/5">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-white/45">Quick Win</p>
                  <p className="mt-1 font-semibold text-white line-clamp-2">{blueprint.quick_win}</p>
                </div>
              </div>

              {blueprint.module_outline.length > 0 && (
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-white/50 mb-2">
                    Module Outline
                  </p>
                  <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                    {blueprint.module_outline.map((item, i) => (
                      <div
                        key={item}
                        className="flex items-center gap-2.5 rounded-lg bg-white/5 px-3 py-2 text-xs font-medium text-white/90"
                      >
                        <span className="text-[#fd8d69] font-bold shrink-0">0{i + 1}</span>
                        <span className="truncate">{item}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-3 py-2">
              <p className="text-[10px] font-bold uppercase tracking-widest text-white/50">
                What You&apos;ll Get
              </p>
              <ul className="space-y-2.5">
                {[
                  "Conversion-focused course title & summary",
                  "Suggested category, level & pricing model",
                  "Target audience & quick-win framing",
                  "Practical module outline ready to build",
                ].map((text) => (
                  <li key={text} className="flex items-center gap-2.5 text-xs sm:text-sm text-white/80">
                    <span className="h-1.5 w-1.5 rounded-full bg-[#fd8d69] shrink-0" />
                    {text}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
