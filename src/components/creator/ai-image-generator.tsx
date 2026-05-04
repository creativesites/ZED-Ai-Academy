"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  Sparkles, 
  Loader2, 
  ImageIcon, 
  Wand2, 
  RefreshCw,
  Crop,
  Layers
} from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface AIImageGeneratorProps {
  courseTitle: string;
  moduleTitle: string;
  lessonTitle: string;
  sectionTitle?: string;
  currentImageId?: string;
  onImageSelected: (asset: any) => void;
  variant?: "inline" | "button";
}

export function AIImageGenerator({
  courseTitle,
  moduleTitle,
  lessonTitle,
  sectionTitle,
  currentImageId,
  onImageSelected,
  variant = "button"
}: AIImageGeneratorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [prompt, setPrompt] = useState("");
  const [aspectRatio, setAspectRatio] = useState("16:9");
  const [isGenerating, setIsGenerating] = useState(false);
  const [mode, setMode] = useState<"generate" | "edit">(currentImageId ? "edit" : "generate");

  async function handleGenerate() {
    if (!prompt.trim()) {
      toast.error("Please enter a description for the image");
      return;
    }

    setIsGenerating(true);
    try {
      const resp = await fetch("/api/ai/generate-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: mode === "generate" ? prompt : undefined,
          editPrompt: mode === "edit" ? prompt : undefined,
          editImageId: mode === "edit" ? currentImageId : undefined,
          aspectRatio,
          context: { courseTitle, moduleTitle, lessonTitle, sectionTitle }
        })
      });

      const data = await resp.json();
      if (data.error) throw new Error(data.error);

      onImageSelected(data.asset);
      toast.success(mode === "generate" ? "Image generated!" : "Image edited!");
      setIsOpen(false);
    } catch (err: any) {
      toast.error(err.message || "Failed to generate image");
    } finally {
      setIsGenerating(false);
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger 
        nativeButton={false}
        render={
          variant === "button" ? (
            <Button 
              variant="outline" 
              size="sm" 
              className="rounded-full border-[#fd5523]/20 bg-[#fff6ee] text-[#fd5523] hover:bg-[#fd5523] hover:text-white"
            >
              <Sparkles className="mr-2 h-4 w-4" />
              {currentImageId ? "AI Edit Image" : "Generate with AI"}
            </Button>
          ) : (
            <button className="flex items-center gap-2 text-xs font-bold text-[#fd5523] hover:text-[#ef4a16] transition-colors">
              <Sparkles className="h-3 w-3" />
              {currentImageId ? "Magic Edit" : "Create Visual"}
            </button>
          )
        }
      />
      <DialogContent className="max-w-xl rounded-[2.5rem] border-0 shadow-2xl p-0 overflow-hidden">
        <DialogHeader className="p-8 bg-[#062e39] text-white">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-[#fd5523] rounded-xl">
              <Wand2 className="h-5 w-5 text-white" />
            </div>
            <DialogTitle className="text-2xl font-bold">
              {mode === "generate" ? "AI Visual Studio" : "Magic Image Editor"}
            </DialogTitle>
          </div>
          <DialogDescription className="text-white/70 text-base">
            Powered by Gemini 3.1 Flash. Generate context-aware visuals for your lesson.
          </DialogDescription>
        </DialogHeader>

        <div className="p-8 space-y-6">
          {/* Mode Selector if image exists */}
          {currentImageId && (
            <div className="flex p-1 bg-slate-100 rounded-xl">
              <button 
                onClick={() => setMode("generate")}
                className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all ${mode === "generate" ? "bg-white text-[#062e39] shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
              >
                New Image
              </button>
              <button 
                onClick={() => setMode("edit")}
                className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all ${mode === "edit" ? "bg-white text-[#062e39] shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
              >
                Edit Current
              </button>
            </div>
          )}

          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-bold text-[#062e39] flex items-center gap-2">
                <ImageIcon className="h-4 w-4 text-[#fd5523]" />
                {mode === "generate" ? "What should the image show?" : "What changes should we make?"}
              </label>
              <Input 
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder={mode === "generate" ? "e.g. A futuristic robot teaching a student..." : "e.g. Make the background sunset orange..."}
                className="h-12 rounded-xl border-slate-200 focus:border-[#fd5523] focus:ring-[#fd5523]/10 text-base"
                autoFocus
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-bold text-[#062e39] flex items-center gap-2">
                  <Crop className="h-4 w-4 text-slate-400" />
                  Aspect Ratio
                </label>
                <Select value={aspectRatio} onValueChange={(val) => val && setAspectRatio(val)}>
                  <SelectTrigger className="rounded-xl border-slate-200 h-10">
                    <SelectValue placeholder="Select ratio" />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl border-slate-100">
                    <SelectItem value="1:1">1:1 Square</SelectItem>
                    <SelectItem value="16:9">16:9 Landscape</SelectItem>
                    <SelectItem value="4:3">4:3 Desktop</SelectItem>
                    <SelectItem value="9:16">9:16 Portrait</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-bold text-[#062e39] flex items-center gap-2">
                  <Layers className="h-4 w-4 text-slate-400" />
                  Context
                </label>
                <div className="h-10 px-3 flex items-center rounded-xl bg-slate-50 border border-slate-100 text-[10px] font-bold text-slate-500 truncate uppercase tracking-wider">
                  {lessonTitle}
                </div>
              </div>
            </div>
          </div>

          <div className="pt-2">
            <Button 
              onClick={handleGenerate}
              disabled={isGenerating || !prompt.trim()}
              className="w-full h-14 rounded-2xl bg-[#fd5523] text-lg font-bold text-white hover:bg-[#ef4a16] shadow-xl shadow-[#fd5523]/20"
            >
              {isGenerating ? (
                <>
                  <RefreshCw className="mr-2 h-5 w-5 animate-spin" />
                  {mode === "generate" ? "Generating Visual..." : "Applying Magic Edits..."}
                </>
              ) : (
                <>
                  <Sparkles className="mr-2 h-5 w-5" />
                  {mode === "generate" ? "Create Educational Visual" : "Apply AI Edits"}
                </>
              )}
            </Button>
            <p className="mt-4 text-center text-[10px] font-bold text-slate-400 uppercase tracking-widest">
              Generated images are automatically saved to your media library
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
