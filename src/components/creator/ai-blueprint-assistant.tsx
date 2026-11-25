"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  Sparkles,
  Copy,
  Check,
  FileJson,
  Download,
  Upload,
  Loader2,
  WandSparkles,
  Trash2,
  BookOpen,
  Layers,
} from "lucide-react";
import {
  exportCourseBlueprint,
  importCourseBlueprint,
  scaffoldCurriculum,
  type CourseBlueprint,
} from "@/actions/course-ai";
import { COURSE_DOMAIN_PRESETS, type CourseDomainPresetId } from "@/lib/course-domain-presets";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface AIBlueprintAssistantProps {
  courseId: string;
  triggerLabel?: string;
  triggerClassName?: string;
}

type GeneratedModule = {
  title: string;
  lessons: { title: string }[];
};

export function AIBlueprintAssistant({ courseId, triggerLabel, triggerClassName }: AIBlueprintAssistantProps) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("generate");

  // Generate tab state
  const [domainPreset, setDomainPreset] = useState<CourseDomainPresetId>("ai-professional");
  const [brief, setBrief] = useState("");
  const [generating, setGenerating] = useState(false);
  const [previewModules, setPreviewModules] = useState<GeneratedModule[] | null>(null);
  const [applyingGenerated, startApplyGenerated] = useTransition();

  // Export tab state
  const [copied, setCopied] = useState(false);
  const [blueprint, setBlueprint] = useState<CourseBlueprint | null>(null);
  const [promptText, setPromptText] = useState("");
  const [isExporting, setIsExporting] = useState(false);

  // Import tab state
  const [importJson, setImportJson] = useState("");
  const [isImporting, startImport] = useTransition();

  async function handleGenerate() {
    if (generating) return;
    setGenerating(true);
    setPreviewModules(null);
    try {
      const res = await fetch("/api/ai/generate-curriculum", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ courseId, brief, domainPreset }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.error || "Unable to generate blueprint.");
      }
      setPreviewModules(Array.isArray(data.modules) ? data.modules : []);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to generate blueprint.");
    } finally {
      setGenerating(false);
    }
  }

  function removeGeneratedModule(index: number) {
    setPreviewModules((prev) => (prev ? prev.filter((_, idx) => idx !== index) : prev));
  }

  function handleApplyGenerated() {
    if (!previewModules || previewModules.length === 0) return;
    startApplyGenerated(async () => {
      try {
        await scaffoldCurriculum(courseId, previewModules);
        toast.success("AI blueprint applied to your curriculum!");
        setIsOpen(false);
        setPreviewModules(null);
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to apply blueprint.");
      }
    });
  }

  async function handleExport() {
    setIsExporting(true);
    try {
      const data = await exportCourseBlueprint(courseId);
      setBlueprint(data.blueprint);
      setPromptText(data.promptText);
    } catch {
      toast.error("Failed to export course structure.");
    } finally {
      setIsExporting(false);
    }
  }

  function handleCopy() {
    if (!promptText) return;
    navigator.clipboard.writeText(promptText);
    setCopied(true);
    toast.success("AI prompt copied to clipboard!");
    setTimeout(() => setCopied(false), 2000);
  }

  function handleDownloadJson() {
    if (!blueprint) return;
    const blob = new Blob([JSON.stringify(blueprint, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${(blueprint.title || "course-blueprint").toLowerCase().replace(/[^a-z0-9]+/g, "-")}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function handleImport() {
    if (!importJson.trim()) return;
    try {
      const parsed = JSON.parse(importJson) as CourseBlueprint;
      if (!parsed.modules || !Array.isArray(parsed.modules)) {
        throw new Error("Invalid blueprint format: 'modules' array is missing.");
      }
      startImport(async () => {
        try {
          await importCourseBlueprint(courseId, parsed);
          toast.success("Curriculum imported successfully!");
          setIsOpen(false);
          setImportJson("");
          router.refresh();
        } catch (err) {
          toast.error(err instanceof Error ? err.message : "Import failed.");
        }
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Invalid JSON format.");
    }
  }

  const totalGeneratedLessons =
    previewModules?.reduce((sum, mod) => sum + mod.lessons.length, 0) ?? 0;

  return (
    <>
      <Button
        type="button"
        variant="outline"
        onClick={() => {
          setIsOpen(true);
          if (activeTab === "export" && !promptText) {
            handleExport();
          }
        }}
        className={cn(
          "h-9 rounded-xl border-brand/25 bg-brand-soft px-3.5 text-xs font-bold text-brand-text hover:bg-brand hover:text-white transition-all shadow-xs",
          triggerClassName
        )}
      >
        <Sparkles className="mr-1.5 h-3.5 w-3.5" />
        {triggerLabel ?? "AI Blueprint Assistant"}
      </Button>

      <Dialog
        open={isOpen}
        onOpenChange={(open) => {
          setIsOpen(open);
          if (open && activeTab === "export" && !promptText) {
            handleExport();
          }
        }}
      >
        <DialogContent className="w-[calc(100vw-1.5rem)] max-w-[calc(100vw-1.5rem)] sm:max-w-3xl lg:max-w-4xl max-h-[88vh] flex flex-col gap-0 p-0 overflow-hidden rounded-2xl sm:rounded-3xl border border-slate-200 shadow-2xl">
          <DialogHeader className="p-5 sm:p-6 bg-ink text-white shrink-0">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand text-white shrink-0">
                <Sparkles className="h-4 w-4" />
              </div>
              <div className="text-left">
                <DialogTitle className="text-lg sm:text-xl font-bold text-white">
                  AI Blueprint Assistant
                </DialogTitle>
                <DialogDescription className="text-white/75 text-xs sm:text-sm mt-0.5">
                  Generate a module & lesson outline in-app, or export/import JSON blueprints.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <Tabs
            value={activeTab}
            onValueChange={(val) => {
              setActiveTab(val);
              if (val === "export" && !promptText) {
                handleExport();
              }
            }}
            className="flex-1 flex flex-col min-h-0"
          >
            <div className="px-4 sm:px-6 border-b border-slate-200 bg-slate-50/60 shrink-0 overflow-x-auto">
              <TabsList className="h-12 bg-transparent gap-4 sm:gap-6 p-0">
                <TabsTrigger
                  value="generate"
                  className="h-12 rounded-none border-b-2 border-transparent px-1 text-xs sm:text-sm font-bold text-slate-500 data-[state=active]:border-brand data-[state=active]:text-ink data-[state=active]:bg-transparent data-[state=active]:shadow-none"
                >
                  <WandSparkles className="mr-1.5 h-3.5 w-3.5" />
                  Generate with AI
                </TabsTrigger>
                <TabsTrigger
                  value="export"
                  className="h-12 rounded-none border-b-2 border-transparent px-1 text-xs sm:text-sm font-bold text-slate-500 data-[state=active]:border-brand data-[state=active]:text-ink data-[state=active]:bg-transparent data-[state=active]:shadow-none"
                >
                  <Download className="mr-1.5 h-3.5 w-3.5" />
                  Export
                </TabsTrigger>
                <TabsTrigger
                  value="import"
                  className="h-12 rounded-none border-b-2 border-transparent px-1 text-xs sm:text-sm font-bold text-slate-500 data-[state=active]:border-brand data-[state=active]:text-ink data-[state=active]:bg-transparent data-[state=active]:shadow-none"
                >
                  <Upload className="mr-1.5 h-3.5 w-3.5" />
                  Import JSON
                </TabsTrigger>
              </TabsList>
            </div>

            <div className="flex-1 overflow-y-auto p-4 sm:p-6">
              {/* TAB 1: IN-APP AI GENERATOR */}
              <TabsContent value="generate" className="mt-0 space-y-5 outline-none">
                <div className="space-y-2">
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
                    1. Choose Course Track
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {COURSE_DOMAIN_PRESETS.map((preset) => (
                      <button
                        key={preset.id}
                        type="button"
                        onClick={() => setDomainPreset(preset.id)}
                        className={cn(
                          "rounded-xl border p-3 text-left transition-all",
                          domainPreset === preset.id
                            ? "border-brand bg-brand-soft"
                            : "border-slate-200 bg-white hover:border-slate-300"
                        )}
                      >
                        <p className="text-xs font-bold text-ink">{preset.label}</p>
                        <p className="text-[11px] text-slate-500 mt-0.5 line-clamp-1">
                          {preset.description}
                        </p>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
                    2. Focus & Learning Goals (Optional)
                  </p>
                  <Textarea
                    value={brief}
                    onChange={(e) => setBrief(e.target.value)}
                    rows={3}
                    placeholder="e.g. Focus on hands-on client reporting workflows, include a capstone audit..."
                    className="resize-none rounded-xl border-slate-200 text-sm"
                  />
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <Button
                    type="button"
                    onClick={handleGenerate}
                    disabled={generating}
                    className="h-10 rounded-xl bg-ink px-5 text-xs sm:text-sm font-bold text-white hover:bg-ink-hover"
                  >
                    {generating ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Generating Blueprint...
                      </>
                    ) : (
                      <>
                        <WandSparkles className="mr-2 h-4 w-4" />
                        {previewModules ? "Regenerate" : "Generate Blueprint"}
                      </>
                    )}
                  </Button>
                </div>

                {previewModules && (
                  <div className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2 text-xs font-bold text-ink">
                        <Layers className="h-4 w-4 text-brand-text" />
                        <span>
                          Proposed Outline: {previewModules.length} modules · {totalGeneratedLessons} lessons
                        </span>
                      </div>
                      <Button
                        type="button"
                        onClick={handleApplyGenerated}
                        disabled={applyingGenerated || previewModules.length === 0}
                        className="h-9 rounded-xl bg-brand px-4 text-xs font-bold text-white hover:bg-brand-hover"
                      >
                        {applyingGenerated ? (
                          <>
                            <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                            Applying...
                          </>
                        ) : (
                          <>
                            <Check className="mr-1.5 h-3.5 w-3.5" />
                            Apply to Course
                          </>
                        )}
                      </Button>
                    </div>

                    <div className="space-y-2.5 max-h-60 overflow-y-auto pr-1">
                      {previewModules.map((mod, idx) => (
                        <div
                          key={`${mod.title}-${idx}`}
                          className="rounded-xl border border-slate-200 bg-white p-3 space-y-2"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-xs sm:text-sm font-bold text-ink">
                              Module {idx + 1}: {mod.title}
                            </p>
                            <button
                              type="button"
                              onClick={() => removeGeneratedModule(idx)}
                              className="p-1 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50"
                              title="Remove module"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                          <ul className="space-y-1 pl-1">
                            {mod.lessons.map((lesson, lIdx) => (
                              <li
                                key={`${lesson.title}-${lIdx}`}
                                className="flex items-center gap-2 text-xs text-slate-600"
                              >
                                <BookOpen className="h-3 w-3 text-slate-400 shrink-0" />
                                <span>{lesson.title}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </TabsContent>

              {/* TAB 2: EXPORT */}
              <TabsContent value="export" className="mt-0 space-y-4 outline-none">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2 text-sm font-bold text-ink">
                    <FileJson className="h-4 w-4 text-brand-text" />
                    Course Structure & Prompt
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={handleDownloadJson}
                      disabled={!blueprint}
                      className="h-9 rounded-xl text-xs font-bold"
                    >
                      <Download className="mr-1.5 h-3.5 w-3.5" />
                      Download JSON
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      onClick={handleCopy}
                      disabled={!promptText}
                      className="h-9 rounded-xl bg-ink text-white hover:bg-ink-hover text-xs font-bold"
                    >
                      {copied ? <Check className="mr-1.5 h-3.5 w-3.5" /> : <Copy className="mr-1.5 h-3.5 w-3.5" />}
                      {copied ? "Copied" : "Copy Prompt"}
                    </Button>
                  </div>
                </div>

                {isExporting ? (
                  <div className="h-56 flex flex-col items-center justify-center bg-slate-50 rounded-xl border border-slate-200 gap-2">
                    <Loader2 className="h-6 w-6 animate-spin text-brand-text" />
                    <p className="text-xs font-medium text-slate-500">Exporting course blueprint...</p>
                  </div>
                ) : (
                  <Textarea
                    value={promptText}
                    readOnly
                    className="h-64 bg-slate-50 font-mono text-xs p-3.5 rounded-xl border-slate-200 leading-relaxed"
                  />
                )}
              </TabsContent>

              {/* TAB 3: IMPORT JSON */}
              <TabsContent value="import" className="mt-0 space-y-4 outline-none">
                <p className="text-xs sm:text-sm text-slate-500">
                  Paste a valid blueprint JSON object with a <code className="text-ink font-semibold">modules</code> array to create modules and lessons automatically.
                </p>
                <Textarea
                  value={importJson}
                  onChange={(e) => setImportJson(e.target.value)}
                  placeholder='{ "title": "...", "modules": [{ "title": "Module 1", "lessons": [{ "title": "Lesson 1", "content_blocks": [] }] }] }'
                  className="h-64 bg-slate-50 font-mono text-xs p-3.5 rounded-xl border-slate-200 leading-relaxed focus:border-brand"
                />
                <div className="flex items-center justify-end gap-2.5">
                  <Button
                    type="button"
                    variant="ghost"
                    className="h-10 rounded-xl text-xs font-bold"
                    onClick={() => setImportJson("")}
                  >
                    Clear
                  </Button>
                  <Button
                    type="button"
                    disabled={!importJson.trim() || isImporting}
                    onClick={handleImport}
                    className="h-10 rounded-xl bg-brand px-5 text-xs sm:text-sm font-bold text-white hover:bg-brand-hover"
                  >
                    {isImporting ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Importing...
                      </>
                    ) : (
                      <>
                        <Check className="mr-2 h-4 w-4" />
                        Apply JSON Blueprint
                      </>
                    )}
                  </Button>
                </div>
              </TabsContent>
            </div>
          </Tabs>
        </DialogContent>
      </Dialog>
    </>
  );
}
