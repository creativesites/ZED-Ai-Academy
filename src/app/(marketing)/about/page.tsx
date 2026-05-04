"use client";
import Layout from "@/components/layout/Layout"
import CounterUp from "@/components/elements/CounterUp"
import Link from "next/link"
import { Autoplay, Navigation, Pagination } from "swiper/modules"
import { Swiper, SwiperSlide } from "swiper/react"
import { useState, useEffect } from "react"
import VideoModal from "@/components/shared/video-modal"
import { getSiteAsset } from "@/lib/site-assets"
import { Sparkles, Target, Zap, GraduationCap, Users, ShieldCheck, TrendingUp, Phone, ArrowRight } from "lucide-react"

const testimonialOptions = {
    modules: [Autoplay, Pagination, Navigation],
    slidesPerView: 1,
    loop: true,
    autoplay: { delay: 4000, disableOnInteraction: false },
    navigation: { nextEl: '.srn', prevEl: '.srp' },
    pagination: { el: '.swiper-pagination', clickable: true },
}

const testimonials = [
    {
        name: "Chanda Mwila",
        role: "Marketing Manager, Lusaka",
        img: "https://images.unsplash.com/photo-1666867936058-de34bfd5b320?w=150&q=80",
        quote: "I finished the Prompt Engineering course in two weeks and immediately started using it at work. I now produce content in a fraction of the time.",
    },
    {
        name: "Bwalya Tembo",
        role: "Entrepreneur, Ndola",
        img: "https://images.unsplash.com/photo-1560250097-0b93528c311a?w=150&q=80",
        quote: "The AI for Business course changed how I run my company. I use AI to draft proposals, respond to emails and analyse my sales data.",
    },
]

