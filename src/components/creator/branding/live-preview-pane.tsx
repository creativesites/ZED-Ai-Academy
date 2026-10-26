"use client";

import { useState } from "react";
import {
  Smartphone,
  Tablet,
  Monitor,
  ExternalLink,
  ZoomIn,
  ZoomOut,
  Layers,
  GraduationCap,
  Sparkles,
  Palette,
  Check,
  Zap,
  ArrowRight,
  ShieldCheck,
  Globe,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { TemplateRenderer } from "@/lib/templates/home-templates";
import { getContrastRatio } from "./palette-presets";

type Viewport = "mobile" | "tablet" | "desktop";
type Surface = "landing" | "ui-kit" | "classroom";

interface LivePreviewPaneProps {
  tenantSlug: string;
  academyName: string;
  logoUrl: string;
  primaryColor: string;
  homeTemplate: string;
  homeContent: any;
}

export function LivePreviewPane({
  tenantSlug,
  academyName,
  logoUrl,
  primaryColor,
  homeTemplate,
  homeContent,
}: LivePreviewPaneProps) {
  const [viewport, setViewport] = useState<Viewport>("desktop");
  const [surface, setSurface] = useState<Surface>("landing");
  const [zoom, setZoom] = useState<number>(1.0);

  const contrast = getContrastRatio(primaryColor || "#fd5523");

  const simulatedTenant = {
    id: "preview-tenant-id",
    name: academyName || "Zed AI Academy",
    slug: tenantSlug || "preview",
    logo_url: logoUrl || null,
    primary_color: primaryColor || "#fd5523",
    home_template: homeTemplate || "modern",
    home_content: homeContent,
  };

  const sampleCourses = [
    {
      id: "c-1",
      title: "Mastering Prompt Engineering & AI Workflows",
      slug: "prompt-engineering",
      description: "Step-by-step masterclass on automating tasks and creating custom GPTs.",
      price_type: "paid",
      price_amount: 350,
      thumbnail_url: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=1000&auto=format&fit=crop",
    },
    {
      id: "c-2",
      title: "Advanced Data & Business Intelligence",
      slug: "data-bi",
      description: "From spreadsheets to executive dashboards with practical business models.",
      price_type: "paid",
      price_amount: 500,
      thumbnail_url: "https://images.unsplash.com/photo-1551288049-bebda4e38f71?q=80&w=1000&auto=format&fit=crop",
    },
    {
      id: "c-3",
      title: "Executive Leadership & Public Speaking",
      slug: "leadership-speaking",
      description: "High-impact communication, negotiation, and visionary leadership.",
      price_type: "free",
      price_amount: 0,
      thumbnail_url: "https://images.unsplash.com/photo-1542744173-8e7e53415bb0?q=80&w=1000&auto=format&fit=crop",
    },
  ];

  const simulatedStats = {
    students: "1,250+",
    rating: "4.9/5",
    success: "98%",
  };

  return (
    <div className="w-full space-y-4">
      {/* Control Bar */}
      <div className="bg-white rounded-2xl p-3 sm:p-4 border border-slate-200/80 shadow-sm flex flex-wrap items-center justify-between gap-3">
        {/* Surface Switcher */}
        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
          <button
            type="button"
            onClick={() => setSurface("landing")}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all",
              surface === "landing" ? "bg-white text-[#062e39] shadow-sm" : "text-slate-500 hover:text-slate-800"
            )}
          >
            <Layers className="h-3.5 w-3.5" />
            <span>Landing Page</span>
          </button>
          <button
            type="button"
            onClick={() => setSurface("ui-kit")}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all",
              surface === "ui-kit" ? "bg-white text-[#062e39] shadow-sm" : "text-slate-500 hover:text-slate-800"
            )}
          >
            <Palette className="h-3.5 w-3.5" />
            <span>Brand System</span>
          </button>
          <button
            type="button"
            onClick={() => setSurface("classroom")}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all",
              surface === "classroom" ? "bg-white text-[#062e39] shadow-sm" : "text-slate-500 hover:text-slate-800"
            )}
          >
            <GraduationCap className="h-3.5 w-3.5" />
            <span>Classroom View</span>
          </button>
        </div>

        {/* Viewport Controls */}
        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
          <button
            type="button"
            onClick={() => setViewport("desktop")}
            className={cn(
              "flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all",
              viewport === "desktop" ? "bg-white text-[#062e39] shadow-sm" : "text-slate-500 hover:text-slate-800"
            )}
            title="Desktop (100%)"
          >
            <Monitor className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Desktop</span>
          </button>
          <button
            type="button"
            onClick={() => setViewport("tablet")}
            className={cn(
              "flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all",
              viewport === "tablet" ? "bg-white text-[#062e39] shadow-sm" : "text-slate-500 hover:text-slate-800"
            )}
            title="Tablet (768px)"
          >
            <Tablet className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Tablet</span>
          </button>
          <button
            type="button"
            onClick={() => setViewport("mobile")}
            className={cn(
              "flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all",
              viewport === "mobile" ? "bg-white text-[#062e39] shadow-sm" : "text-slate-500 hover:text-slate-800"
            )}
            title="Mobile (390px)"
          >
            <Smartphone className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Phone</span>
          </button>
        </div>

        {/* Zoom & Link */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl text-xs">
            <button
              type="button"
              onClick={() => setZoom((z) => Math.max(0.6, Number((z - 0.1).toFixed(2))))}
              className="p-1 rounded-lg text-slate-500 hover:text-slate-900"
              title="Zoom Out"
            >
              <ZoomOut className="h-3.5 w-3.5" />
            </button>
            <span className="text-[11px] font-mono font-bold px-1 text-slate-600">
              {Math.round(zoom * 100)}%
            </span>
            <button
              type="button"
              onClick={() => setZoom((z) => Math.min(1.0, Number((z + 0.1).toFixed(2))))}
              className="p-1 rounded-lg text-slate-500 hover:text-slate-900"
              title="Zoom In"
            >
              <ZoomIn className="h-3.5 w-3.5" />
            </button>
          </div>

          <a
            href={`/academy/${tenantSlug}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors"
          >
            <Globe className="h-3.5 w-3.5 text-slate-400" />
            <span>Open Live</span>
            <ExternalLink className="h-3 w-3 text-slate-400" />
          </a>
        </div>
      </div>

      {/* Preview Surface Canvas */}
      <div className="bg-slate-100/80 rounded-[2rem] p-4 sm:p-8 border border-slate-200/80 min-h-[600px] flex items-start justify-center overflow-auto shadow-inner">
        {/* Surface 1: Full Landing Page Template */}
        {surface === "landing" && (
          <div
            className={cn(
              "transition-all duration-300 origin-top overflow-hidden shadow-2xl bg-white",
              viewport === "mobile" && "w-[390px] rounded-[3rem] border-[10px] border-slate-900 shadow-2xl",
              viewport === "tablet" && "w-[768px] rounded-[2rem] border-[8px] border-slate-800 shadow-xl",
              viewport === "desktop" && "w-full max-w-6xl rounded-2xl border border-slate-200/80 shadow-md"
            )}
            style={{
              transform: `scale(${zoom})`,
              transformOrigin: "top center",
              "--primary-color": primaryColor,
            } as React.CSSProperties}
          >
            {/* Phone Bezel */}
            {viewport === "mobile" && (
              <div className="bg-slate-900 py-3 flex justify-center items-center">
                <div className="h-1.5 w-24 bg-slate-700 rounded-full" />
              </div>
            )}

            {/* Browser Header for Tablet & Desktop */}
            {viewport !== "mobile" && (
              <div className="bg-slate-50 px-4 py-2.5 border-b border-slate-200 flex items-center gap-2">
                <div className="flex gap-1.5">
                  <div className="h-2.5 w-2.5 rounded-full bg-red-400" />
                  <div className="h-2.5 w-2.5 rounded-full bg-amber-400" />
                  <div className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
                </div>
                <div className="flex-1 bg-white border border-slate-200/80 rounded-md px-3 py-1 text-[11px] font-mono text-slate-500 truncate text-center">
                  https://zedai.academy/academy/{tenantSlug}
                </div>
              </div>
            )}

            {/* Template Renderer */}
            <div className="pointer-events-none select-none max-h-[750px] overflow-y-auto">
              <TemplateRenderer
                tenant={simulatedTenant}
                courses={sampleCourses}
                membership={null}
                content={homeContent}
                brandColor={primaryColor}
                template={homeTemplate}
                stats={simulatedStats}
              />
            </div>
          </div>
        )}

        {/* Surface 2: UI Kit & Brand System */}
        {surface === "ui-kit" && (
          <div
            className="w-full max-w-3xl bg-white rounded-3xl p-6 sm:p-10 space-y-8 shadow-sm border border-slate-200/80"
            style={{
              "--primary-color": primaryColor,
            } as React.CSSProperties}
          >
            <div className="border-b border-slate-100 pb-4 flex items-center justify-between">
              <div>
                <h3 className="text-xl font-black text-[#062e39]">Brand System & UI Kit</h3>
                <p className="text-xs text-slate-500 mt-1">Live tokens and interactive UI components in your active brand style.</p>
              </div>
              <span
                className="px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider text-white shadow-sm"
                style={{ backgroundColor: primaryColor }}
              >
                Template: {homeTemplate}
              </span>
            </div>

            {/* Color Swatches & Contrast Score */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="p-5 rounded-2xl bg-slate-50 border border-slate-100 space-y-3">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Primary Color Token</span>
                <div className="flex items-center gap-3">
                  <div
                    className="h-12 w-12 rounded-xl shadow-md border-2 border-white shrink-0"
                    style={{ backgroundColor: primaryColor }}
                  />
                  <div>
                    <div className="text-base font-black font-mono text-slate-800 uppercase">{primaryColor}</div>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className="px-2 py-0.5 rounded text-[10px] font-black bg-emerald-100 text-emerald-800">
                        {contrast.rating}
                      </span>
                      <span className="text-[10px] text-slate-500">
                        {contrast.onWhite}:1 vs White
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-5 rounded-2xl bg-slate-50 border border-slate-100 space-y-3">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Brand Identity Logo</span>
                <div className="flex items-center gap-3">
                  {logoUrl ? (
                    <img src={logoUrl} alt="Logo" className="h-12 w-12 object-contain rounded-xl bg-white p-1 border border-slate-200" />
                  ) : (
                    <div className="h-12 w-12 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-slate-400 font-black text-xl">
                      {academyName.charAt(0) || "A"}
                    </div>
                  )}
                  <div className="text-xs font-bold text-slate-700">
                    <div>{academyName || "Academy Logo"}</div>
                    <div className="text-[10px] text-slate-400 font-mono mt-0.5">/academy/{tenantSlug}</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Buttons Showcase */}
            <div className="space-y-3">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Action Button Styles</span>
              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  className="h-11 px-6 rounded-xl text-white text-xs font-black uppercase tracking-wider shadow-md hover:opacity-90 transition-all flex items-center gap-2"
                  style={{ backgroundColor: primaryColor }}
                >
                  <Zap className="h-3.5 w-3.5" /> Enroll Now
                </button>
                <button
                  type="button"
                  className="h-11 px-6 rounded-xl bg-[#062e39] text-white text-xs font-black uppercase tracking-wider hover:bg-slate-800 transition-all flex items-center gap-2"
                >
                  Explore Catalog <ArrowRight className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  className="h-11 px-6 rounded-xl border border-slate-200 text-slate-800 text-xs font-black uppercase tracking-wider hover:bg-slate-50 transition-all"
                >
                  Learn More
                </button>
              </div>
            </div>

            {/* Badges & Tags */}
            <div className="space-y-3">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Badges & Accents</span>
              <div className="flex flex-wrap gap-2">
                <span
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold"
                  style={{ backgroundColor: `${primaryColor}15`, color: primaryColor }}
                >
                  <Sparkles className="h-3 w-3" /> Certified Academy
                </span>
                <span className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-slate-100 text-slate-700 text-xs font-bold">
                  <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" /> Verified Curriculum
                </span>
                <span className="inline-flex items-center px-3 py-1.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200 text-xs font-bold">
                  ★ 4.9 Rating
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Surface 3: Classroom / Student Navbar View */}
        {surface === "classroom" && (
          <div
            className="w-full max-w-3xl bg-white rounded-3xl overflow-hidden shadow-sm transition-all border border-slate-200/80"
            style={{
              "--primary-color": primaryColor,
            } as React.CSSProperties}
          >
            {/* Branded Learner Navbar */}
            <div className="px-6 py-4 bg-white border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-3">
                {logoUrl ? (
                  <img src={logoUrl} alt="Logo" className="h-8 w-auto max-w-[120px] object-contain" />
                ) : (
                  <div
                    className="h-8 w-8 rounded-lg flex items-center justify-center text-white font-black text-sm"
                    style={{ backgroundColor: primaryColor }}
                  >
                    {academyName.charAt(0) || "Z"}
                  </div>
                )}
                <span className="font-bold text-slate-900 text-sm hidden sm:inline">{academyName}</span>
              </div>

              <div className="flex items-center gap-3">
                <div className="hidden sm:flex items-center gap-4 text-xs font-medium text-slate-500">
                  <span className="text-slate-900 font-bold">My Courses</span>
                  <span>Live Sessions</span>
                  <span>Certificates</span>
                </div>
                <div
                  className="h-7 w-7 rounded-full flex items-center justify-center text-white text-xs font-bold shadow-sm"
                  style={{ backgroundColor: primaryColor }}
                >
                  U
                </div>
              </div>
            </div>

            {/* Learner Dashboard Banner */}
            <div className="p-6 sm:p-8 space-y-6 bg-slate-50/50">
              <div
                className="p-6 rounded-2xl text-white shadow-md space-y-2 relative overflow-hidden"
                style={{ backgroundColor: primaryColor }}
              >
                <div className="text-[10px] font-black uppercase tracking-widest opacity-80">Welcome Back, Student</div>
                <h4 className="text-lg font-black">Continue Learning at {academyName}</h4>
                <p className="text-xs opacity-90">You have 1 live session scheduled today and 2 lessons remaining.</p>
              </div>

              {/* Course Card Preview in Learner View */}
              <div className="space-y-3">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">In Progress</span>
                <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-sm flex items-center gap-4">
                  <div className="h-14 w-14 rounded-lg bg-slate-100 overflow-hidden shrink-0 border border-slate-200">
                    <img
                      src={sampleCourses[0].thumbnail_url}
                      alt="Thumbnail"
                      className="h-full w-full object-cover"
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h5 className="font-bold text-slate-900 text-sm truncate">{sampleCourses[0].title}</h5>
                    <div className="w-full bg-slate-100 h-1.5 rounded-full mt-2 overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: "65%", backgroundColor: primaryColor }} />
                    </div>
                  </div>
                  <button
                    type="button"
                    className="h-8 px-3 rounded-lg text-white text-xs font-bold uppercase tracking-wider shrink-0"
                    style={{ backgroundColor: primaryColor }}
                  >
                    Resume
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
