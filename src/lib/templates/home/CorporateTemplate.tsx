import { Button } from "@/components/ui/button";
import Link from "next/link";
import { CourseCard } from "@/components/tenant/CourseCard";
import { joinTenantBySlug } from "@/actions/tenants";
import { Globe, Shield, Users, ArrowRight, Award, BookOpen, Check, History, Layout, Landmark, Rocket, Search, Zap, Briefcase } from "lucide-react";
import { SharedSections } from "./SharedSections";
import { hasAnyStat } from "@/lib/tenants/academy-stats";


export function CorporateTemplate({ tenant, courses, membership, brandColor, heroTitle, heroSubtitle, aboutTitle, aboutText, aboutImage, ctaTitle, ctaButton, content, adminProfile, stats }: any) {
  const tutorName = adminProfile?.full_name || "Academy Tutor";
  const tutorBio = adminProfile?.bio || "Expert educator dedicated to student success.";
  const tutorAvatar = adminProfile?.avatar_url || null;

  return (
    <div className="font-sans tracking-wide bg-white" style={{ "--primary-color": brandColor } as React.CSSProperties}>
      {/* Hero */}
      <section className="pt-28 pb-16 sm:pt-40 sm:pb-24 lg:pt-52 lg:pb-32 bg-slate-50 relative overflow-hidden">
        <div className="container mx-auto px-6 max-w-7xl flex flex-col lg:flex-row items-center gap-12 lg:gap-20 relative z-10">
          <div className="flex-1 min-w-0 space-y-8">
            <span className="text-blue-600 font-bold uppercase tracking-[0.2em] sm:tracking-[0.3em] text-sm">Professional Development</span>
            <h1 className="text-4xl sm:text-5xl md:text-7xl font-black text-slate-800 leading-tight break-words">{heroTitle}</h1>
            <p className="text-lg sm:text-xl text-slate-600 break-words">{heroSubtitle}</p>
            <div className="flex flex-col sm:flex-row sm:flex-wrap gap-4 mb-12">
              {!membership ? (
                <form action={joinTenantBySlug}>
                  <input type="hidden" name="tenantSlug" value={tenant.slug} />
                  <input type="hidden" name="role" value="student" />
                  <Button className="h-14 sm:h-16 w-full sm:w-auto px-8 sm:px-12 rounded-md bg-blue-600 text-white font-bold hover:bg-blue-700 shadow-lg transition-all">
                    Get Started
                  </Button>
                </form>
              ) : (
                <Link href={`/academy/${tenant.slug}/classroom`} className="w-full sm:w-auto">
                  <Button className="h-14 sm:h-16 w-full sm:w-auto px-8 sm:px-12 rounded-md bg-blue-600 text-white font-bold hover:bg-blue-700 shadow-lg transition-all">
                    Open Classroom
                  </Button>
                </Link>
              )}
              <Button variant="outline" className="h-14 sm:h-16 w-full sm:w-auto px-6 sm:px-10 rounded-md border-slate-300 font-bold bg-white">
                Corporate Plans
              </Button>
            </div>

            {/* Hero Stats */}
            {hasAnyStat(stats) && (
              <div className="grid grid-cols-3 gap-4 sm:gap-10 pt-12 border-t border-slate-200">
                {stats.students && (
                  <div className="min-w-0">
                    <div className="text-2xl sm:text-3xl font-black break-words text-slate-800">{stats.students}</div>
                    <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-1">Learners</div>
                  </div>
                )}
                {stats.rating && (
                  <div className="min-w-0">
                    <div className="text-2xl sm:text-3xl font-black break-words text-slate-800">{stats.rating}</div>
                    <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-1">Satisfaction</div>
                  </div>
                )}
                {stats.success && (
                  <div className="min-w-0">
                    <div className="text-2xl sm:text-3xl font-black break-words text-slate-800">{stats.success}</div>
                    <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-1">Placement</div>
                  </div>
                )}
              </div>
            )}
          </div>
          <div className="flex-1 min-w-0 w-full relative">
            <div className="absolute -inset-3 sm:-inset-4 bg-blue-100 rounded-2xl -rotate-2" />
            <div className="relative rounded-2xl overflow-hidden shadow-2xl border-4 border-white">
              <img src={content.hero_image || aboutImage} className="w-full h-full object-cover max-h-[420px] sm:max-h-[600px]" alt="" />
            </div>
          </div>
        </div>
      </section>

      {/* Trust Bar */}
      <section className="py-16 sm:py-20 bg-white border-b">
        <div className="container mx-auto px-6 text-center">
          <p className="text-sm font-bold uppercase tracking-widest text-slate-500 mb-10">Trusted by leading organisations</p>
          <div className="flex flex-wrap justify-center gap-x-10 gap-y-6 md:gap-16 opacity-40 grayscale">
            {[ "Acme Inc", "GlobalTech", "EduPrime", "SkillForge", "LearnCorp" ].map(name => (
              <span key={name} className="text-xl sm:text-2xl font-black text-slate-400">{name}</span>
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


      {/* Courses Grid */}
      <section className="py-16 sm:py-32 bg-white">
        <div className="container mx-auto px-6 max-w-7xl">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-12 sm:mb-20">
            <h2 className="text-3xl sm:text-4xl font-black text-slate-800 tracking-tight break-words">Available Programs</h2>
            <Link href="#courses" className="text-blue-600 font-bold flex items-center gap-2 group">
              View Catalog <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
            </Link>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-12">
            {courses?.map((course: any) => <CourseCard key={course.id} course={course} variant="corporate" />)}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 sm:py-32 container mx-auto px-6">
        <div className="bg-blue-600 rounded-3xl p-8 sm:p-16 md:p-32 text-center text-white shadow-2xl shadow-blue-600/20 relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-blue-700 to-blue-500" />
          <div className="relative z-10 max-w-3xl mx-auto">
            <h2 className="text-4xl sm:text-5xl md:text-7xl font-black mb-10 sm:mb-12 tracking-tight leading-none break-words">{ctaTitle}</h2>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-6">
              {!membership ? (
                <form action={joinTenantBySlug} className="w-full sm:w-auto">
                  <input type="hidden" name="tenantSlug" value={tenant.slug} />
                  <input type="hidden" name="role" value="student" />
                  <Button className="h-14 sm:h-20 w-full sm:w-auto px-8 sm:px-16 rounded-full bg-white text-blue-600 text-base sm:text-xl font-black shadow-xl hover:scale-105 transition-all">
                    {ctaButton}
                  </Button>
                </form>
              ) : (
                <Link href={`/academy/${tenant.slug}/classroom`} className="w-full sm:w-auto">
                  <Button className="h-14 sm:h-20 w-full sm:w-auto px-8 sm:px-16 rounded-full bg-white text-blue-600 text-base sm:text-xl font-black shadow-xl hover:scale-105 transition-all">
                    Open Classroom
                  </Button>
                </Link>
              )}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
