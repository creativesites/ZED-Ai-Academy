import { Button } from "@/components/ui/button";
import Link from "next/link";
import { CourseCard } from "@/components/tenant/CourseCard";
import { joinTenantBySlug } from "@/actions/tenants";

import { ArrowRight, Award, BookOpen, Check, Globe, History, Layout, Landmark, Rocket, Search, Shield, Users, Zap, Palette, Heart } from "lucide-react";
import { SharedSections } from "./SharedSections";


export function CreativeTemplate({ tenant, courses, membership, brandColor, heroTitle, heroSubtitle, aboutTitle, aboutText, aboutImage, ctaTitle, ctaButton, content, adminProfile }: any) {
  const tutorName = adminProfile?.full_name || "Academy Tutor";
  const tutorBio = adminProfile?.bio || "Expert educator dedicated to student success.";
  const tutorAvatar = adminProfile?.avatar_url || null;

  return (
    <div className="font-sans bg-white selection:bg-fuchsia-100 selection:text-fuchsia-900" style={{ "--primary-color": brandColor } as React.CSSProperties}>
      {/* Hero with blob */}
      <section className="relative pt-52 pb-32 overflow-hidden">
        <div className="absolute top-0 right-0 w-1/2 h-full bg-fuchsia-50 rounded-bl-[10rem] -z-10" />
        <div className="absolute bottom-20 left-20 w-72 h-72 bg-yellow-200 rounded-full mix-blend-multiply blur-3xl opacity-40" />
        
        <div className="container mx-auto px-6 max-w-7xl grid lg:grid-cols-2 gap-20 items-center">
          <div className="space-y-8">
            <span className="inline-block px-4 py-2 rounded-full bg-fuchsia-100 text-fuchsia-700 font-bold text-sm uppercase tracking-widest">🍎 Creative Learning</span>
            <h1 className="text-6xl md:text-7xl font-black text-fuchsia-900 leading-tight">{heroTitle}</h1>
            <p className="text-xl text-fuchsia-700/80">{heroSubtitle}</p>
            <div className="flex gap-4 mb-12">
              {!membership ? (
                <form action={joinTenantBySlug}>
                  <input type="hidden" name="tenantSlug" value={tenant.slug} />
                  <input type="hidden" name="role" value="student" />
                  <Button className="h-16 px-10 rounded-full bg-fuchsia-600 text-white font-bold shadow-lg hover:bg-fuchsia-700 transition-all">
                    Let’s Create
                  </Button>
                </form>
              ) : (
                <Link href={`/academy/${tenant.slug}/classroom`}>
                  <Button className="h-16 px-10 rounded-full bg-fuchsia-600 text-white font-bold shadow-lg hover:bg-fuchsia-700 transition-all">
                    Open Classroom
                  </Button>
                </Link>
              )}
              <Button variant="outline" className="h-16 px-10 rounded-full border-fuchsia-200 text-fuchsia-600 font-bold bg-white">
                See Our Work
              </Button>
            </div>

            {/* Hero Stats */}
            <div className="grid grid-cols-3 gap-8 pt-10 border-t border-fuchsia-100">
              <div>
                <div className="text-3xl font-black text-fuchsia-900">{content.stats_students || "10k+"}</div>
                <div className="text-[10px] font-bold text-fuchsia-400 uppercase tracking-widest mt-1">Creators</div>
              </div>
              <div>
                <div className="text-3xl font-black text-fuchsia-900">{content.stats_rating || "4.9/5"}</div>
                <div className="text-[10px] font-bold text-fuchsia-400 uppercase tracking-widest mt-1">Love Rate</div>
              </div>
              <div>
                <div className="text-3xl font-black text-fuchsia-900">{content.stats_success || "95%"}</div>
                <div className="text-[10px] font-bold text-fuchsia-400 uppercase tracking-widest mt-1">Milestones</div>
              </div>
            </div>
          </div>
          <div className="relative">
            <div className="absolute -top-10 -left-10 w-48 h-48 bg-yellow-300 rounded-full mix-blend-multiply opacity-30" />
            <div className="rounded-[4rem] overflow-hidden shadow-2xl relative z-10 border-8 border-white">
              <img src={content.hero_image || aboutImage} className="w-full h-full object-cover" style={{maxHeight: '600px'}} alt="" />
            </div>
            {/* Floating Element */}
            <div className="absolute -bottom-10 -right-10 bg-white p-6 rounded-3xl shadow-2xl border border-fuchsia-50 animate-bounce">
              <Palette className="h-10 w-10 text-fuchsia-600" />
            </div>
          </div>
        </div>
      </section>

      {/* Story */}
      <section className="py-32 bg-fuchsia-50/30">
        <div className="container mx-auto px-6 max-w-5xl text-center">
          <h2 className="text-4xl md:text-5xl font-black text-fuchsia-900 mb-10">{aboutTitle}</h2>
          <p className="text-xl text-fuchsia-800/70 leading-relaxed max-w-3xl mx-auto">{aboutText}</p>
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

      {/* Courses Grid playful */}
      <section className="py-32">
        <div className="container mx-auto px-6 max-w-7xl">
          <div className="flex items-center justify-between mb-20">
            <h2 className="text-5xl font-black text-fuchsia-900 tracking-tight">Colorful Catalog</h2>
            <Link href="/courses" className="text-fuchsia-600 font-bold flex items-center gap-2 group">
              See All <ArrowRight className="h-4 w-4 group-hover:translate-x-2 transition-transform" />
            </Link>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-12">
            {courses?.map((course: any) => <CourseCard key={course.id} course={course} variant="creative" />)}
          </div>
        </div>
      </section>



      {/* CTA */}
      <section className="py-32 container mx-auto px-6">
        <div className="relative rounded-[5rem] p-16 md:p-28 bg-gradient-to-r from-fuchsia-400 via-pink-400 to-yellow-300 text-center shadow-2xl overflow-hidden group">
          <div className="absolute top-0 right-0 w-96 h-96 bg-white rounded-full blur-3xl opacity-30 group-hover:scale-150 transition-transform duration-1000" />
          <h2 className="text-5xl md:text-8xl font-black text-white relative z-10 mb-16 tracking-tighter leading-none">{ctaTitle}</h2>
          <div className="relative z-10">
            {!membership ? (
              <form action={joinTenantBySlug}>
                <input type="hidden" name="tenantSlug" value={tenant.slug} />
                <input type="hidden" name="role" value="student" />
                <Button className="h-24 px-20 rounded-full bg-white text-fuchsia-900 text-2xl font-black shadow-2xl hover:scale-110 transition-all uppercase tracking-widest">
                  {ctaButton}
                </Button>
              </form>
            ) : (
              <Link href={`/academy/${tenant.slug}/classroom`}>
                <Button className="h-24 px-20 rounded-full bg-white text-fuchsia-900 text-2xl font-black shadow-2xl hover:scale-110 transition-all uppercase tracking-widest">
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
