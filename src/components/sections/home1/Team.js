'use client'
import Link from "next/link"
import { Autoplay, Navigation, Pagination } from "swiper/modules"
import { Swiper, SwiperSlide } from "swiper/react"

const swiperOptions = {
    modules: [Autoplay, Pagination, Navigation],
    slidesPerView: 3,
    spaceBetween: 30,
    
    loop: true,

    // Navigation
    navigation: {
        nextEl: '.h1n',
        prevEl: '.h1p',
    },

    // Pagination
    pagination: {
        el: '.swiper-pagination',
        clickable: true,
    },
    breakpoints: {
        320: {
            slidesPerView: 1,
            
        },
        575: {
            slidesPerView: 1,
            
        },
        767: {
            slidesPerView: 2,
            
        },
        991: {
            slidesPerView: 2,
            
        },
        1199: {
            slidesPerView: 3,
            
        },
        1350: {
            slidesPerView: 3,
            
        },
    }
}
export default function Team() {
    return (
        <>

        <section className="team-one">
            <div className="container">
                <div className="sec-title center text-center tg-heading-subheading animation-style2">
                    <div className="sec-title__tagline">
                        <div className="line"></div>
                        <div className="text tg-element-title">
                            <h4>Team member</h4>
                        </div>
                        <div className="icon">
                            <span className="icon-plane2 float-bob-x3"></span>
                        </div>
                    </div>
                    <h2 className="sec-title__title tg-element-title">Introduce Our Expert <br/>
                        Logistic <span>Teams</span></h2>
                </div>

                <div className="">
                    <Swiper {...swiperOptions} className="team-one__carousel owl-carousel owl-theme owl-dot-style1">
                        <SwiperSlide>
                            <div className="team-one__single">
                                <div className="team-one__single-img">
                                    <div className="inner">
                                        <img src="assets/images/team/team-v1-img1.jpg" alt=""/>
                                    </div>
                                </div>

                                <div className="team-one__single-content">
                                    <ul className="social-links">
                                        <li><Link href="#"><span className="icon-linkedin"></span></Link></li>
                                        <li><Link href="#"><span className="icon-twitter1"></span></Link></li>
                                        <li><Link href="#"><span className="icon-instagram"></span></Link></li>
                                        <li><Link href="#"><span className="icon-facebook-f"></span></Link></li>
                                    </ul>
                                    <span>FOUNDER</span>
                                    <h2><Link href="team-details">Courtney Henry</Link></h2>
                                    <p>Logistic service provider company plays a pivotal role in the global supply chain
                                    </p>
                                    <div className="btn-box">
                                        <Link href="contact">Contact Me <i className="icon-right-arrow21"></i></Link>
                                    </div>
                                </div>
                            </div>
                        </SwiperSlide>
                        <SwiperSlide>  
                            <div className="team-one__single">
                                <div className="team-one__single-img">
                                    <div className="inner">
                                        <img src="assets/images/team/team-v1-img2.jpg" alt=""/>
                                    </div>
                                </div>

                                <div className="team-one__single-content">
                                    <ul className="social-links">
                                        <li><Link href="#"><span className="icon-linkedin"></span></Link></li>
                                        <li><Link href="#"><span className="icon-twitter1"></span></Link></li>
                                        <li><Link href="#"><span className="icon-instagram"></span></Link></li>
                                        <li><Link href="#"><span className="icon-facebook-f"></span></Link></li>
                                    </ul>
                                    <span>FOUNDER</span>
                                    <h2><Link href="team-details">Jane Cooper</Link></h2>
                                    <p>Logistic service provider company plays a pivotal role in the global supply chain
                                    </p>
                                    <div className="btn-box">
                                        <Link href="contact">Contact Me <i className="icon-right-arrow21"></i></Link>
                                    </div>
                                </div>
                            </div>                       
                        </SwiperSlide>
                        <SwiperSlide>
                            <div className="team-one__single">
                                <div className="team-one__single-img">
                                    <div className="inner">
                                        <img src="assets/images/team/team-v1-img3.jpg" alt=""/>
                                    </div>
                                </div>

                                <div className="team-one__single-content">
                                    <ul className="social-links">
                                        <li><Link href="#"><span className="icon-linkedin"></span></Link></li>
                                        <li><Link href="#"><span className="icon-twitter1"></span></Link></li>
                                        <li><Link href="#"><span className="icon-instagram"></span></Link></li>
                                        <li><Link href="#"><span className="icon-facebook-f"></span></Link></li>
                                    </ul>
                                    <span>FOUNDER</span>
                                    <h2><Link href="team-details">Marvin McKinney</Link></h2>
                                    <p>Logistic service provider company plays a pivotal role in the global supply chain
                                    </p>
                                    <div className="btn-box">
                                        <Link href="contact">Contact Me <i className="icon-right-arrow21"></i></Link>
                                    </div>
                                </div>
                            </div>
                        </SwiperSlide>
                        <SwiperSlide>
                            <div className="team-one__single">
                                <div className="team-one__single-img">
                                    <div className="inner">
                                        <img src="assets/images/team/team-v1-img1.jpg" alt=""/>
                                    </div>
                                </div>

                                <div className="team-one__single-content">
                                    <ul className="social-links">
                                        <li><Link href="#"><span className="icon-linkedin"></span></Link></li>
                                        <li><Link href="#"><span className="icon-twitter1"></span></Link></li>
                                        <li><Link href="#"><span className="icon-instagram"></span></Link></li>
                                        <li><Link href="#"><span className="icon-facebook-f"></span></Link></li>
                                    </ul>
                                    <span>FOUNDER</span>
                                    <h2><Link href="team-details">Courtney Henry</Link></h2>
                                    <p>Logistic service provider company plays a pivotal role in the global supply chain
                                    </p>
                                    <div className="btn-box">
                                        <Link href="contact">Contact Me <i className="icon-right-arrow21"></i></Link>
                                    </div>
                                </div>
                            </div>
                        </SwiperSlide>
                        <SwiperSlide>  
                            <div className="team-one__single">
                                <div className="team-one__single-img">
                                    <div className="inner">
                                        <img src="assets/images/team/team-v1-img2.jpg" alt=""/>
                                    </div>
                                </div>

                                <div className="team-one__single-content">
                                    <ul className="social-links">
                                        <li><Link href="#"><span className="icon-linkedin"></span></Link></li>
                                        <li><Link href="#"><span className="icon-twitter1"></span></Link></li>
                                        <li><Link href="#"><span className="icon-instagram"></span></Link></li>
                                        <li><Link href="#"><span className="icon-facebook-f"></span></Link></li>
                                    </ul>
                                    <span>FOUNDER</span>
                                    <h2><Link href="team-details">Jane Cooper</Link></h2>
                                    <p>Logistic service provider company plays a pivotal role in the global supply chain
                                    </p>
                                    <div className="btn-box">
                                        <Link href="contact">Contact Me <i className="icon-right-arrow21"></i></Link>
                                    </div>
                                </div>
                            </div>                       
                        </SwiperSlide>
                        <SwiperSlide>
                            <div className="team-one__single">
                                <div className="team-one__single-img">
                                    <div className="inner">
                                        <img src="assets/images/team/team-v1-img3.jpg" alt=""/>
                                    </div>
                                </div>

                                <div className="team-one__single-content">
                                    <ul className="social-links">
                                        <li><Link href="#"><span className="icon-linkedin"></span></Link></li>
                                        <li><Link href="#"><span className="icon-twitter1"></span></Link></li>
                                        <li><Link href="#"><span className="icon-instagram"></span></Link></li>
                                        <li><Link href="#"><span className="icon-facebook-f"></span></Link></li>
                                    </ul>
                                    <span>FOUNDER</span>
                                    <h2><Link href="team-details">Marvin McKinney</Link></h2>
                                    <p>Logistic service provider company plays a pivotal role in the global supply chain
                                    </p>
                                    <div className="btn-box">
                                        <Link href="contact">Contact Me <i className="icon-right-arrow21"></i></Link>
                                    </div>
                                </div>
                            </div>
                        </SwiperSlide>
                        <SwiperSlide>
                            <div className="team-one__single">
                                <div className="team-one__single-img">
                                    <div className="inner">
                                        <img src="assets/images/team/team-v1-img1.jpg" alt=""/>
                                    </div>
                                </div>

                                <div className="team-one__single-content">
                                    <ul className="social-links">
                                        <li><Link href="#"><span className="icon-linkedin"></span></Link></li>
                                        <li><Link href="#"><span className="icon-twitter1"></span></Link></li>
                                        <li><Link href="#"><span className="icon-instagram"></span></Link></li>
                                        <li><Link href="#"><span className="icon-facebook-f"></span></Link></li>
                                    </ul>
                                    <span>FOUNDER</span>
                                    <h2><Link href="team-details">Courtney Henry</Link></h2>
                                    <p>Logistic service provider company plays a pivotal role in the global supply chain
                                    </p>
                                    <div className="btn-box">
                                        <Link href="contact">Contact Me <i className="icon-right-arrow21"></i></Link>
                                    </div>
                                </div>
                            </div>
                        </SwiperSlide>
                        <SwiperSlide>  
                            <div className="team-one__single">
                                <div className="team-one__single-img">
                                    <div className="inner">
                                        <img src="assets/images/team/team-v1-img2.jpg" alt=""/>
                                    </div>
                                </div>

                                <div className="team-one__single-content">
                                    <ul className="social-links">
                                        <li><Link href="#"><span className="icon-linkedin"></span></Link></li>
                                        <li><Link href="#"><span className="icon-twitter1"></span></Link></li>
                                        <li><Link href="#"><span className="icon-instagram"></span></Link></li>
                                        <li><Link href="#"><span className="icon-facebook-f"></span></Link></li>
                                    </ul>
                                    <span>FOUNDER</span>
                                    <h2><Link href="team-details">Jane Cooper</Link></h2>
                                    <p>Logistic service provider company plays a pivotal role in the global supply chain
                                    </p>
                                    <div className="btn-box">
                                        <Link href="contact">Contact Me <i className="icon-right-arrow21"></i></Link>
                                    </div>
                                </div>
                            </div>                       
                        </SwiperSlide>
                        <SwiperSlide>
                            <div className="team-one__single">
                                <div className="team-one__single-img">
                                    <div className="inner">
                                        <img src="assets/images/team/team-v1-img3.jpg" alt=""/>
                                    </div>
                                </div>

                                <div className="team-one__single-content">
                                    <ul className="social-links">
                                        <li><Link href="#"><span className="icon-linkedin"></span></Link></li>
                                        <li><Link href="#"><span className="icon-twitter1"></span></Link></li>
                                        <li><Link href="#"><span className="icon-instagram"></span></Link></li>
                                        <li><Link href="#"><span className="icon-facebook-f"></span></Link></li>
                                    </ul>
                                    <span>FOUNDER</span>
                                    <h2><Link href="team-details">Marvin McKinney</Link></h2>
                                    <p>Logistic service provider company plays a pivotal role in the global supply chain
                                    </p>
                                    <div className="btn-box">
                                        <Link href="contact">Contact Me <i className="icon-right-arrow21"></i></Link>
                                    </div>
                                </div>
                            </div>
                        </SwiperSlide>
                    </Swiper>
                </div>
            </div>
        </section>
        
            
        </>
    )
}
