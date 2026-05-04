'use client'
import { Autoplay, Navigation, Pagination } from "swiper/modules"
import { Swiper, SwiperSlide } from "swiper/react"


const swiperOptions = {
    modules: [Autoplay, Pagination, Navigation],
    slidesPerView: 1,
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
        767: { slidesPerView: 1 },
        991: { slidesPerView: 1 },
        1199: { slidesPerView: 1 },
        1350: { slidesPerView: 1 },
    }
}

const testimonials = [
    {
        name: "Chanda Mwila",
        role: "MARKETING MANAGER, LUSAKA",
        quote: "I finished the Prompt Engineering course in two weeks and immediately started using it at work. I now produce content in a fraction of the time — it was honestly one of the best investments I have made in my career.",
    },
    {
        name: "Bwalya Tembo",
        role: "ENTREPRENEUR, NDOLA",
        quote: "The AI for Business course changed how I run my company. I use AI to draft proposals, respond to emails and analyse my sales data. Zed AI Academy made it so easy to learn — no tech background needed.",
    },
    {
        name: "Natasha Phiri",
        role: "PHOTOGRAPHER, LIVINGSTONE",
        quote: "The AI Photography course is incredible. I was already a working photographer but the AI tools they teach have doubled my output and my clients love the results. Highly recommend to any creative.",
    },
]

export default function Testimonial() {
    return (
        <>

<section className="testimonial-one">
            <div className="testimonial-one__pattern"
                style={{ backgroundImage: 'url(assets/images/pattern/testimonial-v1-pattern.png)' }} ></div>
            <div className="container">
                <div className="row">
                    {/*Start Testimonial One Content*/}
                    <div className="col-xl-6">
                        <div className="testimonial-one__content">
                            <div className="big-title wow slideInLeft" data-wow-delay="100ms" data-wow-duration="2500ms">
                                <h2>TESTIMONIALS</h2>
                            </div>
                            <div className="sec-title tg-heading-subheading animation-style2">
                                <div className="sec-title__tagline">
                                    <div className="line"></div>
                                    <div className="text tg-element-title">
                                        <h4>Learner Stories</h4>
                                    </div>
                                    <div className="icon">
                                        <span className="icon-plane2 float-bob-x3"></span>
                                    </div>
                                </div>
                                <h2 className="sec-title__title tg-element-title">What Our Learners <br/>
                                    Say <span>About Us</span> </h2>
                            </div>

                            <div className="testimonial-one__carousel owl-carousel owl-theme">
                            <Swiper {...swiperOptions} className="service-one__carousel owl-carousel owl-theme owl-dot-style1">
                                {testimonials.map((t, idx) => (
                                    <SwiperSlide key={idx}>
                                        <div className="testimonial-one__single">
                                            <div className="icon">
                                                <span className="icon-quote1"></span>
                                            </div>
                                            <div className="testimonial-one__single-inner">
                                                <div className="shape1"><img src="assets/images/shapes/testimonial-v1-shape1.png"
                                                        alt=""/></div>
                                                <div className="author-box">
                                                    <div className="img-box">
                                                        <img src="https://images.unsplash.com/photo-1666867936058-de34bfd5b320?w=150&q=80&auto=format&fit=crop" alt={t.name}/>
                                                    </div>
                                                    <div className="author-info">
                                                        <h2>{t.name}</h2>
                                                        <div className="bottom-text">
                                                            <p>{t.role}</p>
                                                            <div className="rating-box">
                                                                <i className="icon-star"></i>
                                                                <i className="icon-star"></i>
                                                                <i className="icon-star"></i>
                                                                <i className="icon-star"></i>
                                                                <i className="icon-star"></i>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>

                                                <div className="text-box">
                                                    <p>{t.quote}</p>
                                                </div>
                                            </div>
                                        </div>
                                    </SwiperSlide>
                                ))}
                            </Swiper>
                            </div>
                        </div>
                    </div>
                    {/*End Testimonial One Content*/}


                    {/*Start Testimonial One Img*/}
                    <div className="col-xl-6">
                        <div className="testimonial-one__img">
                            <div className="testimonial-one__img1 reveal">
                                <img src="images/8984.jpg" alt="Zambian learners celebrating success"/>
                            </div>

                            <div className="testimonial-one__img-author">
                                <ul>
                                    <li>
                                        <div className="img-box"><img src="images/beauty-charisma-head-shot-portrait-600nw-2647728057.webp" alt="Learner"/>
                                        </div>
                                    </li>
                                    <li>
                                        <div className="img-box"><img src="images/photo-1522529599102-193c0d76b5b6.avif" alt="Learner"/>
                                        </div>
                                    </li>
                                    <li>
                                        <div className="img-box"><img src="images/9b2879c1af82d24e1ad2336583952385.jpeg" alt="Learner"/>
                                        </div>
                                    </li>
                                </ul>

                                <div className="text-box">
                                    <h2>Learners Satisfied</h2>
                                    <p>4.9 (50+ Learners)</p>
                                </div>
                            </div>
                        </div>
                    </div>
                    {/*End Testimonial One Img*/}
                </div>
            </div>
        </section>

        </>
    )
}
