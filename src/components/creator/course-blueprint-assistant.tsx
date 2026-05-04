"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Sparkles, WandSparkles } from "lucide-react";

type BlueprintResponse = {
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
  onApply: (blueprint: BlueprintResponse) => void;
}) {
  const [brief, setBrief] = useState(
    "Build an AI course for professionals who want to save time on real work, not study theory."
  );
  const [loading, setLoading] = useState(false);
  const [blueprint, setBlueprint] = useState<BlueprintResponse | null>(null);

  async function handleGenerate() {
    if (!brief.trim()) return;
    setLoading(true);

    try {
      const response = await fetch("/api/ai/generate-course-blueprint", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ brief }),
      });

      if (!response.ok) {
        throw new Error("Unable to generate a course blueprint right now.");
      }

      const payload = (await response.json()) as BlueprintResponse;
      setBlueprint(payload);
    } catch {
      setBlueprint(null);
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="marketing-shell mesh-orange noise overflow-hidden rounded-[2.5rem] border-0 p-8 text-white shadow-2xl">
      <div className="relative z-10 flex flex-wrap items-start justify-between gap-6">
        <div className="max-w-2xl">
          <div className="marketing-kicker bg-white/10 text-white">
            <Sparkles className="mr-2 h-3.5 w-3.5" />
            AI Course Architect
          </div>
          <h2 className="mt-6 text-3xl font-bold tracking-tight">
            Generate a professional-first <br />
            course blueprint
          </h2>
          <p className="mt-4 text-lg leading-relaxed text-white/80">
            Describe the audience, business problem, or workflow you want to transform. The assistant will propose a title, learning angle, pricing posture, and a practical module arc.
          </p>
        </div>
      </div>

      <div className="relative z-10 mt-8 grid gap-8 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="space-y-4">
          <Textarea
            value={brief}
            onChange={(event) => setBrief(event.target.value)}
            rows={6}
            className="resize-none rounded-[2rem] border-white/10 bg-white/10 p-6 text-lg font-medium text-white placeholder:text-white/30 focus:border-[#fd8d69] focus:ring-[#fd8d69]/10"
            placeholder="Example: AI course for law firms to speed up document review, summarize case files, and reduce admin time."
          />
          <div className="flex flex-wrap gap-4">
            <Button
              type="button"
              onClick={handleGenerate}
              disabled={loading}
              className="rounded-full bg-white px-8 py-6 text-lg font-bold text-[#062e39] shadow-xl transition-all hover:bg-white/90 hover:scale-105 active:scale-95"
            >
              {loading ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <WandSparkles className="mr-2 h-5 w-5" />}
              Generate Blueprint
            </Button>
            {blueprint ? (
              <Button
                type="button"
                onClick={() => onApply(blueprint)}
                className="rounded-full border-2 border-white/20 bg-transparent px-8 py-6 text-lg font-bold text-white transition-all hover:bg-white/10"
              >
                Apply to Form
              </Button>
            ) : null}
          </div>
        </div>

        <div className="rounded-[2.5rem] border border-white/10 bg-white/10 p-8 backdrop-blur-xl">
          {blueprint ? (
            <div className="space-y-6">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-white/50">Suggested Identity</p>
                <h3 className="mt-3 text-2xl font-bold tracking-tight">{blueprint.title}</h3>
                <p className="mt-3 text-base leading-relaxed text-white/70">{blueprint.description}</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="rounded-2xl bg-white/5 p-4 border border-white/5">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-white/40">Ideal Audience</p>
                  <p className="mt-2 font-bold text-white">{blueprint.audience}</p>
                </div>
                <div className="rounded-2xl bg-white/5 p-4 border border-white/5">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-white/40">First Quick Win</p>
                  <p className="mt-2 font-bold text-white">{blueprint.quick_win}</p>
                </div>
              </div>

              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-white/50">Core Curriculum Arc</p>
                <div className="mt-4 space-y-2">
                  {blueprint.module_outline.map((item, i) => (
                    <div key={item} className="flex items-center gap-3 rounded-2xl bg-white/5 px-4 py-3 text-sm font-bold text-white border border-white/5">
                      <span className="text-[#fd8d69] opacity-60">0{i+1}</span>
                      {item}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="flex h-full min-h-64 flex-col justify-center">
              <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-white/50">Intelligence Output</p>
              <ul className="mt-6 space-y-4">
                {[
                  "Title tuned for high professional conversion",
                  "Pricing and category posture recommendation",
                  "Quick-win opener & capstone project angle",
                  "A curriculum arc built around practical ROI"
                ].map((text) => (
                  <li key={text} className="flex items-center gap-3 text-base font-medium text-white/70">
                    <div className="h-2 w-2 rounded-full bg-[#fd8d69]" />
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
