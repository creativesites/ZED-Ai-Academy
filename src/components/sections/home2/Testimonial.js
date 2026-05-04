'use client'
import Link from "next/link"
import { Autoplay, Navigation, Pagination } from "swiper/modules"
import { Swiper, SwiperSlide } from "swiper/react"


const swiperOptions = {
    modules: [Autoplay, Pagination, Navigation],
    slidesPerView: 2,
    spaceBetween: 30,
    
    loop: true,

    // Navigation
    navigation: {
        nextEl: '.srn',
        prevEl: '.srp',
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
            slidesPerView: 2,
            
        },
        1350: {
            slidesPerView: 2,
            
        },
    }



}

export default function Testimonial() {
    return (
        <>

        <section className="testimonial-two">
            <div className="container clearfix">
                <div className="row">
                    {/*Start Testimonial Two Content*/}
                    <div className="col-xl-4">
                        <div className="testimonial-two__content">
                            <div className="sec-title tg-heading-subheading animation-style2">
                                <div className="sec-title__tagline">
                                    <div className="line"></div>
                                    <div className="text tg-element-title">
                                        <h4>Client Testimonial</h4>
                                    </div>
                                    <div className="icon">
                                        <span className="icon-plane2 float-bob-x3"></span>
                                    </div>
                                </div>
                                <h2 className="sec-title__title tg-element-title">Our Customers <br/> <span>Reviews</span>
                                </h2>
                            </div>

                            <div className="testimonial-two__content-text">
                                <p>A logistic service provider company plays a pivotal role in the global supply chain A
                                    logistic service provider company.</p>
                            </div>

                            <div className="testimonial-two__content-btn">
                                <Link className="thm-btn" href="#">See All Reviews
                                    <i className="icon-right-arrow21"></i>
                                    <span className="hover-btn hover-bx"></span>
                                    <span className="hover-btn hover-bx2"></span>
                                    <span className="hover-btn hover-bx3"></span>
                                    <span className="hover-btn hover-bx4"></span>
                                </Link>
                            </div>
                        </div>
                    </div>
                    {/*End Testimonial Two Content*/}


                    {/*Start Testimonial Two Right */}
                    <div className="col-xl-8">
                        <div className="testimonial-two__right">
                            <Swiper {...swiperOptions} className="testimonial-two__carousel owl-carousel owl-theme owl-dot-style1">
                                <SwiperSlide>
                                {/*Start Testimonial Two Single*/}
                                <div className="testimonial-two__single">
                                    <div className="testimonial-two__single-inner">
                                        <div className="testimonial-two__single-top">
                                            <div className="img-box">
                                                <img src="assets/images/testimonial/testimonial-v2-img1.png" alt=""/>
                                            </div>

                                            <div className="title-box">
                                                <h2>Leslie Alexander</h2>
                                                <span>MANAGER</span>
                                            </div>
                                        </div>

                                        <div className="testimonial-two__single-text">
                                            <p>A logistic service provider company plays a pivotal role in the
                                                global
                                                supply chain A logistic service provider companyA logistic service
                                                provider.</p>
                                        </div>

                                        <div className="rating-box">
                                            <i className="icon-star"></i>
                                            <i className="icon-star"></i>
                                            <i className="icon-star"></i>
                                            <i className="icon-star"></i>
                                            <i className="icon-star"></i>
                                        </div>
                                    </div>
                                </div>
                                {/*End Testimonial Two Single*/}
                                </SwiperSlide>
                                <SwiperSlide>
                                {/*Start Testimonial Two Single*/}
                                <div className="testimonial-two__single">
                                    <div className="testimonial-two__single-inner">
                                        <div className="testimonial-two__single-top">
                                            <div className="img-box">
                                                <img src="assets/images/testimonial/testimonial-v2-img2.png" alt=""/>
                                            </div>
                                            <div className="title-box">
                                                <h2>Ronald Richards</h2>
                                                <span>MANAGER</span>
                                            </div>
                                        </div>

                                        <div className="testimonial-two__single-text">
                                            <p>A logistic service provider company plays a pivotal role in the
                                                global
                                                supply chain A logistic service provider companyA logistic service
                                                provider.</p>
                                        </div>

                                        <div className="rating-box">
                                            <i className="icon-star"></i>
                                            <i className="icon-star"></i>
                                            <i className="icon-star"></i>
                                            <i className="icon-star"></i>
                                            <i className="icon-star"></i>
                                        </div>
                                    </div>
                                </div>
                                {/*End Testimonial Two Single*/}
                                </SwiperSlide>
                                <SwiperSlide>
                                {/*Start Testimonial Two Single*/}
                                <div className="testimonial-two__single">
                                    <div className="testimonial-two__single-inner">
                                        <div className="testimonial-two__single-top">
                                            <div className="img-box">
                                                <img src="assets/images/testimonial/testimonial-v2-img1.png" alt=""/>
                                            </div>

                                            <div className="title-box">
                                                <h2>Leslie Alexander</h2>
                                                <span>MANAGER</span>
                                            </div>
                                        </div>

                                        <div className="testimonial-two__single-text">
                                            <p>A logistic service provider company plays a pivotal role in the
                                                global
                                                supply chain A logistic service provider companyA logistic service
                                                provider.</p>
                                        </div>

                                        <div className="rating-box">
                                            <i className="icon-star"></i>
                                            <i className="icon-star"></i>
                                            <i className="icon-star"></i>
                                            <i className="icon-star"></i>
                                            <i className="icon-star"></i>
                                        </div>
                                    </div>
                                </div>
                                {/*End Testimonial Two Single*/}
                                </SwiperSlide>
                                <SwiperSlide>
                                {/*Start Testimonial Two Single*/}
                                <div className="testimonial-two__single">
                                    <div className="testimonial-two__single-inner">
                                        <div className="testimonial-two__single-top">
                                            <div className="img-box">
                                                <img src="assets/images/testimonial/testimonial-v2-img2.png" alt=""/>
                                            </div>
                                            <div className="title-box">
                                                <h2>Ronald Richards</h2>
                                                <span>MANAGER</span>
                                            </div>
                                        </div>

                                        <div className="testimonial-two__single-text">
                                            <p>A logistic service provider company plays a pivotal role in the
                                                global
                                                supply chain A logistic service provider companyA logistic service
                                                provider.</p>
                                        </div>

                                        <div className="rating-box">
                                            <i className="icon-star"></i>
                                            <i className="icon-star"></i>
                                            <i className="icon-star"></i>
                                            <i className="icon-star"></i>
                                            <i className="icon-star"></i>
                                        </div>
                                    </div>
                                </div>
                                {/*End Testimonial Two Single*/}
                                </SwiperSlide>
                                <SwiperSlide>
                                {/*Start Testimonial Two Single*/}
                                <div className="testimonial-two__single">
                                    <div className="testimonial-two__single-inner">
                                        <div className="testimonial-two__single-top">
                                            <div className="img-box">
                                                <img src="assets/images/testimonial/testimonial-v2-img1.png" alt=""/>
                                            </div>

                                            <div className="title-box">
                                                <h2>Leslie Alexander</h2>
                                                <span>MANAGER</span>
                                            </div>
                                        </div>

                                        <div className="testimonial-two__single-text">
                                            <p>A logistic service provider company plays a pivotal role in the
                                                global
                                                supply chain A logistic service provider companyA logistic service
                                                provider.</p>
                                        </div>

                                        <div className="rating-box">
                                            <i className="icon-star"></i>
                                            <i className="icon-star"></i>
                                            <i className="icon-star"></i>
                                            <i className="icon-star"></i>
                                            <i className="icon-star"></i>
                                        </div>
                                    </div>
                                </div>
                                {/*End Testimonial Two Single*/}
                                </SwiperSlide>
                                <SwiperSlide>
                                {/*Start Testimonial Two Single*/}
                                <div className="testimonial-two__single">
                                    <div className="testimonial-two__single-inner">
                                        <div className="testimonial-two__single-top">
                                            <div className="img-box">
                                                <img src="assets/images/testimonial/testimonial-v2-img2.png" alt=""/>
                                            </div>
                                            <div className="title-box">
                                                <h2>Ronald Richards</h2>
                                                <span>MANAGER</span>
                                            </div>
                                        </div>

                                        <div className="testimonial-two__single-text">
                                            <p>A logistic service provider company plays a pivotal role in the
                                                global
                                                supply chain A logistic service provider companyA logistic service
                                                provider.</p>
                                        </div>

                                        <div className="rating-box">
                                            <i className="icon-star"></i>
                                            <i className="icon-star"></i>
                                            <i className="icon-star"></i>
                                            <i className="icon-star"></i>
                                            <i className="icon-star"></i>
                                        </div>
                                    </div>
                                </div>
                                {/*End Testimonial Two Single*/}
                                </SwiperSlide>
                            </Swiper>
                        </div>
                    </div>
                    {/*End Testimonial Two Right */}
                </div>
            </div>
        </section>
            
        </>
    )
}
