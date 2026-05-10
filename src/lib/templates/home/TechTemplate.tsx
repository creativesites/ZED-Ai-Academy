import { Button } from "@/components/ui/button";
import Link from "next/link";
import { Globe, Shield, Zap, ArrowRight, Award, BookOpen, Check, History, Layout, Landmark, Rocket, Search, Users, Terminal, Code, Cpu } from "lucide-react";
import { CourseCarousel } from "@/components/tenant/CourseCarousel";
import { joinTenantBySlug } from "@/actions/tenants";

export function TechTemplate({ tenant, courses, membership, brandColor, heroTitle, heroSubtitle, aboutTitle, aboutText, aboutImage, ctaTitle, ctaButton, content, adminProfile }: any) {
  const tutorName = adminProfile?.full_name || "Academy Tutor";
  const tutorBio = adminProfile?.bio || "Expert educator dedicated to student success.";
  const tutorAvatar = adminProfile?.avatar_url || null;

  return (
    <div className="bg-slate-950 text-white font-mono selection:bg-cyan-500 selection:text-black" style={{ "--primary-color": brandColor } as React.CSSProperties}>
      {/* Hero with data grid */}
      <section className="relative pt-52 pb-32 overflow-hidden">
        <div className="absolute inset-0 opacity-20" style={{ backgroundImage: "url('https://www.transparenttextures.com/patterns/carbon-fibre.png')" }} />
        
        {/* Scanline Effect */}
        <div className="absolute inset-0 pointer-events-none bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] z-50 bg-[length:100%_2px,3px_100%]" />

        <div className="container mx-auto px-6 text-center relative z-10">
          <div className="inline-block px-6 py-2 border border-cyan-500/30 rounded text-cyan-400 text-xs uppercase tracking-[0.3em] mb-12 animate-pulse">
            [ system: online // tenant: {tenant.slug} ]
          </div>
          <h1 className="text-7xl md:text-[9rem] font-black leading-[0.8] mb-10 text-cyan-400 uppercase tracking-tighter" style={{ textShadow: "0 0 20px rgba(0,255,255,0.5)" }}>
            {heroTitle}
          </h1>
          <p className="text-xl md:text-2xl text-cyan-300/70 max-w-3xl mx-auto mb-16">{heroSubtitle}</p>
          <div className="flex justify-center gap-6 mb-24">
            {!membership ? (
              <form action={joinTenantBySlug}>
                <input type="hidden" name="tenantSlug" value={tenant.slug} />
                <input type="hidden" name="role" value="student" />
                <Button className="h-20 px-12 rounded-none bg-cyan-500 text-black font-black text-xl hover:bg-cyan-400 shadow-[0_0_30px_rgba(0,255,255,0.5)] uppercase tracking-widest transition-all">
                  Initialize
                </Button>
              </form>
            ) : (
              <Link href={`/academy/${tenant.slug}/classroom`}>
                <Button className="h-20 px-12 rounded-none bg-cyan-500 text-black font-black text-xl hover:bg-cyan-400 shadow-[0_0_30px_rgba(0,255,255,0.5)] uppercase tracking-widest transition-all">
                  Open Classroom
                </Button>
              </Link>
            )}
            <Button variant="outline" className="h-20 px-10 rounded-none border-cyan-500/30 text-cyan-400 font-black text-xl uppercase tracking-widest">
              Docs
            </Button>
          </div>

          {/* Hero Stats */}
          <div className="grid grid-cols-3 gap-10 max-w-4xl mx-auto pt-20 border-t border-cyan-500/10">
            {[ 
              { n: content.stats_students || "10K+", l: "Active Nodes" }, 
              { n: content.stats_rating || "4.9", l: "Reliability" }, 
              { n: content.stats_success || "99.9%", l: "Uptime" } 
            ].map(s => (
              <div key={s.l}>
                <div className="text-5xl font-black text-cyan-400 mb-2" style={{ textShadow: "0 0 15px #0ff" }}>{s.n}</div>
                <div className="text-[10px] uppercase tracking-widest text-cyan-400/40">{s.l}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Mission */}
      <section className="py-32 bg-slate-900 border-y border-cyan-500/10">
        <div className="container mx-auto px-6 max-w-7xl">
          <div className="grid lg:grid-cols-2 gap-20 items-center">
            <div className="space-y-10">
              <div className="inline-block px-4 py-1 border border-cyan-500/20 text-cyan-500/60 text-[10px] uppercase tracking-[0.4em]">Mission Log</div>
              <h2 className="text-5xl md:text-7xl font-black text-cyan-400 uppercase tracking-tighter leading-none">{aboutTitle}</h2>
              <p className="text-xl md:text-2xl text-slate-400 leading-relaxed border-l-2 border-cyan-500/30 pl-8">{aboutText}</p>
            </div>
            <div className="relative aspect-square rounded-none overflow-hidden border border-cyan-500/20 group">
              <img src={content.hero_image || aboutImage} className="w-full h-full object-cover grayscale brightness-50 group-hover:grayscale-0 group-hover:brightness-100 transition-all duration-1000" alt="" />
              <div className="absolute inset-0 bg-cyan-500/10 pointer-events-none" />
              {/* Corner Accents */}
              <div className="absolute top-0 left-0 w-8 h-8 border-t-2 border-l-2 border-cyan-500" />
              <div className="absolute bottom-0 right-0 w-8 h-8 border-b-2 border-r-2 border-cyan-500" />
            </div>
          </div>
        </div>
      </section>

      {/* How it Works */}
      <section className="py-32 bg-slate-950 relative overflow-hidden">
        <div className="container mx-auto px-6 max-w-7xl relative z-10">
          <div className="text-center mb-24">
            <h2 className="text-5xl font-black text-cyan-400 mb-4 tracking-tighter uppercase">[ Execution Flow ]</h2>
            <p className="text-cyan-500/40 text-xs uppercase tracking-[0.5em]">Synchronized Deployment Protocol</p>
          </div>
          <div className="grid md:grid-cols-3 gap-12">
            {[
              { id: "0x01", t: "SCAN", d: "Identify the relevant curriculum nodes from our decentralized academic grid." },
              { id: "0x02", t: "UPLINK", d: "Connect with lead instructors for high-bandwidth real-time data transfer." },
              { id: "0x03", t: "EXECUTE", d: "Finalize the learning cycle and commit your achievements to the ledger." }
            ].map((item, idx) => (
              <div key={idx} className="p-10 border border-cyan-500/10 bg-slate-900/50 hover:border-cyan-500/40 transition-all group">
                <div className="text-cyan-500/20 text-xs font-black mb-6 tracking-widest">{item.id}</div>
                <h3 className="text-2xl font-black text-cyan-400 mb-4 tracking-tight uppercase group-hover:translate-x-2 transition-transform">{item.t}</h3>
                <p className="text-slate-500 text-sm leading-relaxed">{item.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* About Tutor */}
      <section className="py-32 bg-slate-900 border-y border-cyan-500/10">
        <div className="container mx-auto px-6 max-w-7xl">
          <div className="grid lg:grid-cols-2 gap-24 items-center">
            <div className="relative">
              <div className="aspect-square bg-slate-950 border border-cyan-500/20 overflow-hidden relative group">
                {tutorAvatar ? (
                  <img src={tutorAvatar} alt={tutorName} className="w-full h-full object-cover grayscale group-hover:grayscale-0 transition-all duration-700" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Code className="h-24 w-24 text-cyan-500/10" />
                  </div>
                )}
                <div className="absolute inset-0 border-[16px] border-slate-900/80 pointer-events-none" />
                <div className="absolute inset-0 border border-cyan-500/30 pointer-events-none scale-[0.98]" />
              </div>
              <div className="absolute -bottom-8 -right-8 bg-cyan-500 text-black p-10 shadow-[0_0_30px_rgba(0,255,255,0.3)]">
                <Award className="h-12 w-12" />
              </div>
            </div>

            <div className="space-y-12">
              <div className="space-y-4">
                <div className="text-cyan-500 text-xs font-black uppercase tracking-[0.5em]">Lead Architect</div>
                <h2 className="text-6xl md:text-8xl font-black tracking-tighter leading-none text-cyan-400">{tutorName}</h2>
              </div>
              
              <div className="bg-slate-950 p-10 border border-cyan-500/10">
                <p className="text-xl text-cyan-300/60 leading-relaxed italic">
                  "{tutorBio}"
                </p>
              </div>

              <div className="grid grid-cols-2 gap-8">
                <div className="border-l-2 border-cyan-500/30 pl-6">
                  <div className="text-cyan-500/40 text-[10px] font-black uppercase tracking-widest mb-2">Credentials</div>
                  <div className="font-bold text-white text-sm">{content.tutor_education || "MSc Mathematics · PhD Education"}</div>
                </div>
                <div className="border-l-2 border-cyan-500/30 pl-6">
                  <div className="text-cyan-500/40 text-[10px] font-black uppercase tracking-widest mb-2">Base Node</div>
                  <div className="font-bold text-white text-sm">{content.tutor_university || "University of Cambridge"}</div>
                </div>
              </div>

              <div className="flex gap-12 pt-10 border-t border-cyan-500/10">
                <div>
                  <div className="text-3xl font-black text-cyan-400">{content.stats_students_tutor || "500+"}</div>
                  <div className="text-[10px] font-black text-cyan-400/40 uppercase tracking-widest mt-1">Nodes</div>
                </div>
                <div>
                  <div className="text-3xl font-black text-cyan-400">{content.stats_rating_tutor || "4.9★"}</div>
                  <div className="text-[10px] font-black text-cyan-400/40 uppercase tracking-widest mt-1">Uptime</div>
                </div>
                <div>
                  <div className="text-3xl font-black text-cyan-400">{content.stats_hours_tutor || "12K+"}</div>
                  <div className="text-[10px] font-black text-cyan-400/40 uppercase tracking-widest mt-1">Compute</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Courses Slider */}
      <section className="py-32 bg-slate-950">
        <div className="container mx-auto px-6 max-w-7xl">
          <div className="flex items-center justify-between mb-20">
            <h2 className="text-5xl font-black text-cyan-400 tracking-tighter uppercase">[ Data Catalog ]</h2>
            <Link href="/courses" className="text-cyan-500 text-xs font-black uppercase tracking-[0.4em] flex items-center gap-2 group">
              View All <ArrowRight className="h-4 w-4 group-hover:translate-x-2 transition-transform" />
            </Link>
          </div>
          <CourseCarousel courses={courses} variant="tech" />
        </div>
      </section>

      {/* Services Section */}
      <section className="py-32 bg-slate-900 relative overflow-hidden">
        <div className="container mx-auto px-6 max-w-7xl relative z-10">
          <div className="text-center mb-24">
            <h2 className="text-5xl md:text-6xl font-black tracking-tighter mb-6 uppercase leading-none text-cyan-400">System Modules</h2>
            <div className="h-1 bg-cyan-500 w-32 mx-auto" />
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8 mb-24">
            {[
              { icon: Zap, title: "CORE LIVE", desc: "Interactive real-time transmission with our architect faculty." },
              { icon: Globe, title: "LOCAL NODE", desc: "In-person academic deployment directly to your physical coordinates." },
              { icon: History, title: "DATA VAULT", desc: "Instant retrieval of all legacy session data and resources." },
              { icon: Users, title: "GRID SWARM", desc: "Small-batch collaborative modules for shared academic compute." },
              { icon: Shield, title: "PROTOCOL PREP", desc: "Strategic optimization for global standard certification exams." },
              { icon: Rocket, title: "DIRECT LINK", desc: "Confidential 1-on-1 focus on specific individual requirements." }
            ].map((service, idx) => (
              <div key={idx} className="p-10 bg-slate-950 border border-cyan-500/10 hover:border-cyan-500/40 transition-all group">
                <div className="h-14 w-14 flex items-center justify-center bg-cyan-500/10 text-cyan-400 rounded-none mb-8 group-hover:bg-cyan-500 group-hover:text-black transition-all">
                  <service.icon className="h-7 w-7" />
                </div>
                <h4 className="text-xl font-black tracking-tight text-white mb-4 uppercase">{service.title}</h4>
                <p className="text-xs text-slate-500 leading-relaxed">{service.desc}</p>
              </div>
            ))}
          </div>

          <div className="text-center">
            <Link href={`/sign-up?role=student&tenant=${tenant.slug}`}>
              <Button className="h-20 px-16 rounded-none bg-cyan-500 text-black text-xl font-black uppercase tracking-widest hover:bg-cyan-400 shadow-[0_0_40px_rgba(0,255,255,0.4)] transition-all">
                Initialize Enrollment
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-32">
        <div className="container mx-auto px-6 max-w-5xl">
          <div className="bg-slate-900 border border-cyan-500/20 p-20 md:p-32 text-center relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-full h-full bg-cyan-500/5 translate-x-1/2 translate-y-1/2 rotate-45 pointer-events-none" />
            <h2 className="text-5xl md:text-[8rem] font-black text-cyan-400 mb-16 tracking-tighter leading-none relative z-10">{ctaTitle}</h2>
            <div className="relative z-10">
              {!membership ? (
                <form action={joinTenantBySlug}>
                  <input type="hidden" name="tenantSlug" value={tenant.slug} />
                  <input type="hidden" name="role" value="student" />
                  <Button className="h-24 px-20 rounded-none bg-cyan-500 text-black text-2xl font-black shadow-[0_0_60px_rgba(0,255,255,0.4)] hover:bg-cyan-400 transition-all uppercase tracking-widest">
                    {ctaButton}
                  </Button>
                </form>
              ) : (
                <Link href={`/academy/${tenant.slug}/classroom`}>
                  <Button className="h-24 px-20 rounded-none bg-cyan-500 text-black text-2xl font-black shadow-[0_0_60px_rgba(0,255,255,0.4)] hover:bg-cyan-400 transition-all uppercase tracking-widest">
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
        <div className="container mx-auto px-6 text-center text-cyan-500/20 text-[10px] font-black tracking-[0.8em] uppercase">
          [ system: synchronized // protocol: complete ]
        </div>
      </footer>
    </div>
  );
}