export default function AboutPage() {
    const [isOpen, setOpen] = useState(false)
    const [heroImg, setHeroImg] = useState("https://images.unsplash.com/photo-1758612214917-81d7956c09de?w=1200&q=80")
    const [missionImg, setMissionImg] = useState("https://images.unsplash.com/photo-1499914485622-a88fac536970?w=800&q=80")

    useEffect(() => {
        getSiteAsset("about_hero", heroImg).then(setHeroImg);
        getSiteAsset("about_mission_img", missionImg).then(setMissionImg);
    }, []);

    return (
        <Layout headerStyle={2} footerStyle={1} breadcrumbTitle="About Us">
            {/* Mission Section */}
            <section className="about-one py-24 relative overflow-hidden">
                <div className="container">
                    <div className="row items-center">
                        <div className="col-xl-7 lg:mb-20">
                            <div className="about-one__content pr-12">
                                <div className="sec-title mb-10">
                                    <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[#fff2e9] text-[#fd5523] text-xs font-black uppercase tracking-widest mb-6">
                                        <Sparkles className="h-3.5 w-3.5" />
                                        Our Story
                                    </div>
                                    <h2 className="text-6xl font-extrabold text-[#062e39] tracking-tight leading-[1.05] mb-8">
                                        Zambia&apos;s Leading Platform for <br />
                                        <span className="text-[#fd5523]">Practical AI Skills.</span>
                                    </h2>
                                    <p className="text-xl text-slate-500 leading-relaxed max-w-2xl">
                                        Zed AI Academy was built because Zambian professionals deserve world-class AI
                                        training that is relevant to their context. Every course is designed around
                                        real tools and real workflows.
                                    </p>
                                </div>

                                <div className="grid grid-cols-2 gap-8 mb-12">
                                    <div className="p-8 rounded-[2rem] bg-white shadow-xl shadow-slate-200/40 border border-slate-50 group hover:border-[#fd5523]/20 transition-all">
                                        <div className="h-12 w-12 rounded-2xl bg-blue-50 flex items-center justify-center text-blue-600 mb-4 group-hover:scale-110 transition-transform">
                                            <Target className="h-6 w-6" />
                                        </div>
                                        <h3 className="font-bold text-[#062e39] mb-2">Practical Courses</h3>
                                        <p className="text-sm text-slate-500 leading-relaxed">Learn AI tools you can use in your job from day one.</p>
                                    </div>
                                    <div className="p-8 rounded-[2rem] bg-white shadow-xl shadow-slate-200/40 border border-slate-50 group hover:border-[#fd5523]/20 transition-all">
                                        <div className="h-12 w-12 rounded-2xl bg-amber-50 flex items-center justify-center text-amber-600 mb-4 group-hover:scale-110 transition-transform">
                                            <Zap className="h-6 w-6" />
                                        </div>
                                        <h3 className="font-bold text-[#062e39] mb-2">Learn Anywhere</h3>
                                        <p className="text-sm text-slate-500 leading-relaxed">Self-paced lessons accessible any time on any device.</p>
                                    </div>
                                </div>

                                <div className="flex items-center gap-8">
                                    <Link className="thm-btn px-10 py-7 rounded-full shadow-2xl shadow-[#fd5523]/20" href="/courses">
                                        Browse Courses
                                        <i className="icon-right-arrow21"></i>
                                    </Link>
                                    <div className="flex items-center gap-4">
                                        <div className="h-12 w-12 rounded-full bg-[#fff2e9] flex items-center justify-center text-[#fd5523]">
                                            <Phone className="h-5 w-5" />
                                        </div>
                                        <div>
                                            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Admissions</p>
                                            <p className="text-sm font-bold text-[#062e39]">0979 046 745</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="col-xl-5">
                            <div className="relative">
                                <div className="rounded-[4rem] overflow-hidden shadow-2xl rotate-2 hover:rotate-0 transition-transform duration-700">
                                    <img src={heroImg} alt="" className="w-full h-[600px] object-cover" />
                                </div>
                                <div className="absolute -bottom-10 -left-10 p-8 rounded-[3rem] bg-white shadow-2xl border-4 border-slate-50 max-w-[240px] -rotate-3 hover:rotate-0 transition-transform duration-500">
                                    <p className="text-4xl font-black text-[#fd5523] mb-1">1.2k+</p>
                                    <p className="text-xs font-bold text-[#062e39] uppercase tracking-widest leading-tight">Learners Trained in Zambia 🇿🇲</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* Stats */}
            <section className="py-20 bg-[#062e39] relative overflow-hidden">
                <div className="absolute inset-0 opacity-10 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')]" />
                <div className="container relative z-10">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-12">
                        {[
                            { label: "Courses", val: 20, icon: GraduationCap },
                            { label: "Learners", val: 500, icon: Users },
                            { label: "Success Rate", val: 98, icon: ShieldCheck, suffix: "%" },
                            { label: "Companies", val: 30, icon: TrendingUp },
                        ].map((s, idx) => (
                            <div key={idx} className="text-center group">
                                <div className="h-14 w-14 rounded-2xl bg-white/10 flex items-center justify-center text-[#fd5523] mx-auto mb-6 group-hover:scale-110 transition-transform shadow-xl">
                                    <s.icon className="h-7 w-7" />
                                </div>
                                <h3 className="text-5xl font-black text-white tracking-tighter mb-2">
                                    <CounterUp end={s.val} />{s.suffix || "+"}
                                </h3>
                                <p className="text-xs font-bold uppercase tracking-[0.3em] text-white/40">{s.label}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* Testimonials */}
            <section className="py-32 bg-slate-50">
                <div className="container">
                    <div className="text-center mb-20">
                        <h2 className="text-5xl font-extrabold text-[#062e39] tracking-tight">What Our Learners Say</h2>
                        <p className="text-slate-500 mt-4 max-w-xl mx-auto">Success stories from Zambian professionals and entrepreneurs.</p>
                    </div>
                    <div className="grid md:grid-cols-2 gap-10">
                        {testimonials.map((t, idx) => (
                            <div key={idx} className="p-12 rounded-[3rem] bg-white shadow-xl shadow-slate-200/30 border border-slate-50 relative">
                                <div className="absolute -top-6 left-12 h-12 w-12 rounded-2xl bg-[#fd5523] flex items-center justify-center text-white shadow-xl shadow-[#fd5523]/20">
                                    <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M14.017 21L14.017 18C14.017 16.8954 14.9124 16 16.017 16H19.017C19.5693 16 20.017 15.5523 20.017 15V9C20.017 8.44772 19.5693 8 19.017 8H15.017C14.4647 8 14.017 7.55228 14.017 7V5C14.017 4.44772 14.4647 4 15.017 4H20.017C21.1216 4 22.017 4.89543 22.017 6V15C22.017 18.3137 19.3307 21 16.017 21H14.017ZM2.01697 21L2.01697 18C2.01697 16.8954 2.9124 16 4.01697 16H7.01697C7.56925 16 8.01697 15.5523 8.01697 15V9C8.01697 8.44772 7.56925 8 7.01697 8H3.01697C2.46468 8 2.01697 7.55228 2.01697 7V5C2.01697 4.44772 2.46468 4 3.01697 4H8.01697C9.12154 4 10.017 4.89543 10.017 6V15C10.017 18.3137 7.33068 21 4.01697 21H2.01697Z" /></svg>
                                </div>
                                <p className="text-xl leading-relaxed text-slate-600 mb-8 italic">&quot;{t.quote}&quot;</p>
                                <div className="flex items-center gap-4 pt-8 border-t border-slate-50">
                                    <img src={t.img} alt={t.name} className="h-14 w-14 rounded-2xl object-cover" />
                                    <div>
                                        <h4 className="font-bold text-[#062e39]">{t.name}</h4>
                                        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">{t.role}</p>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* Bottom CTA */}
            <section className="py-24 px-4">
                <div className="container max-w-6xl rounded-[4rem] bg-[#fd5523] p-20 text-white text-center relative overflow-hidden shadow-2xl shadow-[#fd5523]/30">
                    <div className="absolute inset-0 opacity-10 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')]" />
                    <div className="relative z-10">
                        <h2 className="text-5xl font-black mb-6 tracking-tight">Start Your AI Journey Today</h2>
                        <p className="text-white/80 text-xl max-w-2xl mx-auto mb-12">Join 500+ Zambian professionals mastering the tools of the future.</p>
                        <Link href="/courses" className="inline-flex items-center gap-3 px-12 py-8 rounded-full bg-white text-[#fd5523] font-black text-lg hover:scale-105 transition-all shadow-2xl shadow-white/20">
                            Explore All Courses
                            <ArrowRight className="h-6 w-6" />
                        </Link>
                    </div>
                </div>
            </section>
        </Layout>
    )
}
