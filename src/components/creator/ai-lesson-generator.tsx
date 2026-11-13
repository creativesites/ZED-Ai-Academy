"use client";

import { useState } from "react";
import { createContentBlocksBatch } from "@/actions/content-blocks";
import { Button } from "@/components/ui/button";
import {
  Check,
  Loader2,
  RotateCcw,
  Sparkles,
  Trash2,
  Wand2,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { ContentBlockType, Json } from "@/types/database";
import { COURSE_DOMAIN_PRESETS, type CourseDomainPresetId } from "@/lib/course-domain-presets";

type GeneratedBlock = { type: ContentBlockType; content: Json };

export type SavedBlock = {
  id: string;
  type: ContentBlockType;
  position: number;
  content: Json;
};

type CoAuthorMode = "full_lesson" | "practice_steps" | "summary_recap";

const MODES: { id: CoAuthorMode; label: string; hint: string }[] = [
  { id: "full_lesson", label: "Full Lesson", hint: "5–7 structured blocks" },
  { id: "practice_steps", label: "Practice & Steps", hint: "Hands-on activities" },
  { id: "summary_recap", label: "Recap", hint: "Takeaways & checklist" },
];

const SUGGESTIONS = [
  { label: "Hands-on", text: "Focus on step-by-step practical implementation and hands-on exercises." },
  { label: "Beginner-friendly", text: "Explain in simple language suitable for complete beginners, avoiding jargon." },
  { label: "Real examples", text: "Include relatable, real-world case studies and concrete examples." },
  { label: "Concise", text: "Keep paragraphs very short and focus on high-impact takeaways." },
];

function summarizeGeneratedBlock(block: GeneratedBlock): string {
  const c = (block.content ?? {}) as Record<string, unknown>;
  if (typeof c.title === "string" && c.title.trim()) return c.title;
  if (typeof c.name === "string" && c.name.trim()) return c.name;
  if (typeof c.html === "string") {
    return c.html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 90);
  }
  if (typeof c.caption === "string" && c.caption.trim()) return c.caption;
  if (typeof c.prompt === "string" && c.prompt.trim()) return c.prompt.slice(0, 90);
  return "Generated content block";
}

