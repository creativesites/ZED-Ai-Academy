import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  ArrowRight,
  Sparkles,
  Zap,
  GraduationCap,
  Star,
  BookOpen,
  Clock,
  Search,
  CalendarCheck,
  Rocket,
  User,
  Video,
  BookMarkedIcon,
  PlayCircle,
  Users,
  FileText,
  Award,
  Check,
  ArrowUpRight,
  Bookmark
} from "lucide-react";
import { CourseCard } from "@/components/tenant/CourseCard";
import { joinTenantBySlug } from "@/actions/tenants";
import { SharedSections } from "./SharedSections";
import { readableTextOn } from "@/lib/color";


export function ModernTemplate(props: {
  tenant: any;
  courses: any[];
  membership: any;
  brandColor: string;
  heroTitle?: string;
  heroSubtitle?: string;
  aboutTitle?: string;
  aboutText?: string;
  aboutImage?: string;
  ctaTitle?: string;
  ctaButton?: string;
  content: any;
  adminProfile?: any;
  stats?: {
    students: string;
    rating: string;
    success: string;
  };
}) {
  const {
    tenant, courses, membership, brandColor, heroTitle, heroSubtitle,
    aboutTitle, aboutText, aboutImage, ctaTitle, ctaButton,
    content, adminProfile, stats
  } = props;

  const academyName = tenant?.name || "Zed AI Academy";
  const defaultHeroTitle = `Welcome to ${academyName}`;
  const defaultHeroSubtitle = "Master practical artificial intelligence, modern workflows, and certified high-demand skills.";
  const defaultAboutTitle = `About ${academyName}`;
  const defaultAboutText = `${academyName} is dedicated to delivering world-class curriculum, hands-on mentorship, and transformative learning experiences built for real-world impact.`;
  const defaultTutorName = "Lead Instructor";
  const defaultTutorBio = "Experienced educator and industry practitioner committed to student success and practical mastery.";

  // Apply default static content when not provided
  const finalHeroTitle = heroTitle || defaultHeroTitle;
  const finalHeroSubtitle = heroSubtitle || defaultHeroSubtitle;
  const finalAboutTitle = aboutTitle || defaultAboutTitle;
  const finalAboutText = aboutText || defaultAboutText;
  const finalTutorName = adminProfile?.full_name || content.tutor_name || defaultTutorName;
  const finalTutorBio = adminProfile?.bio || content.tutor_bio || defaultTutorBio;

  const showHeroImage = !!content.hero_image;
  const tutorName = content.tutor_name || adminProfile?.full_name || defaultTutorName;
  const tutorBio = content.tutor_bio || adminProfile?.bio || defaultTutorBio;
  const tutorAvatar = content.tutor_avatar || adminProfile?.avatar_url || null;

  // Text sitting on the solid brand-coloured buttons: white or site ink, by contrast
  const brandInk = readableTextOn(brandColor || "#fd5523");

   // Helper to safely access content fields
  const getContent = (key: string, fallback: any) =>
    content?.[key] !== undefined ? content[key] : fallback;

  return (
    <div style={{ "--primary-color": brandColor } as React.CSSProperties}>
      {/* Hero */}
      <section className="relative pt-28 pb-12 lg:pt-32 lg:pb-10 overflow-hidden bg-[#0f1117]">
        {/* Grid Background */}
        <div
          className="absolute inset-0 z-0 opacity-30"
          style={{
            backgroundImage:
              "radial-gradient(circle at 1px 1px, rgba(255,255,255,0.06) 1px, transparent 0)",
            backgroundSize: "40px 40px",
          }}
        />

        {/* Glow Effects */}
        <div
          className="absolute top-[-160px] right-[-120px] w-[600px] h-[600px] rounded-full pointer-events-none opacity-50"
          style={{
            background:
              "radial-gradient(ellipse, rgba(61,107,79,0.35) 0%, transparent 70%)",
          }}
        />
        <div
          className="absolute bottom-[-80px] left-[-100px] w-[400px] h-[400px] rounded-full pointer-events-none opacity-30"
          style={{
            background:
              "radial-gradient(ellipse, rgba(251,191,36,0.15) 0%, transparent 70%)",
          }}
        />

        <div className="container mx-auto px-5 sm:px-6 relative z-10">
          <div
            className={`grid ${showHeroImage ? "lg:grid-cols-2" : "grid-cols-1"} gap-12 items-center`}
          >
            <div
              className={`min-w-0 ${showHeroImage ? "text-left" : "text-center max-w-4xl mx-auto"}`}
            >
              <div
                className={`inline-flex max-w-full items-center gap-2 px-4 py-1.5 rounded-full bg-white/5 border border-white/10 text-white/80 text-[10px] font-black uppercase tracking-[0.2em] mb-8 ${!showHeroImage && "mx-auto"}`}
              >
                <Sparkles className="h-3.5 w-3.5 shrink-0 text-[var(--primary-color)]" />{" "}
                Accredited Academy
              </div>
              <h1 className="font-serif text-4xl sm:text-5xl md:text-7xl lg:text-8xl text-white leading-[1.05] mb-8 tracking-tighter break-words">
                {finalHeroTitle}
              </h1>
              <p className="text-white/60 text-base sm:text-lg md:text-xl leading-relaxed mb-10 sm:mb-12 max-w-xl whitespace-pre-wrap break-words">
                {finalHeroSubtitle}
              </p>

              <div
                className={`flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-center gap-4 sm:gap-6 mb-12 ${!showHeroImage && "justify-center"}`}
              >
                {!membership ? (
                  <form action={joinTenantBySlug}>
                    <input type="hidden" name="tenantSlug" value={tenant.slug} />
                    <input type="hidden" name="role" value="student" />
                    <Button
                      className="h-14 sm:h-16 w-full sm:w-auto px-6 sm:px-10 rounded-full bg-[var(--primary-color)] text-lg font-black uppercase tracking-wider shadow-2xl shadow-[var(--primary-color)]/20 hover:scale-105 transition-all"
                      style={{ borderRadius: '24px', color: brandInk }}
                    >
                      Enroll Now
                    </Button>
                  </form>
                ) : (
                  <Link href={`/academy/${tenant.slug}/classroom`} className="w-full sm:w-auto">
                    <Button
                      className="h-14 sm:h-16 w-full sm:w-auto px-6 sm:px-10 rounded-full bg-[var(--primary-color)] text-lg font-black uppercase tracking-wider shadow-2xl shadow-[var(--primary-color)]/20 hover:scale-105 transition-all"
                      style={{ borderRadius: '24px', color: brandInk }}
                    >
                      Go to Classroom
                    </Button>
                  </Link>
                )}
                <Link href="#learn-more" className="w-full sm:w-auto">
                <Button
                  variant="outline"
                  className="h-14 sm:h-16 w-full sm:w-auto px-6 sm:px-10 rounded-2xl text-lg font-black uppercase tracking-wider border-white/10 text-white hover:bg-white/5"
                  style={{
                    background: "radial-gradient(ellipse, rgba(61,107,79,0.35) 0%, transparent 70%)",
                    borderRadius: '16px'
                  }}
                >
                  Learn More
                </Button>
                </Link>
              </div>

              <div className={`flex flex-wrap items-center gap-x-10 gap-y-6 md:gap-16 pt-10 sm:pt-12 border-t border-white/10 ${!showHeroImage && "justify-center"}`}>
                <div className="space-y-1">
                  <div className="text-3xl md:text-4xl font-black text-white tracking-tighter">{stats?.students || content.stats_students || "10k+"}</div>
                  <div className="text-[10px] font-black text-white/40 uppercase tracking-[0.3em]">Students</div>
                </div>
                <div className="space-y-1">
                  <div className="text-3xl md:text-4xl font-black text-white tracking-tighter">{stats?.rating || content.stats_rating || "4.9/5"}</div>
                  <div className="text-[10px] font-black text-white/40 uppercase tracking-[0.3em]">Rating</div>
                </div>
                <div className="space-y-1">
                  <div className="text-3xl md:text-4xl font-black text-white tracking-tighter">{stats?.success || content.stats_success || "95%"}</div>
                  <div className="text-[10px] font-black text-white/40 uppercase tracking-[0.3em]">Success</div>
                </div>
              </div>
            </div>

            {showHeroImage && (
              <div className="relative group">
                <div className="absolute inset-0 bg-[var(--primary-color)] rounded-[4rem] blur-[120px] opacity-20 group-hover:opacity-30 transition-opacity" />
                <div className="relative rounded-[2rem] sm:rounded-[3.5rem] overflow-hidden border-[8px] sm:border-[12px] border-white/5 shadow-2xl shadow-black/50 h-[50vh] lg:h-[80vh]">
                  <img
                    src={content.hero_image}
                    className="w-full h-full object-cover"

                    alt={heroTitle}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-[#0f1117] via-transparent to-transparent opacity-60" />
                </div>

                {/* Floating Badge */}
                <div className="absolute -bottom-6 -left-6 bg-white p-6 rounded-3xl shadow-2xl border border-slate-100 hidden md:block">
                  <div className="flex items-center gap-4">
                    <div className="h-12 w-12 rounded-2xl bg-[var(--primary-color)]/10 flex items-center justify-center">
                      <Zap className="h-6 w-6 text-[var(--primary-color)]" />
                    </div>
                    <div>
                      <div className="text-slate-900 font-black">Fast Track</div>
                      <div className="text-xs text-slate-500">
                        Industry Certificates
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Mission */}
      <section id="learn-more" className="py-16 sm:py-24 bg-white overflow-hidden">
        <div className="container mx-auto px-6 max-w-7xl">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-20 items-center">
            <div className="space-y-8 order-2 lg:order-1 min-w-0">
              <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-slate-100 text-slate-600 text-[10px] font-black uppercase tracking-widest border border-slate-200">
                <BookOpen className="h-3.5 w-3.5" />
                Our Mission
              </div>
              <h2 className="font-serif text-3xl sm:text-5xl lg:text-6xl font-black tracking-tighter leading-[1.1] text-[#062e39] break-words">
                {finalAboutTitle}
              </h2>
              <p className="text-base sm:text-lg md:text-xl font-medium leading-relaxed text-slate-600 whitespace-pre-wrap break-words">
                {finalAboutText}
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6 pt-4">
                {[
                  {
                    icon: BookOpen,
                    title: "Curated Content",
                    desc: "Expert-led courses for practical skills.",
                  },
                  {
                    icon: Clock,
                    title: "Self-Paced",
                    desc: "Learn on your own schedule, anywhere.",
                  },
                ].map((item, idx) => (
                  <div
                    key={idx}
                    className="p-6 rounded-2xl bg-slate-50 border border-slate-100 hover:border-slate-300 transition-colors"
                  >
                    <div className="h-10 w-10 rounded-xl bg-white flex items-center justify-center shadow-sm mb-4">
                      <item.icon className="h-5 w-5 text-emerald-600" />
                    </div>
                    <h4 className="font-black text-[#062e39] mb-1">{item.title}</h4>
                    <p className="text-xs text-slate-500 leading-relaxed">
                      {item.desc}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            <div className="order-1 lg:order-2 min-w-0">
              <div className="relative">
                <div className="absolute inset-0 bg-emerald-200 rounded-[4rem] rotate-3 scale-95 opacity-20" />
                <div className="relative aspect-square rounded-[2rem] sm:rounded-[4rem] overflow-hidden border-[8px] sm:border-[12px] border-white shadow-2xl">
                  <img
                    src={aboutImage}
                    className="w-full h-full object-cover"
                    alt={aboutTitle}
                  />
                </div>
              </div>
            </div>
          </div>
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

      {/* Courses */}
      <section className="py-16 sm:py-24 bg-white">
        <div className="container mx-auto px-6 max-w-7xl">
          <div className="flex flex-col md:flex-row items-start md:items-end justify-between gap-8 mb-12 sm:mb-16">
            <div className="max-w-2xl min-w-0 space-y-4">
              <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-slate-100 text-slate-600 text-[10px] font-black uppercase tracking-widest border border-slate-200">
                <GraduationCap className="h-3.5 w-3.5 text-emerald-600" />
                Academic Catalog
              </div>
              <h2 className="font-serif text-3xl sm:text-5xl lg:text-6xl font-black tracking-tighter leading-none text-[#062e39] break-words">
                Academic Programs
              </h2>
              <p className="text-base sm:text-lg font-medium text-slate-500">
                Premium curriculum tailored for academic excellence.
              </p>
            </div>
            <Link
              href="#courses"
              className="inline-flex items-center gap-3 px-6 sm:px-8 py-4 rounded-2xl bg-[#062e39] text-white font-black uppercase tracking-widest text-xs hover:bg-[#0a4a5c] transition-colors group shrink-0"
            >
              Explore All{" "}
              <ArrowRight className="h-4 w-4 text-emerald-400 group-hover:translate-x-1 transition-transform" />
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 lg:gap-10">
            {courses?.map((course: any) => (
              <CourseCard key={course.id} course={course} />
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 sm:py-24 container mx-auto px-6">
        <div className="rounded-[2rem] md:rounded-[4rem] p-6 sm:p-12 md:p-24 text-center relative overflow-hidden shadow-2xl bg-[#062e39] text-white group">
          {/* Animated Background Element */}
          <div className="absolute top-0 right-0 p-12 opacity-5 pointer-events-none rotate-12 transition-transform duration-700 group-hover:rotate-[30deg] group-hover:scale-125">
            <Zap className="h-64 w-64 text-white" />
          </div>
          <div className="absolute bottom-[-100px] left-[-100px] w-64 h-64 bg-emerald-500 rounded-full blur-[100px] opacity-20" />

          <div className="relative z-10 max-w-4xl mx-auto">
            <h2 className="font-serif text-3xl sm:text-5xl md:text-6xl lg:text-7xl font-black tracking-tighter mb-10 leading-[0.95] break-words">
              {ctaTitle}
            </h2>
            <div className="flex justify-center">
              {!membership ? (
                <form action={joinTenantBySlug} className="w-full sm:w-auto">
                  <input type="hidden" name="tenantSlug" value={tenant.slug} />
                  <input type="hidden" name="role" value="student" />
                  <Button className="h-14 sm:h-20 w-full sm:w-auto px-6 sm:px-12 rounded-3xl bg-emerald-600 text-white text-base sm:text-xl font-black uppercase tracking-[0.12em] sm:tracking-[0.2em] shadow-2xl shadow-emerald-500/40 hover:scale-105 transition-all">
                    {ctaButton}
                  </Button>
                </form>
              ) : (
                <Link href={`/academy/${tenant.slug}/classroom`} className="w-full sm:w-auto">
                  <Button className="h-14 sm:h-20 w-full sm:w-auto px-6 sm:px-12 rounded-3xl bg-emerald-600 text-white text-base sm:text-xl font-black uppercase tracking-[0.12em] sm:tracking-[0.2em] shadow-2xl shadow-emerald-500/40 hover:scale-105 transition-all">
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
