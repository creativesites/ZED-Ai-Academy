import { Button } from "@/components/ui/button";
import Link from "next/link";
import { CourseCard } from "@/components/tenant/CourseCard";
import { joinTenantBySlug } from "@/actions/tenants";

import { ArrowRight, Award, BookOpen, Check, Globe, History, Layout, Landmark, Rocket, Search, Shield, Users, Zap, Palette, Heart } from "lucide-react";

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

      {/* How it Works */}
      <section className="py-32 bg-white">
        <div className="container mx-auto px-6 max-w-7xl">
          <div className="text-center mb-24 relative">
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-pink-100 rounded-full blur-3xl opacity-20" />
            <h2 className="text-5xl font-black text-fuchsia-900 mb-4 relative z-10">Your Creative Flow</h2>
            <div className="h-2 w-20 bg-yellow-400 mx-auto rounded-full" />
          </div>
          <div className="grid md:grid-cols-3 gap-16">
            {[
              { icon: Rocket, t: "Inspiration", d: "Explore our playful landscape of workshops and find the spark that drives you." },
              { icon: Palette, t: "Expression", d: "Engage in live interactive sessions where we turn complex ideas into art." },
              { icon: Heart, t: "Reflection", d: "Showcase your progress, get personal feedback, and celebrate your growth." }
            ].map((item, idx) => (
              <div key={idx} className="text-center group">
                <div className="w-20 h-20 bg-fuchsia-50 rounded-[2rem] flex items-center justify-center mx-auto mb-8 group-hover:rotate-12 group-hover:scale-110 transition-all">
                  <item.icon className="h-10 w-10 text-fuchsia-600" />
                </div>
                <h3 className="text-2xl font-black text-fuchsia-900 mb-4 tracking-tight">{item.t}</h3>
                <p className="text-fuchsia-700/60 leading-relaxed text-sm max-w-xs mx-auto">{item.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* About Tutor */}
      <section className="py-32 bg-yellow-50/30 overflow-hidden">
        <div className="container mx-auto px-6 max-w-7xl">
          <div className="grid lg:grid-cols-2 gap-20 items-center">
            <div className="relative">
              <div className="absolute -inset-10 bg-fuchsia-100 rounded-full blur-3xl opacity-20" />
              <div className="relative aspect-square rounded-[5rem] overflow-hidden border-8 border-white shadow-2xl rotate-3 hover:rotate-0 transition-transform duration-700">
                {tutorAvatar ? (
                  <img src={tutorAvatar} alt={tutorName} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full bg-fuchsia-50 flex items-center justify-center">
                    <Users className="h-24 w-24 text-fuchsia-200" />
                  </div>
                )}
              </div>
              <div className="absolute -top-10 -right-10 bg-yellow-400 text-fuchsia-900 p-8 rounded-[3rem] shadow-xl rotate-12">
                <Award className="h-12 w-12" />
              </div>
            </div>

            <div className="space-y-10">
              <div className="space-y-4">
                <span className="text-fuchsia-600 font-bold uppercase tracking-widest text-xs">Curator & Coach</span>
                <h2 className="text-5xl md:text-7xl font-black text-fuchsia-900 leading-tight">{tutorName}</h2>
              </div>
              
              <p className="text-2xl font-medium text-fuchsia-800/70 leading-relaxed bg-white/50 p-10 rounded-[3rem] border border-white">
                "{tutorBio}"
              </p>

              <div className="grid grid-cols-2 gap-6">
                <div className="p-6 bg-white rounded-3xl border border-fuchsia-50 shadow-sm">
                  <div className="text-fuchsia-400 text-[10px] font-black uppercase tracking-widest mb-2">Background</div>
                  <div className="font-bold text-fuchsia-900 text-sm">{content.tutor_education || "MSc Mathematics · PhD Education"}</div>
                </div>
                <div className="p-6 bg-white rounded-3xl border border-fuchsia-50 shadow-sm">
                  <div className="text-fuchsia-400 text-[10px] font-black uppercase tracking-widest mb-2">Philosophy</div>
                  <div className="font-bold text-fuchsia-900 text-sm">{content.tutor_university || "Learning by Doing"}</div>
                </div>
              </div>

              <div className="flex gap-12 pt-10">
                <div>
                  <div className="text-3xl font-black text-fuchsia-900">{content.stats_students_tutor || "500+"}</div>
                  <div className="text-xs font-bold text-fuchsia-400 uppercase tracking-widest mt-1">Students</div>
                </div>
                <div>
                  <div className="text-3xl font-black text-fuchsia-900">{content.stats_rating_tutor || "4.9★"}</div>
                  <div className="text-xs font-bold text-fuchsia-400 uppercase tracking-widest mt-1">Rating</div>
                </div>
                <div>
                  <div className="text-3xl font-black text-fuchsia-900">{content.stats_hours_tutor || "12K+"}</div>
                  <div className="text-xs font-bold text-fuchsia-400 uppercase tracking-widest mt-1">Workshops</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

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

      {/* Services Section */}
      <section className="py-32 bg-fuchsia-900 text-white relative overflow-hidden">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-pink-500 rounded-full blur-[120px] opacity-20" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-yellow-400 rounded-full blur-[120px] opacity-20" />
        
        <div className="container mx-auto px-6 max-w-7xl relative z-10">
          <div className="text-center mb-24">
            <h2 className="text-5xl md:text-6xl font-black tracking-tighter mb-6 leading-none">Our Palette of Learning</h2>
            <div className="h-2 bg-yellow-400 w-32 mx-auto rounded-full" />
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8 mb-24">
            {[
              { icon: Zap, title: "SPARK SESSIONS", desc: "High-energy live interactive classes that ignite new ideas." },
              { icon: Globe, title: "OFF-SCREEN SYNC", desc: "In-person academic support delivered directly to your creative space." },
              { icon: History, title: "VAULT OF WONDER", desc: "Instant entry to our complete archive of playful past sessions." },
              { icon: Users, title: "COHORT CLUBS", desc: "Small, friendly groups where you learn and grow together." },
              { icon: Shield, title: "EXAM BLOSSOM", desc: "Turning high-pressure exam prep into a path of confidence." },
              { icon: Rocket, title: "DREAM COACHING", desc: "Direct 1-on-1 focus to help you master your specific craft." }
            ].map((service, idx) => (
              <div key={idx} className="p-10 bg-white/10 backdrop-blur-md border border-white/10 rounded-[3rem] hover:bg-white/20 transition-all group">
                <div className="h-16 w-16 flex items-center justify-center bg-yellow-400 text-fuchsia-900 rounded-2xl mb-8 group-hover:rotate-12 transition-transform">
                  <service.icon className="h-8 w-8" />
                </div>
                <h4 className="text-2xl font-black tracking-tight text-white mb-4 uppercase">{service.title}</h4>
                <p className="text-pink-100/60 text-sm leading-relaxed">{service.desc}</p>
              </div>
            ))}
          </div>

          <div className="text-center">
            <Link href={`/sign-up?role=student&tenant=${tenant.slug}`}>
              <Button className="h-20 px-16 rounded-full bg-white text-fuchsia-900 text-xl font-black shadow-[0_20px_50px_rgba(0,0,0,0.3)] hover:scale-105 transition-all">
                Join the Adventure
              </Button>
            </Link>
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
