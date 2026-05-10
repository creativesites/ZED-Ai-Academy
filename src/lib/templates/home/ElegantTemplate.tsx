import { Button } from "@/components/ui/button";
import Link from "next/link";
import { CourseCard } from "@/components/tenant/CourseCard";
import { joinTenantBySlug } from "@/actions/tenants";

import { ArrowRight, Award, BookOpen, Check, Globe, History, Layout, Landmark, Rocket, Search, Shield, Users, Zap, Quote } from "lucide-react";

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

      {/* How it Works */}
      <section className="py-32 bg-stone-50 border-y border-stone-100">
        <div className="container mx-auto px-6 max-w-7xl">
          <div className="text-center mb-24">
            <h2 className="text-4xl font-light tracking-tight text-stone-900 mb-4">THE CURATION PROCESS</h2>
            <div className="w-16 h-0.5 bg-stone-800 mx-auto" />
          </div>
          <div className="grid md:grid-cols-3 gap-20">
            {[
              { step: "Selection", desc: "Identify your path from our carefully chosen catalog of specialized programs." },
              { step: "Immersion", desc: "Engage in deep, focused study through live discourse or private mentorship." },
              { step: "Attainment", desc: "Validate your mastery with recognized credentials and portfolio excellence." }
            ].map((item, idx) => (
              <div key={idx} className="space-y-8 text-center group">
                <div className="text-stone-200 text-6xl font-light italic mb-2 select-none group-hover:text-stone-300 transition-colors">0{idx + 1}</div>
                <h3 className="text-xl font-light text-stone-900 tracking-widest uppercase">{item.step}</h3>
                <p className="text-stone-500 font-light leading-relaxed text-sm max-w-xs mx-auto italic">"{item.desc}"</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* About Tutor */}
      <section className="py-32 bg-white">
        <div className="container mx-auto px-6 max-w-7xl">
          <div className="grid lg:grid-cols-2 gap-24 items-center">
            <div className="relative">
              <div className="absolute inset-0 bg-stone-50 -translate-x-6 -translate-y-6" />
              <div className="relative aspect-square overflow-hidden shadow-2xl grayscale hover:grayscale-0 transition-all duration-1000">
                {tutorAvatar ? (
                  <img src={tutorAvatar} alt={tutorName} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full bg-stone-100 flex items-center justify-center">
                    <Users className="h-24 w-24 text-stone-200" />
                  </div>
                )}
              </div>
              <div className="absolute -bottom-8 -right-8 bg-stone-900 text-white p-10 shadow-2xl">
                <Award className="h-10 w-10 text-stone-400" />
              </div>
            </div>

            <div className="space-y-12">
              <div className="space-y-4">
                <div className="text-stone-300 text-[10px] font-bold uppercase tracking-[0.5em]">Lead Academic</div>
                <h2 className="text-5xl md:text-7xl font-light tracking-tight leading-none text-stone-900">{tutorName}</h2>
                <div className="h-0.5 w-24 bg-stone-800 mt-6" />
              </div>
              
              <p className="text-2xl font-light text-stone-500 leading-relaxed italic">
                "{tutorBio}"
              </p>

              <div className="grid grid-cols-2 gap-12">
                <div>
                  <div className="text-stone-300 text-[10px] font-bold uppercase tracking-widest mb-2">Qualifications</div>
                  <div className="font-light text-stone-800 italic">{content.tutor_education || "MSc Mathematics · PhD Education"}</div>
                </div>
                <div>
                  <div className="text-stone-300 text-[10px] font-bold uppercase tracking-widest mb-2">Institution</div>
                  <div className="font-light text-stone-800 italic">{content.tutor_university || "University of Cambridge"}</div>
                </div>
              </div>

              <div className="flex gap-16 pt-10 border-t border-stone-100">
                <div>
                  <div className="text-3xl font-light text-stone-900">{content.stats_students_tutor || "500+"}</div>
                  <div className="text-[10px] text-stone-300 uppercase tracking-widest mt-1">Scholars</div>
                </div>
                <div>
                  <div className="text-3xl font-light text-stone-900">{content.stats_rating_tutor || "4.9★"}</div>
                  <div className="text-[10px] text-stone-300 uppercase tracking-widest mt-1">Rating</div>
                </div>
                <div>
                  <div className="text-3xl font-light text-stone-900">{content.stats_hours_tutor || "12K+"}</div>
                  <div className="text-[10px] text-stone-300 uppercase tracking-widest mt-1">Discourse</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

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

      {/* Services Section */}
      <section className="py-32 bg-stone-900 text-white relative overflow-hidden">
        <div className="container mx-auto px-6 max-w-7xl relative z-10">
          <div className="text-center mb-24">
            <span className="text-stone-500 font-bold uppercase tracking-[0.5em] text-[10px] mb-4 block">SERVICES</span>
            <h2 className="text-4xl md:text-5xl font-light tracking-tight mb-4">Academic Delivery</h2>
            <div className="h-0.5 bg-stone-700 w-24 mx-auto" />
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-12 mb-24">
            {[
              { icon: Zap, title: "LIVE DISCOURSE", desc: "Interactive real-time sessions with sophisticated virtual tools." },
              { icon: Globe, title: "PRIVATE ONSITE", desc: "Exclusive in-person academic support delivered at your location." },
              { icon: History, title: "ARCHIVAL ACCESS", desc: "Permanent entry to our complete repository of past lectures." },
              { icon: Users, title: "SCHOLAR COHORTS", desc: "Small, curated peer groups for collaborative academic growth." },
              { icon: Shield, title: "CERTIFICATION", desc: "Rigorous strategic preparation for global examination standards." },
              { icon: Rocket, title: "DIRECT MENTOR", desc: "Confidential 1-on-1 link for specialized individual study." }
            ].map((service, idx) => (
              <div key={idx} className="p-12 border border-stone-800 hover:bg-stone-800/50 transition-all group">
                <div className="h-14 w-14 flex items-center justify-center bg-stone-800 text-stone-400 mb-10 group-hover:bg-stone-700 group-hover:text-white transition-all">
                  <service.icon className="h-6 w-6 font-light" />
                </div>
                <h4 className="text-lg font-light tracking-widest text-white mb-6 uppercase">{service.title}</h4>
                <p className="text-sm text-stone-500 font-light leading-relaxed italic">"{service.desc}"</p>
              </div>
            ))}
          </div>

          <div className="text-center">
            <Link href={`/sign-up?role=student&tenant=${tenant.slug}`}>
              <Button className="h-16 px-16 rounded-none bg-white text-stone-900 text-xs font-bold uppercase tracking-[0.4em] hover:bg-stone-100 shadow-2xl transition-all">
                ENROLL & BEGIN STUDY
              </Button>
            </Link>
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
