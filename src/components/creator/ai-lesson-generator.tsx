"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createContentBlock } from "@/actions/content-blocks";
import { Button } from "@/components/ui/button";
import { Loader2, Sparkles, Wand2 } from "lucide-react";
import { toast } from "sonner";
import type { ContentBlockType, Json } from "@/types/database";
import { COURSE_DOMAIN_PRESETS, type CourseDomainPresetId } from "@/lib/course-domain-presets";

type GeneratedBlock = { type: ContentBlockType; content: Json };

// Same shape as the block type used by the lesson editor.
export type CreatedContentBlock = {
  id: string;
  type: ContentBlockType;
  position: number;
  content: Json;
};

export function AILessonGenerator({
  lessonId,
  courseId,
  lessonTitle,
  onBlocksCreated,
}: {
  lessonId: string;
  courseId: string;
  lessonTitle: string;
  onBlocksCreated?: (blocks: CreatedContentBlock[]) => void;
}) {
  const router = useRouter();
  const [brief, setBrief] = useState("");
  const [generating, setGenerating] = useState(false);
  const [progress, setProgress] = useState("");
  const [domainPreset, setDomainPreset] = useState<CourseDomainPresetId>("ai-professional");
  const [showAdvanced, setShowAdvanced] = useState(false);

  const SUGGESTIONS = [
    { label: "💡 Focus on practice", text: "Focus on step-by-step practical implementation and hands-on exercises." },
    { label: "👶 Keep it simple", text: "Explain in simple language suitable for complete beginners, avoiding jargon." },
    { label: "🌍 Real-world examples", text: "Include relatable, real-world case studies and concrete examples." },
    { label: "🚀 Make it concise", text: "Keep paragraphs very short and focus on high-impact expert tips." },
  ];

  async function handleGenerate() {
    if (generating) return;
    setGenerating(true);
    setProgress("Analyzing curriculum objectives…");
    // Rows created so far; passed to the parent even if a later block fails.
    const created: CreatedContentBlock[] = [];
    let interval: ReturnType<typeof setInterval> | undefined;
    try {
      // Small simulated steps to make the AI feel responsive and magical
      const steps = [
        "Consulting curriculum guidelines…",
        "Structuring step-by-step instructions…",
        "Drafting professional content blocks…",
        "Adding callouts & learning objectives…",
        "Saving content blocks to your workspace…"
      ];

      let stepIdx = 0;
      interval = setInterval(() => {
        if (stepIdx < steps.length - 1) {
          setProgress(steps[stepIdx]);
          stepIdx++;
        }
      }, 3000);

      const res = await fetch("/api/ai/generate-lesson-content", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lessonId, courseId, brief, domainPreset }),
      });
      clearInterval(interval);
      interval = undefined;

      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || "Generation failed");

      const blocks: GeneratedBlock[] = data.blocks;
      setProgress(`Creating ${blocks.length} content blocks…`);

      for (let i = 0; i < blocks.length; i++) {
        const block = blocks[i];
        setProgress(`Adding ${block.type} section…`);
        const row = await createContentBlock(lessonId, courseId, block.type, block.content);
        created.push({
          id: row.id,
          type: row.type as ContentBlockType,
          position: row.position,
          content: row.content as Json,
        });
      }

      onBlocksCreated?.(created);
      toast.success("Lesson content generated successfully!");
      if (!onBlocksCreated) router.refresh();
      setProgress("");
      setGenerating(false);
    } catch (err) {
      // Keep whatever was saved before the failure.
      if (created.length > 0) onBlocksCreated?.(created);
      toast.error(err instanceof Error ? err.message : "Failed to generate content");
      setProgress("");
      setGenerating(false);
    } finally {
      if (interval) clearInterval(interval);
    }
  }

  return (
    <div className="rounded-[2.5rem] overflow-hidden border border-[#fd5523]/30 bg-gradient-to-br from-[#062e39] via-[#083b49] to-[#0c4a5c] text-white shadow-2xl p-6 sm:p-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
      
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-white/5 pb-5">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#fd5523] text-white shadow-lg shadow-[#fd5523]/25 animate-pulse">
            <Sparkles className="h-5 w-5" />
          </div>
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.25em] text-[#fd8d69]">AI Co-Author</p>
            <h3 className="text-lg font-bold leading-tight tracking-tight">Lesson Smart Creator</h3>
          </div>
        </div>
        <div className="rounded-full bg-white/5 border border-white/10 px-3.5 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-300 self-start sm:self-auto">
          Gemini 2.5 Enabled
        </div>
      </div>

      <div className="mt-5 space-y-5">
        <p className="text-xs leading-relaxed text-slate-300">
          Tell the AI what you want to teach, and it will draft a perfect set of content blocks: simple reading, step-by-step tasks, helpful callout boxes, and takeaways.
        </p>

        {/* Suggestion Chips */}
        <div className="space-y-2">
          <p className="text-[10px] font-bold uppercase tracking-widest text-[#fd8d69]">Suggestions</p>
          <div className="flex flex-wrap gap-2">
            {SUGGESTIONS.map((s) => (
              <button
                key={s.label}
                onClick={() => setBrief((prev) => prev ? `${prev}\n${s.text}` : s.text)}
                disabled={generating}
                className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-slate-200 transition-all hover:bg-[#fd5523]/10 hover:border-[#fd5523]/30 active:scale-95 disabled:opacity-50 disabled:pointer-events-none"
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>

        {/* Prompt Input Area */}
        <div className="space-y-2">
          <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Your Instructions</label>
          <textarea
            value={brief}
            onChange={(e) => setBrief(e.target.value)}
            placeholder={`e.g. Include a practical exercise on setting up an API call, and explain it like I'm 10...`}
            rows={3}
            disabled={generating}
            className="w-full resize-none rounded-2xl border border-white/15 bg-white/5 px-4 py-3 text-xs text-white placeholder:text-slate-400 focus:border-[#fd5523] focus:outline-none focus:ring-1 focus:ring-[#fd5523]/25 disabled:opacity-50 transition-all leading-relaxed"
          />
        </div>

        {/* Collapsible Advanced Options for Novices */}
        <div className="border-t border-white/5 pt-3">
          <button
            onClick={() => setShowAdvanced(!showAdvanced)}
            disabled={generating}
            className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-white transition-colors"
          >
            {showAdvanced ? "Hide options" : "Show options"}
            <span className="text-[8px]">{showAdvanced ? "▲" : "▼"}</span>
          </button>

          {showAdvanced && (
            <div className="mt-3 space-y-3 rounded-2xl border border-white/5 bg-black/20 p-4 animate-in fade-in slide-in-from-top-1 duration-150">
              <div className="space-y-1.5">
                <label className="text-[9px] font-bold uppercase tracking-widest text-slate-400">Class Audience Preset</label>
                <select
                  value={domainPreset}
                  onChange={(e) => setDomainPreset(e.target.value as CourseDomainPresetId)}
                  className="flex h-10 w-full rounded-xl border border-white/10 bg-[#083542] px-3 text-xs font-bold text-white outline-none focus:border-[#fd5523]"
                >
                  {COURSE_DOMAIN_PRESETS.map((preset) => (
                    <option key={preset.id} value={preset.id} className="bg-[#083542] text-white">
                      {preset.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}
        </div>

        {/* Action Button & Loading Feedback */}
        <div className="space-y-3 pt-2">
          {generating && progress && (
            <div className="flex items-center gap-3 rounded-2xl border border-[#fd8d69]/10 bg-[#fd8d69]/5 p-4 animate-pulse">
              <Loader2 className="h-4 w-4 animate-spin text-[#fd8d69]" />
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-bold uppercase tracking-widest text-[#fd8d69] leading-none mb-1">AI generating content</p>
                <p className="text-xs text-slate-300 truncate">{progress}</p>
              </div>
            </div>
          )}

          <Button
            onClick={handleGenerate}
            disabled={generating}
            className="w-full rounded-2xl bg-[#fd5523] py-6 text-sm font-bold text-white hover:bg-[#ef4a16] shadow-xl shadow-[#fd5523]/10 hover:shadow-[#fd5523]/20 hover:scale-[1.01] active:scale-[0.99] transition-all disabled:opacity-50"
          >
            {generating ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Drafting Lesson...
              </>
            ) : (
              <>
                <Sparkles className="mr-2 h-4 w-4" />
                Generate Complete Lesson
              </>
            )}
          </Button>
        </div>

      </div>
    </div>
  );
}
