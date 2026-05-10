import { Button } from "@/components/ui/button";
import { CourseCard } from "@/components/tenant/CourseCard";
import { joinTenantBySlug } from "@/actions/tenants";
import Link from "next/link";
import { Sparkles, ArrowRight, Zap, Target, Shield, Globe } from "lucide-react";

export function MinimalTemplate({ tenant, courses, membership, brandColor, heroTitle, heroSubtitle, aboutTitle, aboutText, aboutImage, ctaTitle, ctaButton, content, adminProfile }: any) {
  const showHeroImage = !!content.hero_image;
  const tutorName = adminProfile?.full_name || "Academy Tutor";
  const tutorBio = adminProfile?.bio || "Expert educator dedicated to student success.";
  const tutorAvatar = adminProfile?.avatar_url || null;

  return (
    <div className="font-sans bg-white selection:bg-slate-900 selection:text-white" style={{ "--primary-color": brandColor } as React.CSSProperties}>
      {/* Hero */}
      <section className="pt-24 pb-20 lg:pt-40 lg:pb-32">
        <div className="container mx-auto px-6 max-w-7xl">
          <div className={`grid ${showHeroImage ? 'lg:grid-cols-2' : 'grid-cols-1'} gap-20 items-center`}>
            <div className={showHeroImage ? "text-left" : "text-center max-w-4xl mx-auto"}>
              <h1 className="text-6xl md:text-8xl font-light tracking-tight text-slate-900 mb-10 leading-[1.05]">
                {heroTitle}
              </h1>
              <p className="text-xl md:text-2xl text-slate-400 font-light max-w-2xl mb-16 leading-relaxed">
                {heroSubtitle}
              </p>
              
              <div className={`flex flex-col sm:flex-row items-center gap-8 mb-20 ${!showHeroImage && 'justify-center'}`}>
                {!membership ? (
                  <form action={joinTenantBySlug}>
                    <input type="hidden" name="tenantSlug" value={tenant.slug} />
                    <Button className="h-16 px-12 rounded-full bg-slate-900 text-white text-base font-medium tracking-tight hover:bg-slate-800 transition-all">
                      Start Your Journey
                    </Button>
                  </form>
                ) : (
                  <Link href={`/academy/${tenant.slug}/classroom`}>
                    <Button className="h-16 px-12 rounded-full bg-slate-900 text-white text-base font-medium tracking-tight hover:bg-slate-800 transition-all">
                      Open Classroom
                    </Button>
                  </Link>
                )}
                <Button variant="ghost" className="h-16 px-8 rounded-full text-slate-500 font-medium group">
                  Explore Courses <ArrowRight className="h-4 w-4 ml-2 group-hover:translate-x-1 transition-transform" />
                </Button>
              </div>

              {/* Hero Stats */}
              <div className={`flex items-center gap-16 pt-10 border-t border-slate-100 ${!showHeroImage && "justify-center"}`}>
                <div>
                  <div className="text-4xl font-light text-slate-900">{content.stats_students || "10k+"}</div>
                  <div className="text-[10px] font-medium text-slate-400 uppercase tracking-widest mt-1">Students</div>
                </div>
                <div>
                  <div className="text-4xl font-light text-slate-900">{content.stats_rating || "4.9/5"}</div>
                  <div className="text-[10px] font-medium text-slate-400 uppercase tracking-widest mt-1">Rating</div>
                </div>
                <div>
                  <div className="text-4xl font-light text-slate-900">{content.stats_success || "95%"}</div>
                  <div className="text-[10px] font-medium text-slate-400 uppercase tracking-widest mt-1">Success</div>
                </div>
              </div>
            </div>

            {showHeroImage && (
              <div className="relative aspect-square">
                <div className="absolute inset-0 bg-slate-50 rounded-[4rem] -rotate-3" />
                <div className="relative h-full w-full rounded-[4rem] overflow-hidden grayscale hover:grayscale-0 transition-all duration-700 shadow-xl">
                  <img src={content.hero_image} className="w-full h-full object-cover" alt={heroTitle} />
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Philosophy/About */}
      <section className="py-32 border-y border-slate-100 bg-slate-50/30">
        <div className="container mx-auto px-6 max-w-4xl">
           <div className="flex flex-col items-center text-center space-y-12">
             <div className="h-px w-24 bg-slate-200" />
             <h2 className="text-3xl md:text-5xl font-light text-slate-900 leading-tight">
               {aboutTitle}
             </h2>
             <p className="text-xl md:text-2xl text-slate-400 font-light leading-relaxed">
               {aboutText}
             </p>
             <div className="h-px w-24 bg-slate-200" />
           </div>
        </div>
      </section>

      {/* How it Works */}
      <section className="py-32 bg-white">
        <div className="container mx-auto px-6 max-w-7xl">
          <div className="mb-20">
            <h2 className="text-4xl font-light text-slate-900 mb-4">Methodology</h2>
            <div className="h-1 w-12 bg-slate-900" />
          </div>
          <div className="grid md:grid-cols-3 gap-16">
            {[
              { n: "01", t: "Discovery", d: "Identify your path through our curated selection of specialized curriculum." },
              { n: "02", t: "Integration", d: "Join live sessions or onsite tutoring tailored to your individual pace." },
              { n: "03", t: "Mastery", d: "Achieve measurable results and industry-standard academic certification." }
            ].map((item, idx) => (
              <div key={idx} className="space-y-6">
                <div className="text-4xl font-light text-slate-200">{item.n}</div>
                <h4 className="text-xl font-medium text-slate-900">{item.t}</h4>
                <p className="text-slate-500 leading-relaxed font-light">{item.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* About Tutor */}
      <section className="py-32 bg-slate-50 border-y border-slate-100">
        <div className="container mx-auto px-6 max-w-7xl">
          <div className="grid lg:grid-cols-2 gap-20 items-center">
            <div className="relative">
              <div className="aspect-square rounded-[3rem] overflow-hidden grayscale hover:grayscale-0 transition-all duration-700 shadow-2xl">
                {tutorAvatar ? (
                  <img src={tutorAvatar} alt={tutorName} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full bg-slate-200 flex items-center justify-center">
                    <Globe className="h-20 w-20 text-slate-300" />
                  </div>
                )}
              </div>
              <div className="absolute -bottom-8 -right-8 bg-white p-8 rounded-3xl shadow-xl border border-slate-100">
                <div className="text-slate-900 font-medium mb-1">Tutor Badge</div>
                <div className="text-xs text-slate-400">{content.tutor_badge || "Cambridge Certified"}</div>
              </div>
            </div>

            <div className="space-y-10">
              <div className="space-y-4">
                <div className="text-xs font-medium text-slate-400 uppercase tracking-widest">Lead Educator</div>
                <h2 className="text-4xl md:text-5xl font-light text-slate-900 leading-tight">{tutorName}</h2>
                <div className="h-1 w-12 bg-slate-900" />
              </div>
              
              <p className="text-xl text-slate-500 font-light leading-relaxed italic">
                "{tutorBio}"
              </p>

              <div className="grid grid-cols-2 gap-10">
                <div>
                  <div className="text-xs font-medium text-slate-400 uppercase tracking-widest mb-2">Qualifications</div>
                  <div className="text-slate-900">{content.tutor_education || "MSc Mathematics · PhD Education"}</div>
                </div>
                <div>
                  <div className="text-xs font-medium text-slate-400 uppercase tracking-widest mb-2">Institution</div>
                  <div className="text-slate-900">{content.tutor_university || "University of Cambridge"}</div>
                </div>
              </div>

              <div className="flex gap-12 pt-10 border-t border-slate-200">
                <div>
                  <div className="text-2xl font-light text-slate-900">{content.stats_students_tutor || "500+"}</div>
                  <div className="text-[10px] text-slate-400 uppercase tracking-widest mt-1">Alumni</div>
                </div>
                <div>
                  <div className="text-2xl font-light text-slate-900">{content.stats_rating_tutor || "4.9★"}</div>
                  <div className="text-[10px] text-slate-400 uppercase tracking-widest mt-1">Rating</div>
                </div>
                <div>
                  <div className="text-2xl font-light text-slate-900">{content.stats_hours_tutor || "12K+"}</div>
                  <div className="text-[10px] text-slate-400 uppercase tracking-widest mt-1">Hours</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Services Grid */}
      <section className="py-32">
        <div className="container mx-auto px-6 max-w-7xl">
          <div className="mb-20 flex items-end justify-between">
            <div className="space-y-4">
              <h2 className="text-4xl font-light text-slate-900">Learning Models</h2>
              <div className="h-1 w-12 bg-slate-900" />
            </div>
            <p className="text-slate-400 max-w-xs font-light">Customized delivery formats for every learning style.</p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-12 mb-20">
            {[
              { t: "Live Digital", d: "Interactive real-time sessions via our high-definition virtual classroom." },
              { t: "Onsite Personal", d: "In-person academic support delivered at your preferred location." },
              { t: "On-Demand", d: "Unlimited access to our archival library of curriculum and resources." },
              { t: "Private Mentor", d: "Direct 1-on-1 focus on your specific academic requirements." },
              { t: "Exam Strategy", d: "Intensive targeted preparation for global standardized examinations." },
              { t: "Peer Cohort", d: "Collaborative learning environments for shared academic growth." }
            ].map((s, i) => (
              <div key={i} className="p-10 border border-slate-100 hover:border-slate-900 transition-all group">
                <h4 className="text-lg font-medium text-slate-900 mb-6 group-hover:translate-x-2 transition-transform tracking-tight">{s.t}</h4>
                <p className="text-slate-400 font-light leading-relaxed">{s.d}</p>
              </div>
            ))}
          </div>

          <div className="text-center">
            <Link href={`/sign-up?role=student&tenant=${tenant.slug}`}>
              <Button className="h-16 px-12 rounded-full border-2 border-slate-900 text-slate-900 bg-transparent hover:bg-slate-900 hover:text-white transition-all font-medium uppercase tracking-widest text-xs">
                Enroll & Begin Learning
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Courses Grid */}
      <section className="py-32 bg-slate-50 border-y border-slate-100">
        <div className="container mx-auto px-6 max-w-7xl">
          <div className="flex items-center justify-between mb-20">
             <h2 className="text-4xl font-light text-slate-900">Academic Catalog</h2>
             <Link href="/courses" className="text-sm font-medium text-slate-400 hover:text-slate-900 transition-colors">
               View All Programs
             </Link>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-12">
            {courses?.map((course: any) => <CourseCard key={course.id} course={course} variant="minimal" />)}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-40">
        <div className="container mx-auto px-6 max-w-3xl text-center">
          <h2 className="text-5xl md:text-7xl font-light text-slate-900 mb-12 tracking-tight">
            {ctaTitle}
          </h2>
          {!membership ? (
            <form action={joinTenantBySlug}>
              <input type="hidden" name="tenantSlug" value={tenant.slug} />
              <Button className="h-16 px-14 rounded-full bg-slate-900 text-white text-lg font-medium hover:scale-105 transition-all shadow-2xl">
                {ctaButton}
              </Button>
            </form>
          ) : (
            <Link href={`/academy/${tenant.slug}/classroom`}>
              <Button className="h-16 px-14 rounded-full bg-slate-900 text-white text-lg font-medium hover:scale-105 transition-all shadow-2xl">
                Open Classroom
              </Button>
            </Link>
          )}
        </div>
      </section>

      {/* Footer */}
      <footer className="py-20 border-t border-slate-100">
        <div className="container mx-auto px-6 text-center text-slate-300 text-xs font-medium tracking-widest uppercase">
          © {new Date().getFullYear()} {tenant.name} · Less is More
        </div>
      </footer>
    </div>
  );
}
