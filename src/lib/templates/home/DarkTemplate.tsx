import { Button } from "@/components/ui/button";
import Link from "next/link";
import { Sparkles, ArrowRight, Award, BookOpen, Check, Globe, History, Layout, Landmark, Rocket, Search, Shield, Users, Zap } from "lucide-react";
import { CourseCarousel } from "@/components/tenant/CourseCarousel";
import { joinTenantBySlug } from "@/actions/tenants";

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

      {/* How it Works */}
      <section className="py-32 bg-[#0a0a0c]">
        <div className="container mx-auto px-6 max-w-7xl">
          <div className="text-center mb-24">
            <h2 className="text-6xl font-black tracking-tighter mb-4">THE PROTOCOL</h2>
            <p className="text-white/40 uppercase tracking-[0.4em] text-xs">Synchronized Learning Architecture</p>
          </div>
          <div className="grid md:grid-cols-3 gap-12">
            {[
              { step: "01", t: "NEURAL MAPPING", d: "Scan our intelligence grid and select the curriculum optimized for your growth." },
              { step: "02", t: "CORE SYNC", d: "Connect with our elite instructors for real-time data transfer and live sessions." },
              { step: "03", t: "SYSTEM UPLINK", d: "Complete the cycle, earn your credentials, and unlock new career nodes." }
            ].map((item, idx) => (
              <div key={idx} className="p-10 bg-[#0f0f12] border border-white/5 rounded-[3rem] hover:border-[#fd5523]/30 transition-all group">
                <div className="text-5xl font-black text-white/5 group-hover:text-[#fd5523]/20 mb-8 transition-colors">{item.step}</div>
                <h3 className="text-2xl font-black mb-4 tracking-tight">{item.t}</h3>
                <p className="text-white/50 leading-relaxed">{item.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* About Tutor */}
      <section className="py-32 bg-[#0f0f12] border-y border-white/5">
        <div className="container mx-auto px-6 max-w-7xl">
          <div className="grid lg:grid-cols-2 gap-24 items-center">
            <div className="relative">
              <div className="aspect-square rounded-[4rem] overflow-hidden border-2 border-white/5 shadow-[0_0_50px_rgba(0,0,0,0.5)]">
                {tutorAvatar ? (
                  <img src={tutorAvatar} alt={tutorName} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full bg-[#1a1a20] flex items-center justify-center">
                    <Rocket className="h-24 w-24 text-white/10" />
                  </div>
                )}
              </div>
              <div className="absolute -bottom-6 -right-6 bg-[#fd5523] text-white p-10 rounded-[3rem] shadow-2xl rotate-6">
                <Award className="h-12 w-12" />
              </div>
            </div>

            <div className="space-y-12">
              <div className="space-y-4">
                <div className="text-[#fd5523] text-xs font-black uppercase tracking-[0.4em]">Prime Instructor</div>
                <h2 className="text-6xl md:text-8xl font-black tracking-tighter leading-none">{tutorName}</h2>
              </div>
              
              <p className="text-2xl font-medium text-white/70 leading-relaxed border-l-4 border-[#fd5523] pl-8">
                "{tutorBio}"
              </p>

              <div className="grid grid-cols-2 gap-10">
                <div className="p-6 bg-white/5 rounded-3xl border border-white/5">
                  <div className="text-white/40 text-[10px] font-black uppercase tracking-widest mb-2">Qualifications</div>
                  <div className="font-bold text-white">{content.tutor_education || "MSc Mathematics · PhD Education"}</div>
                </div>
                <div className="p-6 bg-white/5 rounded-3xl border border-white/5">
                  <div className="text-white/40 text-[10px] font-black uppercase tracking-widest mb-2">Affiliation</div>
                  <div className="font-bold text-white">{content.tutor_university || "University of Cambridge"}</div>
                </div>
              </div>

              <div className="flex gap-12 pt-10 border-t border-white/10">
                <div>
                  <div className="text-3xl font-black text-white">{content.stats_students_tutor || "500+"}</div>
                  <div className="text-xs font-bold text-white/40 uppercase tracking-widest">Alumni</div>
                </div>
                <div>
                  <div className="text-3xl font-black text-white">{content.stats_rating_tutor || "4.9★"}</div>
                  <div className="text-xs font-bold text-white/40 uppercase tracking-widest">Rating</div>
                </div>
                <div>
                  <div className="text-3xl font-black text-white">{content.stats_hours_tutor || "12K+"}</div>
                  <div className="text-xs font-bold text-white/40 uppercase tracking-widest">Uptime</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

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

      {/* Services Section */}
      <section className="py-32 bg-[#0f0f12]">
        <div className="container mx-auto px-6 max-w-7xl">
          <div className="text-center mb-24">
            <h2 className="text-6xl font-black tracking-tighter mb-6 uppercase leading-none">Transmission Channels</h2>
            <div className="h-1 bg-[#fd5523] w-32 mx-auto" />
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8 mb-24">
            {[
              { icon: Zap, title: "HYPER-SPEED LIVE", desc: "Low-latency real-time sessions with our elite faculty." },
              { icon: Globe, title: "LOCAL NODE SYNC", desc: "In-person academic support delivered at your location." },
              { icon: History, title: "LEGACY ARCHIVE", desc: "Instant retrieval of all past session data and resources." },
              { icon: Users, title: "COHORT SWARM", desc: "Peer-to-peer collaborative learning environments." },
              { icon: Shield, title: "PROTOCOL PREP", desc: "Strategic defense against global standardized exams." },
              { icon: Rocket, title: "PRIME MENTOR", desc: "Direct 1-on-1 link for deep specific optimization." }
            ].map((service, idx) => (
              <div key={idx} className="p-10 bg-white/5 border border-white/5 rounded-[2.5rem] hover:bg-[#fd5523]/5 hover:border-[#fd5523]/20 transition-all group">
                <div className="h-14 w-14 flex items-center justify-center bg-white/5 text-[#fd5523] rounded-2xl mb-8 group-hover:scale-110 transition-transform">
                  <service.icon className="h-7 w-7" />
                </div>
                <h4 className="text-2xl font-black tracking-tight text-white mb-4 uppercase">{service.title}</h4>
                <p className="text-sm text-white/50 leading-relaxed">{service.desc}</p>
              </div>
            ))}
          </div>

          <div className="text-center">
            <Link href={`/sign-up?role=student&tenant=${tenant.slug}`}>
              <Button className="h-20 px-16 rounded-[2.5rem] bg-white text-black text-xl font-black uppercase tracking-widest hover:bg-[#fd5523] hover:text-white transition-all shadow-2xl">
                Initialize Enrollment
              </Button>
            </Link>
          </div>
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
