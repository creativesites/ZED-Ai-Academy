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
        nextEl: '.srn',
        prevEl: '.srp',
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

const instructors = [
    {
        img: "https://images.unsplash.com/photo-1573496527892-904f897eb744?w=400&q=80&auto=format&fit=crop",
        name: "AI & Prompt Design",
        role: "COURSE INSTRUCTOR",
        bio: "Expert in large language models and prompt engineering, helping professionals unlock the full power of AI tools.",
    },
    {
        img: "https://images.unsplash.com/photo-1560250097-0b93528c311a?w=400&q=80&auto=format&fit=crop",
        name: "Business AI Workflows",
        role: "COURSE INSTRUCTOR",
        bio: "Specialist in automating business processes with AI — from content creation to data analysis and reporting.",
    },
    {
        img: "https://images.unsplash.com/photo-1607990283143-e81e7a2c9349?w=400&q=80&auto=format&fit=crop",
        name: "AI Creative Tools",
        role: "COURSE INSTRUCTOR",
        bio: "Photographer and digital creator teaching Midjourney, Firefly and AI-enhanced design for the African market.",
    },
    {
        img: "https://images.unsplash.com/photo-1573496527892-904f897eb744?w=400&q=80&auto=format&fit=crop",
        name: "AI & Prompt Design",
        role: "COURSE INSTRUCTOR",
        bio: "Expert in large language models and prompt engineering, helping professionals unlock the full power of AI tools.",
    },
    {
        img: "https://images.unsplash.com/photo-1560250097-0b93528c311a?w=400&q=80&auto=format&fit=crop",
        name: "Business AI Workflows",
        role: "COURSE INSTRUCTOR",
        bio: "Specialist in automating business processes with AI — from content creation to data analysis and reporting.",
    },
    {
        img: "https://images.unsplash.com/photo-1607990283143-e81e7a2c9349?w=400&q=80&auto=format&fit=crop",
        name: "AI Creative Tools",
        role: "COURSE INSTRUCTOR",
        bio: "Photographer and digital creator teaching Midjourney, Firefly and AI-enhanced design for the African market.",
    },
]

export default function Team() {
    return (
        <>

        <section className="team-one team-one--two">
            <div className="team-one--two__pattern">
                <img src="assets/images/pattern/team-v2-pattern.png" alt=""/>
            </div>
            <div className="container">
                <div className="sec-title center text-center tg-heading-subheading animation-style2">
                    <div className="sec-title__tagline">
                        <div className="line"></div>
                        <div className="text tg-element-title">
                            <h4>Our Instructors</h4>
                        </div>
                        <div className="icon">
                            <span className="icon-plane2 float-bob-x3"></span>
                        </div>
                    </div>
                    <h2 className="sec-title__title tg-element-title">Learn From Expert <br/>
                        AI <span>Instructors</span></h2>
                </div>

                <Swiper {...swiperOptions} className="team-one__carousel owl-carousel owl-theme owl-dot-style1">
                    {instructors.map((instructor, idx) => (
                        <SwiperSlide key={idx}>
                        <div className="team-one__single">
                            <div className="team-one__single-img">
                                <div className="inner">
                                    <img src={instructor.img} alt={instructor.name}/>
                                </div>
                            </div>

                            <div className="team-one__single-content">
                                <ul className="social-links">
                                    <li><Link href="#"><span className="icon-linkedin"></span></Link></li>
                                    <li><Link href="#"><span className="icon-twitter1"></span></Link></li>
                                    <li><Link href="#"><span className="icon-instagram"></span></Link></li>
                                </ul>
                                <span>{instructor.role}</span>
                                <h2><Link href="/courses">{instructor.name}</Link></h2>
                                <p>{instructor.bio}</p>
                                <div className="btn-box">
                                    <Link href="/courses">View Courses <i className="icon-right-arrow21"></i></Link>
                                </div>
                            </div>
                        </div>
                        </SwiperSlide>
                    ))}
                </Swiper>
            </div>
        </section>

        </>
    )
}
