import { Button } from "@/components/ui/button";
import Link from "next/link";
import { CourseCard } from "@/components/tenant/CourseCard";
import { joinTenantBySlug } from "@/actions/tenants";

import { ArrowRight, Award, BookOpen, Check, Globe, History, Layout, Landmark, Rocket, Search, Shield, Users, Zap, Quote } from "lucide-react";
import { SharedSections } from "./SharedSections";


export function ElegantTemplate({ tenant, courses, membership, brandColor, heroTitle, heroSubtitle, aboutTitle, aboutText, aboutImage, ctaTitle, ctaButton, content, adminProfile }: any) {
  const tutorName = adminProfile?.full_name || "Academy Tutor";
  const tutorBio = adminProfile?.bio || "Expert educator dedicated to student success.";
  const tutorAvatar = adminProfile?.avatar_url || null;

  return (
    <div className="font-serif bg-stone-50 text-stone-800 selection:bg-stone-200" style={{ "--primary-color": brandColor } as React.CSSProperties}>
      {/* Hero */}
      <section className="pt-52 pb-32 bg-white relative overflow-hidden">
        <div className="container mx-auto px-6 flex flex-col lg:flex-row items-center gap-20 max-w-7xl relative z-10">
          <div className="flex-1 space-y-10">
            <div className="w-24 h-0.5 bg-stone-400" />
            <h1 className="text-6xl md:text-8xl font-light tracking-tight leading-none text-stone-900">{heroTitle}</h1>
            <p className="text-xl text-stone-500 font-light max-w-xl">{heroSubtitle}</p>
            <div className="flex gap-6 mb-16">
              {!membership ? (
                <form action={joinTenantBySlug}>
                  <input type="hidden" name="tenantSlug" value={tenant.slug} />
                  <input type="hidden" name="role" value="student" />
                  <Button className="h-16 px-12 rounded-none bg-stone-800 text-white font-light tracking-widest hover:bg-stone-700 shadow-lg transition-all">
                    ENTER
                  </Button>
                </form>
              ) : (
                <Link href={`/academy/${tenant.slug}/classroom`}>
                  <Button className="h-16 px-12 rounded-none bg-stone-800 text-white font-light tracking-widest hover:bg-stone-700 shadow-lg transition-all">
                    CLASSROOM
                  </Button>
                </Link>
              )}
              <Button variant="ghost" className="h-16 px-10 rounded-none text-stone-400 font-light tracking-widest border border-stone-100">
                DISCOVER
              </Button>
            </div>

            {/* Hero Stats */}
            <div className="flex gap-16 pt-12 border-t border-stone-100">
              <div>
                <div className="text-4xl font-light text-stone-900">{content.stats_students || "10k+"}</div>
                <div className="text-[10px] font-medium text-stone-400 uppercase tracking-[0.3em] mt-1">Scholars</div>
              </div>
              <div>
                <div className="text-4xl font-light text-stone-900">{content.stats_rating || "4.9/5"}</div>
                <div className="text-[10px] font-medium text-stone-400 uppercase tracking-[0.3em] mt-1">Satisfaction</div>
              </div>
              <div>
                <div className="text-4xl font-light text-stone-900">{content.stats_success || "95%"}</div>
                <div className="text-[10px] font-medium text-stone-400 uppercase tracking-[0.3em] mt-1">Excellence</div>
              </div>
            </div>
          </div>
          <div className="flex-1 relative">
            <div className="absolute -inset-4 border border-stone-200 translate-x-4 translate-y-4" />
            <div className="relative z-10 aspect-[4/5] overflow-hidden shadow-2xl">
              <img src={content.hero_image || aboutImage} className="w-full h-full object-cover grayscale hover:grayscale-0 transition-all duration-1000" alt="" />
            </div>
          </div>
        </div>
      </section>

      {/* About */}
      <section className="py-32 bg-white">
        <div className="container mx-auto px-6 max-w-4xl text-center">
          <Quote className="h-12 w-12 text-stone-200 mx-auto mb-10" />
          <p className="text-2xl md:text-3xl font-light italic leading-relaxed text-stone-500 mb-12">{aboutText}</p>
          <div className="h-px w-20 bg-stone-300 mx-auto mb-8" />
          <p className="text-sm font-bold uppercase tracking-[0.5em] text-stone-300">- {aboutTitle}</p>
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
      <section className="py-32 bg-stone-50 border-y border-stone-100">
        <div className="container mx-auto px-6 max-w-7xl">
          <div className="flex items-end justify-between mb-20">
            <div className="space-y-4">
              <h2 className="text-4xl font-light text-stone-900 tracking-tight">Curated Collections</h2>
              <div className="h-0.5 w-16 bg-stone-800" />
            </div>
            <Link href="/courses" className="text-stone-400 text-xs font-bold uppercase tracking-[0.3em] hover:text-stone-900 transition-colors flex items-center gap-2">
              View Catalog <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-12">
            {courses?.map((course: any) => <CourseCard key={course.id} course={course} variant="elegant" />)}
          </div>
        </div>
      </section>



      {/* CTA */}
      <section className="py-32 container mx-auto px-6">
        <div className="bg-stone-800 text-white p-16 md:p-32 text-center rounded-none shadow-[0_40px_100px_-20px_rgba(0,0,0,0.5)] relative overflow-hidden group">
          <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/dark-matter.png')] opacity-10 pointer-events-none" />
          <h2 className="text-5xl md:text-[7rem] font-light mb-16 tracking-tight leading-none relative z-10">{ctaTitle}</h2>
          <div className="relative z-10">
            {!membership ? (
              <form action={joinTenantBySlug}>
                <input type="hidden" name="tenantSlug" value={tenant.slug} />
                <input type="hidden" name="role" value="student" />
                <Button className="h-20 px-16 rounded-none bg-white text-stone-800 font-bold tracking-[0.3em] hover:bg-stone-100 shadow-2xl transition-all">
                  {ctaButton}
                </Button>
              </form>
            ) : (
              <Link href={`/academy/${tenant.slug}/classroom`}>
                <Button className="h-20 px-16 rounded-none bg-white text-stone-800 font-bold tracking-[0.3em] hover:bg-stone-100 shadow-2xl transition-all">
                  OPEN CLASSROOM
                </Button>
              </Link>
            )}
          </div>
        </div>
      </section>

      {/* Footer Decoration */}
      <div className="py-12 text-center border-t border-stone-100">
        <div className="text-[10px] font-bold tracking-[0.8em] text-stone-200 uppercase">
          Excellence in Discourse
        </div>
      </div>
    </div>
  );
}