function formatBlockTypeLabel(type: string): string {
  return type.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export function AILessonGenerator({
  lessonId,
  courseId,
  lessonTitle,
  existingBlockTypes = [],
  onBlocksGenerated,
}: {
  lessonId: string;
  courseId: string;
  lessonTitle: string;
  existingBlockTypes?: ContentBlockType[];
  onBlocksGenerated?: (newBlocks: SavedBlock[]) => void;
}) {
  const [mode, setMode] = useState<CoAuthorMode>("full_lesson");
  const [brief, setBrief] = useState("");
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [progress, setProgress] = useState("");
  const [domainPreset, setDomainPreset] = useState<CourseDomainPresetId>("ai-professional");
  const [showOptions, setShowOptions] = useState(false);

  // Staged blocks for review before inserting into the lesson
  const [stagedBlocks, setStagedBlocks] = useState<GeneratedBlock[] | null>(null);
  const [selectedIndices, setSelectedIndices] = useState<number[]>([]);

  async function handleGenerate() {
    if (generating || saving) return;
    setGenerating(true);
    setStagedBlocks(null);
    setProgress("Analyzing lesson context…");

    const steps = [
      "Structuring learning flow…",
      "Drafting lesson blocks…",
      "Preparing review preview…",
    ];
    let stepIdx = 0;
    const interval = setInterval(() => {
      if (stepIdx < steps.length) {
        setProgress(steps[stepIdx]);
        stepIdx++;
      }
    }, 2500);

    try {
      const res = await fetch("/api/ai/generate-lesson-content", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lessonId,
          courseId,
          brief,
          domainPreset,
          mode,
          existingBlockTypes,
        }),
      });
      clearInterval(interval);

      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.error || "Generation failed");
      }

      const blocks = (data.blocks ?? []) as GeneratedBlock[];
      setStagedBlocks(blocks);
      setSelectedIndices(blocks.map((_, i) => i));
      toast.success(`Drafted ${blocks.length} blocks — review below before inserting.`);
    } catch (err) {
      clearInterval(interval);
      toast.error(err instanceof Error ? err.message : "Failed to generate content");
    } finally {
      setProgress("");
      setGenerating(false);
    }
  }

  function toggleIndex(idx: number) {
    setSelectedIndices((prev) =>
      prev.includes(idx) ? prev.filter((i) => i !== idx) : [...prev, idx].sort((a, b) => a - b)
    );
  }

  async function handleInsertSelected() {
    if (!stagedBlocks || selectedIndices.length === 0 || saving) return;
    setSaving(true);
    try {
      const chosen = selectedIndices.map((i) => stagedBlocks[i]).filter(Boolean);
      const created = await createContentBlocksBatch(lessonId, courseId, chosen);

      toast.success(`Added ${created.length} block${created.length !== 1 ? "s" : ""} to "${lessonTitle || "lesson"}"`);
      if (onBlocksGenerated && created.length > 0) {
        onBlocksGenerated(
          created.map((b) => ({
            id: b.id,
            type: b.type as ContentBlockType,
            position: b.position,
            content: b.content as Json,
          }))
        );
      }
      setStagedBlocks(null);
      setSelectedIndices([]);
      setBrief("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to insert blocks");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-2xl sm:rounded-3xl overflow-hidden border border-[#062e39]/15 bg-gradient-to-br from-[#062e39] via-[#083b49] to-[#0c4a5c] text-white shadow-lg p-5 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 border-b border-white/10 pb-4">
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#fd5523] text-white shadow-sm">
            <Sparkles className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#fd8d69]">
              AI Co-Author
            </p>
            <h3 className="text-base font-bold leading-tight truncate">
              {stagedBlocks ? "Review Drafted Blocks" : "Smart Lesson Builder"}
            </h3>
          </div>
        </div>
        {existingBlockTypes.length > 0 && !stagedBlocks && (
          <span className="shrink-0 rounded-full bg-white/10 px-2.5 py-1 text-[10px] font-bold text-white/80">
            +{existingBlockTypes.length} on canvas
          </span>
        )}
      </div>

      {/* Review Mode: Staged Blocks Preview */}
      {stagedBlocks ? (
        <div className="space-y-3">
          <p className="text-xs text-slate-300">
            Select which drafted blocks to insert into your lesson:
          </p>

          <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
            {stagedBlocks.map((block, idx) => {
              const checked = selectedIndices.includes(idx);
              return (
                <button
                  key={`${block.type}-${idx}`}
                  type="button"
                  onClick={() => toggleIndex(idx)}
                  className={cn(
                    "w-full text-left rounded-xl border p-3 transition-all flex items-start gap-3",
                    checked
                      ? "border-[#fd5523] bg-white/10"
                      : "border-white/10 bg-white/5 opacity-55 hover:opacity-80"
                  )}
                >
                  <div
                    className={cn(
                      "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition-colors",
                      checked
                        ? "border-[#fd5523] bg-[#fd5523] text-white"
                        : "border-white/30 bg-transparent"
                    )}
                  >
                    {checked && <Check className="h-3.5 w-3.5" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <span className="inline-block text-[10px] font-black uppercase tracking-wider text-[#fd8d69]">
                      {formatBlockTypeLabel(block.type)}
                    </span>
                    <p className="text-xs font-medium text-white/90 line-clamp-2 mt-0.5">
                      {summarizeGeneratedBlock(block)}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-2 pt-2">
            <Button
              type="button"
              variant="ghost"
              disabled={saving}
              onClick={() => {
                setStagedBlocks(null);
                setSelectedIndices([]);
              }}
              className="h-10 rounded-xl border border-white/15 bg-white/5 px-3 text-xs font-bold text-white/80 hover:bg-white/10 hover:text-white"
            >
              <Trash2 className="mr-1.5 h-3.5 w-3.5" />
              Discard
            </Button>
            <Button
              type="button"
              variant="ghost"
              disabled={saving || generating}
              onClick={handleGenerate}
              className="h-10 rounded-xl border border-white/15 bg-white/5 px-3 text-xs font-bold text-white/80 hover:bg-white/10 hover:text-white"
              title="Regenerate"
            >
              <RotateCcw className="h-3.5 w-3.5" />
            </Button>
            <Button
              type="button"
              disabled={saving || selectedIndices.length === 0}
              onClick={handleInsertSelected}
              className="h-10 flex-1 rounded-xl bg-[#fd5523] text-xs font-bold text-white hover:bg-[#ef4a16]"
            >
              {saving ? (
                <>
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                  Inserting...
                </>
              ) : (
                <>
                  <Check className="mr-1.5 h-3.5 w-3.5" />
                  Insert ({selectedIndices.length})
                </>
              )}
            </Button>
          </div>
        </div>
      ) : (
        /* Compose Mode */
        <div className="space-y-4">
          {/* Generation Mode Selector */}
          <div className="grid grid-cols-3 gap-1.5 rounded-xl bg-black/20 p-1 border border-white/10">
            {MODES.map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => setMode(m.id)}
                disabled={generating}
                className={cn(
                  "rounded-lg py-2 px-2 text-center transition-all",
                  mode === m.id
                    ? "bg-[#fd5523] text-white shadow-xs"
                    : "text-white/70 hover:text-white hover:bg-white/5"
                )}
              >
                <p className="text-[11px] font-bold leading-tight">{m.label}</p>
              </button>
            ))}
          </div>

          {/* Quick Style Chips */}
          <div className="flex flex-wrap gap-1.5">
            {SUGGESTIONS.map((s) => (
              <button
                key={s.label}
                type="button"
                onClick={() => setBrief((prev) => (prev ? `${prev}\n${s.text}` : s.text))}
                disabled={generating}
                className="rounded-full border border-white/15 bg-white/5 px-2.5 py-1 text-[11px] font-medium text-slate-200 transition-colors hover:bg-[#fd5523]/20 hover:border-[#fd5523]/40 disabled:opacity-50"
              >
                + {s.label}
              </button>
            ))}
          </div>

          {/* Prompt Input */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold uppercase tracking-widest text-slate-300">
              Instructions (Optional)
            </label>
            <textarea
              value={brief}
              onChange={(e) => setBrief(e.target.value)}
              placeholder="e.g. Include a practical exercise on writing executive briefs, keep examples local..."
              rows={3}
              disabled={generating}
              className="w-full resize-none rounded-xl border border-white/15 bg-white/5 px-3.5 py-2.5 text-xs text-white placeholder:text-slate-400 focus:border-[#fd5523] focus:outline-none disabled:opacity-50 leading-relaxed"
            />
          </div>

          {/* Audience Track Option */}
          <div className="border-t border-white/10 pt-2.5">
            <button
              type="button"
              onClick={() => setShowOptions((prev) => !prev)}
              disabled={generating}
              className="text-[10px] font-black uppercase tracking-widest text-slate-300 hover:text-white"
            >
              {showOptions ? "Hide audience track ▲" : "Audience track ▼"}
            </button>

            {showOptions && (
              <div className="mt-2.5">
                <select
                  value={domainPreset}
                  onChange={(e) => setDomainPreset(e.target.value as CourseDomainPresetId)}
                  className="flex h-9 w-full rounded-xl border border-white/15 bg-[#083542] px-3 text-xs font-bold text-white outline-none focus:border-[#fd5523]"
                >
                  {COURSE_DOMAIN_PRESETS.map((preset) => (
                    <option key={preset.id} value={preset.id} className="bg-[#083542] text-white">
                      {preset.label}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {generating && progress && (
            <div className="flex items-center gap-2.5 rounded-xl border border-[#fd8d69]/20 bg-[#fd8d69]/10 p-3">
              <Loader2 className="h-4 w-4 animate-spin text-[#fd8d69] shrink-0" />
              <p className="text-xs text-slate-200 truncate">{progress}</p>
            </div>
          )}

          <Button
            type="button"
            onClick={handleGenerate}
            disabled={generating}
            className="h-11 w-full rounded-xl bg-[#fd5523] text-xs sm:text-sm font-bold text-white hover:bg-[#ef4a16] shadow-md disabled:opacity-50"
          >
            {generating ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Drafting Blocks...
              </>
            ) : (
              <>
                <Wand2 className="mr-2 h-4 w-4" />
                Draft Blocks to Review
              </>
            )}
          </Button>
        </div>
      )}
    </div>
  );
}
