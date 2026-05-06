'use client'
import Link from "next/link"
import { Autoplay, Navigation, Pagination } from "swiper/modules"
import { Swiper, SwiperSlide } from "swiper/react"
import { Brain, Users, Cpu, Shield, Zap, Workflow, Sparkles, ArrowRight } from "lucide-react"

const swiperOptions = {
    modules: [Autoplay, Pagination, Navigation],
    slidesPerView: 3,
    spaceBetween: 30,
    loop: true,
    autoplay: {
        delay: 5000,
        disableOnInteraction: false,
    },
    navigation: {
        nextEl: '.h1n',
        prevEl: '.h1p',
    },
    pagination: {
        el: '.swiper-pagination',
        clickable: true,
    },
    breakpoints: {
        320: { slidesPerView: 1 },
        767: { slidesPerView: 2 },
        1199: { slidesPerView: 3 },
    }
}

const services = [
    {
        title: "AI Strategy Consulting",
        description: "We help leadership teams identify high-impact AI opportunities and build sustainable implementation roadmaps.",
        icon: Brain,
        link: "/services/strategy"
    },
    {
        title: "Corporate Team Training",
        description: "Customised workshops for departments to master AI tools relevant to their specific industry workflows.",
        icon: Users,
        link: "/services/training"
    },
    {
        title: "Custom AI Implementation",
        description: "End-to-end support in deploying LLMs, automation agents, and custom AI solutions into your existing stack.",
        icon: Cpu,
        link: "/services/implementation"
    },
    {
        title: "AI Ethics & Governance",
        description: "Ensure your AI adoption is safe, compliant, and ethical with our robust governance frameworks.",
        icon: Shield,
        link: "/services/governance"
    },
    {
        title: "Prompt Engineering",
        description: "Master the art of communicating with AI to get precise, high-quality outputs for any business use case.",
        icon: Zap,
        link: "/services/prompt-engineering"
    },
    {
        title: "Workflow Automation",
        description: "Re-engineer your business processes from the ground up using AI-native automation and intelligence.",
        icon: Workflow,
        link: "/services/automation"
    }
]

export default function Services() {
    return (
        <section className="service-two py-24 bg-white relative overflow-hidden">
            {/* Background elements */}
            <div className="absolute top-0 right-0 w-1/3 h-1/3 bg-[#fd5523]/5 rounded-full blur-[120px] -mr-32 -mt-32"></div>
            <div className="absolute bottom-0 left-0 w-1/4 h-1/4 bg-[#062e39]/5 rounded-full blur-[100px] -ml-20 -mb-20"></div>

            <div className="container relative z-10">
                <div className="sec-title center text-center mb-16">
                    <div className="flex items-center justify-center gap-3 mb-4">
                        <div className="h-px w-8 bg-[#fd5523]"></div>
                        <div className="flex items-center gap-2 text-[#fd5523] font-bold text-sm uppercase tracking-[0.3em]">
                            <Sparkles className="h-4 w-4" />
                            Solutions
                        </div>
                        <div className="h-px w-8 bg-[#fd5523]"></div>
                    </div>
                    <h2 className="text-4xl md:text-5xl font-extrabold text-[#062e39] tracking-tight">
                        Transforming Industry with <br/>
                        <span className="text-[#fd5523]">Intelligence</span>
                    </h2>
                </div>

                <Swiper {...swiperOptions} className="service-two__carousel !pb-16">
                    {services.map((service, index) => (
                        <SwiperSlide key={index}>
                            <div className="service-two__single group h-full bg-[#f8fafc] rounded-[2.5rem] p-10 border border-slate-100 transition-all hover:bg-white hover:shadow-2xl hover:shadow-slate-200 hover:-translate-y-2">
                                <div className="service-two__single-content flex flex-col h-full">
                                    <div className="icon mb-8 h-16 w-16 rounded-2xl bg-white flex items-center justify-center text-[#fd5523] shadow-sm group-hover:bg-[#fd5523] group-hover:text-white transition-all duration-500">
                                        <service.icon className="h-8 w-8" />
                                    </div>
                                    <div className="service-two__single-content-inner text-left flex-1">
                                        <h3 className="text-2xl font-bold text-[#062e39] mb-4 leading-tight group-hover:text-[#fd5523] transition-colors">
                                            {service.title}
                                        </h3>
                                        <p className="text-slate-500 leading-relaxed mb-8">
                                            {service.description}
                                        </p>
                                        <div className="mt-auto">
                                            <Link href={service.link} className="inline-flex items-center gap-2 text-sm font-bold text-[#062e39] group-hover:text-[#fd5523] transition-all">
                                                Explore Solution 
                                                <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
                                            </Link>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </SwiperSlide>
                    ))}
                    <div className="swiper-pagination !-bottom-2"></div>
                </Swiper>
            </div>
        </section>
    )
}

