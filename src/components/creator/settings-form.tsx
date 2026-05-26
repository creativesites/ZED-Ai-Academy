"use client";

import { useState, useTransition } from "react";
import { updateCompanySettings } from "@/actions/company";
import { FileUpload } from "@/components/creator/blocks/file-upload";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import {
  Loader2, Check, Layout, Palette, Image as ImageIcon,
  Type, Sparkles, Box, Columns, Rows, Grid3X3, Layers, Monitor,
  Smartphone, Zap, ExternalLink, Eye, ChevronRight, Settings2,
  FileText, Plus, Trash2, GripVertical, Landmark,
  GraduationCap, BookOpen, Star, Rocket,
} from "lucide-react";
import { cn } from "@/lib/utils";

const TEMPLATES = [
  { id: "modern", name: "Modern Bold", desc: "High-impact typography and large imagery.", colors: ["#062e39", "#fd5523", "#ffffff"] },
  { id: "classic", name: "Classic Academic", desc: "Traditional, structured university layout.", colors: ["#78350f", "#fef3c7", "#fdfbf7"] },
  { id: "minimal", name: "Minimalist", desc: "Clean, whitespace-focused and distraction-free.", colors: ["#0f172a", "#f8fafc", "#ffffff"] },
  { id: "dark_mode", name: "Dark Nebula", desc: "Sleek dark theme with vibrant neon accents.", colors: ["#0a0a0c", "#fd5523", "#1a1a20"] },
  { id: "corporate", name: "Corporate Pro", desc: "Professional, trust-focused business layout.", colors: ["#1e293b", "#2563eb", "#f1f5f9"] },
  { id: "creative", name: "Creative Studio", desc: "Playful, organic shapes and artistic vibes.", colors: ["#831843", "#d946ef", "#fdf4ff"] },
  { id: "tech", name: "Future Tech", desc: "Cyberpunk-inspired grid and geometric patterns.", colors: ["#020617", "#06b6d4", "#0f172a"] },
  { id: "elegant", name: "Elegant Serif", desc: "Sophisticated serif type and soft palettes.", colors: ["#292524", "#d6d3d1", "#f5f5f4"] }
];

