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

export function ModernTemplate(props: {
  tenant: any;
  courses: any[];
  membership: any;
  brandColor: string;
  heroTitle: string;
  heroSubtitle: string;
  aboutTitle: string;
  aboutText: string;
  aboutImage: string;
  ctaTitle: string;
  ctaButton: string;
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

  const showHeroImage = !!content.hero_image;
  const tutorName = content.tutor_name || adminProfile?.full_name || "Academy Tutor";
  const tutorBio = content.tutor_bio || adminProfile?.bio || "Expert educator dedicated to student success.";
  const tutorAvatar = content.tutor_avatar || adminProfile?.avatar_url || null;

  return (
    <div style={{ "--primary-color": brandColor } as React.CSSProperties}>
      {/* Hero */}
      <section className="relative pt-25 px-10 pb-10 lg:pt-30 lg:pb-10 overflow-hidden bg-[#0f1117]">
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

        <div className="container mx-auto px-6 relative z-10">
          <div
            className={`grid ${showHeroImage ? "lg:grid-cols-2" : "grid-cols-1"} gap-12 items-center`}
          >
            <div
              className={showHeroImage ? "text-left" : "text-center max-w-4xl mx-auto"}
            >
              <div
                className={`inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/5 border border-white/10 text-white/80 text-[10px] font-black uppercase tracking-[0.2em] mb-8 ${!showHeroImage && "mx-auto"}`}
              >
                <Sparkles className="h-3.5 w-3.5 text-[var(--primary-color)]" />{" "}
                Accredited Academy
              </div>
              <h1 className="font-serif text-5xl md:text-6xl lg:text-7xl text-white leading-[1.1] mb-6">
                {heroTitle}
              </h1>
              <p className="text-white/55 text-lg leading-relaxed mb-10 max-w-md">
                {heroSubtitle}
              </p>

              <div
                className={`flex flex-col sm:flex-row items-center gap-6 mb-12 ${!showHeroImage && "justify-center"}`}
              >
                {!membership ? (
                  <form action={joinTenantBySlug}>
                    <input type="hidden" name="tenantSlug" value={tenant.slug} />
                    <input type="hidden" name="role" value="student" />
                    <Button 
                      className="h-16 px-10 rounded-full bg-[var(--primary-color)] text-black text-lg font-black uppercase tracking-wider shadow-2xl shadow-[var(--primary-color)]/20 hover:scale-105 transition-all"
                      style={{ borderRadius: '24px' }}
                    >
                      Enroll Now
                    </Button>
                  </form>
                ) : (
                  <Link href={`/academy/${tenant.slug}/classroom`}>
                    <Button 
                      className="h-16 px-10 rounded-full bg-[var(--primary-color)] text-black text-lg font-black uppercase tracking-wider shadow-2xl shadow-[var(--primary-color)]/20 hover:scale-105 transition-all"
                      style={{ borderRadius: '24px' }}
                    >
                      Go to Classroom
                    </Button>
                  </Link>
                )}
                <Link href="#learn-more">
                <Button
                  variant="outline"
                  className="h-16 px-10 rounded-2xl text-lg font-black uppercase tracking-wider border-white/10 text-white hover:bg-white/5"
                  style={{
                    background: "radial-gradient(ellipse, rgba(61,107,79,0.35) 0%, transparent 70%)",
                    borderRadius: '16px'
                  }}
                >
                  Learn More
                </Button>
                </Link>
              </div>

              <div className={`flex items-center gap-10 pt-10 border-t border-white/5 ${!showHeroImage && "justify-center"}`}>
                <div>
                  <div className="text-2xl font-black text-white">{stats?.students || content.stats_students || "10k+"}</div>
                  <div className="text-[10px] font-bold text-white/40 uppercase tracking-widest">Students</div>
                </div>
                <div>
                  <div className="text-2xl font-black text-white">{stats?.rating || content.stats_rating || "4.9/5"}</div>
                  <div className="text-[10px] font-bold text-white/40 uppercase tracking-widest">Rating</div>
                </div>
                <div>
                  <div className="text-2xl font-black text-white">{stats?.success || content.stats_success || "95%"}</div>
                  <div className="text-[10px] font-bold text-white/40 uppercase tracking-widest">Success Rate</div>
                </div>
              </div>
            </div>

            {showHeroImage && (
              <div className="relative group">
                <div className="absolute inset-0 bg-[var(--primary-color)] rounded-[4rem] blur-[120px] opacity-20 group-hover:opacity-30 transition-opacity" />
                <div className="relative rounded-[3.5rem] overflow-hidden border-[12px] border-white/5 shadow-2xl shadow-black/50"
                style={{height: '80vh'}}>
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
      <section id="learn-more" className="py-24 bg-white overflow-hidden">
        <div className="container mx-auto px-6 max-w-7xl">
          <div className="grid lg:grid-cols-2 gap-20 items-center">
            <div className="space-y-8 order-2 lg:order-1">
              <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-slate-100 text-slate-600 text-[10px] font-black uppercase tracking-widest border border-slate-200">
                <BookOpen className="h-3.5 w-3.5" />
                Our Mission
              </div>
              <h2 className="font-serif text-4xl md:text-5xl lg:text-6xl font-black tracking-tighter leading-[1.1] text-[#062e39]">
                {aboutTitle}
              </h2>
              <p className="text-lg md:text-xl font-medium leading-relaxed text-slate-600">
                {aboutText}
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-4">
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

            <div className="order-1 lg:order-2">
              <div className="relative">
                <div className="absolute inset-0 bg-emerald-200 rounded-[4rem] rotate-3 scale-95 opacity-20" />
                <div className="relative aspect-square rounded-[4rem] overflow-hidden border-[12px] border-white shadow-2xl">
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

      {/* How it Works */}
      <section className="py-24 bg-slate-50">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white text-slate-600 text-[10px] font-black uppercase tracking-widest border border-slate-200 mb-6">
              <Zap className="h-3.5 w-3.5 text-amber-500" />
              How it Works
            </div>
            <h2 className="font-serif text-4xl md:text-5xl text-[#062e39] mb-4 leading-tight">
              {content.how_it_works_title || "Up and learning in minutes"}
            </h2>
            <p className="text-slate-600 text-lg max-w-xl mx-auto">
              {content.how_it_works_subtitle || "A seamless journey from first click to first breakthrough."}
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {/* Step 01 */}
            <div className="text-center group">
              <div className="w-16 h-16 rounded-2xl bg-emerald-50 flex items-center justify-center mx-auto mb-5 group-hover:bg-emerald-500 transition-all duration-300">
                <Search className="h-7 w-7 text-emerald-600 group-hover:text-white transition-colors" />
              </div>
              <div className="text-xs font-bold text-slate-400 mb-2 tracking-widest uppercase">
                Step 01
              </div>
              <h3 className="font-serif text-xl text-[#062e39] mb-3">
                {content.step1_title || "Choose your course"}
              </h3>
              <p className="text-slate-500 text-sm leading-relaxed max-w-xs mx-auto">
                {content.step1_desc || "Browse live sessions, onsite tutoring, or self-paced courses and pick what fits your goals."}
              </p>
            </div>

            {/* Step 02 */}
            <div className="text-center group">
              <div className="w-16 h-16 rounded-2xl bg-amber-50 flex items-center justify-center mx-auto mb-5 group-hover:bg-amber-400 transition-all duration-300">
                <CalendarCheck className="h-7 w-7 text-amber-600 group-hover:text-white transition-colors" />
              </div>
              <div className="text-xs font-bold text-slate-400 mb-2 tracking-widest uppercase">
                Step 02
              </div>
              <h3 className="font-serif text-xl text-[#062e39] mb-3">
                {content.step2_title || "Book your first session"}
              </h3>
              <p className="text-slate-500 text-sm leading-relaxed max-w-xs mx-auto">
                {content.step2_desc || "Pick a time that works for you. The first session is a free discovery call — no commitment."}
              </p>
            </div>

            {/* Step 03 */}
            <div className="text-center group">
              <div className="w-16 h-16 rounded-2xl bg-slate-200 flex items-center justify-center mx-auto mb-5 group-hover:bg-[#062e39] transition-all duration-300">
                <Rocket className="h-7 w-7 text-slate-700 group-hover:text-white transition-colors" />
              </div>
              <div className="text-xs font-bold text-slate-400 mb-2 tracking-widest uppercase">
                Step 03
              </div>
              <h3 className="font-serif text-xl text-[#062e39] mb-3">
                {content.step3_title || "Start achieving"}
              </h3>
              <p className="text-slate-500 text-sm leading-relaxed max-w-xs mx-auto">
                {content.step3_desc || "Track your progress with weekly reports. Adjust your plan anytime as you grow."}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Courses */}
      <section className="py-24 bg-white">
        <div className="container mx-auto px-6 max-w-7xl">
          <div className="flex flex-col md:flex-row items-end justify-between gap-8 mb-16">
            <div className="max-w-2xl space-y-4">
              <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-slate-100 text-slate-600 text-[10px] font-black uppercase tracking-widest border border-slate-200">
                <GraduationCap className="h-3.5 w-3.5 text-emerald-600" />
                Academic Catalog
              </div>
              <h2 className="font-serif text-4xl md:text-5xl lg:text-6xl font-black tracking-tighter leading-none text-[#062e39]">
                Global Programs
              </h2>
              <p className="text-lg font-medium text-slate-500">
                Premium curriculum tailored for industry excellence.
              </p>
            </div>
            <Link
              href="/courses"
              className="inline-flex items-center gap-3 px-8 py-4 rounded-2xl bg-[#062e39] text-white font-black uppercase tracking-widest text-xs hover:bg-[#0a4a5c] transition-colors group"
            >
              Explore All{" "}
              <ArrowRight className="h-4 w-4 text-emerald-400 group-hover:translate-x-1 transition-transform" />
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10">
            {courses?.map((course: any) => (
              <CourseCard key={course.id} course={course} />
            ))}
          </div>
        </div>
      </section>

      {/* About Tutor */}
      <section id="about" className="py-24 bg-white">
        <div className="max-w-7xl mx-auto px-6 grid md:grid-cols-2 gap-16 items-center">
          <div className="relative">
            <div className="bg-slate-50 rounded-3xl p-10 text-center border border-slate-200 shadow-lg">
              <div className="w-28 h-28 rounded-full bg-emerald-50 border-4 border-white shadow-lg mx-auto mb-5 flex items-center justify-center overflow-hidden">
                {tutorAvatar ? (
                  <img src={tutorAvatar} alt={tutorName} className="w-full h-full object-cover" />
                ) : (
                  <User className="h-12 w-12 text-emerald-600" />
                )}
              </div>
              <h3 className="font-serif text-2xl text-[#062e39] mb-1">
                {tutorName}
              </h3>
              <p className="text-slate-500 text-sm mb-4">
                {content.tutor_education || "MSc Mathematics · PhD Education"} · {content.tutor_experience || "8 years teaching"}
              </p>

              <div className="flex justify-center gap-8 mt-6 pt-6 border-t border-slate-200">
                <div>
                  <p className="font-serif text-2xl text-[#062e39]">{stats?.students || content.stats_students_tutor || "500+"}</p>
                  <p className="text-xs text-slate-400 mt-1">Students</p>
                </div>
                <div>
                  <p className="font-serif text-2xl text-[#062e39]">{stats?.rating || content.stats_rating_tutor || "4.9★"}</p>
                  <p className="text-xs text-slate-400 mt-1">Avg rating</p>
                </div>
                <div>
                  <p className="font-serif text-2xl text-[#062e39]">{content.stats_hours_tutor || "12K+"}</p>
                  <p className="text-xs text-slate-400 mt-1">Hours taught</p>
                </div>
              </div>
            </div>
            <div className="absolute -top-4 -right-4 bg-[#062e39] text-white rounded-2xl px-4 py-3 text-xs font-bold shadow-lg flex items-center gap-2">
              <Award className="h-4 w-4 text-amber-400" />
              {content.tutor_badge || "Certified Educator"}
            </div>
          </div>

          <div>
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-slate-100 text-slate-600 text-[10px] font-black uppercase tracking-widest border border-slate-200 mb-5">
              <User className="h-3.5 w-3.5" />
              About the Tutor
            </div>
            <h2 className="font-serif text-4xl md:text-5xl text-[#062e39] mb-6 leading-tight">
              {content.tutor_tagline || "Teaching that actually sticks"}
            </h2>
            <p className="text-slate-600 leading-relaxed mb-8 whitespace-pre-wrap">
              {tutorBio}
            </p>
            
            <div className="grid grid-cols-2 gap-4 mb-8">
              <div className="bg-emerald-50 rounded-2xl p-4 border border-emerald-100">
                <GraduationCap className="h-5 w-5 text-emerald-600 mb-2" />
                <p className="text-[#062e39] text-sm font-bold">
                  {content.tutor_university || "University Degree"}
                </p>
                <p className="text-slate-500 text-xs">{content.tutor_college || "Accredited Institution"}</p>
              </div>
              <div className="bg-amber-50 rounded-2xl p-4 border border-amber-100">
                <CalendarCheck className="h-5 w-5 text-amber-600 mb-2" />
                <p className="text-[#062e39] text-sm font-bold">
                  {content.tutor_availability || "Mon - Fri"}
                </p>
                <p className="text-slate-500 text-xs">Standard Available Days</p>
              </div>
            </div>
            <Link
              href={`/sign-up?role=student&tenant=${tenant.slug}`}
              className="inline-flex items-center gap-2 bg-[#062e39] text-white text-sm font-bold px-7 py-3.5 rounded-full hover:bg-[#0a4a5c] transition-all hover:gap-3 group"
            >
              Get Started Now{" "}
              <ArrowUpRight className="h-4 w-4 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
            </Link>
          </div>
        </div>
      </section>

      
    {/* ========== STICKY SCROLL‑CARDS SECTION ========== */}
    <section id="scroll-cards" className="relative bg-[#060908] selection:bg-emerald-500/30">

      {/* Section heading — scrolls away before cards pin */}
      <div className="max-w-7xl mx-auto px-6 pt-32 pb-24 text-center">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/5 border border-white/10 text-white/70 text-[11px] font-black uppercase tracking-[0.2em] mb-8 backdrop-blur-md">
          <Sparkles className="h-3.5 w-3.5 text-emerald-400" />
          The {tenant.name} Ecosystem
        </div>
        <h2 className="font-serif text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-medium text-white mb-6 leading-[1.05] tracking-tight">
          Designed for <em className="italic text-emerald-400 font-light">mastery.</em>
        </h2>
        <p className="text-base md:text-lg text-white/50 max-w-2xl mx-auto leading-relaxed font-light">
          Elevate your learning experience. From your first immersive session to a certified completion, we provide the environment, the expertise, and the structure for your success.
        </p>
      </div>

      {/* Cards wrapper — total scroll height = n cards × 100vh */}
      <div className="relative" style={{ height: "400vh" }}>

        {/* ── CARD 1 : Live Online Sessions (LIGHT THEME) ── */}
        <div className="sticky top-0 h-screen w-full flex items-center justify-center card-layer" data-card="1">
          {/* Card Container - Now White */}
          <div className="max-w-7xl w-full mx-auto px-4 sm:px-6 md:px-8 h-[90vh] sm:h-[85vh] rounded-[2rem] sm:rounded-[2.5rem] overflow-hidden relative flex flex-col md:flex-row shadow-[0_20px_80px_rgba(0,0,0,0.8)] ring-1 ring-white/10 bg-white">

            {/* Background image */}
            <img
              src="https://images.unsplash.com/photo-1516321318423-f06f85e504b3?q=80&w=2000&auto=format&fit=crop"
              alt="Student in live online tutoring session"
              className="absolute inset-0 w-full h-full object-cover object-center opacity-80"
            />
            {/* Light Gradients */}
            <div className="absolute inset-0 bg-gradient-to-r from-white via-white/98 to-transparent" />
            <div className="absolute inset-0 bg-gradient-to-t from-white/96 via-transparent to-transparent md:hidden" />

            {/* Left content */}
            <div className="relative z-10 flex flex-col justify-center p-6 sm:p-10 md:p-16 md:w-1/2 lg:w-[55%] h-full">
              <div className="flex items-center gap-3 mb-4 sm:mb-6">
                <div className="w-10 h-10 rounded-xl bg-emerald-50 ring-1 ring-emerald-100 flex items-center justify-center backdrop-blur-md">
                  <Video className="h-4 w-4 text-emerald-600" />
                </div>
                <span className="text-[10px] font-bold uppercase tracking-[0.25em] text-emerald-600">Immersive Live Classes</span>
              </div>

              <h3 className="font-serif text-3xl sm:text-4xl md:text-5xl lg:text-6xl text-slate-900 leading-[1.05] mb-4 sm:mb-6 tracking-tight">
                {content.scroll_card_1_title || (
                  <>
                    Your tutor,<br />
                    <em className="italic text-emerald-600 font-light">face-to-face</em><br />
                    unbound by location.
                  </>
                )}
              </h3>

              <p className="text-slate-600 text-sm sm:text-base md:text-lg leading-relaxed mb-6 sm:mb-10 max-w-md font-light">
                Crystal-clear HD video, interactive whiteboards, and real-time collaboration. Revisit any complex concept with unlimited access to session recordings.
              </p>

              {/* Feature pills */}
              <div className="flex flex-wrap gap-2 sm:gap-3 mb-6 sm:mb-10">
                {["HD Video + Whiteboard","Session Recordings","Personalised Homework"].map((f) => (
                  <span key={f} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-50 ring-1 ring-slate-200 text-slate-700 text-[11px] sm:text-xs font-medium backdrop-blur-sm">
                    <Check className="h-3 w-3 text-emerald-500 flex-shrink-0" />{f}
                  </span>
                ))}
              </div>

              {/* Stat row */}
              <div className="flex items-center gap-6 sm:gap-8 pt-6 sm:pt-8 border-t border-slate-100">
                <div>
                  <p className="text-xl sm:text-2xl font-semibold text-slate-900">500+</p>
                  <p className="text-[9px] sm:text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Students</p>
                </div>
                <div className="w-px h-8 bg-slate-200" />
                <div>
                  <p className="text-xl sm:text-2xl font-semibold text-slate-900">4.9 <span className="text-emerald-500 text-lg">★</span></p>
                  <p className="text-[9px] sm:text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Avg Rating</p>
                </div>
              </div>
            </div>

            {/* Right floating UI card (decorative) */}
            <div className="hidden md:flex relative z-10 flex-col justify-center items-end p-10 md:p-16 md:w-1/2 lg:w-[45%] gap-6">
              <div className="w-80 bg-white/80 backdrop-blur-2xl ring-1 ring-slate-200 rounded-3xl p-6 shadow-[0_20px_40px_rgba(0,0,0,0.08)] transition-transform hover:-translate-y-2 duration-500">
                <div className="flex items-center gap-4 mb-5">
                  <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center flex-shrink-0">
                    <Video className="h-4 w-4 text-emerald-600" />
                  </div>
                  <div>
                    <p className="text-slate-900 text-sm font-medium tracking-wide">Live Session — Algebra II</p>
                    <p className="text-slate-500 text-xs mt-0.5">Today · 4:00 PM · 45 min</p>
                  </div>
                </div>
                <div className="w-full h-1 bg-slate-100 rounded-full mb-3 overflow-hidden">
                  <div className="h-full w-2/3 bg-emerald-500 rounded-full" />
                </div>
                <p className="text-slate-500 text-[11px] uppercase tracking-wider font-bold">In progress · 30 min left</p>
              </div>
            </div>

            {/* Card number */}
            <div className="absolute bottom-6 right-8 sm:bottom-10 sm:right-12 text-slate-900/5 font-serif font-bold text-6xl sm:text-8xl select-none pointer-events-none leading-none italic">01</div>
          </div>
        </div>

        {/* ── CARD 2 : Onsite Tutoring (LIGHT THEME) ── */}
        <div className="sticky top-0 h-screen w-full flex items-center justify-center card-layer" data-card="2">
          <div className="max-w-7xl w-full mx-auto px-4 sm:px-6 md:px-8 h-[90vh] sm:h-[85vh] rounded-[2rem] sm:rounded-[2.5rem] overflow-hidden relative flex flex-col md:flex-row-reverse shadow-[0_20px_80px_rgba(0,0,0,0.8)] ring-1 ring-white/10 bg-white">

            <img
              src="https://images.unsplash.com/photo-1523240795612-9a054b0db644?q=80&w=2000&auto=format&fit=crop"
              alt="Onsite tutoring in a home study environment"
              className="absolute inset-0 w-full h-full object-cover object-center opacity-80"
            />
            <div className="absolute inset-0 bg-gradient-to-l from-white via-white/98 to-transparent" />
            <div className="absolute inset-0 bg-gradient-to-t from-white/96 via-transparent to-transparent md:hidden" />

            {/* Right content (reversed layout) */}
            <div className="relative z-10 flex flex-col justify-center p-6 sm:p-10 md:p-16 md:w-1/2 lg:w-[55%] h-full">
              <div className="flex items-center gap-3 mb-4 sm:mb-6">
                <div className="w-10 h-10 rounded-xl bg-slate-50 ring-1 ring-slate-200 flex items-center justify-center backdrop-blur-md">
                  <Bookmark className="h-4 w-4 text-slate-600" />
                </div>
                <span className="text-[10px] font-bold uppercase tracking-[0.25em] text-slate-500">Bespoke In-Person</span>
              </div>

              <h3 className="font-serif text-3xl sm:text-4xl md:text-5xl lg:text-6xl text-slate-900 leading-[1.05] mb-4 sm:mb-6 tracking-tight">
                The classroom<br />
                comes to <em className="italic text-emerald-600 font-light">you.</em>
              </h3>

              <p className="text-slate-600 text-sm sm:text-base md:text-lg leading-relaxed mb-6 sm:mb-10 max-w-md font-light">
                For those who thrive in a physical environment. Our expert tutors bring bespoke materials and hands-on guidance directly to your preferred study space.
              </p>

              {/* Feature list — editorial style */}
              <div className="space-y-4 mb-6 sm:mb-10">
                {[
                  { label: "Curated physical lab resources", icon: BookOpen },
                  { label: "Comprehensive progress reporting", icon: Users },
                  { label: "Flexible weekend scheduling", icon: CalendarCheck },
                ].map(({ label, icon: Icon }) => (
                  <div key={label} className="flex items-center gap-4">
                    <div className="w-8 h-8 rounded-lg bg-slate-50 ring-1 ring-slate-200 flex items-center justify-center flex-shrink-0 backdrop-blur-sm">
                      <Icon className="h-3.5 w-3.5 text-emerald-600" />
                    </div>
                    <p className="text-slate-700 text-sm font-light">{label}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Left visual panel */}
            <div className="hidden md:flex relative z-10 flex-col justify-center p-10 md:p-16 md:w-1/2 lg:w-[45%] gap-5">
              <div className="bg-white/80 backdrop-blur-2xl ring-1 ring-slate-200 rounded-3xl p-8 shadow-[0_20px_40px_rgba(0,0,0,0.08)] max-w-sm transition-transform hover:-translate-y-2 duration-500">
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-6">Next Scheduled Visit</p>
                <div className="flex items-center gap-5 mb-6">
                  <div className="w-14 h-14 rounded-2xl bg-emerald-50 ring-1 ring-emerald-100 flex flex-col items-center justify-center shadow-inner">
                    <span className="text-emerald-600 text-lg font-bold leading-none">14</span>
                    <span className="text-emerald-600/60 text-[9px] font-bold uppercase tracking-widest mt-1">Jun</span>
                  </div>
                  <div>
                    <p className="text-slate-900 text-base font-medium tracking-wide">Physics — Unit 4</p>
                    <p className="text-slate-500 text-xs mt-1">2:00 PM · 90 min · Home</p>
                  </div>
                </div>
                <div className="flex gap-3">
                  <div className="flex-1 text-center py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-bold transition-colors cursor-pointer">Confirm</div>
                  <div className="flex-1 text-center py-2.5 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-600 text-xs font-medium ring-1 ring-slate-200 transition-colors cursor-pointer">Reschedule</div>
                </div>
              </div>
            </div>

            <div className="absolute bottom-6 left-8 sm:bottom-10 sm:left-12 text-slate-900/5 font-serif font-bold text-6xl sm:text-8xl select-none pointer-events-none leading-none italic">02</div>
          </div>
        </div>

        {/* ── CARD 3 : Self-Paced Courses (LIGHT THEME) ── */}
        <div className="sticky top-0 h-screen w-full flex items-center justify-center card-layer" data-card="3">
          <div className="max-w-7xl w-full mx-auto px-4 sm:px-6 md:px-8 h-[90vh] sm:h-[85vh] rounded-[2rem] sm:rounded-[2.5rem] overflow-hidden relative flex flex-col md:flex-row shadow-[0_20px_80px_rgba(0,0,0,0.8)] ring-1 ring-white/10 bg-white">

            <img
              src="https://images.unsplash.com/photo-1501504905252-473c47e087f8?q=80&w=2000&auto=format&fit=crop"
              alt="Student focused on self-paced learning"
              className="absolute inset-0 w-full h-full object-cover object-top opacity-80"
            />
            <div className="absolute inset-0 bg-gradient-to-r from-white via-white/98 to-transparent" />
            <div className="absolute inset-0 bg-gradient-to-t from-white/96 via-transparent to-transparent md:hidden" />

            {/* Left content */}
            <div className="relative z-10 flex flex-col justify-center p-6 sm:p-10 md:p-16 md:w-[55%] h-full">
              <div className="flex items-center gap-3 mb-4 sm:mb-6">
                <div className="w-10 h-10 rounded-xl bg-amber-50 ring-1 ring-amber-100 flex items-center justify-center backdrop-blur-md">
                  <PlayCircle className="h-4 w-4 text-amber-500" />
                </div>
                <span className="text-[10px] font-bold uppercase tracking-[0.25em] text-amber-600">Self-Paced Courses</span>
              </div>

              <h3 className="font-serif text-3xl sm:text-4xl md:text-5xl lg:text-6xl text-slate-900 leading-[1.05] mb-4 sm:mb-6 tracking-tight">
                Curated mastery,<br />
                at <em className="italic text-amber-500 font-light">your pace.</em>
              </h3>

              <p className="text-slate-600 text-sm sm:text-base md:text-lg leading-relaxed mb-6 sm:mb-10 max-w-lg font-light">
                Dive into beautifully structured modules featuring cinematic video lessons, interactive quizzes, and community insights. Earn a verified certificate upon completion.
              </p>

              {/* Course subject chips */}
              <div className="flex flex-wrap gap-2 mb-6 sm:mb-10">
                {(content.subjects || [
                  { label: "Mathematics", active: true },
                  { label: "Geography", active: false },
                  { label: "English", active: false },
                  { label: "Python", active: false },
                  { label: "+ 17 more", active: true },
                ]).map(({ label, active }: { label: string; active: boolean }) => (
                  <div key={label} className={`flex items-center justify-center px-4 py-2 rounded-full ring-1 text-[11px] sm:text-xs font-medium backdrop-blur-sm transition-colors ${active ? 'bg-amber-50 ring-amber-200 text-amber-700' : 'bg-slate-50 ring-slate-200 text-slate-600 hover:bg-slate-100'}`}>
                    {label}
                  </div>
                ))}
              </div>

              <div className="flex items-center gap-6 sm:gap-8 pt-6 sm:pt-8 border-t border-slate-100">
                <div>
                  <p className="text-xl sm:text-2xl font-semibold text-slate-900">24</p>
                  <p className="text-[9px] sm:text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Courses</p>
                </div>
                <div className="w-px h-8 bg-slate-200" />
                <div>
                  <p className="text-xl sm:text-2xl font-semibold text-slate-900">∞</p>
                  <p className="text-[9px] sm:text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Access</p>
                </div>
              </div>
            </div>

            {/* Right: stacked course mini-cards */}
            <div className="hidden md:flex relative z-10 flex-col justify-center items-end p-10 md:p-16 md:w-[45%] gap-4">
              {[
                { title: "Algebra & Calculus Foundations", subject: "Mathematics", rating: "4.9", color: "ring-amber-200 bg-white" },
                { title: "Python for Beginners", subject: "Programming", rating: "4.8", color: "ring-slate-200 bg-white/80" },
              ].map((course) => (
                <div key={course.title} className={`w-80 backdrop-blur-2xl ring-1 ${course.color} rounded-3xl p-6 transition-transform hover:-translate-x-2 duration-500 shadow-[0_10px_30px_rgba(0,0,0,0.05)]`}>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-amber-600 mb-2">{course.subject}</p>
                  <p className="text-slate-900 text-base font-medium leading-snug mb-4">{course.title}</p>
                  <div className="flex items-center justify-between text-xs text-slate-500 font-light">
                    <span className="flex items-center gap-1.5"><Star className="h-3 w-3 text-amber-400" fill="currentColor" />{course.rating}</span>
                    <span>View Module →</span>
                  </div>
                </div>
              ))}
            </div>

            <div className="absolute bottom-6 right-8 sm:bottom-10 sm:right-12 text-slate-900/5 font-serif font-bold text-6xl sm:text-8xl select-none pointer-events-none leading-none italic">03</div>
          </div>
        </div>

        {/* ── CARD 4 : Exam Preparation (STAYS DARK FOR DRAMATIC REVEAL) ── */}
        <div className="sticky top-0 h-screen w-full flex items-center justify-center card-layer" data-card="4">
          <div className="max-w-7xl w-full mx-auto px-4 sm:px-6 md:px-8 h-[90vh] sm:h-[85vh] rounded-[2rem] sm:rounded-[2.5rem] overflow-hidden relative flex flex-col md:flex-row-reverse shadow-[0_20px_80px_rgba(0,0,0,0.8)] ring-1 ring-white/10 bg-[#0c1210]">

            <img
              src="https://images.unsplash.com/photo-1606326608606-aa0b62935f2b?q=80&w=2000&auto=format&fit=crop"
              alt="Student preparing for exams"
              className="absolute inset-0 w-full h-full object-cover object-center opacity-80 mix-blend-luminosity"
            />
            <div className="absolute inset-0 bg-gradient-to-l from-[#0c121a] via-[#0c121a]/97 to-transparent" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-transparent md:hidden" />

            {/* Right content */}
            <div className="relative z-10 flex flex-col justify-center p-6 sm:p-10 md:p-16 md:w-[55%] h-full">
              <div className="flex items-center gap-3 mb-4 sm:mb-6">
                <div className="w-10 h-10 rounded-xl bg-white/5 ring-1 ring-white/15 flex items-center justify-center backdrop-blur-md">
                  <FileText className="h-4 w-4 text-white/80" />
                </div>
                <span className="text-[10px] font-bold uppercase tracking-[0.25em] text-white/60">Elite Exam Prep</span>
              </div>

              <h3 className="font-serif text-3xl sm:text-4xl md:text-5xl lg:text-6xl text-white leading-[1.05] mb-4 sm:mb-6 tracking-tight">
                Command your<br />
                results with <em className="italic text-blue-300 font-light">confidence.</em>
              </h3>

              <p className="text-white/60 text-sm sm:text-base md:text-lg leading-relaxed mb-6 sm:mb-10 max-w-lg font-light">
                Strategic crash courses built around real past papers, timed mock conditions, and proven score-boosting methodologies. Step into the exam hall fully prepared.
              </p>

              {/* Exam results visual */}
              <div className="grid grid-cols-2 gap-3 sm:gap-4 mb-6 sm:mb-10">
                {[
                  { exam: "SAT", lift: "+240", label: "avg score lift" },
                  { exam: "A-Level", lift: "A*", label: "target grade" },
                ].map(({ exam, lift, label }) => (
                  <div key={exam} className="bg-white/5 ring-1 ring-white/10 rounded-2xl p-4 sm:p-5 text-center backdrop-blur-md transition-colors hover:bg-white/10">
                    <p className="text-[9px] sm:text-[10px] font-bold uppercase tracking-widest text-white/40 mb-2">{exam}</p>
                    <p className="text-2xl sm:text-3xl font-semibold text-white leading-none mb-2">{lift}</p>
                    <p className="text-[10px] text-white/50 font-medium leading-snug">{label}</p>
                  </div>
                ))}
              </div>

              <div className="flex items-start sm:items-center gap-4 pt-6 sm:pt-8 border-t border-white/10">
                <Award className="h-5 w-5 text-blue-400 mt-0.5 sm:mt-0 flex-shrink-0" />
                <p className="text-white/60 text-xs sm:text-sm font-light">
                  <span className="text-white font-medium">93% of our students</span> achieve their first-choice target grade.
                </p>
              </div>
            </div>

            {/* Left: score progress card */}
            <div className="hidden md:flex relative z-10 flex-col justify-center items-start p-10 md:p-16 md:w-[45%] gap-6">
              <div className="w-80 bg-white/5 backdrop-blur-2xl ring-1 ring-white/10 rounded-3xl p-8 shadow-2xl transition-transform hover:-translate-y-2 duration-500">
                <p className="text-[10px] font-bold uppercase tracking-widest text-white/40 mb-6">Score Trajectory</p>
                {[
                  { label: "Diagnostic", pct: 45, color: "bg-white/20" },
                  { label: "Mid-Course", pct: 72, color: "bg-blue-400/60" },
                  { label: "Final Mock", pct: 94, color: "bg-blue-400 shadow-[0_0_15px_rgba(96,165,250,0.4)]" },
                ].map(({ label, pct, color }) => (
                  <div key={label} className="mb-5 last:mb-0">
                    <div className="flex justify-between mb-2">
                      <span className="text-white/60 text-xs font-light">{label}</span>
                      <span className="text-white text-xs font-medium">{pct}%</span>
                    </div>
                    <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                      <div className={`h-full ${color} rounded-full transition-all duration-1000 ease-out`} style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="absolute bottom-6 left-8 sm:bottom-10 sm:left-12 text-white/5 font-serif font-bold text-6xl sm:text-8xl select-none pointer-events-none leading-none italic">04</div>
          </div>
        </div>

      </div>{/* end cards-wrapper */}
    </section>

      {/* Services */}
      <section id="services" className="py-24 bg-slate-50 overflow-hidden">
        <div className="max-w-7xl mx-auto px-6 mb-12">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
            <div>
              <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white text-slate-600 text-[10px] font-black uppercase tracking-widest border border-slate-200 mb-6">
                <Sparkles className="h-3.5 w-3.5 text-amber-500" />
                Services
              </div>
              <h2 className="font-serif text-4xl md:text-5xl text-[#062e39] max-w-md leading-tight">
                Two ways to learn, <em className="italic text-emerald-600">one goal</em>
              </h2>
            </div>
            <p className="text-slate-500 max-w-sm leading-relaxed">
              Choose the format that works for your schedule, learning style, and goals.
            </p>
          </div>
        </div>

        {/* Desktop Grid / Mobile Horizontal Scroll */}
        <div className="relative">
          <div className="flex gap-6 overflow-x-auto lg:grid lg:grid-cols-3 lg:overflow-visible px-6 pb-6 snap-x snap-mandatory scrollbar-hide">
            {[
              {
                icon: Video,
                title: "Live Online Classes",
                subtitle: "Real-time, interactive sessions",
                bgClass: "bg-[#062e39]",
                iconBgClass: "bg-white/10",
                iconColor: "text-emerald-400",
                textColor: "text-white",
                subtitleColor: "text-white/60",
                checkColor: "text-emerald-400",
                features: [
                  "Face-to-face tutor via HD video call",
                  "Interactive whiteboard & screen sharing",
                  "Session recordings sent after class",
                  "Personalised homework & feedback",
                  "Flexible scheduling — book anytime",
                ],
              },
              {
                icon: BookMarkedIcon,
                title: "Onsite Live Tutoring",
                subtitle: "In-person at your location",
                bgClass: "bg-emerald-600",
                iconBgClass: "bg-white/20",
                iconColor: "text-white",
                textColor: "text-white",
                subtitleColor: "text-white/70",
                checkColor: "text-emerald-300",
                features: [
                  "Tutor visits your home or study space",
                  "Full physical resources & materials",
                  "Hands-on learning & lab assistance",
                  "Progress reports sent to parents",
                  "Available weekdays & weekends",
                ],
              },
              {
                icon: PlayCircle,
                title: "Self-Paced Courses",
                subtitle: "Learn on your own schedule",
                bgClass: "bg-amber-400",
                iconBgClass: "bg-white/20",
                iconColor: "text-white",
                textColor: "text-white",
                subtitleColor: "text-white/70",
                checkColor: "text-amber-700",
                features: [
                  "Lifetime access to all materials",
                  "Video lessons, notes & quizzes",
                  "Progress tracked automatically",
                  "Certificate of completion",
                  "Community forum & Q&A",
                ],
              },
              {
                icon: Users,
                title: "Group Sessions",
                subtitle: "Study with peers, pay less",
                bgClass: "bg-[#062e39]",
                iconBgClass: "bg-white/10",
                iconColor: "text-emerald-400",
                textColor: "text-white",
                subtitleColor: "text-white/60",
                checkColor: "text-emerald-400",
                badge: "3–6 students",
                features: [
                  "Collaborative problem solving",
                  "60% cheaper than 1-on-1 sessions",
                  "Structured weekly curriculum",
                  "Peer accountability & motivation",
                ],
              },
              {
                icon: FileText,
                title: "Exam Preparation",
                subtitle: "Targeted crash courses",
                bgClass: "bg-gradient-to-br from-slate-800 to-emerald-800",
                iconBgClass: "bg-white/10",
                iconColor: "text-white",
                textColor: "text-white",
                subtitleColor: "text-white/70",
                checkColor: "text-emerald-300",
                features: [
                  "SAT, ACT, GCSE, A-Level, IB",
                  "Practice papers with marking",
                  "Timed mock exam conditions",
                  "Exam strategy & time management",
                ],
              },
              {
                icon: Star,
                title: "One-on-One Mentorship",
                subtitle: "Deep focus on your specific needs",
                bgClass: "bg-[var(--primary-color)]",
                iconBgClass: "bg-black/10",
                iconColor: "text-black",
                textColor: "text-black",
                subtitleColor: "text-black/60",
                checkColor: "text-black",
                features: [
                  "Highly personalized learning path",
                  "Weekly 1-on-1 strategy sessions",
                  "Unlimited Q&A support via chat",
                  "Portfolio & project guidance",
                ],
              },
            ].map((service, idx) => (
              <div
                key={idx}
                className="scroll-card bg-white rounded-3xl overflow-hidden border border-slate-200 min-w-[320px] max-w-[400px] flex-shrink-0 shadow-lg hover:shadow-xl transition-shadow"
              >
                <div className={`${service.bgClass} p-8`}>
                  <div
                    className={`w-12 h-12 rounded-2xl ${service.iconBgClass} flex items-center justify-center mb-6`}
                  >
                    <service.icon
                      className={`h-6 w-6 ${service.iconColor}`}
                    />
                  </div>
                  <h3 className={`font-serif text-2xl mb-2 ${service.textColor}`}>
                    {service.title}
                  </h3>
                  <p className={`${service.subtitleColor} text-sm`}>
                    {service.subtitle}
                  </p>
                  {service.badge && (
                    <div className="mt-4 inline-block bg-emerald-500/20 text-emerald-300 text-xs font-bold px-3 py-1 rounded-full border border-emerald-500/30">
                      {service.badge}
                    </div>
                  )}
                </div>
                <div className="p-8">
                  <ul className="space-y-3 mb-8">
                    {service.features.map((feature, fIdx) => (
                      <li
                        key={fIdx}
                        className="flex items-start gap-3 text-sm text-slate-600"
                      >
                        <Check
                          className={`h-4 w-4 ${service.checkColor} mt-0.5 flex-shrink-0`}
                        />
                        {feature}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            ))}
          </div>

          {/* Gradient fade indicators (mobile only) */}
          <div className="pointer-events-none absolute left-0 top-0 bottom-0 w-8 bg-gradient-to-r from-slate-50 to-transparent z-10 lg:hidden"></div>
          <div className="pointer-events-none absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-slate-50 to-transparent z-10 lg:hidden"></div>
        </div>

        {/* CTA Button below Services */}
        <div className="mt-16 text-center">
          <Link
            href={`/sign-up?role=student&tenant=${tenant.slug}`}
            className="inline-flex items-center gap-4 bg-[#062e39] text-white text-lg font-black px-12 py-5 rounded-2xl hover:bg-[#0a4a5c] transition-all hover:scale-105 shadow-xl shadow-[#062e39]/20 group uppercase tracking-widest"
          >
            Get Started & Sign Up Now
            <ArrowRight className="h-5 w-5 text-emerald-400 group-hover:translate-x-2 transition-transform" />
          </Link>
        </div>

        {/* Scroll indicators (mobile only) */}
        <div className="flex justify-center gap-2 mt-12 lg:hidden">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <div
              key={i}
              className="rounded-full transition-all duration-300 w-6 h-1.5 bg-slate-300"
            ></div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="py-24 container mx-auto px-6">
        <div className="rounded-[4rem] p-12 md:p-24 text-center relative overflow-hidden shadow-2xl bg-[#062e39] text-white group">
          {/* Animated Background Element */}
          <div className="absolute top-0 right-0 p-12 opacity-5 pointer-events-none rotate-12 transition-transform duration-700 group-hover:rotate-[30deg] group-hover:scale-125">
            <Zap className="h-64 w-64 text-white" />
          </div>
          <div className="absolute bottom-[-100px] left-[-100px] w-64 h-64 bg-emerald-500 rounded-full blur-[100px] opacity-20" />

          <div className="relative z-10 max-w-4xl mx-auto">
            <h2 className="font-serif text-4xl md:text-6xl lg:text-7xl font-black tracking-tighter mb-10 leading-[0.9]">
              {ctaTitle}
            </h2>
            <div className="flex justify-center">
              {!membership ? (
                <form action={joinTenantBySlug}>
                  <input type="hidden" name="tenantSlug" value={tenant.slug} />
                  <input type="hidden" name="role" value="student" />
                  <Button className="h-20 px-12 rounded-3xl bg-emerald-500 text-white text-xl font-black uppercase tracking-[0.2em] shadow-2xl shadow-emerald-500/40 hover:scale-105 transition-all">
                    {ctaButton}
                  </Button>
                </form>
              ) : (
                <Link href={`/academy/${tenant.slug}/classroom`}>
                  <Button className="h-20 px-12 rounded-3xl bg-emerald-500 text-white text-xl font-black uppercase tracking-[0.2em] shadow-2xl shadow-emerald-500/40 hover:scale-105 transition-all">
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