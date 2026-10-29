import { Button } from "@/components/ui/button";
import Link from "next/link";
import { Globe, Shield, Zap, ArrowRight, Award, BookOpen, Check, History, Layout, Landmark, Rocket, Search, Users, Terminal, Code, Cpu } from "lucide-react";
import { CourseCarousel } from "@/components/tenant/CourseCarousel";
import { joinTenantBySlug } from "@/actions/tenants";
import { SharedSections } from "./SharedSections";


export function TechTemplate({ tenant, courses, membership, brandColor, heroTitle, heroSubtitle, aboutTitle, aboutText, aboutImage, ctaTitle, ctaButton, content, adminProfile }: any) {
  const tutorName = adminProfile?.full_name || "Academy Tutor";
  const tutorBio = adminProfile?.bio || "Expert educator dedicated to student success.";
  const tutorAvatar = adminProfile?.avatar_url || null;

  return (
    <div className="bg-slate-950 text-white font-mono selection:bg-cyan-500 selection:text-black" style={{ "--primary-color": brandColor } as React.CSSProperties}>
      {/* Hero with data grid */}
      <section className="relative pt-28 pb-16 sm:pt-40 sm:pb-24 lg:pt-52 lg:pb-32 overflow-hidden">
        <div className="absolute inset-0 opacity-20" style={{ backgroundImage: "url('https://www.transparenttextures.com/patterns/carbon-fibre.png')" }} />

        {/* Scanline Effect */}
        <div className="absolute inset-0 pointer-events-none bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] z-50 bg-[length:100%_2px,3px_100%]" />

        <div className="container mx-auto px-6 text-center relative z-10">
          <div className="inline-block max-w-full px-4 sm:px-6 py-2 border border-cyan-500/30 rounded text-cyan-400 text-[10px] sm:text-xs uppercase tracking-[0.2em] sm:tracking-[0.3em] mb-12 animate-pulse break-all">
            [ system: online // tenant: {tenant.slug} ]
          </div>
          <h1 className="text-5xl sm:text-7xl md:text-[9rem] font-black leading-[0.9] sm:leading-[0.8] mb-10 text-cyan-400 uppercase tracking-tighter break-words" style={{ textShadow: "0 0 20px rgba(0,255,255,0.5)" }}>
            {heroTitle}
          </h1>
          <p className="text-lg md:text-2xl text-cyan-300/80 max-w-3xl mx-auto mb-12 sm:mb-16 break-words">{heroSubtitle}</p>
          <div className="flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-center justify-center gap-4 sm:gap-6 mb-16 sm:mb-24">
            {!membership ? (
              <form action={joinTenantBySlug}>
                <input type="hidden" name="tenantSlug" value={tenant.slug} />
                <input type="hidden" name="role" value="student" />
                <Button className="h-14 sm:h-20 w-full sm:w-auto px-8 sm:px-12 rounded-none bg-cyan-500 text-black font-black text-base sm:text-xl hover:bg-cyan-400 shadow-[0_0_30px_rgba(0,255,255,0.5)] uppercase tracking-widest transition-all">
                  Initialize
                </Button>
              </form>
            ) : (
              <Link href={`/academy/${tenant.slug}/classroom`} className="w-full sm:w-auto">
                <Button className="h-14 sm:h-20 w-full sm:w-auto px-8 sm:px-12 rounded-none bg-cyan-500 text-black font-black text-base sm:text-xl hover:bg-cyan-400 shadow-[0_0_30px_rgba(0,255,255,0.5)] uppercase tracking-widest transition-all">
                  Open Classroom
                </Button>
              </Link>
            )}
            <Button variant="outline" className="h-14 sm:h-20 w-full sm:w-auto px-8 sm:px-10 rounded-none border-cyan-500/30 text-cyan-400 font-black text-base sm:text-xl uppercase tracking-widest">
              Docs
            </Button>
          </div>

          {/* Hero Stats */}
          <div className="grid grid-cols-3 gap-4 sm:gap-10 max-w-4xl mx-auto pt-12 sm:pt-20 border-t border-cyan-500/10">
            {[
              { n: content.stats_students || "10K+", l: "Active Nodes" },
              { n: content.stats_rating || "4.9", l: "Reliability" },
              { n: content.stats_success || "99.9%", l: "Uptime" }
            ].map(s => (
              <div key={s.l} className="min-w-0">
                <div className="text-3xl sm:text-5xl font-black text-cyan-400 mb-2 break-words" style={{ textShadow: "0 0 15px #0ff" }}>{s.n}</div>
                <div className="text-[10px] uppercase tracking-widest text-cyan-300/60">{s.l}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Mission */}
      <section className="py-16 sm:py-32 bg-slate-900 border-y border-cyan-500/10">
        <div className="container mx-auto px-6 max-w-7xl">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-20 items-center">
            <div className="space-y-8 sm:space-y-10 min-w-0">
              <div className="inline-block px-4 py-1 border border-cyan-500/20 text-cyan-400/80 text-[10px] uppercase tracking-[0.3em] sm:tracking-[0.4em]">Mission Log</div>
              <h2 className="text-4xl sm:text-5xl md:text-7xl font-black text-cyan-400 uppercase tracking-tighter leading-none break-words">{aboutTitle}</h2>
              <p className="text-lg md:text-2xl text-slate-400 leading-relaxed border-l-2 border-cyan-500/30 pl-5 sm:pl-8 break-words">{aboutText}</p>
            </div>
            <div className="relative aspect-square rounded-none overflow-hidden border border-cyan-500/20 group min-w-0">
              <img src={content.hero_image || aboutImage} className="w-full h-full object-cover grayscale brightness-50 group-hover:grayscale-0 group-hover:brightness-100 transition-all duration-1000" alt="" />
              <div className="absolute inset-0 bg-cyan-500/10 pointer-events-none" />
              {/* Corner Accents */}
              <div className="absolute top-0 left-0 w-8 h-8 border-t-2 border-l-2 border-cyan-500" />
              <div className="absolute bottom-0 right-0 w-8 h-8 border-b-2 border-r-2 border-cyan-500" />
            </div>
          </div>
        </div>
      </section>

      {/* Shared Sections (How It Works, About Tutor, Sticky Scroll‑Cards, Services) */}
      <SharedSections
        brandColor={brandColor}
        content={content}
        tutorName={tutorName}
        tutorBio={tutorBio}
        tutorAvatar={tutorAvatar}
        aboutTitle={aboutTitle}
        aboutText={aboutText}
      />

      {/* Courses Slider */}
      <section className="py-16 sm:py-32 bg-slate-950">
        <div className="container mx-auto px-6 max-w-7xl">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-12 sm:mb-20">
            <h2 className="text-3xl sm:text-5xl font-black text-cyan-400 tracking-tighter uppercase">[ Data Catalog ]</h2>
            <Link href="#courses" className="text-cyan-400 text-xs font-black uppercase tracking-[0.3em] sm:tracking-[0.4em] flex items-center gap-2 group">
              View All <ArrowRight className="h-4 w-4 group-hover:translate-x-2 transition-transform" />
            </Link>
          </div>
          <CourseCarousel courses={courses} variant="tech" />
        </div>
      </section>



      {/* CTA */}
      <section className="py-16 sm:py-32">
        <div className="container mx-auto px-6 max-w-5xl">
          <div className="bg-slate-900 border border-cyan-500/20 p-8 sm:p-20 md:p-32 text-center relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-full h-full bg-cyan-500/5 translate-x-1/2 translate-y-1/2 rotate-45 pointer-events-none" />
            <h2 className="text-4xl sm:text-6xl md:text-[8rem] font-black text-cyan-400 mb-12 sm:mb-16 tracking-tighter leading-none relative z-10 break-words">{ctaTitle}</h2>
            <div className="relative z-10">
              {!membership ? (
                <form action={joinTenantBySlug}>
                  <input type="hidden" name="tenantSlug" value={tenant.slug} />
                  <input type="hidden" name="role" value="student" />
                  <Button className="h-16 sm:h-24 w-full sm:w-auto px-8 sm:px-20 rounded-none bg-cyan-500 text-black text-lg sm:text-2xl font-black shadow-[0_0_60px_rgba(0,255,255,0.4)] hover:bg-cyan-400 transition-all uppercase tracking-widest">
                    {ctaButton}
                  </Button>
                </form>
              ) : (
                <Link href={`/academy/${tenant.slug}/classroom`} className="inline-block w-full sm:w-auto">
                  <Button className="h-16 sm:h-24 w-full sm:w-auto px-8 sm:px-20 rounded-none bg-cyan-500 text-black text-lg sm:text-2xl font-black shadow-[0_0_60px_rgba(0,255,255,0.4)] hover:bg-cyan-400 transition-all uppercase tracking-widest">
                    Open Classroom
                  </Button>
                </Link>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 border-t border-cyan-500/10">
        <div className="container mx-auto px-6 text-center text-cyan-400/50 text-[10px] font-black tracking-[0.4em] sm:tracking-[0.8em] uppercase break-words">
          [ system: synchronized // protocol: complete ]
        </div>
      </footer>
    </div>
  );
}
