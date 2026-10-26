"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Sparkles, Loader2, Check, Wand2, Palette, ArrowRight, Layers, FileText, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { CURATED_PALETTES, BrandPalette } from "./palette-presets";

interface AIBrandModalProps {
  academyName: string;
  currentPrimaryColor: string;
  onApplyBrandKit: (kit: {
    primaryColor: string;
    secondaryColor?: string;
    template: string;
    heroTitle: string;
    heroSubtitle: string;
    aboutTitle: string;
    aboutText: string;
    services: any[];
    faqs: any[];
    ctaTitle: string;
    ctaButton: string;
  }) => void;
  onApplyPalette: (palette: BrandPalette) => void;
}

export function AIBrandModal({
  academyName,
  currentPrimaryColor,
  onApplyBrandKit,
  onApplyPalette,
}: AIBrandModalProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"ai-architect" | "palettes">("ai-architect");
  const [niche, setNiche] = useState("");
  const [targetAudience, setTargetAudience] = useState("");
  const [tone, setTone] = useState("modern");
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedKit, setGeneratedKit] = useState<any | null>(null);

  const TONES = [
    { id: "modern", label: "Modern & Bold" },
    { id: "academic", label: "Academic & Trustworthy" },
    { id: "tech", label: "Future Tech & AI" },
    { id: "warm", label: "Warm & Faith-Rooted" },
    { id: "corporate", label: "Corporate & Executive" },
    { id: "creative", label: "Creative & Expressive" },
  ];

  async function handleGenerate() {
    if (!niche.trim()) {
      toast.error("Please enter what your academy teaches.");
      return;
    }

    setIsGenerating(true);
    setGeneratedKit(null);

    try {
      const res = await fetch("/api/ai/branding-assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "generate_brand_kit",
          academyName: academyName || "Zed AI Academy",
          niche,
          targetAudience,
          tone,
        }),
      });

      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.error || "Generation failed");
      }

      setGeneratedKit(data.brandKit);
      toast.success("AI Brand Kit generated!");
    } catch (err: any) {
      toast.error(err.message || "Failed to generate brand kit");
    } finally {
      setIsGenerating(false);
    }
  }

  function handleApplyAll() {
    if (!generatedKit) return;

    onApplyBrandKit({
      primaryColor: generatedKit.primary_color || currentPrimaryColor,
      secondaryColor: generatedKit.secondary_color,
      template: generatedKit.recommended_template || "modern",
      heroTitle: generatedKit.hero_title || "",
      heroSubtitle: generatedKit.hero_subtitle || "",
      aboutTitle: generatedKit.about_title || "",
      aboutText: generatedKit.about_text || "",
      services: generatedKit.services || [],
      faqs: generatedKit.faqs || [],
      ctaTitle: generatedKit.cta_title || "",
      ctaButton: generatedKit.cta_button || "",
    });

    toast.success("AI Brand Kit applied! Review changes in your settings.");
    setIsOpen(false);
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger
        render={
          <Button
            type="button"
            className="flex items-center gap-2 rounded-2xl px-4 py-2.5 bg-[#fff6ee] text-[#fd5523] border border-[#fd5523]/30 hover:bg-[#fd5523] hover:text-white font-black text-xs uppercase tracking-wider shadow-sm transition-all"
          >
            <Sparkles className="h-4 w-4" />
            <span>AI Brand Assistant</span>
          </Button>
        }
      />
      <DialogContent className="max-w-2xl rounded-[2rem] border border-slate-100 p-0 overflow-hidden shadow-2xl bg-white max-h-[90vh] flex flex-col">
        {/* Clean Header */}
        <DialogHeader className="p-6 sm:p-8 bg-[#062e39] text-white shrink-0">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-white/10 flex items-center justify-center text-[#fd5523]">
              <Wand2 className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-xl font-black tracking-tight text-white">
                AI Brand Assistant
              </DialogTitle>
              <DialogDescription className="text-white/70 text-xs mt-0.5">
                Generate an end-to-end brand identity, color scheme, and copy in seconds.
              </DialogDescription>
            </div>
          </div>

          {/* Sub Navigation */}
          <div className="flex gap-2 mt-6 pt-4 border-t border-white/10">
            <button
              type="button"
              onClick={() => setActiveTab("ai-architect")}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-1.5 ${
                activeTab === "ai-architect"
                  ? "bg-white text-[#062e39] shadow-sm"
                  : "bg-white/10 text-white/80 hover:bg-white/20"
              }`}
            >
              <Sparkles className="h-3.5 w-3.5" />
              Generate with AI
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("palettes")}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-1.5 ${
                activeTab === "palettes"
                  ? "bg-white text-[#062e39] shadow-sm"
                  : "bg-white/10 text-white/80 hover:bg-white/20"
              }`}
            >
              <Palette className="h-3.5 w-3.5" />
              Curated Palettes
            </button>
          </div>
        </DialogHeader>

        {/* Scrollable Body */}
        <div className="p-6 sm:p-8 overflow-y-auto flex-1 space-y-6">
          {activeTab === "ai-architect" && (
            <div className="space-y-5">
              {!generatedKit ? (
                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold text-slate-700">
                      What does your academy teach? (Niche & Focus)
                    </Label>
                    <Input
                      value={niche}
                      onChange={(e) => setNiche(e.target.value)}
                      placeholder="e.g. AI Workflow Automation, High School Sciences, Public Speaking"
                      className="h-11 rounded-xl text-sm"
                      autoFocus
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold text-slate-700">
                      Target Audience (Optional)
                    </Label>
                    <Input
                      value={targetAudience}
                      onChange={(e) => setTargetAudience(e.target.value)}
                      placeholder="e.g. African entrepreneurs, high school students, career switchers"
                      className="h-11 rounded-xl text-sm"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="text-xs font-bold text-slate-700">
                      Brand Personality
                    </Label>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {TONES.map((t) => (
                        <button
                          key={t.id}
                          type="button"
                          onClick={() => setTone(t.id)}
                          className={`p-2.5 rounded-xl border text-left text-xs font-bold transition-all ${
                            tone === t.id
                              ? "border-[#fd5523] bg-[#fff6ee] text-[#fd5523]"
                              : "border-slate-200 text-slate-600 hover:border-slate-300"
                          }`}
                        >
                          {t.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="pt-2">
                    <Button
                      type="button"
                      onClick={handleGenerate}
                      disabled={isGenerating || !niche.trim()}
                      className="w-full h-12 rounded-xl bg-[#062e39] text-white font-bold text-xs uppercase tracking-wider hover:bg-slate-800 transition-all flex items-center justify-center gap-2"
                    >
                      {isGenerating ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin text-[#fd5523]" />
                          <span>Generating Brand Identity...</span>
                        </>
                      ) : (
                        <>
                          <Wand2 className="h-4 w-4 text-[#fd5523]" />
                          <span>Generate Brand Kit</span>
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              ) : (
                /* Generated Review Screen */
                <div className="space-y-5 animate-in fade-in duration-200">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                    <div className="flex items-center gap-2 text-emerald-600 font-bold text-xs">
                      <CheckCircle2 className="h-4 w-4" /> Brand Kit Generated
                    </div>
                    <button
                      type="button"
                      onClick={() => setGeneratedKit(null)}
                      className="text-xs text-slate-400 hover:text-slate-600 font-bold underline"
                    >
                      Regenerate
                    </button>
                  </div>

                  {/* Visual Palette Preview */}
                  <div className="p-4 rounded-xl bg-slate-50 border border-slate-100 space-y-2">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Recommended Palette & Template</p>
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-2">
                        <div
                          className="h-8 w-8 rounded-lg shadow-sm border border-slate-200"
                          style={{ backgroundColor: generatedKit.primary_color }}
                        />
                        <div>
                          <div className="text-xs font-bold text-slate-800">{generatedKit.primary_color}</div>
                          <div className="text-[10px] text-slate-400 uppercase">Primary</div>
                        </div>
                      </div>
                      <div className="ml-auto px-2.5 py-1 rounded-lg bg-white border border-slate-200 text-[10px] font-bold text-slate-600 uppercase">
                        Template: {generatedKit.recommended_template}
                      </div>
                    </div>
                  </div>

                  {/* Copy Highlights */}
                  <div className="space-y-3">
                    <div className="p-3.5 rounded-xl border border-slate-100 space-y-1 bg-white">
                      <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                        <FileText className="h-3 w-3 text-[#fd5523]" /> Hero Section
                      </div>
                      <h4 className="text-sm font-bold text-[#062e39]">{generatedKit.hero_title}</h4>
                      <p className="text-xs text-slate-600 leading-relaxed">{generatedKit.hero_subtitle}</p>
                    </div>

                    <div className="p-3.5 rounded-xl border border-slate-100 space-y-1 bg-white">
                      <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                        <Layers className="h-3 w-3 text-emerald-600" /> Mission & Story
                      </div>
                      <h4 className="text-xs font-bold text-[#062e39]">{generatedKit.about_title}</h4>
                      <p className="text-xs text-slate-600 leading-relaxed line-clamp-2">{generatedKit.about_text}</p>
                    </div>
                  </div>

                  {/* Apply Actions */}
                  <div className="pt-2 flex gap-3">
                    <Button
                      type="button"
                      onClick={handleApplyAll}
                      className="flex-1 h-11 rounded-xl bg-[#fd5523] text-white font-bold text-xs uppercase tracking-wider hover:bg-[#ef4a16] shadow-sm flex items-center justify-center gap-2"
                    >
                      <Sparkles className="h-4 w-4" /> Apply All to Settings
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        onApplyBrandKit({
                          primaryColor: generatedKit.primary_color || currentPrimaryColor,
                          secondaryColor: generatedKit.secondary_color,
                          template: generatedKit.recommended_template || "modern",
                          heroTitle: "",
                          heroSubtitle: "",
                          aboutTitle: "",
                          aboutText: "",
                          services: [],
                          faqs: [],
                          ctaTitle: "",
                          ctaButton: "",
                        });
                        toast.success("Applied palette and template!");
                        setIsOpen(false);
                      }}
                      className="rounded-xl border-slate-200 text-xs font-bold text-slate-600 h-11"
                    >
                      Colors Only
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === "palettes" && (
            <div className="space-y-3">
              <p className="text-xs text-slate-500 font-medium">
                Select a cohesive color palette designed for high engagement and readability:
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {CURATED_PALETTES.map((pal) => (
                  <button
                    key={pal.id}
                    type="button"
                    onClick={() => {
                      onApplyPalette(pal);
                      toast.success(`Applied ${pal.name} palette!`);
                      setIsOpen(false);
                    }}
                    className="p-3 rounded-xl border border-slate-200 text-left hover:border-[#fd5523] hover:bg-[#fffaf6] transition-all group bg-white space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-xs text-[#062e39] group-hover:text-[#fd5523] transition-colors">
                        {pal.name}
                      </span>
                      <ArrowRight className="h-3.5 w-3.5 text-slate-300 group-hover:text-[#fd5523] transition-colors" />
                    </div>

                    <div className="flex items-center gap-1.5">
                      <div className="h-6 w-6 rounded-md shadow-sm border border-slate-100" style={{ backgroundColor: pal.primary }} />
                      <div className="h-6 w-6 rounded-md shadow-sm border border-slate-100" style={{ backgroundColor: pal.secondary }} />
                      <div className="h-6 w-6 rounded-md shadow-sm border border-slate-100" style={{ backgroundColor: pal.accent }} />
                    </div>

                    <p className="text-[10px] text-slate-400 font-medium">{pal.vibe}</p>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