export function SettingsForm({
  initialData,
  tenantSlug,
}: {
  initialData: {
    logo_url: string;
    primary_color: string;
    home_template: string;
    home_content: any;
  };
  tenantSlug: string;
}) {
  const [logoUrl, setLogoUrl] = useState(initialData.logo_url);
  const [primaryColor, setPrimaryColor] = useState(initialData.primary_color || "#fd5523");
  const [homeTemplate, setHomeTemplate] = useState(initialData.home_template || "modern");
  const defaultHomeContent = {
    hero_title: "Wisdom in Love & Faith",
    hero_subtitle: "Healing, better standards, and relationships that honor God.",
    hero_image: "",
    about_title: "About Maureen Sinovia Mulenga",
    about_text: "Founder of Me and My Sisters and a graduate of UNZA, Maureen writes with warmth, conviction, and vulnerability. Based in Lusaka, she is a faith-rooted relationship voice dedicated to women's empowerment and practical wisdom.",
    about_image: "",
    cta_title: "Start Your Healing Journey",
    cta_button: "Join Bloom Academy",
    features: [],
    tutor_name: "Maureen Sinovia Mulenga",
    tutor_bio: "Devoted Christian, speaker, entrepreneur, and author of 'Let's Fix'. Dedicated to helping readers love with more wisdom.",
    tutor_university: "UNZA",
    tutor_college: "Bachelor of Arts with Education",
    tutor_availability: "By Appointment",
    subjects: [
      { label: "Faith & Relationships", active: true },
      { label: "Women's Empowerment", active: true },
      { label: "Public Speaking", active: true },
      { label: "Author Mentorship", active: true },
    ],
    services: [
      {
        title: "Live Online Classes",
        subtitle: "Real-time, interactive sessions",
        features: [
          "Face-to-face tutor via HD video call",
          "Interactive whiteboard & screen sharing",
          "Session recordings sent after class",
          "Personalised homework & feedback",
          "Flexible scheduling — book anytime",
        ]
      },
      {
        title: "Onsite Live Tutoring",
        subtitle: "In-person at your location",
        features: [
          "Tutor visits your home or study space",
          "Full physical resources & materials",
          "Hands-on learning & lab assistance",
          "Progress reports sent to parents",
          "Available weekdays & weekends",
        ]
      },
      {
        title: "Self-Paced Courses",
        subtitle: "Learn on your own schedule",
        features: [
          "Lifetime access to all materials",
          "Video lessons, notes & quizzes",
          "Progress tracked automatically",
          "Certificate of completion",
          "Community forum & Q&A",
        ]
      },
      {
        title: "Group Sessions",
        subtitle: "Study with peers, pay less",
        badge: "3–6 students",
        features: [
          "Collaborative problem solving",
          "60% cheaper than 1-on-1 sessions",
          "Structured weekly curriculum",
          "Peer accountability & motivation",
        ]
      },
      {
        title: "Exam Preparation",
        subtitle: "Targeted crash courses",
        features: [
          "ECZ Grade 9 & Grade 12 Prep",
          "Practice papers with marking",
          "Timed mock exam conditions",
          "Exam strategy & time management",
        ]
      },
      {
        title: "One-on-One Mentorship",
        subtitle: "Deep focus on your specific needs",
        features: [
          "Highly personalized learning path",
          "Weekly 1-on-1 strategy sessions",
          "Unlimited Q&A support via chat",
          "Portfolio & project guidance",
        ]
      }
    ],
    scroll_cards_title: "The Ecosystem",
    ecosystem_cards: [
      {
        title: "Your tutor, face-to-face unbound by location.",
        subtitle: "Crystal-clear HD video, interactive whiteboards, and real-time collaboration. Revisit any complex concept with unlimited access to session recordings.",
        features: ["HD Video + Whiteboard", "Session Recordings", "Personalised Homework"]
      },
      {
        title: "The classroom comes to you.",
        subtitle: "For those who thrive in a physical environment. Our expert tutors bring bespoke materials and hands-on guidance directly to your preferred study space.",
        features: ["Curated physical lab resources", "Comprehensive progress reporting", "Flexible weekend scheduling"]
      },
      {
        title: "Curated mastery, at your pace.",
        subtitle: "Dive into beautifully structured modules featuring cinematic video lessons, interactive quizzes, and community insights. Earn a verified certificate upon completion.",
        features: []
      },
      {
        title: "Command your results with confidence.",
        subtitle: "ECZ crash courses built around real past papers, timed mock conditions, and proven score-boosting methodologies. Step into the exam hall fully prepared.",
        features: []
      }
    ]
  };

  const [homeContent, setHomeContent] = useState(() => {
    const data = initialData.home_content || {};
    if (!data || Object.keys(data).length === 0) {
      return defaultHomeContent;
    }
    // Merge so that missing keys get the default fallback
    return { ...defaultHomeContent, ...data };
  });
  const [activeTab, setActiveTab] = useState<'branding' | 'template' | 'content'>('branding');
  const [pending, startTransition] = useTransition();

  const updateContent = (key: string, value: any) => {
    setHomeContent((prev: any) => ({ ...prev, [key]: value }));
  };

  const addFeature = () => {
    const newFeatures = [...(homeContent.features || []), { title: "New Feature", description: "", icon: "Zap" }];
    updateContent("features", newFeatures);
  };

  const removeFeature = (index: number) => {
    const newFeatures = [...(homeContent.features || [])];
    newFeatures.splice(index, 1);
    updateContent("features", newFeatures);
  };

  const updateFeature = (index: number, key: string, value: string) => {
    const newFeatures = [...(homeContent.features || [])];
    newFeatures[index] = { ...newFeatures[index], [key]: value };
    updateContent("features", newFeatures);
  };

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const fd = new FormData();
    fd.append("logo_url", logoUrl);
    fd.append("primary_color", primaryColor);
    fd.append("home_template", homeTemplate);
    fd.append("home_content", JSON.stringify(homeContent));

    startTransition(async () => {
      try {
        await updateCompanySettings(fd);
        toast.success("Academy configuration saved!");
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Failed to save settings");
      }
    });
  }

  return (
    <div className="flex flex-col lg:flex-row gap-4 sm:gap-6 lg:gap-8 items-start">
      
      {/* Sticky Navigation - Horizontal scroll on mobile, vertical on desktop */}
      <aside className="w-full lg:w-72 lg:sticky lg:top-8">
        {/* Mobile: Horizontal scrollable tabs */}
        <div className="lg:hidden overflow-x-auto pb-3 -mx-1 px-1">
          <div className="flex gap-2 min-w-max">
            <button
              onClick={() => setActiveTab('branding')}
              className={cn(
                "flex items-center gap-2 px-4 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all whitespace-nowrap",
                activeTab === 'branding' ? "bg-white shadow-md text-[#062e39]" : "text-slate-400 hover:bg-white/50"
              )}
            >
              <Palette className="h-4 w-4" style={{ color: activeTab === 'branding' ? primaryColor : undefined }} />
              Branding
            </button>
            <button
              onClick={() => setActiveTab('template')}
              className={cn(
                "flex items-center gap-2 px-4 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all whitespace-nowrap",
                activeTab === 'template' ? "bg-white shadow-md text-[#062e39]" : "text-slate-400 hover:bg-white/50"
              )}
            >
              <Layout className="h-4 w-4" style={{ color: activeTab === 'template' ? primaryColor : undefined }} />
              Templates
            </button>
            <button
              onClick={() => setActiveTab('content')}
              className={cn(
                "flex items-center gap-2 px-4 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all whitespace-nowrap",
                activeTab === 'content' ? "bg-white shadow-md text-[#062e39]" : "text-slate-400 hover:bg-white/50"
              )}
            >
              <Type className="h-4 w-4" style={{ color: activeTab === 'content' ? primaryColor : undefined }} />
              Page Content
            </button>
          </div>
        </div>

        {/* Desktop: Vertical tabs */}
        <div className="hidden lg:flex lg:flex-col gap-2">
          <button
            onClick={() => setActiveTab('branding')}
            className={cn(
              "w-full flex items-center gap-3 px-6 py-4 rounded-2xl text-sm font-black uppercase tracking-widest transition-all",
              activeTab === 'branding' ? "bg-white shadow-lg text-[#062e39]" : "text-slate-400 hover:bg-white/50"
            )}
          >
            <Palette className="h-5 w-5" style={{ color: activeTab === 'branding' ? primaryColor : undefined }} />
            Branding
          </button>
          <button
            onClick={() => setActiveTab('template')}
            className={cn(
              "w-full flex items-center gap-3 px-6 py-4 rounded-2xl text-sm font-black uppercase tracking-widest transition-all",
              activeTab === 'template' ? "bg-white shadow-lg text-[#062e39]" : "text-slate-400 hover:bg-white/50"
            )}
          >
            <Layout className="h-5 w-5" style={{ color: activeTab === 'template' ? primaryColor : undefined }} />
            Templates
          </button>
          <button
            onClick={() => setActiveTab('content')}
            className={cn(
              "w-full flex items-center gap-3 px-6 py-4 rounded-2xl text-sm font-black uppercase tracking-widest transition-all",
              activeTab === 'content' ? "bg-white shadow-lg text-[#062e39]" : "text-slate-400 hover:bg-white/50"
            )}
          >
            <Type className="h-5 w-5" style={{ color: activeTab === 'content' ? primaryColor : undefined }} />
            Page Content
          </button>

          <div className="pt-8 border-t border-slate-200 mt-8">
            <a
              href={`/academy/${tenantSlug}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-between w-full px-6 py-4 rounded-2xl bg-slate-900 text-white text-[10px] font-black uppercase tracking-[0.2em] hover:bg-slate-800 transition-all group"
            >
              <span>Visit Live Site</span>
              <ExternalLink className="h-4 w-4 group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" />
            </a>
          </div>
        </div>
      </aside>

      {/* Main Form Area */}
      <form onSubmit={handleSubmit} className="flex-1 space-y-6 sm:space-y-8 lg:space-y-12 w-full max-w-4xl">
        
        {activeTab === 'branding' && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 space-y-6 sm:space-y-8">
            <section className="p-5 sm:p-8 lg:p-12 bg-white rounded-2xl sm:rounded-[2.5rem] border border-slate-100 shadow-sm space-y-6 sm:space-y-12">
              <div className="space-y-2 sm:space-y-3">
                <h3 className="text-2xl sm:text-3xl font-black text-[#062e39] uppercase tracking-tight">Core Identity</h3>
                <p className="text-xs sm:text-sm text-slate-500 font-medium">Define how your academy looks to the world.</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-10">
                <div className="space-y-3 sm:space-y-4">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Academy Logo</Label>
                  <FileUpload
                    courseId="site-assets"
                    folder="logos"
                    accept="image/*"
                    isImage={true}
                    currentUrl={logoUrl}
                    onUpload={(url) => setLogoUrl(url)}
                  />
                  <p className="text-[10px] text-slate-400 font-medium">Recommended: PNG or SVG with transparent background.</p>
                </div>

                <div className="space-y-3 sm:space-y-4">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Brand Color Accent</Label>
                  <div className="p-4 sm:p-6 rounded-2xl sm:rounded-3xl bg-slate-50 border border-slate-100 space-y-4 sm:space-y-6">
                    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 sm:gap-6">
                      <div className="relative h-16 w-16 sm:h-20 sm:w-20 shrink-0 self-center sm:self-auto">
                        <input
                          type="color"
                          value={primaryColor}
                          onChange={(e) => setPrimaryColor(e.target.value)}
                          className="absolute inset-0 h-full w-full opacity-0 cursor-pointer"
                        />
                        <div
                          className="h-full w-full rounded-2xl sm:rounded-[2rem] border-4 border-white shadow-xl transition-all"
                          style={{ backgroundColor: primaryColor }}
                        />
                      </div>
                      <div className="flex-1 space-y-2 w-full">
                        <Input
                          value={primaryColor}
                          onChange={(e) => setPrimaryColor(e.target.value)}
                          className="h-12 sm:h-14 font-mono text-base sm:text-lg rounded-xl sm:rounded-2xl border-slate-100 uppercase focus:bg-white"
                          maxLength={7}
                        />
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">HEX COLOR CODE</p>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {["#fd5523", "#06b6d4", "#8b5cf6", "#ec4899", "#10b981", "#f59e0b"].map(c => (
                        <button 
                          key={c}
                          type="button" 
                          onClick={() => setPrimaryColor(c)}
                          className="h-7 w-7 sm:h-8 sm:w-8 rounded-full border-2 border-white shadow-sm hover:scale-110 transition-transform"
                          style={{ backgroundColor: c }}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </section>
          </div>
        )}

        {activeTab === 'template' && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 space-y-6 sm:space-y-8">
            <section className="space-y-6 sm:space-y-10">
              <div className="space-y-2 px-2">
                <h3 className="text-2xl sm:text-3xl font-black text-[#062e39] uppercase tracking-tight">Choose a Vibe</h3>
                <p className="text-xs sm:text-sm text-slate-500">Pick a starting template that matches your academy's personality.</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                {TEMPLATES.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setHomeTemplate(t.id)}
                    className={cn(
                      "group p-5 sm:p-8 rounded-2xl sm:rounded-[3rem] border-2 text-left transition-all relative overflow-hidden flex flex-col",
                      homeTemplate === t.id
                        ? "border-[var(--brand)] bg-white shadow-2xl"
                        : "border-transparent bg-white hover:border-slate-200"
                    )}
                    style={{ "--brand": primaryColor } as React.CSSProperties}
                  >
                    <div className="flex items-start justify-between mb-4 sm:mb-8">
                      <div className={cn(
                        "h-10 w-10 sm:h-14 sm:w-14 rounded-xl sm:rounded-2xl flex items-center justify-center transition-all duration-500",
                        homeTemplate === t.id ? "bg-[var(--brand)] text-white rotate-6" : "bg-slate-50 text-slate-400"
                      )}>
                        {t.id === 'modern' && <Layers className="h-5 w-5 sm:h-7 sm:w-7" />}
                        {t.id === 'classic' && <Landmark className="h-5 w-5 sm:h-7 sm:w-7" />}
                        {t.id === 'minimal' && <Monitor className="h-5 w-5 sm:h-7 sm:w-7" />}
                        {t.id === 'dark_mode' && <Zap className="h-5 w-5 sm:h-7 sm:w-7" />}
                        {t.id === 'corporate' && <Box className="h-5 w-5 sm:h-7 sm:w-7" />}
                        {t.id === 'creative' && <Sparkles className="h-5 w-5 sm:h-7 sm:w-7" />}
                        {t.id === 'tech' && <Grid3X3 className="h-5 w-5 sm:h-7 sm:w-7" />}
                        {t.id === 'elegant' && <Smartphone className="h-5 w-5 sm:h-7 sm:w-7" />}
                      </div>
                      <div className="flex gap-1 sm:gap-1.5">
                        {t.colors.map((c, i) => (
                          <div key={i} className="h-2 w-2 sm:h-3 sm:w-3 rounded-full border border-slate-100" style={{ backgroundColor: c }} />
                        ))}
                      </div>
                    </div>

                    <h4 className="font-black text-[#062e39] text-base sm:text-lg uppercase tracking-tight mb-1 sm:mb-2">{t.name}</h4>
                    <p className="text-[10px] sm:text-xs text-slate-400 font-medium leading-relaxed">{t.desc}</p>
                    
                    {homeTemplate === t.id && (
                      <div className="absolute top-4 right-4 sm:top-8 sm:right-8 h-6 w-6 sm:h-8 sm:w-8 rounded-full bg-[var(--brand)] flex items-center justify-center text-white scale-in animate-in">
                        <Check className="h-3 w-3 sm:h-4 sm:w-4" />
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </section>
          </div>
        )}

        {activeTab === 'content' && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 space-y-4 sm:space-y-8 lg:space-y-12 max-w-full px-1">
  
            {/* Hero Section Content */}
            <section className="px-4 py-5 sm:p-8 lg:p-10 bg-white rounded-2xl sm:rounded-[2rem] lg:rounded-[3rem] border border-slate-100 shadow-sm space-y-5 sm:space-y-10">
              <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
                <div className="h-10 w-10 rounded-xl bg-slate-50 flex items-center justify-center shrink-0">
                  <ImageIcon className="h-5 w-5 text-slate-400" />
                </div>
                <h3 className="text-base sm:text-xl font-black text-[#062e39] uppercase tracking-tight">Hero Banner</h3>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-1 gap-5 sm:gap-8 lg:gap-12">
                <div className="space-y-5">
                  <div className="space-y-2">
                    <Label className="text-xs font-bold uppercase tracking-wider text-slate-400">Headline</Label>
                    <Input
                      value={homeContent.hero_title || ""}
                      onChange={(e) => updateContent("hero_title", e.target.value)}
                      placeholder="e.g. Master the Art of Digital Creation"
                      className="h-12 sm:h-14 rounded-xl border-slate-200 bg-slate-50/50 focus:bg-white font-bold text-base sm:text-sm"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-bold uppercase tracking-wider text-slate-400">Subtext</Label>
                    <textarea
                      value={homeContent.hero_subtitle || ""}
                      onChange={(e) => updateContent("hero_subtitle", e.target.value)}
                      placeholder="Give them a reason to join your academy in 1-2 sentences."
                      className="w-full h-28 sm:h-32 p-3 sm:p-5 rounded-xl border border-slate-200 bg-slate-50/50 focus:bg-white resize-none text-base sm:text-sm font-medium leading-relaxed focus:outline-none focus:ring-2 focus:ring-slate-200"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-bold uppercase tracking-wider text-slate-400">Featured Hero Image</Label>
                  <FileUpload
                    courseId="site-assets"
                    folder="banners"
                    accept="image/*"
                    isImage={true}
                    currentUrl={homeContent.hero_image}
                    onUpload={(url) => updateContent("hero_image", url)}
                  />
                  <p className="text-[11px] text-slate-400 font-medium pt-1">Leave empty to show a centered text-only hero.</p>
                </div>
              </div>
            </section>

            {/* About Section Content */}
            <section className="px-4 py-5 sm:p-8 lg:p-10 bg-white rounded-2xl sm:rounded-[2rem] lg:rounded-[3rem] border border-slate-100 shadow-sm space-y-5 sm:space-y-10">
              <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
                <div className="h-10 w-10 rounded-xl bg-slate-50 flex items-center justify-center shrink-0">
                  <FileText className="h-5 w-5 text-slate-400" />
                </div>
                <h3 className="text-base sm:text-xl font-black text-[#062e39] uppercase tracking-tight">Mission & Story</h3>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-1 gap-5 sm:gap-8 lg:gap-12">
                <div className="space-y-5">
                  <div className="space-y-2">
                    <Label className="text-xs font-bold uppercase tracking-wider text-slate-400">Section Title</Label>
                    <Input
                      value={homeContent.about_title || ""}
                      onChange={(e) => updateContent("about_title", e.target.value)}
                      className="h-12 sm:h-14 rounded-xl border-slate-200 bg-slate-50/50 text-base sm:text-sm"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-bold uppercase tracking-wider text-slate-400">The Story</Label>
                    <textarea
                      value={homeContent.about_text || ""}
                      onChange={(e) => updateContent("about_text", e.target.value)}
                      className="w-full h-40 sm:h-48 p-3 sm:p-5 rounded-xl border border-slate-200 bg-slate-50/50 focus:bg-white resize-none text-base sm:text-sm font-medium leading-relaxed focus:outline-none focus:ring-2 focus:ring-slate-200"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-bold uppercase tracking-wider text-slate-400">Story Image</Label>
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
            </section>

            {/* Tutor Profile Section */}
            <section className="px-4 py-5 sm:p-8 lg:p-10 bg-white rounded-2xl sm:rounded-[2rem] lg:rounded-[3rem] border border-slate-100 shadow-sm space-y-5 sm:space-y-10">
              <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
                <div className="h-10 w-10 rounded-xl bg-slate-50 flex items-center justify-center shrink-0">
                  <GraduationCap className="h-5 w-5 text-slate-400" />
                </div>
                <h3 className="text-base sm:text-xl font-black text-[#062e39] uppercase tracking-tight">Tutor Profile</h3>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-1 gap-5 sm:gap-8 lg:gap-10">
                <div className="space-y-5">
                  <div className="space-y-2">
                    <Label className="text-xs font-bold uppercase tracking-wider text-slate-400">Display Name</Label>
                    <Input
                      value={homeContent.tutor_name || ""}
                      onChange={(e) => updateContent("tutor_name", e.target.value)}
                      placeholder="Full Name"
                      className="h-12 sm:h-14 rounded-xl border-slate-200 bg-slate-50/50 text-base sm:text-sm"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-bold uppercase tracking-wider text-slate-400">Short Bio</Label>
                    <textarea
                      value={homeContent.tutor_bio || ""}
                      onChange={(e) => updateContent("tutor_bio", e.target.value)}
                      className="w-full h-32 p-3 sm:p-5 rounded-xl border border-slate-200 bg-slate-50/50 focus:bg-white resize-none text-base sm:text-sm font-medium focus:outline-none focus:ring-2 focus:ring-slate-200"
                    />
                  </div>
                </div>
                
                <div className="space-y-5">
                  <div className="grid grid-cols-1 sm:grid-cols-1 gap-4">
                    <div className="space-y-2">
                      <Label className="text-xs font-bold uppercase tracking-wider text-slate-400">Degree</Label>
                      <Input
                        value={homeContent.tutor_university || ""}
                        onChange={(e) => updateContent("tutor_university", e.target.value)}
                        className="h-12 rounded-xl border-slate-200 bg-slate-50/50 text-base sm:text-sm"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs font-bold uppercase tracking-wider text-slate-400">Institution</Label>
                      <Input
                        value={homeContent.tutor_college || ""}
                        onChange={(e) => updateContent("tutor_college", e.target.value)}
                        className="h-12 rounded-xl border-slate-200 bg-slate-50/50 text-base sm:text-sm"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-bold uppercase tracking-wider text-slate-400">Availability</Label>
                    <Input
                      value={homeContent.tutor_availability || ""}
                      onChange={(e) => updateContent("tutor_availability", e.target.value)}
                      className="h-12 rounded-xl border-slate-200 bg-slate-50/50 text-base sm:text-sm"
                    />
                  </div>
                </div>
              </div>
            </section>

            {/* Subjects Section */}
            <section className="px-4 py-5 sm:p-8 lg:p-10 bg-white rounded-2xl sm:rounded-[2rem] lg:rounded-[3rem] border border-slate-100 shadow-sm space-y-5 sm:space-y-8">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-100 pb-4 gap-4">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-slate-50 flex items-center justify-center shrink-0">
                    <BookOpen className="h-5 w-5 text-slate-400" />
                  </div>
                  <h3 className="text-base sm:text-xl font-black text-[#062e39] uppercase tracking-tight">Expertise & Subjects</h3>
                </div>
                <Button 
                  type="button" 
                  variant="outline" 
                  size="default" 
                  onClick={() => {
                    const newSubjects = [...(homeContent.subjects || []), { label: "New Subject", active: false }];
                    updateContent("subjects", newSubjects);
                  }}
                  className="rounded-xl text-sm h-11 w-full sm:w-auto flex items-center justify-center gap-2 border-slate-200"
                >
                  <Plus className="h-4 w-4" /> Add Subject
                </Button>
              </div>

              {/* Managed as responsive list blocks on mobile, fluid tags on desktop */}
              <div className="grid grid-cols-1 gap-2.5 sm:flex sm:flex-wrap sm:gap-3">
                {(homeContent.subjects || []).map((subject: any, idx: number) => (
                  <div key={idx} className="flex w-full w-100 sm:w-auto items-center justify-between gap-3 bg-slate-50 p-2.5 pl-4 rounded-xl border border-slate-200">
                    <input 
                      className="bg-transparent border-none focus:ring-0 text-base sm:text-sm font-black flex-1 min-w-0 outline-none"
                      value={subject.label}
                      onChange={(e) => {
                        const newSubjects = [...homeContent.subjects];
                        newSubjects[idx].label = e.target.value;
                        updateContent("subjects", newSubjects);
                      }}
                    />
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button 
                        type="button"
                        onClick={() => {
                          const newSubjects = [...homeContent.subjects];
                          newSubjects[idx].active = !newSubjects[idx].active;
                          updateContent("subjects", newSubjects);
                        }}
                        className={cn("h-9 w-9 rounded-xl flex items-center justify-center transition-colors shadow-sm", subject.active ? "bg-amber-500 text-white" : "bg-white border border-slate-200 text-slate-400")}
                      >
                        <Star className="h-4 w-4" />
                      </button>
                      <button 
                        type="button"
                        onClick={() => {
                          const newSubjects = [...homeContent.subjects];
                          newSubjects.splice(idx, 1);
                          updateContent("subjects", newSubjects);
                        }}
                        className="h-9 w-9 rounded-xl flex items-center justify-center bg-white border border-slate-200 text-slate-400 hover:bg-red-50 hover:text-red-500 hover:border-red-100 transition-colors shadow-sm"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* Services Section */}
            <section className="px-4 py-5 sm:p-8 lg:p-10 bg-white rounded-2xl sm:rounded-[2rem] lg:rounded-[3rem] border border-slate-100 shadow-sm space-y-5 sm:space-y-8">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-100 pb-4 gap-4">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-slate-50 flex items-center justify-center shrink-0">
                    <Rocket className="h-5 w-5 text-slate-400" />
                  </div>
                  <h3 className="text-base sm:text-xl font-black text-[#062e39] uppercase tracking-tight">Our Services</h3>
                </div>
                <Button 
                  type="button" 
                  variant="outline" 
                  size="default" 
                  onClick={() => {
                    const newServices = [...(homeContent.services || []), { 
                      title: "New Service", 
                      description: "", 
                      icon: "Sparkles",
                      features: []
                    }];
                    updateContent("services", newServices);
                  }}
                  className="rounded-xl text-sm h-11 w-full sm:w-auto flex items-center justify-center gap-2 border-slate-200"
                >
                  <Plus className="h-4 w-4" /> Add Service
                </Button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-1 gap-4 lg:gap-6">
                {(homeContent.services || []).map((service: any, idx: number) => (
                  <div 
                    key={idx} 
                    className="relative p-4 sm:p-6 rounded-2xl bg-slate-50 border border-slate-200/60 transition-all hover:bg-white hover:shadow-xl hover:shadow-slate-200/50 space-y-4"
                  >
                    {/* Top Row Layout for Title Input and Icon + Actions */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="h-11 w-11 rounded-xl bg-white shadow-sm flex items-center justify-center shrink-0 border border-slate-100">
                        <Rocket className="h-5 w-5 text-[#fd5523]" />
                      </div>
                      
                      <button 
                        type="button"
                        onClick={() => {
                          const newServices = [...homeContent.services];
                          newServices.splice(idx, 1);
                          updateContent("services", newServices);
                        }}
                        className="h-11 w-11 rounded-xl flex items-center justify-center bg-white text-red-500 border border-slate-200 shadow-sm active:scale-95 transition-all shrink-0"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>

                    {/* Form Content - Cleanly visual touch targets */}
                    <div className="space-y-3 w-full">
                      <div className="space-y-1">
                        <Label className="text-[10px] font-black uppercase tracking-wider text-slate-400">Service Title</Label>
                        <Input 
                          value={service.title}
                          onChange={(e) => {
                            const newServices = [...homeContent.services];
                            newServices[idx].title = e.target.value;
                            updateContent("services", newServices);
                          }}
                          className="h-11 rounded-xl border-slate-200 bg-white font-black text-base sm:text-lg focus-visible:ring-slate-200 placeholder:text-slate-300 text-[#062e39]"
                          placeholder="Service Title"
                        />
                      </div>
                      
                      <div className="space-y-1">
                        <Label className="text-[10px] font-black uppercase tracking-wider text-slate-400">Description</Label>
                        <textarea
                          value={service.subtitle || service.description || ""}
                          onChange={(e) => {
                            const newServices = [...homeContent.services];
                            newServices[idx].subtitle = e.target.value;
                            updateContent("services", newServices);
                          }}
                          rows={3}
                          className="w-full p-3 rounded-xl border border-slate-200 bg-white text-slate-600 text-base sm:text-sm font-medium placeholder:text-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-200"
                          placeholder="Add a short description..."
                        />
                      </div>

                      {/* Features Sub-section */}
                      <div className="space-y-2 pt-3 border-t border-slate-200/60">
                        <div className="flex items-center justify-between">
                          <Label className="text-[10px] font-black uppercase tracking-wider text-slate-400">Features Label</Label>
                          <button 
                            type="button"
                            onClick={() => {
                              const newServices = [...homeContent.services];
                              newServices[idx].features = [...(newServices[idx].features || []), "New Feature"];
                              updateContent("services", newServices);
                            }}
                            className="text-[#fd5523] hover:underline text-xs font-bold px-2 py-1 bg-white rounded-lg border border-slate-200 shadow-sm active:scale-95 transition-all"
                          >
                            + Add Feature
                          </button>
                        </div>

                        <div className="space-y-2">
                          {(service.features || []).map((feature: string, fIdx: number) => (
                            <div key={fIdx} className="flex items-center gap-2 bg-white rounded-xl p-1.5 pl-3 border border-slate-200 shadow-sm">
                              <Check className="h-4 w-4 text-emerald-500 shrink-0" />
                              <input 
                                className="bg-transparent border-none focus:ring-0 text-base sm:text-sm font-medium flex-1 p-0 outline-none min-w-0"
                                value={feature}
                                onChange={(e) => {
                                  const newServices = [...homeContent.services];
                                  newServices[idx].features[fIdx] = e.target.value;
                                  updateContent("services", newServices);
                                }}
                              />
                              <button 
                                type="button"
                                onClick={() => {
                                  const newServices = [...homeContent.services];
                                  newServices[idx].features.splice(fIdx, 1);
                                  updateContent("services", newServices);
                                }}
                                className="h-8 w-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-red-500 active:bg-slate-50 shrink-0"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* Ecosystem Cards Section */}
            <section className="px-4 py-5 sm:p-8 lg:p-10 bg-white rounded-2xl sm:rounded-[2rem] lg:rounded-[3rem] border border-slate-100 shadow-sm space-y-5 sm:space-y-8">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-100 pb-4 gap-4">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-slate-50 flex items-center justify-center shrink-0">
                    <Sparkles className="h-5 w-5 text-slate-400" />
                  </div>
                  <h3 className="text-base sm:text-xl font-black text-[#062e39] uppercase tracking-tight">Ecosystem Cards</h3>
                </div>
                <Button 
                  type="button" 
                  variant="outline" 
                  size="default" 
                  onClick={() => {
                    const newCards = [...(homeContent.ecosystem_cards || []), { 
                      title: "New Card", 
                      subtitle: "Short description", 
                      icon: "Sparkles",
                      badge: "",
                      features: ["Feature 1"]
                    }];
                    updateContent("ecosystem_cards", newCards);
                  }}
                  className="rounded-xl text-sm h-11 w-full sm:w-auto flex items-center justify-center gap-2 border-slate-200"
                >
                  <Plus className="h-4 w-4" /> Add Card
                </Button>
              </div>

              <div className="space-y-5">
                <div className="space-y-2">
                  <Label className="text-xs font-bold uppercase tracking-wider text-slate-400">Section Title</Label>
                  <Input
                    value={homeContent.scroll_cards_title || "The Ecosystem"}
                    onChange={(e) => updateContent("scroll_cards_title", e.target.value)}
                    className="h-12 sm:h-14 rounded-xl border-slate-200 bg-slate-50/50 font-bold text-base sm:text-sm"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-1 gap-4 sm:gap-6">
                  {(homeContent.ecosystem_cards || []).map((card: any, idx: number) => (
                    <div key={idx} className="p-4 sm:p-6 rounded-2xl bg-slate-50 border border-slate-200/60 space-y-4 relative">
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-[10px] font-black bg-slate-200 text-slate-700 px-2 py-1 rounded-md uppercase">Card Item</span>
                        <button 
                          type="button"
                          onClick={() => {
                            const newCards = [...homeContent.ecosystem_cards];
                            newCards.splice(idx, 1);
                            updateContent("ecosystem_cards", newCards);
                          }}
                          className="h-10 w-10 rounded-xl flex items-center justify-center bg-white text-red-500 border border-slate-200 shadow-sm active:scale-95 transition-all"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>

                      <div className="space-y-3">
                        <div className="space-y-1">
                          <Label className="text-[10px] font-black uppercase tracking-wider text-slate-400">Title</Label>
                          <Input 
                            value={card.title}
                            onChange={(e) => {
                              const newCards = [...homeContent.ecosystem_cards];
                              newCards[idx].title = e.target.value;
                              updateContent("ecosystem_cards", newCards);
                            }}
                            className="h-11 border-slate-200 bg-white font-black text-base sm:text-xl"
                            placeholder="Card Title"
                          />
                        </div>

                        <div className="space-y-1">
                          <Label className="text-[10px] font-black uppercase tracking-wider text-slate-400">Short Description</Label>
                          <textarea 
                            rows={3}
                            value={card.subtitle}
                            onChange={(e) => {
                              const newCards = [...homeContent.ecosystem_cards];
                              newCards[idx].subtitle = e.target.value;
                              updateContent("ecosystem_cards", newCards);
                            }}
                            className="w-full p-3 border border-slate-200 rounded-xl bg-white text-slate-600 text-base sm:text-sm font-medium focus:outline-none focus:ring-2 focus:ring-slate-200"
                            placeholder="Short description"
                          />
                        </div>
                      </div>

                      <div className="space-y-2 pt-3 border-t border-slate-200">
                        <div className="flex items-center justify-between">
                          <Label className="text-[10px] font-black uppercase tracking-wider text-slate-400">Card Features</Label>
                          <button 
                            type="button"
                            onClick={() => {
                              const newCards = [...homeContent.ecosystem_cards];
                              newCards[idx].features = [...(newCards[idx].features || []), "New Feature"];
                              updateContent("ecosystem_cards", newCards);
                            }}
                            className="text-[#fd5523] hover:underline text-xs font-bold px-2 py-1 bg-white rounded-lg border border-slate-200 shadow-sm active:scale-95 transition-all"
                          >
                            + Add Feature
                          </button>
                        </div>

                        <div className="space-y-2">
                          {(card.features || []).map((feature: string, fIdx: number) => (
                            <div key={fIdx} className="flex items-center gap-2 bg-white rounded-xl p-1.5 pl-3 border border-slate-200 shadow-sm">
                              <Check className="h-4 w-4 text-emerald-500 shrink-0" />
                              <input 
                                className="bg-transparent border-none focus:ring-0 text-base sm:text-sm font-medium flex-1 p-0 outline-none min-w-0"
                                value={feature}
                                onChange={(e) => {
                                  const newCards = [...homeContent.ecosystem_cards];
                                  newCards[idx].features[fIdx] = e.target.value;
                                  updateContent("ecosystem_cards", newCards);
                                }}
                              />
                              <button 
                                type="button"
                                onClick={() => {
                                  const newCards = [...homeContent.ecosystem_cards];
                                  newCards[idx].features.splice(fIdx, 1);
                                  updateContent("ecosystem_cards", newCards);
                                }}
                                className="h-8 w-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-red-500 active:bg-slate-50 shrink-0"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </section>

            {/* CTA Section Content */}
            <section className="px-4 py-5 sm:p-8 lg:p-10 rounded-2xl sm:rounded-[2rem] lg:rounded-[3rem] text-white space-y-5 sm:space-y-10 shadow-2xl relative overflow-hidden" style={{ backgroundColor: primaryColor }}>
              <div className="absolute top-0 right-0 p-4 sm:p-12 opacity-10 pointer-events-none">
                <Zap className="h-16 w-16 sm:h-32 sm:w-32" />
              </div>
              <div className="flex items-center gap-3 border-b border-white/10 pb-4 relative z-10">
                <Zap className="h-5 w-5 sm:h-6 sm:w-6" />
                <h3 className="text-base sm:text-xl font-black uppercase tracking-tight">Final CTA</h3>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 relative z-10">
                <div className="space-y-2">
                  <Label className="text-xs font-bold uppercase tracking-wider text-white/70">CTA Headline</Label>
                  <Input
                    value={homeContent.cta_title || ""}
                    onChange={(e) => updateContent("cta_title", e.target.value)}
                    className="h-12 sm:h-14 rounded-xl border-white/20 bg-white/10 text-white placeholder:text-white/40 focus:bg-white/20 text-base sm:text-sm"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-bold uppercase tracking-wider text-white/70">Button Label</Label>
                  <Input
                    value={homeContent.cta_button || ""}
                    onChange={(e) => updateContent("cta_button", e.target.value)}
                    className="h-12 sm:h-14 rounded-xl border-white/20 bg-white/10 text-white placeholder:text-white/40 focus:bg-white/20 text-base sm:text-sm"
                  />
                </div>
              </div>
            </section>
          </div>
        )}

        {/* Global Save Button - Sticky on mobile, enhanced UX */}
        <div className="sticky bottom-4 sm:bottom-6 lg:bottom-8 z-50 pt-4 sm:pt-6 lg:pt-10">
          <div className="bg-white/90 sm:bg-white/80 backdrop-blur-lg sm:backdrop-blur-xl p-3 sm:p-4 rounded-2xl sm:rounded-[3rem] border border-slate-100 shadow-xl sm:shadow-2xl flex flex-col sm:flex-row items-center gap-3 sm:gap-4">
            <div className="hidden sm:flex items-center gap-3 px-6">
              <div className="h-3 w-3 rounded-full bg-green-500 animate-pulse" />
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Ready to Publish</span>
            </div>
            <Button
              type="submit"
              disabled={pending}
              className="px-4 sm:flex-none rounded-2xl sm:rounded-[2rem] text-white px-6 sm:px-12 h-12 sm:h-16 text-xs sm:text-sm font-black uppercase tracking-[0.2em] transition-all hover:scale-[1.02] active:scale-95 shadow-lg sm:shadow-xl"
              style={{ backgroundColor: primaryColor }}
            >
              {pending ? (
                <Loader2 className="h-4 w-4 sm:h-5 sm:w-5 animate-spin mr-2 sm:mr-3" />
              ) : (
                <Sparkles className="h-4 w-4 sm:h-5 sm:w-5 mr-2 sm:mr-3" />
              )}
              Save Configuration
            </Button>
          </div>
        </div>

        {/* Mobile Live Site Link */}
        <div className="lg:hidden pt-4 pb-6">
          <a
            href={`/academy/${tenantSlug}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-between w-full px-5 py-4 rounded-2xl bg-slate-900 text-white text-[10px] font-black uppercase tracking-[0.2em] hover:bg-slate-800 transition-all group"
          >
            <span>Visit Live Site</span>
            <ExternalLink className="h-4 w-4 group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" />
          </a>
        </div>

      </form>
    </div>
  );
}