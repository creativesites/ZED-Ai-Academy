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
  const [homeContent, setHomeContent] = useState(initialData.home_content || {
    hero_title: "",
    hero_subtitle: "",
    hero_image: "",
    about_title: "Our Mission",
    about_text: "",
    about_image: "",
    cta_title: "Start Your Journey",
    cta_button: "Enroll Now",
    features: [],
    tutor_name: "",
    tutor_bio: "",
    tutor_university: "University Degree",
    tutor_college: "Accredited Institution",
    tutor_availability: "Mon - Fri",
    subjects: [
      { label: "Mathematics", active: true },
      { label: "Geography", active: false },
      { label: "English", active: false },
      { label: "Python", active: false },
      { label: "+ 17 more", active: true },
    ],
    services: [
      {
        title: "Live Online Classes",
        description: "Real-time, interactive sessions",
        icon: "Video",
        features: ["Face-to-face tutor via HD video call", "Interactive whiteboard & screen sharing"]
      }
    ]
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
    <div className="flex flex-col lg:flex-row gap-10 items-start">
      {/* Sticky Navigation */}
      <aside className="w-full lg:w-72 lg:sticky lg:top-8 space-y-2">
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
              className="flex items-center justify-between w-full px-6 py-4 rounded-2xl bg-slate-900 text-white text-xs font-black uppercase tracking-widest hover:bg-slate-800 transition-all group"
            >
              <span>Visit Live Site</span>
              <ExternalLink className="h-4 w-4 group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" />
            </a>
        </div>
      </aside>

      {/* Main Form Area */}
      <form onSubmit={handleSubmit} className="flex-1 space-y-12 w-full max-w-4xl">
        
        {activeTab === 'branding' && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 space-y-8">
            <section className="p-10 bg-white rounded-[3rem] border border-slate-100 shadow-sm space-y-10">
              <div className="space-y-2">
                <h3 className="text-2xl font-black text-[#062e39] uppercase tracking-tight">Core Identity</h3>
                <p className="text-sm text-slate-500">Define how your academy looks to the world.</p>
              </div>

              <div className="grid md:grid-cols-2 gap-10">
                <div className="space-y-4">
                  <Label className="text-xs font-black uppercase tracking-widest text-slate-400">Academy Logo</Label>
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

                <div className="space-y-4">
                  <Label className="text-xs font-black uppercase tracking-widest text-slate-400">Brand Color Accent</Label>
                  <div className="p-6 rounded-3xl bg-slate-50 border border-slate-100 space-y-6">
                    <div className="flex items-center gap-6">
                      <div className="relative h-20 w-20 shrink-0">
                        <input
                          type="color"
                          value={primaryColor}
                          onChange={(e) => setPrimaryColor(e.target.value)}
                          className="absolute inset-0 h-full w-full opacity-0 cursor-pointer"
                        />
                        <div
                          className="h-full w-full rounded-[2rem] border-4 border-white shadow-xl transition-all"
                          style={{ backgroundColor: primaryColor }}
                        />
                      </div>
                      <div className="flex-1 space-y-2">
                        <Input
                          value={primaryColor}
                          onChange={(e) => setPrimaryColor(e.target.value)}
                          className="h-14 font-mono text-lg rounded-2xl border-slate-100 uppercase focus:bg-white"
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
                          className="h-8 w-8 rounded-full border-2 border-white shadow-sm hover:scale-110 transition-transform"
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
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 space-y-8">
             <section className="space-y-10">
              <div className="space-y-2 px-2">
                <h3 className="text-2xl font-black text-[#062e39] uppercase tracking-tight">Choose a Vibe</h3>
                <p className="text-sm text-slate-500">Pick a starting template that matches your academy's personality.</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                {TEMPLATES.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setHomeTemplate(t.id)}
                    className={cn(
                      "group p-8 rounded-[3rem] border-2 text-left transition-all relative overflow-hidden flex flex-col",
                      homeTemplate === t.id
                        ? "border-[var(--brand)] bg-white shadow-2xl"
                        : "border-transparent bg-white hover:border-slate-200"
                    )}
                    style={{ "--brand": primaryColor } as React.CSSProperties}
                  >
                    <div className="flex items-start justify-between mb-8">
                       <div className={cn(
                        "h-14 w-14 rounded-2xl flex items-center justify-center transition-all duration-500",
                        homeTemplate === t.id ? "bg-[var(--brand)] text-white rotate-6" : "bg-slate-50 text-slate-400"
                      )}>
                        {t.id === 'modern' && <Layers className="h-7 w-7" />}
                        {t.id === 'classic' && <Landmark className="h-7 w-7" />}
                        {t.id === 'minimal' && <Monitor className="h-7 w-7" />}
                        {t.id === 'dark_mode' && <Zap className="h-7 w-7" />}
                        {t.id === 'corporate' && <Box className="h-7 w-7" />}
                        {t.id === 'creative' && <Sparkles className="h-7 w-7" />}
                        {t.id === 'tech' && <Grid3X3 className="h-7 w-7" />}
                        {t.id === 'elegant' && <Smartphone className="h-7 w-7" />}
                      </div>
                      <div className="flex gap-1.5">
                        {t.colors.map((c, i) => (
                          <div key={i} className="h-3 w-3 rounded-full border border-slate-100" style={{ backgroundColor: c }} />
                        ))}
                      </div>
                    </div>

                    <h4 className="font-black text-[#062e39] text-lg uppercase tracking-tight mb-2">{t.name}</h4>
                    <p className="text-xs text-slate-400 font-medium leading-relaxed">{t.desc}</p>
                    
                    {homeTemplate === t.id && (
                      <div className="absolute top-8 right-8 h-8 w-8 rounded-full bg-[var(--brand)] flex items-center justify-center text-white scale-in animate-in">
                        <Check className="h-4 w-4" />
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </section>
          </div>
        )}

        {activeTab === 'content' && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 space-y-12">
            {/* Hero Section Content */}
            <section className="p-10 bg-white rounded-[3rem] border border-slate-100 shadow-sm space-y-10">
               <div className="flex items-center justify-between border-b border-slate-100 pb-6">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-slate-50 flex items-center justify-center">
                    <ImageIcon className="h-5 w-5 text-slate-400" />
                  </div>
                  <h3 className="text-xl font-black text-[#062e39] uppercase tracking-tight">Hero Banner</h3>
                </div>
              </div>

              <div className="grid lg:grid-cols-2 gap-12">
                <div className="space-y-8">
                  <div className="space-y-3">
                    <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Headline</Label>
                    <Input
                      value={homeContent.hero_title || ""}
                      onChange={(e) => updateContent("hero_title", e.target.value)}
                      placeholder="e.g. Master the Art of Digital Creation"
                      className="h-14 rounded-2xl border-slate-100 bg-slate-50/50 focus:bg-white font-bold"
                    />
                  </div>
                  <div className="space-y-3">
                    <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Subtext</Label>
                    <textarea
                      value={homeContent.hero_subtitle || ""}
                      onChange={(e) => updateContent("hero_subtitle", e.target.value)}
                      placeholder="Give them a reason to join your academy in 1-2 sentences."
                      className="w-full h-32 p-5 rounded-2xl border-slate-100 bg-slate-50/50 focus:bg-white resize-none text-sm font-medium leading-relaxed"
                    />
                  </div>
                </div>
                <div className="space-y-4">
                   <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Featured Hero Image</Label>
                   <FileUpload
                    courseId="site-assets"
                    folder="banners"
                    accept="image/*"
                    isImage={true}
                    currentUrl={homeContent.hero_image}
                    onUpload={(url) => updateContent("hero_image", url)}
                  />
                  <p className="text-[10px] text-slate-400 font-medium">Leave empty to show a centered text-only hero.</p>
                </div>
              </div>
            </section>

            {/* About Section Content */}
            <section className="p-10 bg-white rounded-[3rem] border border-slate-100 shadow-sm space-y-10">
               <div className="flex items-center justify-between border-b border-slate-100 pb-6">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-slate-50 flex items-center justify-center">
                    <FileText className="h-5 w-5 text-slate-400" />
                  </div>
                  <h3 className="text-xl font-black text-[#062e39] uppercase tracking-tight">Mission & Story</h3>
                </div>
              </div>

              <div className="grid lg:grid-cols-2 gap-12">
                <div className="space-y-8">
                   <div className="space-y-3">
                    <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Section Title</Label>
                    <Input
                      value={homeContent.about_title || ""}
                      onChange={(e) => updateContent("about_title", e.target.value)}
                      className="h-14 rounded-2xl border-slate-100 bg-slate-50/50"
                    />
                  </div>
                  <div className="space-y-3">
                    <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">The Story</Label>
                    <textarea
                      value={homeContent.about_text || ""}
                      onChange={(e) => updateContent("about_text", e.target.value)}
                      className="w-full h-48 p-5 rounded-2xl border-slate-100 bg-slate-50/50 focus:bg-white resize-none text-sm font-medium leading-relaxed"
                    />
                  </div>
                </div>
                <div className="space-y-4">
                   <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Story Image</Label>
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
            <section className="p-10 bg-white rounded-[3rem] border border-slate-100 shadow-sm space-y-10">
               <div className="flex items-center justify-between border-b border-slate-100 pb-6">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-slate-50 flex items-center justify-center">
                    <GraduationCap className="h-5 w-5 text-slate-400" />
                  </div>
                  <h3 className="text-xl font-black text-[#062e39] uppercase tracking-tight">Tutor Profile</h3>
                </div>
              </div>

              <div className="grid lg:grid-cols-2 gap-10">
                <div className="space-y-6">
                  <div className="space-y-3">
                    <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Display Name</Label>
                    <Input
                      value={homeContent.tutor_name || ""}
                      onChange={(e) => updateContent("tutor_name", e.target.value)}
                      placeholder="Full Name"
                      className="h-14 rounded-2xl border-slate-100 bg-slate-50/50"
                    />
                  </div>
                  <div className="space-y-3">
                    <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Short Bio</Label>
                    <textarea
                      value={homeContent.tutor_bio || ""}
                      onChange={(e) => updateContent("tutor_bio", e.target.value)}
                      className="w-full h-32 p-5 rounded-2xl border-slate-100 bg-slate-50/50 focus:bg-white resize-none text-sm font-medium"
                    />
                  </div>
                </div>
                <div className="space-y-6">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-3">
                      <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Degree</Label>
                      <Input
                        value={homeContent.tutor_university || ""}
                        onChange={(e) => updateContent("tutor_university", e.target.value)}
                        className="h-12 rounded-xl border-slate-100 bg-slate-50/50"
                      />
                    </div>
                    <div className="space-y-3">
                      <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Institution</Label>
                      <Input
                        value={homeContent.tutor_college || ""}
                        onChange={(e) => updateContent("tutor_college", e.target.value)}
                        className="h-12 rounded-xl border-slate-100 bg-slate-50/50"
                      />
                    </div>
                  </div>
                  <div className="space-y-3">
                    <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Availability</Label>
                    <Input
                      value={homeContent.tutor_availability || ""}
                      onChange={(e) => updateContent("tutor_availability", e.target.value)}
                      className="h-12 rounded-xl border-slate-100 bg-slate-50/50"
                    />
                  </div>
                </div>
              </div>
            </section>

            {/* Subjects Section */}
            <section className="p-10 bg-white rounded-[3rem] border border-slate-100 shadow-sm space-y-8">
              <div className="flex items-center justify-between border-b border-slate-100 pb-6">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-slate-50 flex items-center justify-center">
                    <BookOpen className="h-5 w-5 text-slate-400" />
                  </div>
                  <h3 className="text-xl font-black text-[#062e39] uppercase tracking-tight">Expertise & Subjects</h3>
                </div>
                <Button 
                  type="button" 
                  variant="outline" 
                  size="sm" 
                  onClick={() => {
                    const newSubjects = [...(homeContent.subjects || []), { label: "New Subject", active: false }];
                    updateContent("subjects", newSubjects);
                  }}
                  className="rounded-xl"
                >
                  <Plus className="h-4 w-4 mr-2" /> Add Subject
                </Button>
              </div>

              <div className="flex flex-wrap gap-4">
                {(homeContent.subjects || []).map((subject: any, idx: number) => (
                  <div key={idx} className="flex items-center gap-2 bg-slate-50 p-2 pl-4 rounded-full border border-slate-200">
                    <input 
                      className="bg-transparent border-none focus:ring-0 text-xs font-bold w-24"
                      value={subject.label}
                      onChange={(e) => {
                        const newSubjects = [...homeContent.subjects];
                        newSubjects[idx].label = e.target.value;
                        updateContent("subjects", newSubjects);
                      }}
                    />
                    <button 
                      type="button"
                      onClick={() => {
                        const newSubjects = [...homeContent.subjects];
                        newSubjects[idx].active = !newSubjects[idx].active;
                        updateContent("subjects", newSubjects);
                      }}
                      className={cn("h-6 w-6 rounded-full flex items-center justify-center", subject.active ? "bg-amber-500 text-white" : "bg-slate-200")}
                    >
                      <Star className="h-3 w-3" />
                    </button>
                    <button 
                      type="button"
                      onClick={() => {
                        const newSubjects = [...homeContent.subjects];
                        newSubjects.splice(idx, 1);
                        updateContent("subjects", newSubjects);
                      }}
                      className="h-6 w-6 rounded-full flex items-center justify-center hover:bg-red-50 hover:text-red-500"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            </section>

            {/* Services Section */}
            <section className="p-10 bg-white rounded-[3rem] border border-slate-100 shadow-sm space-y-8">
              <div className="flex items-center justify-between border-b border-slate-100 pb-6">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-slate-50 flex items-center justify-center">
                    <Rocket className="h-5 w-5 text-slate-400" />
                  </div>
                  <h3 className="text-xl font-black text-[#062e39] uppercase tracking-tight">Our Services</h3>
                </div>
                <Button 
                  type="button" 
                  variant="outline" 
                  size="sm" 
                  onClick={() => {
                    const newServices = [...(homeContent.services || []), { 
                      title: "New Service", 
                      description: "", 
                      icon: "Sparkles",
                      features: []
                    }];
                    updateContent("services", newServices);
                  }}
                  className="rounded-xl"
                >
                  <Plus className="h-4 w-4 mr-2" /> Add Service
                </Button>
              </div>

              <div className="grid md:grid-cols-2 gap-6">
                {(homeContent.services || []).map((service: any, idx: number) => (
                  <div key={idx} className="p-6 rounded-[2.5rem] bg-slate-50 border border-slate-100 space-y-4 relative">
                    <button 
                      type="button"
                      onClick={() => {
                        const newServices = [...homeContent.services];
                        newServices.splice(idx, 1);
                        updateContent("services", newServices);
                      }}
                      className="absolute top-4 right-4 h-8 w-8 rounded-full flex items-center justify-center bg-white text-red-500 shadow-sm hover:bg-red-50"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                    <div className="flex items-center gap-4">
                      <div className="h-12 w-12 rounded-xl bg-white shadow-sm flex items-center justify-center">
                         <Rocket className="h-6 w-6 text-slate-400" />
                      </div>
                      <div className="flex-1">
                        <Input 
                          value={service.title}
                          onChange={(e) => {
                            const newServices = [...homeContent.services];
                            newServices[idx].title = e.target.value;
                            updateContent("services", newServices);
                          }}
                          className="h-10 border-none bg-transparent font-bold text-lg p-0 focus-visible:ring-0"
                        />
                        <Input 
                          value={service.subtitle || service.description}
                          onChange={(e) => {
                            const newServices = [...homeContent.services];
                            newServices[idx].subtitle = e.target.value;
                            updateContent("services", newServices);
                          }}
                          className="h-6 border-none bg-transparent text-slate-400 text-xs p-0 focus-visible:ring-0"
                          placeholder="Short description"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* Ecosystem Cards Section */}
            <section className="p-10 bg-white rounded-[3rem] border border-slate-100 shadow-sm space-y-8">
              <div className="flex items-center justify-between border-b border-slate-100 pb-6">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-slate-50 flex items-center justify-center">
                    <Sparkles className="h-5 w-5 text-slate-400" />
                  </div>
                  <h3 className="text-xl font-black text-[#062e39] uppercase tracking-tight">Ecosystem Cards</h3>
                </div>
              </div>
              <div className="space-y-4">
                <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Section Title</Label>
                <Input
                  value={homeContent.scroll_cards_title || "The Ecosystem"}
                  onChange={(e) => updateContent("scroll_cards_title", e.target.value)}
                  className="h-14 rounded-2xl border-slate-100 bg-slate-50/50"
                />
              </div>
            </section>

             {/* CTA Section Content */}
             <section className="p-10 rounded-[3rem] text-white space-y-10 shadow-2xl relative overflow-hidden" style={{ backgroundColor: primaryColor }}>
               <div className="absolute top-0 right-0 p-12 opacity-10 pointer-events-none">
                 <Zap className="h-32 w-32" />
               </div>
               <div className="flex items-center gap-3 border-b border-white/10 pb-6 relative z-10">
                  <Zap className="h-6 w-6" />
                  <h3 className="text-xl font-black uppercase tracking-tight">Final CTA</h3>
               </div>

               <div className="grid md:grid-cols-2 gap-10 relative z-10">
                 <div className="space-y-3">
                    <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-white/60">CTA Headline</Label>
                    <Input
                      value={homeContent.cta_title || ""}
                      onChange={(e) => updateContent("cta_title", e.target.value)}
                      className="h-14 rounded-2xl border-white/20 bg-white/10 text-white placeholder:text-white/40 focus:bg-white/20"
                    />
                  </div>
                  <div className="space-y-3">
                    <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-white/60">Button Label</Label>
                    <Input
                      value={homeContent.cta_button || ""}
                      onChange={(e) => updateContent("cta_button", e.target.value)}
                      className="h-14 rounded-2xl border-white/20 bg-white/10 text-white placeholder:text-white/40 focus:bg-white/20"
                    />
                  </div>
               </div>
            </section>
          </div>
        )}

        {/* Global Save Button - Floating or Sticky Bottom */}
        <div className="sticky bottom-8 z-50 pt-10">
          <div className="bg-white/80 backdrop-blur-xl p-4 rounded-[3rem] border border-slate-100 shadow-2xl flex items-center justify-between gap-4">
             <div className="hidden sm:flex items-center gap-3 px-6">
               <div className="h-3 w-3 rounded-full bg-green-500 animate-pulse" />
               <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Ready to Publish</span>
             </div>
             <Button
                type="submit"
                disabled={pending}
                className="flex-1 sm:flex-none rounded-[2rem] text-white px-12 h-16 text-sm font-black uppercase tracking-[0.2em] transition-all hover:scale-[1.02] active:scale-95 shadow-xl"
                style={{ backgroundColor: primaryColor }}
              >
                {pending ? (
                  <Loader2 className="h-5 w-5 animate-spin mr-3" />
                ) : (
                  <Sparkles className="h-5 w-5 mr-3" />
                )}
                Save Configuration
              </Button>
          </div>
        </div>

      </form>
    </div>
  );
}