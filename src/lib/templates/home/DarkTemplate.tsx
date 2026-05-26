import { Button } from "@/components/ui/button";
import Link from "next/link";
import { Sparkles, ArrowRight, Award, BookOpen, Check, Globe, History, Layout, Landmark, Rocket, Search, Shield, Users, Zap } from "lucide-react";
import { CourseCarousel } from "@/components/tenant/CourseCarousel";
import { joinTenantBySlug } from "@/actions/tenants";
import { SharedSections } from "./SharedSections";


export function DarkTemplate({ tenant, courses, membership, brandColor, heroTitle, heroSubtitle, aboutTitle, aboutText, aboutImage, ctaTitle, ctaButton, content, adminProfile }: any) {
  const tutorName = adminProfile?.full_name || "Academy Tutor";
  const tutorBio = adminProfile?.bio || "Expert educator dedicated to student success.";
  const tutorAvatar = adminProfile?.avatar_url || null;

  return (
    <div className="bg-[#0a0a0c] text-white selection:bg-[#fd5523] selection:text-white" style={{ "--primary-color": brandColor } as React.CSSProperties}>
      {/* Hero */}
      <section className="relative pt-52 pb-32 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-[#0a0a0c] to-[#1a1a20]">
          <div className="absolute inset-0 opacity-10" style={{ backgroundImage: "url('https://www.transparenttextures.com/patterns/carbon-fibre.png')" }} />
        </div>
        
        {/* Animated Orbs */}
        <div className="absolute top-[-10%] right-[-10%] w-[50%] h-[50%] bg-[#fd5523]/10 rounded-full blur-[120px] animate-pulse" />
        <div className="absolute bottom-[-10%] left-[-10%] w-[40%] h-[40%] bg-[#fd5523]/5 rounded-full blur-[100px]" />

        <div className="container mx-auto px-6 text-center relative z-10">
          <div className="inline-flex items-center gap-2 px-5 py-2 rounded-full bg-[#fd5523]/20 text-[#fd5523] text-[10px] font-black uppercase tracking-[0.2em] mb-12 border border-[#fd5523]/30">
            <Sparkles className="h-4 w-4 fill-[#fd5523]" /> Join the Nebula
          </div>
          <h1 className="text-7xl md:text-[9rem] font-black tracking-tighter mb-10 leading-[0.8] text-white">
            {heroTitle}
          </h1>
          <p className="text-xl md:text-3xl font-medium leading-relaxed max-w-3xl mx-auto mb-16 text-white/60">
            {heroSubtitle}
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-6 mb-20">
            {!membership ? (
              <form action={joinTenantBySlug}>
                <input type="hidden" name="tenantSlug" value={tenant.slug} />
                <input type="hidden" name="role" value="student" />
                <Button className="h-20 px-14 rounded-[2.5rem] bg-[#fd5523] text-white text-xl font-black uppercase tracking-widest shadow-[0_0_50px_rgba(253,85,35,0.3)] hover:scale-105 transition-all">
                  Launch Now
                </Button>
              </form>
            ) : (
              <Link href={`/academy/${tenant.slug}/classroom`}>
                <Button className="h-20 px-14 rounded-[2.5rem] bg-[#fd5523] text-white text-xl font-black uppercase tracking-widest shadow-[0_0_50px_rgba(253,85,35,0.3)] hover:scale-105 transition-all">
                  Open Classroom
                </Button>
              </Link>
            )}
            <Button variant="outline" className="h-20 px-12 rounded-[2.5rem] border-white/10 text-white hover:bg-white/5 font-black text-xl">
              Explore
            </Button>
          </div>

          {/* Hero Stats */}
          <div className="grid grid-cols-3 gap-12 max-w-4xl mx-auto pt-20 border-t border-white/5">
            {[
              { num: content.stats_students || "12K", label: "Active Students" },
              { num: content.stats_rating || "4.9", label: "Global Rating" },
              { num: content.stats_success || "95%", label: "Success Rate" }
            ].map(s => (
              <div key={s.label}>
                <div className="text-5xl font-black text-[#fd5523] mb-2">{s.num}</div>
                <div className="text-xs font-bold uppercase tracking-widest text-white/40">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Mission */}
      <section className="py-32 bg-[#0f0f12] relative overflow-hidden">
        <div className="container mx-auto px-6 max-w-7xl relative z-10">
          <div className="grid lg:grid-cols-2 gap-20 items-center">
            <div className="space-y-10">
              <div className="h-1 bg-[#fd5523] w-20" />
              <h2 className="text-5xl md:text-7xl font-black tracking-tighter leading-[0.9]">{aboutTitle}</h2>
              <p className="text-xl md:text-2xl font-medium leading-relaxed text-white/60">{aboutText}</p>
            </div>
            <div className="relative aspect-square rounded-[5rem] overflow-hidden border border-white/10 group">
              <img src={aboutImage} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-1000" alt="" />
              <div className="absolute inset-0 bg-gradient-to-t from-[#0a0a0c] via-transparent to-transparent opacity-60" />
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
      <section className="py-32 bg-[#0a0a0c]">
        <div className="container mx-auto px-6 max-w-7xl">
          <div className="flex items-center justify-between mb-20">
            <h2 className="text-5xl font-black text-white tracking-tighter">DATA CATALOG</h2>
            <Link href="/courses" className="text-[#fd5523] text-sm font-black uppercase tracking-[0.3em] flex items-center gap-2 group">
              View All <ArrowRight className="h-4 w-4 group-hover:translate-x-2 transition-transform" />
            </Link>
          </div>
          <CourseCarousel courses={courses} variant="dark" />
        </div>
      </section>



      {/* CTA */}
      <section className="py-32 container mx-auto px-6">
        <div className="rounded-[4rem] p-16 md:p-28 bg-[#1a1a20] text-center border border-white/5 relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-[50%] h-[100%] bg-[#fd5523]/5 blur-[100px] group-hover:bg-[#fd5523]/10 transition-all" />
          <h2 className="text-5xl md:text-[8rem] font-black mb-16 tracking-tighter leading-none relative z-10">{ctaTitle}</h2>
          <div className="relative z-10">
            {!membership ? (
              <form action={joinTenantBySlug}>
                <input type="hidden" name="tenantSlug" value={tenant.slug} />
                <input type="hidden" name="role" value="student" />
                <Button className="h-24 px-20 rounded-[3rem] bg-[#fd5523] text-white text-2xl font-black shadow-[0_0_60px_rgba(253,85,35,0.4)] hover:scale-110 transition-all">
                  {ctaButton}
                </Button>
              </form>
            ) : (
              <Link href={`/academy/${tenant.slug}/classroom`}>
                <Button className="h-24 px-20 rounded-[3rem] bg-[#fd5523] text-white text-2xl font-black shadow-[0_0_60px_rgba(253,85,35,0.4)] hover:scale-110 transition-all">
                  Open Classroom
                </Button>
              </Link>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
