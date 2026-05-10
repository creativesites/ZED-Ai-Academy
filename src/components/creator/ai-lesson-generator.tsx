"use client";

import { useState } from "react";
import { createContentBlock } from "@/actions/content-blocks";
import { Button } from "@/components/ui/button";
import { Loader2, Sparkles, Wand2 } from "lucide-react";
import { toast } from "sonner";
import type { ContentBlockType, Json } from "@/types/database";

type GeneratedBlock = { type: ContentBlockType; content: Json };

export function AILessonGenerator({
  lessonId,
  courseId,
  lessonTitle,
}: {
  lessonId: string;
  courseId: string;
  lessonTitle: string;
}) {
  const [brief, setBrief] = useState("");
  const [generating, setGenerating] = useState(false);
  const [progress, setProgress] = useState("");

  async function handleGenerate() {
    if (generating) return;
    setGenerating(true);
    setProgress("Asking AI to write your lesson…");
    try {
      const res = await fetch("/api/ai/generate-lesson-content", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lessonId, courseId, brief }),
      });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || "Generation failed");

      const blocks: GeneratedBlock[] = data.blocks;
      setProgress(`Creating ${blocks.length} content blocks…`);

      for (let i = 0; i < blocks.length; i++) {
        const block = blocks[i];
        setProgress(`Adding block ${i + 1} of ${blocks.length}: ${block.type}…`);
        await createContentBlock(lessonId, courseId, block.type, block.content);
      }

      toast.success("Lesson content generated! Reloading…");
      window.location.reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to generate content");
      setProgress("");
      setGenerating(false);
    }
  }

  return (
    <div className="rounded-[2rem] overflow-hidden border border-[#fd5523]/20 bg-gradient-to-br from-[#062e39] to-[#083848] text-white shadow-xl">
      <div className="p-5">
        <div className="flex items-center gap-3 mb-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#fd5523]/20 text-[#fd8d69]">
            <Wand2 className="h-4 w-4" />
          </div>
          <div>
            <p className="text-[9px] font-black uppercase tracking-[0.3em] text-[#fd8d69]">AI Studio</p>
            <h3 className="text-sm font-bold leading-tight">Generate Lesson Content</h3>
          </div>
        </div>

        <p className="text-xs leading-relaxed text-white/55 mb-3">
          AI will write a full content stack: intro text, a tip callout, step-by-step guide, key takeaways, and a practice prompt — all ready to save.
        </p>

        <textarea
          value={brief}
          onChange={(e) => setBrief(e.target.value)}
          placeholder={`Any extra context for "${lessonTitle}"? (optional)`}
          rows={2}
          disabled={generating}
          className="w-full resize-none rounded-xl border border-white/10 bg-white/8 px-3 py-2 text-xs text-white placeholder:text-white/30 focus:border-[#fd8d69]/50 focus:outline-none focus:ring-1 focus:ring-[#fd8d69]/20 disabled:opacity-50"
        />

        {generating && progress && (
          <p className="mt-2 flex items-center gap-1.5 text-xs text-[#fd8d69]/80">
            <Loader2 className="h-3 w-3 animate-spin" />
            {progress}
          </p>
        )}

        <Button
          onClick={handleGenerate}
          disabled={generating}
          className="mt-3 w-full rounded-xl bg-[#fd5523] py-5 text-sm font-bold text-white hover:bg-[#ef4a16] disabled:opacity-60"
        >
          {generating ? (
            <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Generating…</>
          ) : (
            <><Sparkles className="mr-2 h-4 w-4" />Generate Lesson Content</>
          )}
        </Button>
      </div>
    </div>
  );
}
