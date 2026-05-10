import { Button } from "@/components/ui/button";
import Link from "next/link";
import { CourseCard } from "@/components/tenant/CourseCard";
import { joinTenantBySlug } from "@/actions/tenants";
import { Globe, Shield, Users, ArrowRight, Award, BookOpen, Check, History, Layout, Landmark, Rocket, Search, Zap, Briefcase } from "lucide-react";

export function CorporateTemplate({ tenant, courses, membership, brandColor, heroTitle, heroSubtitle, aboutTitle, aboutText, aboutImage, ctaTitle, ctaButton, content, adminProfile }: any) {
  const tutorName = adminProfile?.full_name || "Academy Tutor";
  const tutorBio = adminProfile?.bio || "Expert educator dedicated to student success.";
  const tutorAvatar = adminProfile?.avatar_url || null;

  return (
    <div className="font-sans tracking-wide bg-white" style={{ "--primary-color": brandColor } as React.CSSProperties}>
      {/* Hero */}
      <section className="pt-52 pb-32 bg-slate-50 relative overflow-hidden">
        <div className="container mx-auto px-6 max-w-7xl flex flex-col lg:flex-row items-center gap-20 relative z-10">
          <div className="flex-1 space-y-8">
            <span className="text-blue-600 font-bold uppercase tracking-[0.3em] text-sm">Professional Development</span>
            <h1 className="text-5xl md:text-7xl font-black text-slate-800 leading-tight">{heroTitle}</h1>
            <p className="text-xl text-slate-600">{heroSubtitle}</p>
            <div className="flex gap-4 mb-12">
              {!membership ? (
                <form action={joinTenantBySlug}>
                  <input type="hidden" name="tenantSlug" value={tenant.slug} />
                  <input type="hidden" name="role" value="student" />
                  <Button className="h-16 px-12 rounded-md bg-blue-600 text-white font-bold hover:bg-blue-700 shadow-lg transition-all">
                    Get Started
                  </Button>
                </form>
              ) : (
                <Link href={`/academy/${tenant.slug}/classroom`}>
                  <Button className="h-16 px-12 rounded-md bg-blue-600 text-white font-bold hover:bg-blue-700 shadow-lg transition-all">
                    Open Classroom
                  </Button>
                </Link>
              )}
              <Button variant="outline" className="h-16 px-10 rounded-md border-slate-300 font-bold bg-white">
                Corporate Plans
              </Button>
            </div>

            {/* Hero Stats */}
            <div className="grid grid-cols-3 gap-10 pt-12 border-t border-slate-200">
              <div>
                <div className="text-3xl font-black text-slate-800">{content.stats_students || "10k+"}</div>
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Learners</div>
              </div>
              <div>
                <div className="text-3xl font-black text-slate-800">{content.stats_rating || "4.9/5"}</div>
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Satisfaction</div>
              </div>
              <div>
                <div className="text-3xl font-black text-slate-800">{content.stats_success || "95%"}</div>
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Placement</div>
              </div>
            </div>
          </div>
          <div className="flex-1 relative">
            <div className="absolute -inset-4 bg-blue-100 rounded-2xl -rotate-2" />
            <div className="relative rounded-2xl overflow-hidden shadow-2xl border-4 border-white">
              <img src={content.hero_image || aboutImage} className="w-full h-full object-cover" style={{maxHeight: '600px'}} alt="" />
            </div>
          </div>
        </div>
      </section>

      {/* Trust Bar */}
      <section className="py-20 bg-white border-b">
        <div className="container mx-auto px-6 text-center">
          <p className="text-sm font-bold uppercase tracking-widest text-slate-400 mb-10">Trusted by leading organisations</p>
          <div className="flex flex-wrap justify-center gap-16 opacity-40 grayscale">
            {[ "Acme Inc", "GlobalTech", "EduPrime", "SkillForge", "LearnCorp" ].map(name => (
              <span key={name} className="text-2xl font-black text-slate-400">{name}</span>
            ))}
          </div>
        </div>
      </section>

      {/* How it Works */}
      <section className="py-32 bg-slate-50/50">
        <div className="container mx-auto px-6 max-w-7xl">
          <div className="text-center mb-20">
            <h2 className="text-4xl font-black text-slate-800 mb-4 tracking-tight">The Implementation Process</h2>
            <p className="text-slate-500">A structured approach to enterprise-grade learning.</p>
          </div>
          <div className="grid md:grid-cols-3 gap-12">
            {[
              { icon: Search, t: "Needs Assessment", d: "We identify skill gaps within your organization and recommend targeted curriculum." },
              { icon: Layout, t: "Deployment", d: "Full access for your team to live sessions, onsite workshops, and self-paced modules." },
              { icon: Shield, t: "Verification", d: "Measurable progress tracking and industry-recognized certifications for every learner." }
            ].map((item, idx) => (
              <div key={idx} className="bg-white p-10 rounded-2xl shadow-sm border border-slate-100 relative group hover:border-blue-200 transition-all">
                <div className="w-14 h-14 bg-blue-50 rounded-xl flex items-center justify-center text-blue-600 mb-8 group-hover:bg-blue-600 group-hover:text-white transition-all">
                  <item.icon className="h-7 w-7" />
                </div>
                <h3 className="text-xl font-bold text-slate-800 mb-4">{item.t}</h3>
                <p className="text-slate-500 leading-relaxed text-sm">{item.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* About Tutor */}
      <section className="py-32 bg-white">
        <div className="container mx-auto px-6 max-w-7xl">
          <div className="grid lg:grid-cols-2 gap-20 items-center">
            <div className="order-2 lg:order-1">
              <span className="text-blue-600 font-bold uppercase tracking-widest text-xs mb-4 block">Executive Faculty</span>
              <h2 className="text-4xl md:text-5xl font-black text-slate-800 mb-8 leading-tight">{tutorName}</h2>
              <p className="text-xl text-slate-600 leading-relaxed mb-10 font-medium italic underline decoration-blue-200 decoration-4 underline-offset-8">
                "{tutorBio}"
              </p>
              
              <div className="grid grid-cols-2 gap-8 mb-12">
                <div className="p-6 bg-slate-50 rounded-xl border border-slate-100">
                  <div className="text-slate-400 text-[10px] font-bold uppercase tracking-widest mb-2">Qualifications</div>
                  <div className="font-bold text-slate-800 text-sm">{content.tutor_education || "MSc Mathematics · PhD Education"}</div>
                </div>
                <div className="p-6 bg-slate-50 rounded-xl border border-slate-100">
                  <div className="text-slate-400 text-[10px] font-bold uppercase tracking-widest mb-2">Institution</div>
                  <div className="font-bold text-slate-800 text-sm">{content.tutor_university || "University of Cambridge"}</div>
                </div>
              </div>

              <div className="flex gap-16 pt-10 border-t border-slate-100">
                <div>
                  <div className="text-2xl font-black text-slate-800">{content.stats_students_tutor || "500+"}</div>
                  <div className="text-xs font-bold text-slate-400 uppercase tracking-widest">Alumni</div>
                </div>
                <div>
                  <div className="text-2xl font-black text-slate-800">{content.stats_rating_tutor || "4.9★"}</div>
                  <div className="text-xs font-bold text-slate-400 uppercase tracking-widest">Rating</div>
                </div>
                <div>
                  <div className="text-2xl font-black text-slate-800">{content.stats_hours_tutor || "12K+"}</div>
                  <div className="text-xs font-bold text-slate-400 uppercase tracking-widest">Hours</div>
                </div>
              </div>
            </div>

            <div className="order-1 lg:order-2 relative">
              <div className="aspect-[4/5] rounded-2xl overflow-hidden shadow-2xl border-8 border-white grayscale hover:grayscale-0 transition-all duration-700">
                {tutorAvatar ? (
                  <img src={tutorAvatar} alt={tutorName} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full bg-slate-100 flex items-center justify-center">
                    <Users className="h-24 w-24 text-slate-300" />
                  </div>
                )}
              </div>
              <div className="absolute -top-6 -right-6 bg-blue-600 text-white p-8 rounded-2xl shadow-xl">
                <Briefcase className="h-10 w-10" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Services Section */}
      <section className="py-32 bg-slate-800 text-white">
        <div className="container mx-auto px-6 max-w-7xl">
          <div className="text-center mb-24">
            <span className="text-blue-400 font-bold uppercase tracking-widest text-xs mb-4 block">Enterprise Solutions</span>
            <h2 className="text-4xl md:text-5xl font-black tracking-tight mb-4">Strategic Academic Services</h2>
            <div className="h-1 bg-blue-500 w-24 mx-auto" />
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8 mb-24">
            {[
              { icon: Zap, title: "EXECUTIVE LIVE", desc: "High-level interactive sessions for leadership and specialized teams." },
              { icon: Globe, title: "ONSITE SEMINARS", desc: "Tailored in-person academic delivery at your corporate headquarters." },
              { icon: History, title: "DATA ARCHIVE", desc: "Full repository access to all proprietary training and past sessions." },
              { icon: Shield, title: "ACCREDITATION", desc: "Structured preparation for professional board and certification exams." },
              { icon: Users, title: "GROUP COHORTS", desc: "Collaborative learning environments designed for team synergy." },
              { icon: Rocket, title: "DIRECT MENTORSHIP", desc: "Confidential 1-on-1 focus on specific individual requirements." }
            ].map((service, idx) => (
              <div key={idx} className="p-10 bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 transition-all group">
                <div className="h-14 w-14 flex items-center justify-center bg-blue-600/20 text-blue-400 rounded-lg mb-8 group-hover:scale-110 transition-transform">
                  <service.icon className="h-7 w-7" />
                </div>
                <h4 className="text-xl font-bold mb-4 tracking-tight">{service.title}</h4>
                <p className="text-slate-400 text-sm leading-relaxed">{service.desc}</p>
              </div>
            ))}
          </div>

          <div className="text-center">
            <Link href={`/sign-up?role=student&tenant=${tenant.slug}`}>
              <Button className="h-16 px-16 rounded-md bg-blue-600 text-white text-lg font-bold hover:bg-blue-700 shadow-2xl transition-all uppercase tracking-widest">
                Authorize Enrollment
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Courses Grid */}
      <section className="py-32 bg-white">
        <div className="container mx-auto px-6 max-w-7xl">
          <div className="flex items-center justify-between mb-20">
            <h2 className="text-4xl font-black text-slate-800 tracking-tight">Available Programs</h2>
            <Link href="/courses" className="text-blue-600 font-bold flex items-center gap-2 group">
              View Catalog <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
            </Link>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
            {courses?.map((course: any) => <CourseCard key={course.id} course={course} variant="corporate" />)}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-32 container mx-auto px-6">
        <div className="bg-blue-600 rounded-3xl p-16 md:p-32 text-center text-white shadow-2xl shadow-blue-600/20 relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-blue-700 to-blue-500" />
          <div className="relative z-10 max-w-3xl mx-auto">
            <h2 className="text-5xl md:text-7xl font-black mb-12 tracking-tight leading-none">{ctaTitle}</h2>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-6">
              {!membership ? (
                <form action={joinTenantBySlug}>
                  <input type="hidden" name="tenantSlug" value={tenant.slug} />
                  <input type="hidden" name="role" value="student" />
                  <Button className="h-20 px-16 rounded-full bg-white text-blue-600 text-xl font-black shadow-xl hover:scale-105 transition-all">
                    {ctaButton}
                  </Button>
                </form>
              ) : (
                <Link href={`/academy/${tenant.slug}/classroom`}>
                  <Button className="h-20 px-16 rounded-full bg-white text-blue-600 text-xl font-black shadow-xl hover:scale-105 transition-all">
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
