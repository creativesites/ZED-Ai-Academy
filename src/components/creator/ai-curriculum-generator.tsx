"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { scaffoldCurriculum } from "@/actions/course-ai";
import { Button } from "@/components/ui/button";
import { Loader2, Sparkles, ChevronDown, ChevronUp, CheckCircle2, BookOpen, Layers } from "lucide-react";
import { toast } from "sonner";

type GeneratedLesson = { title: string };
type GeneratedModule = { title: string; lessons: GeneratedLesson[] };

export function AICurriculumGenerator({ courseId }: { courseId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [brief, setBrief] = useState("");
  const [generating, setGenerating] = useState(false);
  const [applying, startApply] = useTransition();
  const [preview, setPreview] = useState<GeneratedModule[] | null>(null);
  const [progress, setProgress] = useState("");

  async function handleGenerate() {
    if (generating) return;
    setGenerating(true);
    setPreview(null);
    setProgress("");
    try {
      const res = await fetch("/api/ai/generate-curriculum", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ courseId, brief }),
      });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || "Generation failed");
      setPreview(data.modules);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to generate curriculum");
    } finally {
      setGenerating(false);
    }
  }

  function handleApply() {
    if (!preview) return;
    setProgress(`Building ${preview.length} modules and ${totalLessons} lessons…`);
    startApply(async () => {
      try {
        await scaffoldCurriculum(courseId, preview);
        toast.success("Curriculum scaffolded! All modules and lessons created.");
        setOpen(false);
        setPreview(null);
        setProgress("");
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to apply curriculum");
        setProgress("");
      }
    });
  }

  const totalLessons = preview?.reduce((s, m) => s + m.lessons.length, 0) ?? 0;

  return (
    <div className="rounded-[2rem] border border-[#fd5523]/20 bg-gradient-to-br from-[#fff6ee] to-white shadow-sm">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-4 p-5 text-left"
      >
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#fd5523] text-white shadow-md">
          <Sparkles className="h-5 w-5" />
        </div>
        <div className="flex-1">
          <p className="text-[10px] font-black uppercase tracking-[0.25em] text-[#fd5523]">AI Studio</p>
          <h3 className="text-base font-bold text-[#062e39]">Generate Curriculum with AI</h3>
        </div>
        <div className="text-slate-400">
          {open ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
        </div>
      </button>

      {open && (
        <div className="border-t border-[#fd5523]/10 px-5 pb-5 pt-4 space-y-4">
          {!preview ? (
            <>
              <p className="text-sm text-slate-500 leading-relaxed">
                Describe any additional context about your course and AI will scaffold all 4 modules with lessons.
              </p>
              <textarea
                value={brief}
                onChange={(e) => setBrief(e.target.value)}
                placeholder="e.g. Focus on non-technical professionals in Zambia who use Excel and WhatsApp daily. Include a module on AI tools for small business."
                rows={3}
                className="w-full resize-none rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-[#062e39] placeholder:text-slate-400 focus:border-[#fd5523] focus:outline-none focus:ring-2 focus:ring-[#fd5523]/10"
              />
              <Button
                onClick={handleGenerate}
                disabled={generating}
                className="w-full rounded-2xl bg-[#fd5523] py-6 font-bold text-white hover:bg-[#ef4a16]"
              >
                {generating ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Generating curriculum…</>
                ) : (
                  <><Sparkles className="mr-2 h-4 w-4" />Generate Curriculum</>
                )}
              </Button>
            </>
          ) : (
            <div className="space-y-4">
              {/* Preview */}
              <div className="space-y-3 max-h-[400px] overflow-y-auto pr-1">
                {preview.map((mod, mi) => (
                  <div key={mi} className="rounded-2xl border border-slate-100 bg-white p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-xl bg-[#fff6ee] text-[#fd5523]">
                        <Layers className="h-3.5 w-3.5" />
                      </div>
                      <p className="text-sm font-bold text-[#062e39]">{mod.title}</p>
                    </div>
                    <div className="ml-9 space-y-1">
                      {mod.lessons.map((lesson, li) => (
                        <div key={li} className="flex items-center gap-2 text-xs text-slate-500">
                          <BookOpen className="h-3 w-3 shrink-0 text-slate-400" />
                          {lesson.title}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex items-center justify-between rounded-2xl bg-[#062e39]/5 px-4 py-2">
                <p className="text-xs text-slate-500">{preview.length} modules · {totalLessons} lessons</p>
                <button
                  onClick={() => setPreview(null)}
                  className="text-xs font-bold text-[#fd5523] hover:underline"
                >
                  Regenerate
                </button>
              </div>

              {progress && (
                <p className="flex items-center gap-2 text-xs text-slate-400">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  {progress}
                </p>
              )}

              <Button
                onClick={handleApply}
                disabled={applying}
                className="w-full rounded-2xl bg-[#062e39] py-6 font-bold text-white hover:bg-[#062e39]/90"
              >
                {applying ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Building curriculum…</>
                ) : (
                  <><CheckCircle2 className="mr-2 h-4 w-4" />Apply to Curriculum</>
                )}
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
