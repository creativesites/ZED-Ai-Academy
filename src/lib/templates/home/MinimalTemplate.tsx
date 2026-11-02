import { Button } from "@/components/ui/button";
import { CourseCard } from "@/components/tenant/CourseCard";
import { joinTenantBySlug } from "@/actions/tenants";
import Link from "next/link";
import { Sparkles, ArrowRight, Zap, Target, Shield, Globe } from "lucide-react";
import { SharedSections } from "./SharedSections";
import { hasAnyStat } from "@/lib/tenants/academy-stats";


export function MinimalTemplate({ tenant, courses, membership, brandColor, heroTitle, heroSubtitle, aboutTitle, aboutText, aboutImage, ctaTitle, ctaButton, content, adminProfile, stats }: any) {
  const showHeroImage = !!content.hero_image;
  const tutorName = adminProfile?.full_name || "Academy Tutor";
  const tutorBio = adminProfile?.bio || "Expert educator dedicated to student success.";
  const tutorAvatar = adminProfile?.avatar_url || null;

  return (
    <div className="font-sans bg-white selection:bg-slate-900 selection:text-white" style={{ "--primary-color": brandColor } as React.CSSProperties}>
      {/* Hero */}
      <section className="pt-24 pb-16 lg:pt-40 lg:pb-32">
        <div className="container mx-auto px-6 max-w-7xl">
          <div className={`grid ${showHeroImage ? 'lg:grid-cols-2' : 'grid-cols-1'} gap-12 lg:gap-20 items-center`}>
            <div className={`min-w-0 ${showHeroImage ? "text-left" : "text-center max-w-4xl mx-auto"}`}>
              <h1 className="text-5xl sm:text-6xl md:text-8xl font-light tracking-tight text-slate-900 mb-10 leading-[1.05] break-words">
                {heroTitle}
              </h1>
              <p className="text-lg md:text-2xl text-slate-500 font-light max-w-2xl mb-12 sm:mb-16 leading-relaxed break-words">
                {heroSubtitle}
              </p>

              <div className={`flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-center gap-4 sm:gap-8 mb-14 sm:mb-20 ${!showHeroImage && 'justify-center'}`}>
                {!membership ? (
                  <form action={joinTenantBySlug}>
                    <input type="hidden" name="tenantSlug" value={tenant.slug} />
                    <Button className="h-14 sm:h-16 w-full sm:w-auto px-8 sm:px-12 rounded-full bg-slate-900 text-white text-base font-medium tracking-tight hover:bg-slate-800 transition-all">
                      Start Your Journey
                    </Button>
                  </form>
                ) : (
                  <Link href={`/academy/${tenant.slug}/classroom`} className="w-full sm:w-auto">
                    <Button className="h-14 sm:h-16 w-full sm:w-auto px-8 sm:px-12 rounded-full bg-slate-900 text-white text-base font-medium tracking-tight hover:bg-slate-800 transition-all">
                      Open Classroom
                    </Button>
                  </Link>
                )}
                <Button variant="ghost" className="h-14 sm:h-16 w-full sm:w-auto px-6 sm:px-8 rounded-full text-slate-500 font-medium group">
                  Explore Courses <ArrowRight className="h-4 w-4 ml-2 group-hover:translate-x-1 transition-transform" />
                </Button>
              </div>

              {/* Hero Stats */}
              {hasAnyStat(stats) && (
                <div className={`flex items-center gap-16 pt-10 border-t border-slate-100 ${!showHeroImage && "justify-center"}`}>
                  {stats.students && (
                    <div className="min-w-0">
                      <div className="text-4xl font-light text-slate-900">{stats.students}</div>
                      <div className="text-[10px] font-medium text-slate-500 uppercase tracking-widest mt-1">Students</div>
                    </div>
                  )}
                  {stats.rating && (
                    <div className="min-w-0">
                      <div className="text-4xl font-light text-slate-900">{stats.rating}</div>
                      <div className="text-[10px] font-medium text-slate-500 uppercase tracking-widest mt-1">Rating</div>
                    </div>
                  )}
                  {stats.success && (
                    <div className="min-w-0">
                      <div className="text-4xl font-light text-slate-900">{stats.success}</div>
                      <div className="text-[10px] font-medium text-slate-500 uppercase tracking-widest mt-1">Success</div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {showHeroImage && (
              <div className="relative aspect-square min-w-0">
                <div className="absolute inset-0 bg-slate-50 rounded-[2.5rem] sm:rounded-[4rem] -rotate-3" />
                <div className="relative h-full w-full rounded-[2.5rem] sm:rounded-[4rem] overflow-hidden grayscale hover:grayscale-0 transition-all duration-700 shadow-xl">
                  <img src={content.hero_image} className="w-full h-full object-cover" alt={heroTitle} />
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Philosophy/About */}
      <section className="py-20 sm:py-32 border-y border-slate-100 bg-slate-50/30">
        <div className="container mx-auto px-6 max-w-4xl">
           <div className="flex flex-col items-center text-center space-y-10 sm:space-y-12">
             <div className="h-px w-24 bg-slate-200" />
             <h2 className="text-3xl md:text-5xl font-light text-slate-900 leading-tight break-words">
               {aboutTitle}
             </h2>
             <p className="text-lg md:text-2xl text-slate-500 font-light leading-relaxed break-words">
               {aboutText}
             </p>
             <div className="h-px w-24 bg-slate-200" />
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

      {/* Courses Grid */}
      <section className="py-20 sm:py-32 bg-slate-50 border-y border-slate-100">
        <div className="container mx-auto px-6 max-w-7xl">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-12 sm:mb-20">
             <h2 className="text-3xl sm:text-4xl font-light text-slate-900 break-words">Academic Catalog</h2>
             <Link href="#courses" className="text-sm font-medium text-slate-500 hover:text-slate-900 transition-colors">
               View All Programs
             </Link>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 md:gap-12">
            {courses?.map((course: any) => <CourseCard key={course.id} course={course} variant="minimal" />)}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 sm:py-40">

        <div className="container mx-auto px-6 max-w-3xl text-center">
          <h2 className="text-4xl sm:text-5xl md:text-7xl font-light text-slate-900 mb-12 tracking-tight break-words">
            {ctaTitle}
          </h2>
          {!membership ? (
            <form action={joinTenantBySlug}>
              <input type="hidden" name="tenantSlug" value={tenant.slug} />
              <Button className="h-14 sm:h-16 w-full sm:w-auto px-8 sm:px-14 rounded-full bg-slate-900 text-white text-base sm:text-lg font-medium hover:scale-105 transition-all shadow-2xl">
                {ctaButton}
              </Button>
            </form>
          ) : (
            <Link href={`/academy/${tenant.slug}/classroom`} className="inline-block w-full sm:w-auto">
              <Button className="h-14 sm:h-16 w-full sm:w-auto px-8 sm:px-14 rounded-full bg-slate-900 text-white text-base sm:text-lg font-medium hover:scale-105 transition-all shadow-2xl">
                Open Classroom
              </Button>
            </Link>
          )}
        </div>
      </section>

      {/* Footer */}
      <footer className="py-20 border-t border-slate-100">
        <div className="container mx-auto px-6 text-center text-slate-400 text-xs font-medium tracking-widest uppercase break-words">
          © {new Date().getFullYear()} {tenant.name} · Less is More
        </div>
      </footer>
    </div>
  );
}
