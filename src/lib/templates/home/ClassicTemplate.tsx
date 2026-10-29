import { Button } from "@/components/ui/button";
import { BookOpen, Users, Shield, Award, Landmark, History, Search } from "lucide-react";
import { SharedSections } from "./SharedSections";
import { CourseCarousel } from "@/components/tenant/CourseCarousel";
import { joinTenantBySlug } from "@/actions/tenants";
import Link from "next/link";
import { hasAnyStat } from "@/lib/tenants/academy-stats";

export function ClassicTemplate({ tenant, courses, membership, brandColor, heroTitle, heroSubtitle, aboutTitle, aboutText, aboutImage, ctaTitle, ctaButton, content, adminProfile, stats }: any) {
  const showHeroImage = !!content.hero_image;
  const tutorName = adminProfile?.full_name || "Academy Tutor";
  const tutorBio = adminProfile?.bio || "Expert educator dedicated to student success.";
  const tutorAvatar = adminProfile?.avatar_url || null;

  return (
    <div className="font-serif bg-[#fdfbf7]" style={{ "--primary-color": brandColor } as React.CSSProperties}>
      {/* Top Bar Decoration */}
      <div className="h-2 bg-amber-900/10 w-full" />

      {/* Hero */}
      <section className="pt-20 pb-16 lg:pt-36 lg:pb-32 relative overflow-hidden">
        {/* Subtle Paper Texture Overlay */}
        <div className="absolute inset-0 z-0 pointer-events-none opacity-[0.03] bg-[url('https://www.transparenttextures.com/patterns/natural-paper.png')]" />

        <div className="container mx-auto px-6 relative z-10">
          <div className={`grid ${showHeroImage ? 'lg:grid-cols-2' : 'grid-cols-1'} gap-10 lg:gap-16 items-center`}>
            <div className={`min-w-0 ${showHeroImage ? "text-left" : "text-center max-w-4xl mx-auto"}`}>
              <div className={`inline-flex max-w-full items-center gap-3 px-4 sm:px-6 py-2 border-y border-amber-900/20 text-amber-900/60 text-xs font-bold uppercase tracking-[0.2em] sm:tracking-[0.3em] mb-10 ${!showHeroImage && 'mx-auto'}`}>
                <Landmark className="h-4 w-4 shrink-0" /> Established Academic Institution
              </div>

              <h1 className="text-4xl sm:text-5xl md:text-7xl font-black tracking-tight text-amber-950 mb-10 leading-[1.1] break-words">
                {heroTitle}
              </h1>

              <p className="text-lg md:text-2xl text-amber-900/70 max-w-2xl mb-10 sm:mb-12 leading-relaxed italic break-words">
                "{heroSubtitle}"
              </p>

              <div className={`flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-center gap-4 sm:gap-6 mb-12 sm:mb-16 ${!showHeroImage && 'justify-center'}`}>
                {!membership ? (
                  <form action={joinTenantBySlug}>
                    <input type="hidden" name="tenantSlug" value={tenant.slug} />
                    <Button className="h-14 sm:h-16 w-full sm:w-auto px-6 sm:px-12 rounded-none bg-amber-900 text-white text-base sm:text-lg font-bold tracking-widest shadow-xl hover:bg-amber-800 transition-all border-b-4 border-amber-950 active:border-b-0 active:translate-y-1">
                      JOIN THE TRADITION
                    </Button>
                  </form>
                ) : (
                  <Link href={`/academy/${tenant.slug}/classroom`} className="w-full sm:w-auto">
                    <Button className="h-14 sm:h-16 w-full sm:w-auto px-6 sm:px-12 rounded-none bg-amber-900 text-white text-base sm:text-lg font-bold tracking-widest shadow-xl hover:bg-amber-800 transition-all border-b-4 border-amber-950 active:border-b-0 active:translate-y-1">
                      ENTER ACADEMY
                    </Button>
                  </Link>
                )}
                <Button variant="outline" className="h-14 sm:h-16 w-full sm:w-auto px-6 sm:px-10 rounded-none border-2 border-amber-900/20 text-amber-900 font-bold tracking-widest hover:bg-amber-50">
                  DISCOVER HISTORY
                </Button>
              </div>

              {/* Hero Stats */}
              {hasAnyStat(stats) && (
                <div className={`grid grid-cols-3 gap-4 sm:gap-10 pt-10 border-t border-amber-900/10 ${!showHeroImage && "max-w-xl mx-auto"}`}>
                  {stats.students && (
                    <div className="min-w-0">
                      <div className="text-2xl sm:text-3xl font-black break-words text-amber-950 tracking-tighter">{stats.students}</div>
                      <div className="text-[10px] font-bold text-amber-900/50 uppercase tracking-[0.15em] sm:tracking-[0.2em] mt-2">Scholars Enrolled</div>
                    </div>
                  )}
                  {stats.rating && (
                    <div className="min-w-0">
                      <div className="text-2xl sm:text-3xl font-black break-words text-amber-950 tracking-tighter">{stats.rating}</div>
                      <div className="text-[10px] font-bold text-amber-900/50 uppercase tracking-[0.15em] sm:tracking-[0.2em] mt-2">Academic Rating</div>
                    </div>
                  )}
                  {stats.success && (
                    <div className="min-w-0">
                      <div className="text-2xl sm:text-3xl font-black break-words text-amber-950 tracking-tighter">{stats.success}</div>
                      <div className="text-[10px] font-bold text-amber-900/50 uppercase tracking-[0.15em] sm:tracking-[0.2em] mt-2">Success Quotient</div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {showHeroImage && (
              <div className="relative min-w-0">
                {/* Decorative Frame */}
                <div className="absolute -inset-4 border border-amber-900/10 scale-[1.02] hidden sm:block" />
                <div className="absolute -inset-8 border border-amber-900/5 scale-[1.04] hidden sm:block" />

                <div className="relative aspect-[4/5] overflow-hidden shadow-2xl border-[8px] sm:border-[12px] border-white">
                  <img src={content.hero_image} className="w-full h-full object-cover sepia-[0.2] hover:sepia-0 transition-all duration-700" alt={heroTitle} />
                  <div className="absolute inset-0 shadow-[inset_0_0_100px_rgba(0,0,0,0.2)]" />
                </div>

                {/* Founding Year Badge */}
                <div className="absolute -bottom-4 -right-2 sm:-bottom-6 sm:-right-6 bg-amber-950 text-white p-5 sm:p-8 shadow-2xl">
                  <div className="text-center">
                    <div className="text-[10px] uppercase tracking-[0.4em] opacity-60 mb-1">Founded</div>
                    <div className="text-2xl font-black tracking-tighter">MMXXIV</div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Mission Section */}
      <section className="py-16 sm:py-24 bg-white">
        <div className="container mx-auto px-6 max-w-7xl">
          <div className="text-center max-w-3xl mx-auto mb-12 sm:mb-20">
            <History className="h-12 w-12 text-amber-900/20 mx-auto mb-6" />
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-black tracking-tight text-amber-950 mb-8 break-words">{aboutTitle}</h2>
            <div className="w-20 h-1 bg-amber-900 mx-auto mb-10" />
            <p className="text-lg md:text-2xl text-amber-900/70 leading-relaxed italic break-words">{aboutText}</p>
          </div>

          <div className="grid md:grid-cols-3 gap-10 md:gap-12 pt-10 border-t border-amber-100">
            {[
              { icon: BookOpen, title: "RIGOROUS CURRICULUM", desc: "Our programs are developed by industry veterans with decades of collective experience." },
              { icon: Award, title: "PRESTIGIOUS AWARDS", desc: "Graduates from our academy are recognized globally by leading institutions." },
              { icon: Search, title: "ACADEMIC RESEARCH", desc: "We focus on deep understanding and critical thinking in every subject area." }
            ].map((feature, idx) => (
              <div key={idx} className="text-center group">
                <div className="h-16 w-16 mx-auto mb-6 flex items-center justify-center border-2 border-amber-900/10 rounded-full group-hover:bg-amber-900 group-hover:text-white transition-all">
                  <feature.icon className="h-6 w-6" />
                </div>
                <h4 className="text-sm font-black tracking-[0.2em] text-amber-950 mb-4">{feature.title}</h4>
                <p className="text-sm text-amber-900/70 leading-relaxed">{feature.desc}</p>
              </div>
            ))}
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
      <section className="py-16 sm:py-24 border-y border-amber-100 bg-[#fdfbf7]">
        <div className="container mx-auto px-6 max-w-7xl">
          <div className="flex items-center justify-between gap-4 mb-10 sm:mb-16">
            <div className="h-px bg-amber-900/20 flex-1 mr-0 sm:mr-10 hidden sm:block" />
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-black text-amber-950 tracking-tight shrink-0 px-0 sm:px-10 sm:border-x border-amber-900/20 text-center">
              FEATURED PROGRAMS
            </h2>
            <div className="h-px bg-amber-900/20 flex-1 ml-0 sm:ml-10 hidden sm:block" />
          </div>
          <CourseCarousel courses={courses} variant="classic" />
        </div>
      </section>

      {/* Legacy/Trust Bar */}
      <section className="py-16 sm:py-20 bg-[#fdfbf7]">
        <div className="container mx-auto px-6 text-center">
          <p className="text-[10px] font-bold uppercase tracking-[0.3em] sm:tracking-[0.5em] text-amber-900/50 mb-10 sm:mb-12">OUR ACADEMIC PARTNERS</p>
          <div className="flex flex-wrap justify-center gap-x-10 gap-y-8 md:gap-24 grayscale opacity-40 contrast-125">
             <Landmark className="h-10 w-10" />
             <Award className="h-10 w-10" />
             <History className="h-10 w-10" />
             <Shield className="h-10 w-10" />
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 sm:py-24 container mx-auto px-6">
        <div className="bg-amber-950 rounded-none p-8 sm:p-16 md:p-32 text-center text-white shadow-[0_40px_100px_-20px_rgba(69,39,0,0.4)] relative overflow-hidden">
          {/* Flourish */}
          <div className="absolute top-0 left-0 w-full h-full opacity-[0.03] pointer-events-none bg-[url('https://www.transparenttextures.com/patterns/damask.png')]" />

          <div className="relative z-10 max-w-3xl mx-auto">
            <Landmark className="h-16 w-16 text-amber-500/20 mx-auto mb-10" />
            <h2 className="text-4xl sm:text-5xl md:text-7xl font-black tracking-tight mb-12 break-words">{ctaTitle}</h2>
            <Button className="h-14 sm:h-20 w-full sm:w-auto px-6 sm:px-16 rounded-none bg-white text-amber-950 text-base sm:text-xl font-black tracking-widest hover:bg-amber-50 transition-all shadow-2xl">
              {ctaButton}
            </Button>
          </div>
        </div>
      </section>

      {/* Footer Decoration */}
      <div className="py-10 text-center border-t border-amber-900/10">
        <div className="text-[10px] font-bold tracking-[0.4em] sm:tracking-[0.6em] text-amber-900/40 uppercase">
          Ad Astra Per Aspera
        </div>
      </div>
    </div>
  );
}
