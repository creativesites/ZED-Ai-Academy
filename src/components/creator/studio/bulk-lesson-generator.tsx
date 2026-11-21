"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Sparkles, X } from "lucide-react";
import { toast } from "sonner";
import { createContentBlocksBatch } from "@/actions/content-blocks";
import { COURSE_DOMAIN_PRESETS, type CourseDomainPresetId } from "@/lib/course-domain-presets";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { ContentBlockType, Json } from "@/types/database";

type Target = { id: string; title: string };

/**
 * Drafts every empty lesson in one go using the same co-author endpoint as the
 * lesson studio. Runs lesson-by-lesson so progress is visible and a failure in
 * one lesson never loses the others.
 */
export function BulkLessonGenerator({
  courseId,
  emptyLessons,
  defaultPreset,
}: {
  courseId: string;
  emptyLessons: Target[];
  defaultPreset: CourseDomainPresetId;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [preset, setPreset] = useState<CourseDomainPresetId>(defaultPreset);
  const [brief, setBrief] = useState("");
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(0);
  const [current, setCurrent] = useState<string | null>(null);
  const cancelled = useRef(false);

  if (emptyLessons.length === 0) return null;

  async function run() {
    setRunning(true);
    setDone(0);
    cancelled.current = false;
    let ok = 0;
    let failed = 0;
    for (const lesson of emptyLessons) {
      if (cancelled.current) break;
      setCurrent(lesson.title);
      try {
        const res = await fetch("/api/ai/generate-lesson-content", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ lessonId: lesson.id, courseId, brief, domainPreset: preset, mode: "full_lesson" }),
        });
        const data = await res.json();
        if (!res.ok || data.error) throw new Error(data.error || "Generation failed");
        const blocks = ((data.blocks ?? []) as { type: ContentBlockType; content: Json }[]).filter(
          // Quizzes need their own questions table; leave them to the quiz builder.
          (b) => b.type !== "quiz"
        );
        if (blocks.length > 0) {
          await createContentBlocksBatch(lesson.id, courseId, blocks);
          ok++;
        }
      } catch {
        failed++;
      }
      setDone((d) => d + 1);
    }
    setRunning(false);
    setCurrent(null);
    setOpen(false);
    router.refresh();
    if (ok > 0) toast.success(`Drafted ${ok} lesson${ok === 1 ? "" : "s"}. Review each one before publishing.`);
    if (failed > 0) toast.error(`${failed} lesson${failed === 1 ? "" : "s"} couldn't be drafted — try them individually.`);
  }

  const pct = Math.round((done / emptyLessons.length) * 100);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex w-full items-center gap-3 rounded-2xl border border-[#fd5523]/25 bg-gradient-to-r from-[#fff6ee] to-white p-3 text-left transition-colors hover:border-[#fd5523]/50"
      >
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#fd5523] text-white">
          <Sparkles className="h-4 w-4" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold text-[#062e39]">
            Draft {emptyLessons.length} empty lesson{emptyLessons.length === 1 ? "" : "s"} with AI
          </span>
          <span className="block truncate text-xs text-slate-500">
            Fills each lesson with objectives, explanations, examples and practice — you review and edit.
          </span>
        </span>
      </button>

      <Dialog open={open} onOpenChange={(next) => !running && setOpen(next)}>
        <DialogContent className="w-[calc(100vw-1rem)] max-w-lg rounded-2xl p-0">
          <DialogHeader className="border-b border-slate-100 p-5 text-left">
            <DialogTitle className="text-lg font-bold text-[#062e39]">Draft lessons with AI</DialogTitle>
            <DialogDescription className="text-sm text-slate-500">
              {emptyLessons.length} lesson{emptyLessons.length === 1 ? "" : "s"} will be drafted one at a time. Existing
              content is never touched.
            </DialogDescription>
          </DialogHeader>

          {running ? (
            <div className="space-y-3 p-5">
              <div className="flex items-center justify-between text-sm">
                <span className="flex min-w-0 items-center gap-2 text-slate-600">
                  <Loader2 className="h-4 w-4 shrink-0 animate-spin text-[#fd5523]" />
                  <span className="truncate">{current}</span>
                </span>
                <span className="shrink-0 font-semibold tabular-nums text-[#062e39]">
                  {done}/{emptyLessons.length}
                </span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                <div className="h-full rounded-full bg-[#fd5523] transition-all" style={{ width: `${pct}%` }} />
              </div>
              <button
                type="button"
                onClick={() => {
                  cancelled.current = true;
                }}
                className="inline-flex h-9 items-center gap-1.5 rounded-lg px-3 text-xs font-semibold text-slate-600 hover:bg-slate-100"
              >
                <X className="h-3.5 w-3.5" /> Stop after this lesson
              </button>
            </div>
          ) : (
            <div className="space-y-4 p-5">
              <label className="block">
                <span className="mb-1.5 block text-xs font-semibold text-slate-600">Course style</span>
                <select
                  value={preset}
                  onChange={(e) => setPreset(e.target.value as CourseDomainPresetId)}
                  className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-[#062e39] outline-none focus:border-[#fd5523]/50"
                >
                  {COURSE_DOMAIN_PRESETS.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="mb-1.5 block text-xs font-semibold text-slate-600">Notes for the AI (optional)</span>
                <textarea
                  value={brief}
                  onChange={(e) => setBrief(e.target.value)}
                  rows={3}
                  maxLength={1000}
                  placeholder="e.g. Learners are small-business owners in Lusaka; use local examples and simple English."
                  className="w-full resize-none rounded-xl border border-slate-200 bg-white p-3 text-sm text-[#062e39] outline-none focus:border-[#fd5523]/50"
                />
              </label>
              <ul className="max-h-36 space-y-1 overflow-y-auto rounded-xl bg-slate-50 p-3 text-xs text-slate-600">
                {emptyLessons.map((l) => (
                  <li key={l.id} className="truncate">• {l.title}</li>
                ))}
              </ul>
              <button
                type="button"
                onClick={run}
                className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#fd5523] text-sm font-semibold text-white hover:bg-[#ef4a16]"
              >
                <Sparkles className="h-4 w-4" />
                Draft {emptyLessons.length} lesson{emptyLessons.length === 1 ? "" : "s"}
              </button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
