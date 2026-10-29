import React from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowRight, Award, BookOpen, Check, Globe, History, Landmark, Search, Shield, Sparkles, Quote, Star, HelpCircle } from "lucide-react";
import { readableTextOn } from "@/lib/color";


/**
 * SharedSections – a reusable component that renders the four common sections
 * (How it Works, About Tutor, Sticky Scroll‑Cards, Services) for all home-page
 * templates. It receives the same data that each individual template already gets
 * via its props, so no additional data fetching is required.
 *
 * Colour rule: the academy brand colour (--primary-color) is used for accents only
 * (icons, rules, borders, tinted backgrounds). Headings and body text stay neutral.
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
  // Text colour for anything sitting on a solid brand-coloured background
  const brandInk = readableTextOn(brandColor || "#fd5523");
  return (
    <div style={style}>
      {/* ------ How It Works ------ */}
      <section className="py-16 sm:py-24 bg-white border-y border-gray-100">
        <div className="container mx-auto px-6 max-w-7xl">
          <div className="text-center mb-16 sm:mb-20">
            <h2 className="text-3xl sm:text-4xl font-black text-gray-900 tracking-tight mb-4 break-words">
              How It Works
            </h2>
            <div className="w-20 h-1 bg-gray-900 mx-auto" />
          </div>
          <div className="grid md:grid-cols-3 gap-12 md:gap-16">
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
              <div key={idx} className="relative text-center pt-6">
                <div className="text-7xl font-black text-gray-200 absolute -top-4 left-1/2 -translate-x-1/2 select-none">
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
      <section className="py-16 sm:py-24 bg-gray-50 overflow-hidden">
        <div className="container mx-auto px-6 max-w-7xl">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-20 items-center">
            <div className="relative max-w-md w-full mx-auto lg:max-w-none">
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
                <div className="absolute bottom-0 left-0 right-0 p-5 sm:p-8 bg-gray-900/90 text-white backdrop-blur-sm">
                  <div className="text-xs uppercase tracking-wider opacity-60 mb-2">
                    Lead Instructor
                  </div>
                  <div className="text-xl sm:text-2xl font-black tracking-widest uppercase break-words">
                    {tutorName}
                  </div>
                </div>
              </div>
              <div
                className="absolute -top-4 -right-2 sm:-top-8 sm:-right-8 p-4 sm:p-6 shadow-2xl rounded-full"
                style={{ backgroundColor: brandColor, color: brandInk }}
              >
                <Award className="h-8 w-8 sm:h-10 sm:w-10" />
              </div>
            </div>
            <div className="space-y-8 sm:space-y-12 min-w-0">
              <div className="text-xs font-bold text-gray-600 uppercase tracking-wider">
                Distinguished Faculty
              </div>
              <h2 className="text-3xl sm:text-4xl md:text-5xl font-black text-gray-900 tracking-tight mb-4 break-words">
                {aboutTitle}
              </h2>
              <p className="text-lg sm:text-xl text-gray-700 italic leading-relaxed mb-6 break-words">
                {aboutText}
              </p>
              <p className="text-base sm:text-lg text-gray-600 leading-relaxed mb-8 break-words">
                {tutorBio}
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 sm:gap-8">
                <div className="border-l-4 border-[var(--primary-color)] pl-5 sm:pl-6 py-2 min-w-0">
                  <div className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">
                    Education
                  </div>
                  <div className="text-gray-900 font-black break-words">
                    {content.tutor_education || content.tutor_college || "MSc Computer Science · Applied AI"}
                  </div>
                </div>
                <div className="border-l-4 border-[var(--primary-color)] pl-5 sm:pl-6 py-2 min-w-0">
                  <div className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">
                    Institution
                  </div>
                  <div className="text-gray-900 font-black break-words">
                    {content.tutor_university || "Zed AI Academy Faculty"}
                  </div>
                </div>
              </div>
              <div className="flex flex-wrap gap-x-8 gap-y-6 sm:gap-12 pt-10 border-t border-gray-200 mt-8">
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
        <div className="max-w-7xl mx-auto px-6 py-16 sm:py-24 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white border border-gray-200 text-gray-600 text-[11px] font-black uppercase tracking-[0.2em] mb-8 shadow-sm">
            <Sparkles className="h-3.5 w-3.5 text-[var(--primary-color)]" />
            Educational Ecosystem
          </div>
          <h2 className="text-3xl sm:text-5xl md:text-6xl font-black text-gray-900 mb-6 leading-[1.1] sm:leading-[1.05] tracking-tight break-words">
            Designed for <em className="italic font-light text-gray-600">mastery.</em>
          </h2>
          <p className="text-base md:text-lg text-gray-500 max-w-2xl mx-auto leading-relaxed font-light">
            Elevate your learning experience. From your first immersive session to a certified completion, we provide the environment, the expertise, and the structure for your success.
          </p>
        </div>

        <div className="container mx-auto px-6 max-w-7xl pb-16 sm:pb-24">
          <div className="grid md:grid-cols-2 gap-6 sm:gap-8">
            {(content.ecosystem_cards || [
              { title: "Live Digital", subtitle: "Low‑latency real‑time sessions with elite faculty." },
              { title: "Onsite Personal", subtitle: "In‑person academic support delivered at your preferred location." },
              { title: "On-Demand", subtitle: "Unlimited access to our archival library of curriculum and resources." },
              { title: "Elite Exam Prep", subtitle: "Strategic optimization for global standard certification exams." }
            ]).map((card: any, idx: number) => (
              <div key={idx} className="p-6 sm:p-10 bg-white border border-gray-200 rounded-3xl hover:border-[var(--primary-color)] transition-all group shadow-sm hover:shadow-xl min-w-0">
                <div className="text-gray-400 text-xs font-black mb-6 tracking-widest uppercase">Protocol 0{idx + 1}</div>
                <h4 className="text-xl sm:text-2xl font-black text-gray-900 mb-4 uppercase tracking-tight break-words">
                  {card.title}
                </h4>
                <p className="text-gray-600 leading-relaxed font-light break-words">
                  {card.subtitle}
                </p>
                {card.features && (
                   <div className="flex flex-wrap gap-2 mt-8">
                     {card.features.map((f: string) => (
                       <span key={f} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-gray-50 text-gray-500 text-[10px] font-bold uppercase tracking-wider">
                         <Check className="h-3 w-3 text-[var(--primary-color)]" />{f}
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
      <section className="py-16 sm:py-24 bg-white">
        <div className="container mx-auto px-6 max-w-7xl">
          <div className="text-center mb-12">
            <div className="text-xs font-bold text-gray-600 uppercase tracking-wider mb-4">
              Our Services
            </div>
            <h2 className="text-3xl sm:text-4xl font-black text-gray-900 tracking-tight break-words">
              Premium Academic Delivery
            </h2>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
            {[
              { icon: Landmark, title: "Live Digital", desc: "Interactive real‑time sessions via high‑def virtual classroom." },
              { icon: BookOpen, title: "Onsite Personal", desc: "In‑person support at your location." },
              { icon: History, title: "On‑Demand", desc: "Unlimited access to archival curriculum." },
              { icon: Award, title: "Private Mentor", desc: "1‑on‑1 deep optimization guidance." },
              { icon: Shield, title: "Exam Strategy", desc: "Targeted preparation for standardized exams." },
              { icon: Search, title: "Peer Cohort", desc: "Collaborative learning environments." },
            ].map((service, idx) => (
              <div key={idx} className="p-6 sm:p-8 border border-gray-200 hover:bg-gray-50 transition-colors group min-w-0">
                <div className="h-12 w-12 flex items-center justify-center bg-[var(--primary-color)]/10 text-[var(--primary-color)] mb-6 group-hover:bg-[var(--primary-color)]/20 transition-colors rounded-lg">
                  <service.icon className="h-6 w-6" />
                </div>
                <h4 className="text-lg font-bold text-gray-900 mb-2 uppercase break-words">
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

      {/* ------ Testimonials Section (Rendered when testimonials exist) ------ */}
      {content.testimonials && content.testimonials.length > 0 && (
        <section className="py-16 sm:py-24 bg-gray-50 border-t border-gray-100">
          <div className="container mx-auto px-6 max-w-7xl">
            <div className="text-center mb-12 sm:mb-16">
              <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white border border-gray-200 text-gray-600 text-[11px] font-black uppercase tracking-[0.2em] mb-4 shadow-sm">
                <Quote className="h-3.5 w-3.5 text-[var(--primary-color)]" />
                Student Experiences
              </div>
              <h2 className="text-3xl sm:text-5xl font-black text-gray-900 tracking-tight break-words">
                Proven Results From Real Learners
              </h2>
            </div>
            <div className="grid md:grid-cols-3 gap-6 sm:gap-8">
              {content.testimonials.map((t: any, idx: number) => (
                <div key={idx} className="p-6 sm:p-8 bg-white rounded-3xl border border-gray-200 shadow-sm hover:shadow-xl transition-all space-y-4 min-w-0">
                  <div className="flex items-center gap-1 text-amber-400">
                    {Array.from({ length: t.rating || 5 }).map((_, s) => (
                      <Star key={s} className="h-4 w-4 fill-amber-400 text-amber-400" />
                    ))}
                  </div>
                  <p className="text-gray-600 text-sm leading-relaxed italic break-words">
                    "{t.content}"
                  </p>
                  <div className="pt-4 border-t border-gray-100">
                    <h5 className="font-black text-gray-900 text-sm break-words">{t.name}</h5>
                    <p className="text-xs text-gray-500 uppercase tracking-wider break-words">{t.role}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ------ FAQ Section (Rendered when FAQs exist) ------ */}
      {content.faqs && content.faqs.length > 0 && (
        <section className="py-16 sm:py-24 bg-white border-t border-gray-100">
          <div className="container mx-auto px-6 max-w-4xl">
            <div className="text-center mb-12 sm:mb-16">
              <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-gray-50 border border-gray-200 text-gray-600 text-[11px] font-black uppercase tracking-[0.2em] mb-4 shadow-sm">
                <HelpCircle className="h-3.5 w-3.5 text-[var(--primary-color)]" />
                Answers to Your Questions
              </div>
              <h2 className="text-3xl sm:text-5xl font-black text-gray-900 tracking-tight break-words">
                Frequently Asked Questions
              </h2>
            </div>
            <div className="space-y-4">
              {content.faqs.map((faq: any, idx: number) => (
                <div key={idx} className="p-5 sm:p-6 bg-gray-50 rounded-2xl border border-gray-200/80 space-y-2">
                  <h4 className="text-base font-black text-gray-900 flex items-start gap-2">
                    <span className="text-gray-500 font-mono text-sm shrink-0">0{idx + 1}.</span>
                    <span className="break-words min-w-0">{faq.question}</span>
                  </h4>
                  <p className="text-sm text-gray-600 leading-relaxed pl-0 sm:pl-7 break-words">
                    {faq.answer}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
