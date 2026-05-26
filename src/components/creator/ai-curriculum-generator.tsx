"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { scaffoldCurriculum } from "@/actions/course-ai";
import { Button } from "@/components/ui/button";
import { 
  Loader2, Sparkles, ChevronDown,
  CheckCircle2, RefreshCcw,
  BrainCircuit, X
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { COURSE_DOMAIN_PRESETS, type CourseDomainPresetId } from "@/lib/course-domain-presets";

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
  const [domainPreset, setDomainPreset] = useState<CourseDomainPresetId>("ai-professional");

  async function handleGenerate() {
    if (generating || !brief.trim()) return;
    setGenerating(true);
    setPreview(null);
    try {
      const res = await fetch("/api/ai/generate-curriculum", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ courseId, brief, domainPreset }),
      });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || "Generation failed");
      setPreview(data.modules);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to generate");
    } finally {
      setGenerating(false);
    }
  }

  function handleApply() {
    if (!preview) return;
    setProgress(`Creating ${preview.length} modules...`);
    startApply(async () => {
      try {
        await scaffoldCurriculum(courseId, preview);
        toast.success("Curriculum built successfully!");
        setOpen(false);
        setPreview(null);
        router.refresh();
      } catch {
        toast.error("Failed to build curriculum");
      } finally {
        setProgress("");
      }
    });
  }

  const totalLessons = preview?.reduce((s, m) => s + m.lessons.length, 0) ?? 0;

  return (
    <div className={cn(
      "relative overflow-hidden rounded-[2.5rem] border transition-all duration-500",
      open ? "border-[#fd5523]/40 bg-white shadow-2xl shadow-[#fd5523]/5" : "border-slate-100 bg-slate-50/50"
    )}>
      {/* Header / Toggle */}
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center gap-4 p-4 lg:p-6 text-left transition-active active:scale-[0.98]"
      >
        <div className={cn(
          "flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl transition-all duration-500",
          open ? "bg-[#062e39] text-white rotate-90" : "bg-white text-[#fd5523] shadow-sm border border-slate-100"
        )}>
          {open ? <X className="h-5 w-5" /> : <BrainCircuit className="h-6 w-6" />}
        </div>
        
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-[#fd5523]">AI Co-Pilot</span>
            {generating && <Loader2 className="h-3 w-3 animate-spin text-[#fd5523]" />}
          </div>
          <h3 className="text-sm lg:text-base font-black text-[#062e39] truncate">
            {preview ? "Review Generated Path" : "Magic Curriculum Builder"}
          </h3>
        </div>

        <div className={cn(
          "h-8 w-8 rounded-full border border-slate-200 flex items-center justify-center transition-transform duration-300",
          open && "rotate-180"
        )}>
          <ChevronDown className="h-4 w-4 text-slate-400" />
        </div>
      </button>

      {/* Content Area */}
      <div className={cn(
        "grid transition-all duration-500 ease-in-out",
        open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
      )}>
        <div className="overflow-hidden">
          <div className="p-4 lg:p-6 pt-0 space-y-6">
            
            {!preview ? (
              <div className="space-y-4 animate-in fade-in slide-in-from-top-2">
                <div className="relative">
                  <select
                    value={domainPreset}
                    onChange={(e) => setDomainPreset(e.target.value as CourseDomainPresetId)}
                    className="mb-3 flex h-11 w-full rounded-[1.2rem] border-2 border-slate-100 bg-white px-4 text-sm font-bold text-[#062e39] outline-none transition-all focus:border-[#fd5523]/30 focus:ring-4 focus:ring-[#fd5523]/5"
                  >
                    {COURSE_DOMAIN_PRESETS.map((preset) => (
                      <option key={preset.id} value={preset.id}>
                        {preset.label}
                      </option>
                    ))}
                  </select>
                  <textarea
                    value={brief}
                    onChange={(e) => setBrief(e.target.value)}
                    placeholder="Describe your course goal... (e.g. Real Estate marketing for beginners in Lusaka)"
                    rows={4}
                    className="w-full resize-none rounded-[1.5rem] border-2 border-slate-100 bg-white px-5 py-4 text-sm font-medium text-[#062e39] transition-all placeholder:text-slate-300 focus:border-[#fd5523]/30 focus:outline-none focus:ring-4 focus:ring-[#fd5523]/5"
                  />
                  <div className="absolute bottom-4 right-4 text-[10px] font-bold text-slate-300 uppercase tracking-widest">
                    {brief.length} chars
                  </div>
                </div>

                <Button
                  onClick={handleGenerate}
                  disabled={generating || !brief.trim()}
                  className="group w-full h-14 rounded-2xl bg-[#fd5523] hover:bg-[#062e39] text-white shadow-lg shadow-[#fd5523]/20 transition-all duration-300 active:scale-[0.97]"
                >
                  {generating ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <div className="flex items-center gap-2 font-black uppercase tracking-widest text-xs">
                      <span>Start Generation</span>
                      <Sparkles className="h-4 w-4 group-hover:rotate-12 transition-transform" />
                    </div>
                  )}
                </Button>
              </div>
            ) : (
              /* Preview State */
              <div className="space-y-6 animate-in zoom-in-95 duration-300">
                <div className="flex items-center justify-between px-2">
                  <div className="flex flex-col">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Structure</span>
                    <span className="text-xs font-bold text-[#062e39]">{preview.length} Modules • {totalLessons} Lessons</span>
                  </div>
                  <button 
                    onClick={() => setPreview(null)}
                    className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-[#fd5523] hover:opacity-70 transition-opacity"
                  >
                    <RefreshCcw className="h-3 w-3" />
                    Reset
                  </button>
                </div>

                <div className="space-y-3 max-h-[350px] overflow-y-auto pr-2 scrollbar-hide">
                  {preview.map((mod, mi) => (
                    <div key={mi} className="group rounded-[1.5rem] border border-slate-100 bg-slate-50/50 p-4 transition-all hover:bg-white hover:border-[#fd5523]/20">
                      <div className="flex items-center gap-3 mb-3">
                        <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-white border border-slate-100 text-[#fd5523] font-black text-xs shadow-sm">
                          {mi + 1}
                        </div>
                        <h4 className="text-sm font-black text-[#062e39] leading-tight">{mod.title}</h4>
                      </div>
                      
                      <div className="space-y-2 ml-11">
                        {mod.lessons.map((lesson, li) => (
                          <div key={li} className="flex items-center gap-2 text-[11px] font-bold text-slate-500 uppercase tracking-tight">
                            <div className="h-1 w-1 rounded-full bg-slate-300" />
                            {lesson.title}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="pt-2">
                  <Button
                    onClick={handleApply}
                    disabled={applying}
                    className="w-full h-14 rounded-2xl bg-[#062e39] hover:bg-[#fd5523] text-white transition-all duration-500 active:scale-[0.97] group"
                  >
                    {applying ? (
                      <div className="flex items-center gap-3 text-xs font-black uppercase tracking-widest">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span>{progress || "Building..."}</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 text-xs font-black uppercase tracking-widest">
                        <span>Apply to Course</span>
                        <CheckCircle2 className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
                      </div>
                    )}
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
