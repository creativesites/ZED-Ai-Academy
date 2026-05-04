"use client";

import { useState, useTransition } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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
  AlertCircle
} from "lucide-react";
import { exportCourseBlueprint, importCourseBlueprint, type CourseBlueprint } from "@/actions/course-ai";
import { toast } from "sonner";
import { ScrollArea } from "@/components/ui/scroll-area";

interface AIBlueprintAssistantProps {
  courseId: string;
}

export function AIBlueprintAssistant({ courseId }: AIBlueprintAssistantProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("export");
  const [copied, setCopied] = useState(false);
  const [blueprint, setBlueprint] = useState<CourseBlueprint | null>(null);
  const [promptText, setPromptText] = useState("");
  const [importJson, setImportJson] = useState("");
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, startImport] = useTransition();

  async function handleExport() {
    setIsExporting(true);
    try {
      const data = await exportCourseBlueprint(courseId);
      setBlueprint(data.blueprint);
      setPromptText(data.promptText);
    } catch (err) {
      toast.error("Failed to export course structure");
    } finally {
      setIsExporting(false);
    }
  }

  function handleCopy() {
    navigator.clipboard.writeText(promptText);
    setCopied(true);
    toast.success("AI Prompt copied to clipboard!");
    setTimeout(() => setCopied(false), 2000);
  }

  async function handleImport() {
    if (!importJson.trim()) return;

    try {
      const parsed = JSON.parse(importJson) as CourseBlueprint;
      if (!parsed.modules || !Array.isArray(parsed.modules)) {
        throw new Error("Invalid blueprint format: 'modules' array is missing.");
      }

      startImport(async () => {
        try {
          await importCourseBlueprint(courseId, parsed);
          toast.success("Curriculum updated successfully!");
          setIsOpen(false);
          setImportJson("");
        } catch (err) {
          toast.error(err instanceof Error ? err.message : "Import failed");
        }
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Invalid JSON format");
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => {
      setIsOpen(open);
      if (open && activeTab === "export" && !promptText) {
        handleExport();
      }
    }}>
      <DialogTrigger 
        nativeButton={false}
        render={
          <Button 
            variant="outline" 
            className="rounded-full border-[#fd5523]/20 bg-[#fff6ee] text-[#fd5523] hover:bg-[#fd5523] hover:text-white"
          >
            <Sparkles className="mr-2 h-4 w-4" />
            AI Blueprint Assistant
          </Button>
        }
      />
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col gap-0 p-0 overflow-hidden rounded-[2.5rem] border-0 shadow-2xl">
        <DialogHeader className="p-8 bg-[#062e39] text-white">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-[#fd5523] rounded-xl">
              <Sparkles className="h-5 w-5 text-white" />
            </div>
            <DialogTitle className="text-2xl font-bold">AI Blueprint Assistant</DialogTitle>
          </div>
          <DialogDescription className="text-white/70 text-base">
            Export your course to AI for expansion, or import AI-generated curriculum files.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-hidden">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full flex flex-col">
            <div className="px-8 border-b">
              <TabsList className="h-14 bg-transparent gap-8">
                <TabsTrigger 
                  value="export" 
                  className="h-14 rounded-none border-b-2 border-transparent data-[state=active]:border-[#fd5523] data-[state=active]:bg-transparent data-[state=active]:shadow-none text-base font-bold"
                >
                  <Download className="mr-2 h-4 w-4" />
                  Export to AI
                </TabsTrigger>
                <TabsTrigger 
                  value="import" 
                  className="h-14 rounded-none border-b-2 border-transparent data-[state=active]:border-[#fd5523] data-[state=active]:bg-transparent data-[state=active]:shadow-none text-base font-bold"
                >
                  <Upload className="mr-2 h-4 w-4" />
                  Import JSON
                </TabsTrigger>
              </TabsList>
            </div>

            <ScrollArea className="flex-1 p-8">
              <TabsContent value="export" className="mt-0 outline-none">
                <div className="space-y-6">
                  <div className="bg-slate-50 rounded-2xl p-6 border border-slate-100">
                    <h3 className="font-bold text-[#062e39] mb-2 flex items-center gap-2">
                      <FileJson className="h-4 w-4 text-[#fd5523]" />
                      AI Training Prompt
                    </h3>
                    <p className="text-sm text-slate-500 mb-4">
                      Copy this prompt and paste it into any LLM (Claude, ChatGPT, or Gemini). It contains your current course structure and instructions for the AI to follow.
                    </p>
                    <div className="relative">
                      {isExporting ? (
                        <div className="h-64 flex flex-col items-center justify-center bg-white rounded-xl border border-slate-200 gap-3">
                          <Loader2 className="h-8 w-8 animate-spin text-[#fd5523]" />
                          <p className="text-sm font-medium text-slate-500">Preparing blueprint...</p>
                        </div>
                      ) : (
                        <>
                          <Textarea 
                            value={promptText} 
                            readOnly 
                            className="h-80 bg-white font-mono text-xs p-4 rounded-xl border-slate-200 leading-relaxed"
                          />
                          <Button 
                            size="sm" 
                            onClick={handleCopy}
                            className="absolute top-3 right-3 rounded-lg bg-[#062e39] text-white hover:bg-[#0a4055]"
                          >
                            {copied ? <Check className="h-4 w-4 mr-1" /> : <Copy className="h-4 w-4 mr-1" />}
                            {copied ? "Copied" : "Copy Prompt"}
                          </Button>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="p-4 rounded-2xl bg-blue-50 border border-blue-100 flex gap-3">
                      <AlertCircle className="h-5 w-5 text-blue-500 shrink-0 mt-0.5" />
                      <div>
                        <p className="text-sm font-bold text-blue-900">Expert Tip</p>
                        <p className="text-xs text-blue-700 leading-relaxed">
                          Ask the AI to "add 3 more modules focused on practical applications" or "suggest content blocks for Module 2".
                        </p>
                      </div>
                    </div>
                    <div className="p-4 rounded-2xl bg-amber-50 border border-amber-100 flex gap-3">
                      <Sparkles className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
                      <div>
                        <p className="text-sm font-bold text-amber-900">JSON Only</p>
                        <p className="text-xs text-amber-700 leading-relaxed">
                          Ensure the AI returns ONLY the JSON object. You'll paste that JSON into the Import tab.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="import" className="mt-0 outline-none">
                <div className="space-y-6">
                  <div className="bg-slate-50 rounded-2xl p-6 border border-slate-100">
                    <h3 className="font-bold text-[#062e39] mb-2 flex items-center gap-2">
                      <Upload className="h-4 w-4 text-[#fd5523]" />
                      Import AI Response
                    </h3>
                    <p className="text-sm text-slate-500 mb-4">
                      Paste the JSON object returned by the AI below. It will automatically create missing modules and lessons.
                    </p>
                    <Textarea 
                      value={importJson} 
                      onChange={(e) => setImportJson(e.target.value)}
                      placeholder='{ "title": "...", "modules": [...] }'
                      className="h-80 bg-white font-mono text-xs p-4 rounded-xl border-slate-200 leading-relaxed focus:border-[#fd5523] focus:ring-[#fd5523]/10"
                    />
                  </div>

                  <div className="flex items-center justify-end gap-3">
                    <Button 
                      variant="ghost" 
                      className="rounded-full"
                      onClick={() => setImportJson("")}
                    >
                      Clear
                    </Button>
                    <Button 
                      disabled={!importJson.trim() || isImporting} 
                      onClick={handleImport}
                      className="rounded-full bg-[#fd5523] px-8 text-white hover:bg-[#ef4a16] shadow-lg shadow-[#fd5523]/20"
                    >
                      {isImporting ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Building Curriculum...
                        </>
                      ) : (
                        <>
                          <Check className="mr-2 h-4 w-4" />
                          Apply AI Blueprint
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </TabsContent>
            </ScrollArea>
          </Tabs>
        </div>
      </DialogContent>
    </Dialog>
  );
}
