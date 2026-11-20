"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  BookOpen,
  Check,
  FileText,
  Loader2,
  Sparkles,
  Upload,
  WandSparkles,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";

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

export type ReferenceMaterialPayload = {
  fileName: string;
  notes: string;
};

const MAX_UPLOAD_BYTES = 4 * 1024 * 1024; // 4 MB safe for inline API payload

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  let binary = "";
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

export function CourseBlueprintAssistant({
  initialMode = "idea",
  onApply,
  onAttachReference,
}: {
  initialMode?: "idea" | "materials";
  onApply: (blueprint: CourseBlueprintResponse) => void;
  onAttachReference?: (material: ReferenceMaterialPayload) => void;
}) {
  const [mode, setMode] = useState<"idea" | "materials">(initialMode);
  const [brief, setBrief] = useState(
    "Build an AI course for professionals who want to save time on real work, not study theory."
  );
  const [sourceNotes, setSourceNotes] = useState("");
  const [uploadedFile, setUploadedFile] = useState<{
    name: string;
    mimeType: string;
    base64?: string;
    text?: string;
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [blueprint, setBlueprint] = useState<CourseBlueprintResponse | null>(null);

  async function handleFileSelect(file: File | null) {
    if (!file) return;
    setError(null);

    if (file.size > MAX_UPLOAD_BYTES) {
      setError("Please upload a file under 4 MB.");
      return;
    }

    const lowerName = file.name.toLowerCase();
    if (
      lowerName.endsWith(".txt") ||
      lowerName.endsWith(".md") ||
      lowerName.endsWith(".csv") ||
      lowerName.endsWith(".json")
    ) {
      const text = await file.text();
      setUploadedFile({ name: file.name, mimeType: "text/plain", text: text.slice(0, 30000) });
      if (!sourceNotes.trim()) {
        setSourceNotes(text.slice(0, 8000));
      }
      return;
    }

    if (lowerName.endsWith(".pdf") || file.type === "application/pdf") {
      const buffer = await file.arrayBuffer();
      const base64 = arrayBufferToBase64(buffer);
      setUploadedFile({ name: file.name, mimeType: "application/pdf", base64 });
      return;
    }

    setError("Supported files: PDF (.pdf), Markdown (.md), Text (.txt), or CSV (.csv).");
  }

  async function handleGenerate() {
    if (mode === "idea" && !brief.trim()) return;
    if (mode === "materials" && !sourceNotes.trim() && !uploadedFile) {
      setError("Upload a PDF/text file or paste your course notes first.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/ai/generate-course-blueprint", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          brief: mode === "idea" ? brief : brief.trim() || undefined,
          sourceText: mode === "materials" ? uploadedFile?.text || sourceNotes : undefined,
          sourceFile:
            mode === "materials" && uploadedFile?.base64
              ? {
                  name: uploadedFile.name,
                  mimeType: uploadedFile.mimeType,
                  base64: uploadedFile.base64,
                }
              : undefined,
        }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || "Unable to generate a course blueprint right now.");
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

  function handleSaveAsReference() {
    if (!onAttachReference) return;
    const notes = sourceNotes.trim() || uploadedFile?.text || "";
    const fileName = uploadedFile?.name || "Instructor Notes";
    if (!notes && !uploadedFile) {
      setError("Upload a document or paste notes to keep as reference.");
      return;
    }
    onAttachReference({
      fileName,
      notes: notes || `Reference document attached: ${fileName}`,
    });
  }

  return (
    <section className="rounded-2xl sm:rounded-3xl bg-gradient-to-br from-[#062e39] to-[#0b3f4d] p-5 sm:p-7 text-white shadow-lg border border-white/10">
      {/* Mode Switcher */}
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-4">
        <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-[#fd8d69]">
          <Sparkles className="h-3.5 w-3.5" />
          Course Starter Assistant
        </div>

        <div className="inline-flex rounded-xl bg-black/25 p-1 border border-white/10">
          <button
            type="button"
            onClick={() => {
              setMode("idea");
              setError(null);
            }}
            className={cn(
              "px-3 py-1.5 rounded-lg text-xs font-bold transition-all",
              mode === "idea" ? "bg-[#fd5523] text-white" : "text-white/70 hover:text-white"
            )}
          >
            From Idea
          </button>
          <button
            type="button"
            onClick={() => {
              setMode("materials");
              setError(null);
            }}
            className={cn(
              "px-3 py-1.5 rounded-lg text-xs font-bold transition-all",
              mode === "materials" ? "bg-[#fd5523] text-white" : "text-white/70 hover:text-white"
            )}
          >
            From Materials
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-6 lg:grid lg:grid-cols-[1.15fr_0.85fr] lg:items-start">
        <div className="space-y-4">
          {mode === "idea" ? (
            <>
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
                rows={4}
                className="resize-none rounded-xl border-white/15 bg-white/10 p-3.5 text-sm font-medium text-white placeholder:text-white/40 focus:border-[#fd8d69] focus:ring-[#fd8d69]/20"
                placeholder="Example: AI course for law firms to speed up document review and summarize case files."
              />
            </>
          ) : (
            <>
              <div>
                <h2 className="text-xl sm:text-2xl font-bold tracking-tight">
                  Start from existing materials
                </h2>
                <p className="mt-1.5 text-sm leading-relaxed text-white/75">
                  Upload a PDF, Markdown, or text syllabus—or paste your notes. Choose to keep them as reference only or generate an AI course blueprint grounded in them.
                </p>
              </div>

              {uploadedFile ? (
                <div className="flex items-center justify-between gap-3 rounded-xl border border-white/15 bg-white/10 px-4 py-3">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <FileText className="h-4 w-4 text-[#fd8d69] shrink-0" />
                    <span className="text-xs sm:text-sm font-semibold truncate">
                      {uploadedFile.name}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setUploadedFile(null)}
                    className="p-1 rounded-lg text-white/60 hover:text-white hover:bg-white/10"
                    aria-label="Remove file"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ) : (
                <label className="flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-white/20 bg-white/5 p-5 text-center transition-colors hover:border-[#fd8d69]/60 hover:bg-white/10">
                  <Upload className="h-6 w-6 text-[#fd8d69] mb-2" />
                  <span className="text-xs sm:text-sm font-bold text-white">
                    Upload PDF, Markdown, or Text file
                  </span>
                  <span className="text-[11px] text-white/60 mt-0.5">
                    Max 4 MB · Stored privately for authoring, not published to students
                  </span>
                  <input
                    type="file"
                    accept=".pdf,.txt,.md,.csv,application/pdf,text/plain,text/markdown"
                    onChange={(e) => handleFileSelect(e.target.files?.[0] ?? null)}
                    className="hidden"
                  />
                </label>
              )}

              <Textarea
                value={sourceNotes}
                onChange={(event) => setSourceNotes(event.target.value)}
                rows={3}
                className="resize-none rounded-xl border-white/15 bg-white/10 p-3.5 text-sm font-medium text-white placeholder:text-white/40 focus:border-[#fd8d69]"
                placeholder="Or paste syllabus outline, lesson notes, or reference text here..."
              />
            </>
          )}

          {error && (
            <p className="text-xs font-medium text-red-300 bg-red-500/15 border border-red-400/20 rounded-xl px-3 py-2">
              {error}
            </p>
          )}

          <div className="flex flex-wrap items-center gap-2.5">
            {mode === "materials" && onAttachReference && (
              <Button
                type="button"
                variant="outline"
                onClick={handleSaveAsReference}
                disabled={loading}
                className="h-10 rounded-xl border-white/25 bg-white/10 px-4 text-xs sm:text-sm font-bold text-white hover:bg-white/20"
              >
                <BookOpen className="mr-1.5 h-4 w-4 text-[#fd8d69]" />
                Use as Reference Only
              </Button>
            )}

            <Button
              type="button"
              onClick={handleGenerate}
              disabled={loading || (mode === "idea" && !brief.trim())}
              className="h-10 rounded-xl bg-[#fd5523] px-5 text-xs sm:text-sm font-bold text-white shadow-md hover:bg-[#ef4a16] disabled:opacity-60"
            >
              {loading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <WandSparkles className="mr-2 h-4 w-4" />
              )}
              {loading ? "Generating..." : "Generate Blueprint with AI"}
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
                  "Course title & outcome-focused summary",
                  "Suggested category, level & pricing model",
                  "Target audience & quick-win framing",
                  "Grounded 4-module outline ready to review",
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
