"use client";

import { useState, useTransition, useMemo } from "react";
import { updateCompanySettings } from "@/actions/company";
import { FileUpload } from "@/components/creator/blocks/file-upload";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import {
  Loader2,
  Check,
  Layout,
  Palette,
  Image as ImageIcon,
  Type,
  Sparkles,
  Box,
  Monitor,
  Zap,
  ExternalLink,
  ChevronRight,
  FileText,
  Plus,
  Trash2,
  Landmark,
  GraduationCap,
  BookOpen,
  Star,
  Rocket,
  Copy,
  Layers,
  Wand2,
  HelpCircle,
  Quote,
  Eye,
  CheckCircle2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { LivePreviewPane } from "./branding/live-preview-pane";
import { AIBrandModal } from "./branding/ai-brand-modal";
import { FAQEditor } from "./branding/faq-editor";
import { TestimonialEditor } from "./branding/testimonial-editor";
import { CURATED_PALETTES, getContrastRatio, BrandPalette } from "./branding/palette-presets";

const TEMPLATES = [
  { id: "modern", name: "Modern Bold", desc: "High-impact typography and prominent imagery.", colors: ["#062e39", "#fd5523", "#ffffff"] },
  { id: "classic", name: "Classic Academic", desc: "Traditional, structured university layout.", colors: ["#78350f", "#fef3c7", "#fdfbf7"] },
  { id: "minimal", name: "Minimalist", desc: "Clean, whitespace-focused and distraction-free.", colors: ["#0f172a", "#f8fafc", "#ffffff"] },
  { id: "dark_mode", name: "Dark Nebula", desc: "Sleek dark theme with vibrant neon accents.", colors: ["#0a0a0c", "#fd5523", "#1a1a20"] },
  { id: "corporate", name: "Corporate Pro", desc: "Professional, trust-focused business layout.", colors: ["#1e293b", "#2563eb", "#f1f5f9"] },
  { id: "creative", name: "Creative Studio", desc: "Playful, organic shapes and artistic vibes.", colors: ["#831843", "#d946ef", "#fdf4ff"] },
  { id: "tech", name: "Future Tech", desc: "Cyberpunk-inspired grid and geometric patterns.", colors: ["#020617", "#06b6d4", "#0f172a"] },
  { id: "elegant", name: "Elegant Serif", desc: "Sophisticated serif type and soft palettes.", colors: ["#292524", "#d6d3d1", "#f5f5f4"] },
];

export function SettingsForm({
  initialData,
  tenantSlug,
  academyName = "",
}: {
  initialData: {
    logo_url: string;
    primary_color: string;
    home_template: string;
    home_content: any;
  };
  tenantSlug: string;
  academyName?: string;
}) {
  const [logoUrl, setLogoUrl] = useState(initialData.logo_url || "");
  const [primaryColor, setPrimaryColor] = useState(initialData.primary_color || "#fd5523");
  const [homeTemplate, setHomeTemplate] = useState(initialData.home_template || "modern");

  const defaultHomeContent = {
    hero_title: `Welcome to ${academyName || "Zed AI Academy"}`,
    hero_subtitle: "Empowering learners, professionals, and innovators with modern practical skills and certified excellence.",
    hero_image: "",
    about_title: `About ${academyName || "Zed AI Academy"}`,
    about_text: `${academyName || "Zed AI Academy"} is dedicated to delivering world-class curriculum, hands-on mentorship, and transformative learning experiences.`,
    about_image: "",
    cta_title: "Start Your Learning Journey Today",
    cta_button: "Enroll Now",
    secondary_color: "#062e39",
    features: [],
    tutor_name: "Lead Instructor",
    tutor_bio: "Experienced educator and industry practitioner committed to student success.",
    tutor_university: "University of Zambia",
    tutor_college: "School of Engineering & Technology",
    tutor_availability: "Available for Live Sessions",
    subjects: [
      { label: "AI & Automation", active: true },
      { label: "Data Science", active: true },
      { label: "Leadership & Speaking", active: true },
      { label: "Creative Media", active: true },
    ],
    services: [
      {
        title: "Live Online Classes",
        subtitle: "Real-time, interactive cohort sessions",
        features: [
          "HD video call with live instructor",
          "Interactive exercises & discussions",
          "Unlimited access to session recordings",
          "Weekly personalized feedback",
        ],
      },
      {
        title: "Self-Paced Masterclasses",
        subtitle: "Learn on your schedule anywhere",
        features: [
          "Lifetime access to lessons & materials",
          "Knowledge-check quizzes & practical tasks",
          "Verified digital certificate of completion",
          "Active community discussion forum",
        ],
      },
      {
        title: "1-on-1 Mentorship",
        subtitle: "Private tailored academic support",
        features: [
          "Dedicated 1-on-1 strategy sessions",
          "Customized learning roadmaps",
          "Priority Q&A chat with tutor",
        ],
      },
    ],
    scroll_cards_title: "The Ecosystem",
    ecosystem_cards: [
      {
        title: "Live Digital Mastery",
        subtitle: "Interactive HD virtual sessions with elite faculty and real-time screen sharing.",
        features: ["Live Virtual Lab", "Session Recordings", "Personalised Homework"],
      },
      {
        title: "On-Demand Curriculum",
        subtitle: "Cinematic video modules, interactive quizzes, and verified certification.",
        features: ["Self-paced access", "Automated grading", "Verified certificate"],
      },
    ],
    faqs: [
      {
        question: `How do I enroll in ${academyName || "this academy"}?`,
        answer: "Select your desired course, click 'Enroll Now', and create your student account. You'll get immediate access to all curriculum materials.",
      },
      {
        question: "Will I receive a verified certificate?",
        answer: "Yes, upon completing all lessons and passing quizzes, you receive a shareable digital certificate.",
      },
      {
        question: "Can I access lessons on my smartphone?",
        answer: "Absolutely! The entire academy portal is fully responsive and optimized for mobile, tablet, and desktop.",
      },
    ],
    testimonials: [
      {
        name: "Mwila Chanda",
        role: "Class of 2026",
        content: `Learning with ${academyName || "Zed AI Academy"} gave me the confidence and practical skills I needed to excel.`,
        rating: 5,
      },
      {
        name: "Blessing Tembo",
        role: "Scholar & Graduate",
        content: "The live interactive sessions and personalized feedback made all the difference in my learning journey.",
        rating: 5,
      },
    ],
  };

  const [homeContent, setHomeContent] = useState(() => {
    const data = initialData.home_content || {};
    if (!data || Object.keys(data).length === 0) {
      return defaultHomeContent;
    }
    return { ...defaultHomeContent, ...data };
  });

  const [activeTab, setActiveTab] = useState<"brand" | "templates" | "content" | "preview">("brand");
  const [contentSection, setContentSection] = useState<
    "hero" | "mission" | "tutor" | "services" | "ecosystem" | "social" | "cta"
  >("hero");
  const [pending, startTransition] = useTransition();
  const [enhancingField, setEnhancingField] = useState<string | null>(null);

  const contrast = useMemo(() => getContrastRatio(primaryColor), [primaryColor]);

  const updateContent = (key: string, value: any) => {
    setHomeContent((prev: any) => ({ ...prev, [key]: value }));
  };

  function handleApplyBrandKit(kit: {
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
  }) {
    if (kit.primaryColor) setPrimaryColor(kit.primaryColor);
    if (kit.template) setHomeTemplate(kit.template);

    setHomeContent((prev: any) => ({
      ...prev,
      secondary_color: kit.secondaryColor || prev.secondary_color,
      hero_title: kit.heroTitle || prev.hero_title,
      hero_subtitle: kit.heroSubtitle || prev.hero_subtitle,
      about_title: kit.aboutTitle || prev.about_title,
      about_text: kit.aboutText || prev.about_text,
      services: kit.services?.length ? kit.services : prev.services,
      faqs: kit.faqs?.length ? kit.faqs : prev.faqs,
      cta_title: kit.ctaTitle || prev.cta_title,
      cta_button: kit.ctaButton || prev.cta_button,
    }));
  }

  function handleApplyPalette(palette: BrandPalette) {
    setPrimaryColor(palette.primary);
    setHomeContent((prev: any) => ({
      ...prev,
      secondary_color: palette.secondary,
    }));
  }

  async function handleEnhanceField(
    fieldKey: string,
    currentValue: string,
    instruction: string = "make it punchier, clearer, and more inspiring"
  ) {
    if (!currentValue.trim()) {
      toast.error("Please enter some text first for AI to enhance.");
      return;
    }

    setEnhancingField(fieldKey);
    try {
      const res = await fetch("/api/ai/branding-assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "enhance_copy",
          field: fieldKey,
          currentText: currentValue,
          academyName: academyName || "Zed AI Academy",
          niche: homeContent.hero_subtitle || "Professional and Academic Skills",
          instruction,
        }),
      });

      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || "Enhancement failed");

      updateContent(fieldKey, data.enhancedText);
      toast.success("Enhanced with AI!");
    } catch (err: any) {
      toast.error(err.message || "Failed to enhance copy");
    } finally {
      setEnhancingField(null);
    }
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const fd = new FormData();
    fd.append("tenant_slug", tenantSlug);
    fd.append("logo_url", logoUrl);
    fd.append("primary_color", primaryColor);
    fd.append("home_template", homeTemplate);
    fd.append("home_content", JSON.stringify(homeContent));

    startTransition(async () => {
      try {
        await updateCompanySettings(fd);
        toast.success("Academy configuration published successfully!");
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Failed to save settings");
      }
    });
  }

  const copyLiveLink = () => {
    const url = `${window.location.origin}/academy/${tenantSlug}`;
    navigator.clipboard.writeText(url);
    toast.success("Copied live academy link!");
  };

  return (
    <div className="space-y-6">
      {/* Top Header Card */}
      <div className="bg-white rounded-3xl p-5 sm:p-7 border border-slate-200/80 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4 min-w-0">
        <div className="flex items-center gap-3 min-w-0 w-full">
          <div
            className="h-11 w-11 rounded-2xl flex items-center justify-center text-white font-black text-base shadow-sm shrink-0"
            style={{ backgroundColor: primaryColor }}
          >
            {logoUrl ? (
              <img src={logoUrl} alt="Logo" className="h-full w-full object-contain p-1 rounded-2xl" />
            ) : (
              (academyName || tenantSlug).charAt(0).toUpperCase()
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="font-black text-slate-900 text-lg sm:text-xl break-words min-w-0">{academyName || tenantSlug}</h2>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-[#fff6ee] text-[#fd5523] border border-[#fd5523]/20">
                Academy Branding
              </span>
            </div>
            <div className="flex items-center gap-2 text-xs text-slate-400 font-mono mt-0.5 min-w-0">
              <span className="break-all min-w-0">https://zedai.academy/academy/{tenantSlug}</span>
              <button
                type="button"
                onClick={copyLiveLink}
                className="hover:text-slate-700 text-slate-400 transition-colors"
                title="Copy Link"
              >
                <Copy className="h-3 w-3" />
              </button>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto justify-end">
          <AIBrandModal
            academyName={academyName || tenantSlug}
            currentPrimaryColor={primaryColor}
            onApplyBrandKit={handleApplyBrandKit}
            onApplyPalette={handleApplyPalette}
          />

          <Button
            type="button"
            variant="outline"
            onClick={() => setActiveTab(activeTab === "preview" ? "brand" : "preview")}
            className={cn(
              "h-11 px-4 rounded-2xl text-xs font-black uppercase tracking-wider transition-all",
              activeTab === "preview"
                ? "bg-[#062e39] text-white border-transparent"
                : "border-slate-200 text-slate-700 hover:bg-slate-50"
            )}
          >
            <Eye className="h-4 w-4 mr-1.5" />
            {activeTab === "preview" ? "Exit Preview" : "Live Preview"}
          </Button>

          <Button
            type="submit"
            form="branding-settings-form"
            disabled={pending}
            className="h-11 px-5 rounded-2xl text-white text-xs font-black uppercase tracking-wider shadow-md hover:opacity-95 active:scale-95 transition-all"
            style={{ backgroundColor: primaryColor }}
          >
            {pending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Saving...
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4 mr-2" /> Save Changes
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Main Navigation Tabs */}
      <div className="grid grid-cols-2 sm:flex sm:items-stretch gap-1 bg-slate-100 p-1.5 rounded-2xl border border-slate-200">
        <button
          type="button"
          onClick={() => setActiveTab("brand")}
          className={cn(
            "flex-1 min-w-0 py-3 px-2 sm:px-3 rounded-xl text-[11px] sm:text-xs font-black uppercase tracking-wider leading-tight text-center whitespace-normal transition-all flex items-center justify-center gap-2",
            activeTab === "brand" ? "bg-white text-[#062e39] shadow-sm" : "text-slate-500 hover:text-slate-900"
          )}
        >
          <Palette className="h-4 w-4" style={{ color: activeTab === "brand" ? primaryColor : undefined }} />
          <span>Brand Identity</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("templates")}
          className={cn(
            "flex-1 min-w-0 py-3 px-2 sm:px-3 rounded-xl text-[11px] sm:text-xs font-black uppercase tracking-wider leading-tight text-center whitespace-normal transition-all flex items-center justify-center gap-2",
            activeTab === "templates" ? "bg-white text-[#062e39] shadow-sm" : "text-slate-500 hover:text-slate-900"
          )}
        >
          <Layout className="h-4 w-4" style={{ color: activeTab === "templates" ? primaryColor : undefined }} />
          <span>Templates & Vibe</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("content")}
          className={cn(
            "flex-1 min-w-0 py-3 px-2 sm:px-3 rounded-xl text-[11px] sm:text-xs font-black uppercase tracking-wider leading-tight text-center whitespace-normal transition-all flex items-center justify-center gap-2",
            activeTab === "content" ? "bg-white text-[#062e39] shadow-sm" : "text-slate-500 hover:text-slate-900"
          )}
        >
          <Type className="h-4 w-4" style={{ color: activeTab === "content" ? primaryColor : undefined }} />
          <span>Page Content</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("preview")}
          className={cn(
            "flex-1 min-w-0 py-3 px-2 sm:px-3 rounded-xl text-[11px] sm:text-xs font-black uppercase tracking-wider leading-tight text-center whitespace-normal transition-all flex items-center justify-center gap-2",
            activeTab === "preview" ? "bg-white text-[#062e39] shadow-sm" : "text-slate-500 hover:text-slate-900"
          )}
        >
          <Eye className="h-4 w-4" style={{ color: activeTab === "preview" ? primaryColor : undefined }} />
          <span>Live Preview</span>
        </button>
      </div>

      {/* Actual Form Container */}
      <form id="branding-settings-form" onSubmit={handleSubmit} className="space-y-6">
        {/* TAB 1: Brand Identity */}
        {activeTab === "brand" && (
          <div className="space-y-6 animate-in fade-in duration-200">
            {/* Logo Card */}
            <div className="p-6 sm:p-8 bg-white rounded-3xl border border-slate-200/80 shadow-sm space-y-4">
              <div className="space-y-1">
                <Label className="text-sm font-black uppercase tracking-wider text-slate-800 flex items-center gap-2">
                  <ImageIcon className="h-4 w-4 text-[#fd5523]" /> Academy Logo
                </Label>
                <p className="text-xs text-slate-500">
                  This logo appears in your academy header, learner navigation bar, and course certificates.
                </p>
              </div>

              <FileUpload
                courseId="site-assets"
                folder="logos"
                accept="image/*"
                isImage={true}
                currentUrl={logoUrl}
                onUpload={(url) => setLogoUrl(url)}
              />
              <p className="text-[11px] text-slate-400">
                Recommended: Transparent PNG or SVG with a 1:1 or landscape aspect ratio.
              </p>
            </div>

            {/* Primary Brand Color Card */}
            <div className="p-6 sm:p-8 bg-white rounded-3xl border border-slate-200/80 shadow-sm space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="space-y-1">
                  <Label className="text-sm font-black uppercase tracking-wider text-slate-800 flex items-center gap-2">
                    <Palette className="h-4 w-4 text-[#fd5523]" /> Primary Brand Color
                  </Label>
                  <p className="text-xs text-slate-500">
                    Defines your primary action buttons, key highlights, badges, and link colors.
                  </p>
                </div>

                {/* WCAG Contrast Rating */}
                <div className="flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200 w-fit">
                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">WCAG Rating</span>
                  <span
                    className={cn(
                      "px-2 py-0.5 rounded text-[10px] font-black uppercase",
                      contrast.rating === "AAA"
                        ? "bg-emerald-100 text-emerald-800"
                        : contrast.rating === "AA"
                        ? "bg-blue-100 text-blue-800"
                        : "bg-amber-100 text-amber-800"
                    )}
                  >
                    {contrast.rating} ({contrast.onWhite}:1 vs White)
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-4 p-4 rounded-2xl bg-slate-50 border border-slate-200">
                <div className="relative h-14 w-14 shrink-0">
                  <input
                    type="color"
                    value={primaryColor}
                    onChange={(e) => setPrimaryColor(e.target.value)}
                    className="absolute inset-0 h-full w-full opacity-0 cursor-pointer"
                  />
                  <div
                    className="h-full w-full rounded-2xl border-4 border-white shadow-md transition-all cursor-pointer"
                    style={{ backgroundColor: primaryColor }}
                  />
                </div>
                <div className="flex-1 space-y-1">
                  <Input
                    value={primaryColor}
                    onChange={(e) => setPrimaryColor(e.target.value)}
                    className="h-11 font-mono text-sm uppercase rounded-xl border-slate-200 bg-white font-bold"
                    maxLength={7}
                  />
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">HEX COLOR CODE</p>
                </div>
              </div>

              {/* Curated Swatches */}
              <div className="space-y-2.5">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                  Curated Educational Palettes
                </span>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  {CURATED_PALETTES.map((pal) => (
                    <button
                      key={pal.id}
                      type="button"
                      onClick={() => handleApplyPalette(pal)}
                      className={cn(
                        "p-3 rounded-2xl border text-left transition-all flex items-center gap-2.5 group",
                        primaryColor === pal.primary
                          ? "border-[#fd5523] bg-[#fff6ee] shadow-sm"
                          : "border-slate-200/80 bg-slate-50 hover:border-slate-300 hover:bg-white"
                      )}
                    >
                      <div
                        className="h-7 w-7 rounded-xl shadow-sm border border-white shrink-0"
                        style={{ backgroundColor: pal.primary }}
                      />
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-slate-800 truncate">{pal.name}</div>
                        <div className="text-[10px] text-slate-400 font-mono">{pal.primary}</div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: Templates & Vibe */}
        {activeTab === "templates" && (
          <div className="space-y-6 animate-in fade-in duration-200">
            <div className="p-6 sm:p-8 bg-white rounded-3xl border border-slate-200/80 shadow-sm space-y-6">
              <div className="space-y-1">
                <h3 className="text-xl font-black text-[#062e39] uppercase tracking-tight">Select Template Architecture</h3>
                <p className="text-xs text-slate-500">
                  Pick a layout vibe that suits your subject domain. You can preview changes anytime in the Live Preview tab.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {TEMPLATES.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setHomeTemplate(t.id)}
                    className={cn(
                      "group p-5 rounded-3xl border-2 text-left transition-all relative overflow-hidden flex flex-col bg-white",
                      homeTemplate === t.id
                        ? "border-[#fd5523] shadow-lg shadow-[#fd5523]/10"
                        : "border-slate-200/80 hover:border-slate-300"
                    )}
                  >
                    <div className="flex items-start justify-between mb-4">
                      <div
                        className={cn(
                          "h-11 w-11 rounded-2xl flex items-center justify-center transition-all",
                          homeTemplate === t.id
                            ? "bg-[#fd5523] text-white shadow-md rotate-3"
                            : "bg-slate-100 text-slate-500"
                        )}
                      >
                        {t.id === "modern" && <Layers className="h-5 w-5" />}
                        {t.id === "classic" && <Landmark className="h-5 w-5" />}
                        {t.id === "minimal" && <Monitor className="h-5 w-5" />}
                        {t.id === "dark_mode" && <Zap className="h-5 w-5" />}
                        {t.id === "corporate" && <Box className="h-5 w-5" />}
                        {t.id === "creative" && <Sparkles className="h-5 w-5" />}
                        {t.id === "tech" && <Zap className="h-5 w-5" />}
                        {t.id === "elegant" && <Sparkles className="h-5 w-5" />}
                      </div>

                      <div className="flex gap-1">
                        {t.colors.map((c, i) => (
                          <div
                            key={i}
                            className="h-2.5 w-2.5 rounded-full border border-slate-100"
                            style={{ backgroundColor: c }}
                          />
                        ))}
                      </div>
                    </div>

                    <h4 className="font-black text-[#062e39] text-sm uppercase tracking-tight mb-1">
                      {t.name}
                    </h4>
                    <p className="text-xs text-slate-500 leading-relaxed font-medium">{t.desc}</p>

                    {homeTemplate === t.id && (
                      <div className="absolute top-3 right-3 h-6 w-6 rounded-full bg-[#fd5523] flex items-center justify-center text-white shadow-sm">
                        <Check className="h-3.5 w-3.5" />
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: Page Content & Sections */}
        {activeTab === "content" && (
          <div className="space-y-6 animate-in fade-in duration-200">
            {/* Section Sub-Nav */}
            <div className="flex overflow-x-auto pb-2 gap-1.5 -mx-1 px-1">
              {[
                { id: "hero", label: "Hero Banner", icon: ImageIcon },
                { id: "mission", label: "Mission & Story", icon: FileText },
                { id: "tutor", label: "Faculty Profile", icon: GraduationCap },
                { id: "services", label: "Services", icon: Rocket },
                { id: "ecosystem", label: "Ecosystem Cards", icon: Layers },
                { id: "social", label: "Reviews & FAQs", icon: HelpCircle },
                { id: "cta", label: "Closing CTA", icon: Zap },
              ].map((sec) => {
                const Icon = sec.icon;
                return (
                  <button
                    key={sec.id}
                    type="button"
                    onClick={() => setContentSection(sec.id as any)}
                    className={cn(
                      "flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all",
                      contentSection === sec.id
                        ? "bg-[#062e39] text-white shadow-sm"
                        : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                    )}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    <span>{sec.label}</span>
                  </button>
                );
              })}
            </div>

            {/* SECTION: Hero */}
            {contentSection === "hero" && (
              <div className="p-6 sm:p-8 bg-white rounded-3xl border border-slate-200/80 shadow-sm space-y-5">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div className="flex items-center gap-2">
                    <ImageIcon className="h-4 w-4 text-[#fd5523]" />
                    <h4 className="text-sm font-black text-[#062e39] uppercase">Hero Banner Content</h4>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs font-bold text-slate-700">Headline</Label>
                      <button
                        type="button"
                        onClick={() =>
                          handleEnhanceField("hero_title", homeContent.hero_title || "", "make it punchy, high-impact, max 8 words")
                        }
                        disabled={enhancingField === "hero_title"}
                        className="text-[11px] font-bold text-[#fd5523] hover:underline flex items-center gap-1"
                      >
                        {enhancingField === "hero_title" ? <Loader2 className="h-3 w-3 animate-spin" /> : <Wand2 className="h-3 w-3" />}
                        <span>AI Enhance</span>
                      </button>
                    </div>
                    <Input
                      value={homeContent.hero_title || ""}
                      onChange={(e) => updateContent("hero_title", e.target.value)}
                      placeholder="e.g. Master Practical AI Workflows"
                      className="h-11 rounded-xl text-sm font-bold"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs font-bold text-slate-700">Subtext & Value Proposition</Label>
                      <button
                        type="button"
                        onClick={() =>
                          handleEnhanceField("hero_subtitle", homeContent.hero_subtitle || "", "make it persuasive, clear benefit, max 2 sentences")
                        }
                        disabled={enhancingField === "hero_subtitle"}
                        className="text-[11px] font-bold text-[#fd5523] hover:underline flex items-center gap-1"
                      >
                        {enhancingField === "hero_subtitle" ? <Loader2 className="h-3 w-3 animate-spin" /> : <Wand2 className="h-3 w-3" />}
                        <span>AI Enhance</span>
                      </button>
                    </div>
                    <textarea
                      rows={3}
                      value={homeContent.hero_subtitle || ""}
                      onChange={(e) => updateContent("hero_subtitle", e.target.value)}
                      placeholder="Give prospective students a compelling reason to join in 1-2 sentences."
                      className="w-full p-3.5 rounded-xl border border-slate-200 text-xs font-medium leading-relaxed resize-none focus:outline-none focus:ring-2 focus:ring-slate-200"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold text-slate-700">Featured Hero Image</Label>
                    <FileUpload
                      courseId="site-assets"
                      folder="banners"
                      accept="image/*"
                      isImage={true}
                      currentUrl={homeContent.hero_image}
                      onUpload={(url) => updateContent("hero_image", url)}
                    />
                    <p className="text-[11px] text-slate-400">
                      Leave empty to display a clean centered typographic layout.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* SECTION: Mission */}
            {contentSection === "mission" && (
              <div className="p-6 sm:p-8 bg-white rounded-3xl border border-slate-200/80 shadow-sm space-y-5">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-[#fd5523]" />
                    <h4 className="text-sm font-black text-[#062e39] uppercase">Mission & Story</h4>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold text-slate-700">Section Title</Label>
                    <Input
                      value={homeContent.about_title || ""}
                      onChange={(e) => updateContent("about_title", e.target.value)}
                      placeholder="e.g. Our Mission & Story"
                      className="h-11 rounded-xl text-sm font-bold"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs font-bold text-slate-700">Story Narrative</Label>
                      <button
                        type="button"
                        onClick={() =>
                          handleEnhanceField("about_text", homeContent.about_text || "", "make it authentic, warm, and inspiring")
                        }
                        disabled={enhancingField === "about_text"}
                        className="text-[11px] font-bold text-[#fd5523] hover:underline flex items-center gap-1"
                      >
                        {enhancingField === "about_text" ? <Loader2 className="h-3 w-3 animate-spin" /> : <Wand2 className="h-3 w-3" />}
                        <span>AI Enhance</span>
                      </button>
                    </div>
                    <textarea
                      rows={5}
                      value={homeContent.about_text || ""}
                      onChange={(e) => updateContent("about_text", e.target.value)}
                      className="w-full p-3.5 rounded-xl border border-slate-200 text-xs font-medium leading-relaxed resize-none focus:outline-none focus:ring-2 focus:ring-slate-200"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold text-slate-700">Story Image</Label>
                    <FileUpload
                      courseId="site-assets"
                      folder="about"
                      accept="image/*"
                      isImage={true}
                      currentUrl={homeContent.about_image}
                      onUpload={(url) => updateContent("about_image", url)}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* SECTION: Tutor */}
            {contentSection === "tutor" && (
              <div className="p-6 sm:p-8 bg-white rounded-3xl border border-slate-200/80 shadow-sm space-y-5">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div className="flex items-center gap-2">
                    <GraduationCap className="h-4 w-4 text-[#fd5523]" />
                    <h4 className="text-sm font-black text-[#062e39] uppercase">Faculty & Tutor Credentials</h4>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label className="text-xs font-bold text-slate-700">Display Name</Label>
                      <Input
                        value={homeContent.tutor_name || ""}
                        onChange={(e) => updateContent("tutor_name", e.target.value)}
                        placeholder="Full Name"
                        className="h-11 rounded-xl text-sm font-bold"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-bold text-slate-700">Availability</Label>
                      <Input
                        value={homeContent.tutor_availability || ""}
                        onChange={(e) => updateContent("tutor_availability", e.target.value)}
                        placeholder="e.g. By Appointment / Cohort Starts Monday"
                        className="h-11 rounded-xl text-sm"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold text-slate-700">Short Bio</Label>
                    <textarea
                      rows={3}
                      value={homeContent.tutor_bio || ""}
                      onChange={(e) => updateContent("tutor_bio", e.target.value)}
                      className="w-full p-3 rounded-xl border border-slate-200 text-xs font-medium resize-none"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label className="text-xs font-bold text-slate-700">Degree</Label>
                      <Input
                        value={homeContent.tutor_university || ""}
                        onChange={(e) => updateContent("tutor_university", e.target.value)}
                        placeholder="e.g. MSc Computer Science"
                        className="h-11 rounded-xl text-sm"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-bold text-slate-700">Institution</Label>
                      <Input
                        value={homeContent.tutor_college || ""}
                        onChange={(e) => updateContent("tutor_college", e.target.value)}
                        placeholder="e.g. University of Zambia"
                        className="h-11 rounded-xl text-sm"
                      />
                    </div>
                  </div>

                  {/* Subject Tag Chips */}
                  <div className="space-y-2 pt-2 border-t border-slate-100">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs font-bold text-slate-700">Subject Tags</Label>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          const newSubjects = [...(homeContent.subjects || []), { label: "New Subject", active: true }];
                          updateContent("subjects", newSubjects);
                        }}
                        className="h-8 rounded-lg text-xs font-bold"
                      >
                        <Plus className="h-3.5 w-3.5 mr-1" /> Add Subject
                      </Button>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {(homeContent.subjects || []).map((sub: any, idx: number) => (
                        <div
                          key={idx}
                          className="flex items-center gap-1.5 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200 text-xs"
                        >
                          <input
                            value={sub.label}
                            onChange={(e) => {
                              const next = [...homeContent.subjects];
                              next[idx].label = e.target.value;
                              updateContent("subjects", next);
                            }}
                            className="bg-transparent border-none outline-none font-bold text-slate-800 text-xs w-28"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              const next = [...homeContent.subjects];
                              next[idx].active = !next[idx].active;
                              updateContent("subjects", next);
                            }}
                            className={cn("p-1 rounded-md", sub.active ? "text-amber-500" : "text-slate-300")}
                          >
                            <Star className="h-3 w-3 fill-current" />
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              const next = [...homeContent.subjects];
                              next.splice(idx, 1);
                              updateContent("subjects", next);
                            }}
                            className="p-1 text-slate-400 hover:text-red-500"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* SECTION: Services */}
            {contentSection === "services" && (
              <div className="p-6 sm:p-8 bg-white rounded-3xl border border-slate-200/80 shadow-sm space-y-5">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div className="flex items-center gap-2">
                    <Rocket className="h-4 w-4 text-[#fd5523]" />
                    <h4 className="text-sm font-black text-[#062e39] uppercase">Academy Services & Formats</h4>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => {
                      const newServices = [
                        ...(homeContent.services || []),
                        { title: "New Service", subtitle: "Short description", features: ["Key Feature 1", "Key Feature 2"] },
                      ];
                      updateContent("services", newServices);
                    }}
                    className="h-8 rounded-lg text-xs font-bold bg-[#062e39] text-white"
                  >
                    <Plus className="h-3.5 w-3.5 mr-1" /> Add Service
                  </Button>
                </div>

                <div className="space-y-4">
                  {(homeContent.services || []).map((service: any, idx: number) => (
                    <div key={idx} className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-3">
                      <div className="flex items-center justify-between gap-2">
                        <Input
                          value={service.title}
                          onChange={(e) => {
                            const next = [...homeContent.services];
                            next[idx].title = e.target.value;
                            updateContent("services", next);
                          }}
                          className="h-10 rounded-xl bg-white font-bold text-sm text-slate-800"
                          placeholder="Service Title"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            const next = [...homeContent.services];
                            next.splice(idx, 1);
                            updateContent("services", next);
                          }}
                          className="p-2 text-slate-400 hover:text-red-500 rounded-lg hover:bg-red-50"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>

                      <textarea
                        rows={2}
                        value={service.subtitle || ""}
                        onChange={(e) => {
                          const next = [...homeContent.services];
                          next[idx].subtitle = e.target.value;
                          updateContent("services", next);
                        }}
                        placeholder="Short tagline..."
                        className="w-full p-2.5 rounded-xl border border-slate-200 bg-white text-xs font-medium resize-none focus:outline-none"
                      />

                      {/* Features */}
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-black uppercase text-slate-400">Features</span>
                          <button
                            type="button"
                            onClick={() => {
                              const next = [...homeContent.services];
                              next[idx].features = [...(next[idx].features || []), "New Feature"];
                              updateContent("services", next);
                            }}
                            className="text-[10px] font-bold text-[#fd5523] hover:underline"
                          >
                            + Feature
                          </button>
                        </div>
                        {(service.features || []).map((f: string, fIdx: number) => (
                          <div key={fIdx} className="flex items-center gap-2">
                            <Check className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                            <input
                              value={f}
                              onChange={(e) => {
                                const next = [...homeContent.services];
                                next[idx].features[fIdx] = e.target.value;
                                updateContent("services", next);
                              }}
                              className="h-8 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-medium flex-1 outline-none"
                            />
                            <button
                              type="button"
                              onClick={() => {
                                const next = [...homeContent.services];
                                next[idx].features.splice(fIdx, 1);
                                updateContent("services", next);
                              }}
                              className="p-1 text-slate-400 hover:text-red-500"
                            >
                              <Trash2 className="h-3 w-3" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* SECTION: Ecosystem Cards */}
            {contentSection === "ecosystem" && (
              <div className="p-6 sm:p-8 bg-white rounded-3xl border border-slate-200/80 shadow-sm space-y-5">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div className="flex items-center gap-2">
                    <Layers className="h-4 w-4 text-[#fd5523]" />
                    <h4 className="text-sm font-black text-[#062e39] uppercase">Educational Ecosystem Cards</h4>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => {
                      const newCards = [
                        ...(homeContent.ecosystem_cards || []),
                        { title: "New Card", subtitle: "Short description", features: ["Benefit 1"] },
                      ];
                      updateContent("ecosystem_cards", newCards);
                    }}
                    className="h-8 rounded-lg text-xs font-bold bg-[#062e39] text-white"
                  >
                    <Plus className="h-3.5 w-3.5 mr-1" /> Add Card
                  </Button>
                </div>

                <div className="space-y-4">
                  <div className="space-y-1">
                    <Label className="text-xs font-bold text-slate-700">Section Headline</Label>
                    <Input
                      value={homeContent.scroll_cards_title || "The Ecosystem"}
                      onChange={(e) => updateContent("scroll_cards_title", e.target.value)}
                      className="h-11 rounded-xl text-sm font-bold"
                    />
                  </div>

                  {(homeContent.ecosystem_cards || []).map((card: any, idx: number) => (
                    <div key={idx} className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-black uppercase text-slate-400">Card 0{idx + 1}</span>
                        <button
                          type="button"
                          onClick={() => {
                            const next = [...homeContent.ecosystem_cards];
                            next.splice(idx, 1);
                            updateContent("ecosystem_cards", next);
                          }}
                          className="p-1.5 text-slate-400 hover:text-red-500"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>

                      <Input
                        value={card.title}
                        onChange={(e) => {
                          const next = [...homeContent.ecosystem_cards];
                          next[idx].title = e.target.value;
                          updateContent("ecosystem_cards", next);
                        }}
                        className="h-10 rounded-xl bg-white font-bold text-sm"
                        placeholder="Title"
                      />

                      <textarea
                        rows={2}
                        value={card.subtitle}
                        onChange={(e) => {
                          const next = [...homeContent.ecosystem_cards];
                          next[idx].subtitle = e.target.value;
                          updateContent("ecosystem_cards", next);
                        }}
                        className="w-full p-2.5 rounded-xl border border-slate-200 bg-white text-xs resize-none"
                        placeholder="Description"
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* SECTION: Reviews & FAQs */}
            {contentSection === "social" && (
              <div className="space-y-6">
                <div className="p-6 sm:p-8 bg-white rounded-3xl border border-slate-200/80 shadow-sm">
                  <FAQEditor
                    faqs={homeContent.faqs || []}
                    onChange={(faqs) => updateContent("faqs", faqs)}
                    academyName={academyName || tenantSlug}
                  />
                </div>

                <div className="p-6 sm:p-8 bg-white rounded-3xl border border-slate-200/80 shadow-sm">
                  <TestimonialEditor
                    testimonials={homeContent.testimonials || []}
                    onChange={(testimonials) => updateContent("testimonials", testimonials)}
                    academyName={academyName || tenantSlug}
                  />
                </div>
              </div>
            )}

            {/* SECTION: CTA */}
            {contentSection === "cta" && (
              <div className="p-6 sm:p-8 bg-white rounded-3xl border border-slate-200/80 shadow-sm space-y-5">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div className="flex items-center gap-2">
                    <Zap className="h-4 w-4 text-[#fd5523]" />
                    <h4 className="text-sm font-black text-[#062e39] uppercase">Conversion Call-To-Action</h4>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold text-slate-700">CTA Headline</Label>
                    <Input
                      value={homeContent.cta_title || ""}
                      onChange={(e) => updateContent("cta_title", e.target.value)}
                      placeholder="e.g. Ready to Transform Your Career?"
                      className="h-11 rounded-xl text-sm font-bold"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold text-slate-700">Button Label</Label>
                    <Input
                      value={homeContent.cta_button || ""}
                      onChange={(e) => updateContent("cta_button", e.target.value)}
                      placeholder="e.g. Start Your Journey Today"
                      className="h-11 rounded-xl text-sm font-bold"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 4: Dedicated Live Preview Canvas (Full Width) */}
        {activeTab === "preview" && (
          <div className="animate-in fade-in duration-200">
            <LivePreviewPane
              tenantSlug={tenantSlug}
              academyName={academyName || tenantSlug}
              logoUrl={logoUrl}
              primaryColor={primaryColor}
              homeTemplate={homeTemplate}
              homeContent={homeContent}
            />
          </div>
        )}
      </form>

      {/* Sticky Bottom Action Bar */}
      {activeTab !== "preview" && (
        <div className="sticky bottom-[calc(4.5rem+env(safe-area-inset-bottom)+0.5rem)] md:bottom-6 z-40 bg-white/95 backdrop-blur-md p-4 rounded-2xl border border-slate-200 shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
          <div className="flex items-center gap-2 text-xs font-medium text-slate-500">
            <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>Ready to publish updates</span>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setActiveTab("preview")}
              className="flex-1 sm:flex-none rounded-xl text-xs font-bold border-slate-200 text-slate-700"
            >
              <Eye className="h-3.5 w-3.5 mr-1.5" />
              Preview Site
            </Button>

            <Button
              type="submit"
              form="branding-settings-form"
              disabled={pending}
              className="flex-1 sm:flex-none rounded-xl text-xs font-black uppercase tracking-wider text-white px-5 shadow-sm"
              style={{ backgroundColor: primaryColor }}
            >
              {pending ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> Saving...
                </>
              ) : (
                "Save Configuration"
              )}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
