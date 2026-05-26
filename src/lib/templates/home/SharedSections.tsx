import React from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowRight, Award, BookOpen, Check, Globe, History, Landmark, Search, Shield, Sparkles } from "lucide-react";


/**
 * SharedSections – a reusable component that renders the four common sections
 * (How it Works, About Tutor, Sticky Scroll‑Cards, Services) for all home-page
 * templates. It receives the same data that each individual template already gets
 * via its props, so no additional data fetching is required.
 */
export function SharedSections({
  brandColor,
  content,
  tutorName,
  tutorBio,
  tutorAvatar,
  aboutTitle,
  aboutText,
}: any) {
  // Helper to apply the primary brand color via inline CSS variables
  const style = { "--primary-color": brandColor } as React.CSSProperties;
  return (
    <div style={style}>
      {/* ------ How It Works ------ */}
      <section className="py-24 bg-white border-y border-gray-100">
        <div className="container mx-auto px-6 max-w-7xl">
          <div className="text-center mb-20">
            <h2 className="text-4xl font-black text-gray-900 tracking-tight mb-4">
              How It Works
            </h2>
            <div className="w-20 h-1 bg-gray-900 mx-auto" />
          </div>
          <div className="grid md:grid-cols-3 gap-16">
            {[
              {
                step: "01",
                title: "Discovery",
                desc: "Identify your path through our curated curriculum.",
              },
              {
                step: "02",
                title: "Integration",
                desc: "Join live sessions or onsite tutoring tailored to your pace.",
              },
              {
                step: "03",
                title: "Mastery",
                desc: "Achieve measurable results and industry certification.",
              },
            ].map((item, idx) => (
              <div key={idx} className="relative text-center">
                <div className="text-7xl font-black text-gray-200 absolute -top-10 left-1/2 -translate-x-1/2 select-none">
                  {item.step}
                </div>
                <h3 className="text-lg font-black text-gray-900 mb-4 relative z-10 tracking-widest">
                  {item.title}
                </h3>
                <p className="text-gray-600 text-sm leading-relaxed">
                  {item.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ------ About Tutor ------ */}
      <section className="py-24 bg-gray-50 overflow-hidden">
        <div className="container mx-auto px-6 max-w-7xl">
          <div className="grid lg:grid-cols-2 gap-20 items-center">
            <div className="relative">
              <div className="relative aspect-square bg-gray-100 overflow-hidden shadow-2xl">
                {tutorAvatar ? (
                  <img
                    src={tutorAvatar}
                    alt={tutorName}
                    className="w-full h-full object-cover grayscale hover:grayscale-0 transition-all duration-700"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-gray-200">
                    <Globe className="h-20 w-20 text-gray-400" />
                  </div>
                )}
                <div className="absolute bottom-0 left-0 right-0 p-8 bg-gray-900/90 text-white backdrop-blur-sm">
                  <div className="text-xs uppercase tracking-wider opacity-60 mb-2">
                    Lead Instructor
                  </div>
                  <div className="text-2xl font-black tracking-widest uppercase">
                    {tutorName}
                  </div>
                </div>
              </div>
              <div className="absolute -top-8 -right-8 bg-primary text-white p-6 shadow-2xl rounded-full">
                <Award className="h-10 w-10" />
              </div>
            </div>
            <div className="space-y-12">
              <div className="text-xs font-bold text-gray-600 uppercase tracking-wider mb-6">
                Distinguished Faculty
              </div>
              <h2 className="text-4xl md:text-5xl font-black text-gray-900 tracking-tight mb-4">
                {aboutTitle}
              </h2>
              <p className="text-xl text-gray-700 italic leading-relaxed mb-6">
                {aboutText}
              </p>
              <p className="text-lg text-gray-600 leading-relaxed mb-8">
                {tutorBio}
              </p>
              <div className="grid grid-cols-2 gap-8">
                <div className="border-l-4 border-primary pl-6 py-2">
                  <div className="text-xs font-bold text-primary uppercase tracking-wider mb-1">
                    Education
                  </div>
                  <div className="text-gray-900 font-black">
                    {content.tutor_education || "MSc Mathematics · PhD Education"}
                  </div>
                </div>
                <div className="border-l-4 border-primary pl-6 py-2">
                  <div className="text-xs font-bold text-primary uppercase tracking-wider mb-1">
                    Institution
                  </div>
                  <div className="text-gray-900 font-black">
                    {content.tutor_university || "University of Cambridge"}
                  </div>
                </div>
              </div>
              <div className="flex flex-wrap gap-12 pt-10 border-t border-gray-200 mt-8">
                <div>
                  <div className="text-2xl font-black text-gray-900">
                    {content.stats_students_tutor || "500+"}
                  </div>
                  <div className="text-xs font-medium text-gray-600 uppercase tracking-wider">
                    Alumni
                  </div>
                </div>
                <div>
                  <div className="text-2xl font-black text-gray-900">
                    {content.stats_rating_tutor || "4.9★"}
                  </div>
                  <div className="text-xs font-medium text-gray-600 uppercase tracking-wider">
                    Rating
                  </div>
                </div>
                <div>
                  <div className="text-2xl font-black text-gray-900">
                    {content.stats_hours_tutor || "12K+"}
                  </div>
                  <div className="text-xs font-medium text-gray-600 uppercase tracking-wider">
                    Hours
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ------ Sticky Scroll‑Cards Section ------ */}
      <section id="scroll-cards" className="relative bg-gray-50 selection:bg-primary/30">
        <div className="max-w-7xl mx-auto px-6 py-24 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white border border-gray-200 text-gray-600 text-[11px] font-black uppercase tracking-[0.2em] mb-8 shadow-sm">
            <Sparkles className="h-3.5 w-3.5 text-primary" />
            Educational Ecosystem
          </div>
          <h2 className="text-4xl sm:text-5xl md:text-6xl font-black text-gray-900 mb-6 leading-[1.05] tracking-tight">
            Designed for <em className="italic text-primary font-light">mastery.</em>
          </h2>
          <p className="text-base md:text-lg text-gray-500 max-w-2xl mx-auto leading-relaxed font-light">
            Elevate your learning experience. From your first immersive session to a certified completion, we provide the environment, the expertise, and the structure for your success.
          </p>
        </div>

        <div className="container mx-auto px-6 max-w-7xl pb-24">
          <div className="grid md:grid-cols-2 gap-8">
            {(content.ecosystem_cards || [
              { title: "Live Digital", subtitle: "Low‑latency real‑time sessions with elite faculty." },
              { title: "Onsite Personal", subtitle: "In‑person academic support delivered at your preferred location." },
              { title: "On-Demand", subtitle: "Unlimited access to our archival library of curriculum and resources." },
              { title: "Elite Exam Prep", subtitle: "Strategic optimization for global standard certification exams." }
            ]).map((card: any, idx: number) => (
              <div key={idx} className="p-10 bg-white border border-gray-200 rounded-3xl hover:border-primary transition-all group shadow-sm hover:shadow-xl">
                <div className="text-primary/20 text-xs font-black mb-6 tracking-widest uppercase">Protocol 0{idx + 1}</div>
                <h4 className="text-2xl font-black text-gray-900 mb-4 group-hover:text-primary transition-colors uppercase tracking-tight">
                  {card.title}
                </h4>
                <p className="text-gray-600 leading-relaxed font-light">
                  {card.subtitle}
                </p>
                {card.features && (
                   <div className="flex flex-wrap gap-2 mt-8">
                     {card.features.map((f: string) => (
                       <span key={f} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-gray-50 text-gray-500 text-[10px] font-bold uppercase tracking-wider">
                         <Check className="h-3 w-3 text-primary" />{f}
                       </span>
                     ))}
                   </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>


      {/* ------ Services Section ------ */}
      <section className="py-24 bg-white">
        <div className="container mx-auto px-6 max-w-7xl">
          <div className="text-center mb-12">
            <div className="text-xs font-bold text-gray-600 uppercase tracking-wider mb-4">
              Our Services
            </div>
            <h2 className="text-4xl font-black text-gray-900 tracking-tight">
              Premium Academic Delivery
            </h2>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {[
              { icon: Landmark, title: "Live Digital", desc: "Interactive real‑time sessions via high‑def virtual classroom." },
              { icon: BookOpen, title: "Onsite Personal", desc: "In‑person support at your location." },
              { icon: History, title: "On‑Demand", desc: "Unlimited access to archival curriculum." },
              { icon: Award, title: "Private Mentor", desc: "1‑on‑1 deep optimization guidance." },
              { icon: Shield, title: "Exam Strategy", desc: "Targeted preparation for standardized exams." },
              { icon: Search, title: "Peer Cohort", desc: "Collaborative learning environments." },
            ].map((service, idx) => (
              <div key={idx} className="p-8 border border-gray-200 hover:bg-gray-50 transition-colors group">
                <div className="h-12 w-12 flex items-center justify-center bg-primary/5 text-primary mb-6 group-hover:bg-primary group-hover:text-white transition-colors rounded-lg">
                  <service.icon className="h-6 w-6" />
                </div>
                <h4 className="text-lg font-bold text-gray-900 mb-2 uppercase">
                  {service.title}
                </h4>
                <p className="text-sm text-gray-600 leading-relaxed">
                  {service.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
