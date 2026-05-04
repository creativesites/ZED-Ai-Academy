'use client'
import Link from "next/link"
import { Autoplay, Navigation, Pagination } from "swiper/modules"
import { Swiper, SwiperSlide } from "swiper/react"

const swiperOptions = {
    modules: [Autoplay, Pagination, Navigation],
    slidesPerView: 3,
    spaceBetween: 30,
    loop: true,
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
        575: { slidesPerView: 1 },
        767: { slidesPerView: 2 },
        991: { slidesPerView: 2 },
        1199: { slidesPerView: 3 },
        1350: { slidesPerView: 3 },
    }
}

const courses = [
    {
        img: "https://images.unsplash.com/photo-1677442135703-1787eea5ce01?w=600&q=80&auto=format&fit=crop",
        title: "Prompt Engineering",
        desc: "Master the art of writing effective prompts for ChatGPT, Claude and other AI tools to get better results faster.",
        icon: "icon-delivery-man",
        slug: "prompt-engineering",
    },
    {
        img: "https://images.unsplash.com/photo-1762341107834-a3437dd0ae62?w=600&q=80&auto=format&fit=crop",
        title: "AI for Business",
        desc: "Automate workflows, write better emails, generate reports and use AI to make smarter business decisions.",
        icon: "icon-shipment",
        slug: "ai-for-business",
    },
    {
        img: "https://images.unsplash.com/photo-1542038784456-1ea8e935640e?w=600&q=80&auto=format&fit=crop",
        title: "AI Photography & Creative Tools",
        desc: "Use Midjourney, Adobe Firefly and AI editing tools to create stunning visuals and grow your creative business.",
        icon: "icon-international-shipping",
        slug: "ai-photography",
    },
    {
        img: "https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=600&q=80&auto=format&fit=crop",
        title: "AI for Data & Analytics",
        desc: "Analyse data faster using AI tools — build dashboards, summarise reports and spot insights without coding.",
        icon: "icon-delivery-man",
        slug: "ai-data-analytics",
    },
    {
        img: "https://images.unsplash.com/photo-1499914485622-a88fac536970?w=600&q=80&auto=format&fit=crop",
        title: "AI Tools for Productivity",
        desc: "Save hours every week by integrating AI into your daily work — from scheduling to content creation and beyond.",
        icon: "icon-shipment",
        slug: "ai-productivity",
    },
    {
        img: "https://images.unsplash.com/photo-1678995637406-1ca9bdf03817?w=600&q=80&auto=format&fit=crop",
        title: "Machine Learning Basics",
        desc: "A non-technical introduction to how AI models work — perfect for anyone wanting to understand the technology.",
        icon: "icon-international-shipping",
        slug: "machine-learning-basics",
    },
]

export default function Service() {
    return (
        <>
        <section className="service-one">
            <div className="service-one__pattern"
                style={{ backgroundImage: 'url(assets/images/pattern/service-v1-pattern.jpg)' }} ></div>
            <div className="container">
                <div className="sec-title center text-center tg-heading-subheading animation-style2">
                    <div className="sec-title__tagline">
                        <div className="line"></div>
                        <div className="text tg-element-title">
                            <h4>Our Courses</h4>
                        </div>
                        <div className="icon">
                            <span className="icon-plane2 float-bob-x3"></span>
                        </div>
                    </div>
                    <h2 className="sec-title__title tg-element-title">Practical AI Skills for <br/> Zambian <span>Professionals</span></h2>
                </div>

                <div className="row">
                    <div className="">
                        <Swiper {...swiperOptions} className="service-one__carousel owl-carousel owl-theme owl-dot-style1">
                            {courses.map((course) => (
                                <SwiperSlide key={course.slug}>
                                    <div className="service-one__single">
                                        <div className="service-one__single-inner">
                                            <div className="service-one__single-img">
                                                <img src={course.img} alt={course.title}/>
                                            </div>

                                            <div className="service-one__single-content">
                                                <h2><Link href={`/courses?category=${course.slug}`}>{course.title}</Link></h2>
                                                <p>{course.desc}</p>
                                                <div className="btn-box">
                                                    <Link href={`/courses?category=${course.slug}`}>Explore <span
                                                            className="icon-right-arrow21"></span></Link>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="icon">
                                            <span className={course.icon}></span>
                                        </div>
                                    </div>
                                </SwiperSlide>
                            ))}
                        </Swiper>
                    </div>
                </div>
            </div>
        </section>
        </>
    )
}
