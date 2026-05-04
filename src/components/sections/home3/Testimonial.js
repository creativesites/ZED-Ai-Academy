'use client'
import { Autoplay, Navigation, Pagination } from "swiper/modules"
import { Swiper, SwiperSlide } from "swiper/react"


const swiperOptions = {
    modules: [Autoplay, Pagination, Navigation],
    slidesPerView: 1,
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
            slidesPerView: 1,
            
        },
        991: {
            slidesPerView: 1,
            
        },
        1199: {
            slidesPerView: 1,
            
        },
        1350: {
            slidesPerView: 1,
            
        },
    }



}


export default function Testimonial() {
    return (
        <>

        <section className="testimonial-three">
            <div className="shape1 float-bob-x3"><img src="assets/images/shapes/quote-v1-shape1.png" alt=""/></div>
            <div className="container">
                <div className="sec-title center text-center tg-heading-subheading animation-style2">
                    <div className="sec-title__tagline">
                        <div className="line"></div>
                        <div className="text tg-element-title">
                            <h4>testimonials</h4>
                        </div>
                        <div className="icon">
                            <span className="icon-plane2 float-bob-x3"></span>
                        </div>
                    </div>
                    <h2 className="sec-title__title tg-element-title">What Client’s say about <br/>
                        Our <span>Services</span></h2>
                </div>

                <div className="testimonial-three__inner">
                    <div className="testimonial-three__img1 float-bob-y3">
                        <img src="assets/images/testimonial/testimonial-v3-img5.jpg" alt=""/>
                    </div>

                    <div className="testimonial-three__img2 float-bob-y3">
                        <img src="assets/images/testimonial/testimonial-v3-img7.jpg" alt=""/>
                    </div>

                    <div className="testimonial-three__img3  float-bob-x3">
                        <img src="assets/images/testimonial/testimonial-v3-img8.jpg" alt=""/>
                    </div>

                    <div className="testimonial-three__img4  float-bob-y3">
                        <img src="assets/images/testimonial/testimonial-v3-img9.jpg" alt=""/>
                    </div>

                    <div className="testimonial-three__img5  float-bob-y3">
                        <img src="assets/images/testimonial/testimonial-v3-img6.jpg" alt=""/>
                    </div>

                    <div className="testimonial-three__img6  float-bob-x3">
                        <img src="assets/images/testimonial/testimonial-v3-img4.jpg" alt=""/>
                    </div>

                    <Swiper {...swiperOptions} className="testimonial-three__carousel owl-carousel owl-theme">
                        <SwiperSlide>
                        {/*Start Testimonial Three Single*/}
                        <div className="testimonial-three__single">
                            <div className="testimonial-three__single-img">
                                <img src="assets/images/testimonial/testimonial-v3-img1.jpg" alt=""/>
                            </div>

                            <div className="testimonial-three__single-title text-center">
                                <h2>A logistic service provider company plays a pivotal role in the
                                    global supply chain A logistic service provider companyA logistic service
                                    provider.</h2>
                            </div>

                            <div className="testimonial-three__single-author text-center">
                                <h2>Leslie Alexander</h2>
                                <p>Military Man, Member for 5 Years.</p>
                            </div>

                            <div className="testimonial-three__single-rating">
                                <div className="icon">
                                    <span className="icon-star"></span>
                                </div>
                                <h4>5 out of 5</h4>
                            </div>

                        </div>
                        {/*End Testimonial Three Single*/}
                        </SwiperSlide>
                        <SwiperSlide>
                        {/*Start Testimonial Three Single*/}
                        <div className="testimonial-three__single">
                            <div className="testimonial-three__single-img">
                                <img src="assets/images/testimonial/testimonial-v3-img2.jpg" alt=""/>
                            </div>

                            <div className="testimonial-three__single-title text-center">
                                <h2>A logistic service provider company plays a pivotal role in the
                                    global supply chain A logistic service provider companyA logistic service
                                    provider.</h2>
                            </div>

                            <div className="testimonial-three__single-author text-center">
                                <h2>Leslie Alexander</h2>
                                <p>Military Man, Member for 5 Years.</p>
                            </div>

                            <div className="testimonial-three__single-rating">
                                <div className="icon">
                                    <span className="icon-star"></span>
                                </div>
                                <h4>5 out of 5</h4>
                            </div>

                        </div>
                        {/*End Testimonial Three Single*/}
                        </SwiperSlide>
                        <SwiperSlide>
                        {/*Start Testimonial Three Single*/}
                        <div className="testimonial-three__single">
                            <div className="testimonial-three__single-img">
                                <img src="assets/images/testimonial/testimonial-v3-img3.jpg" alt=""/>
                            </div>

                            <div className="testimonial-three__single-title text-center">
                                <h2>A logistic service provider company plays a pivotal role in the
                                    global supply chain A logistic service provider companyA logistic service
                                    provider.</h2>
                            </div>

                            <div className="testimonial-three__single-author text-center">
                                <h2>Leslie Alexander</h2>
                                <p>Military Man, Member for 5 Years.</p>
                            </div>

                            <div className="testimonial-three__single-rating">
                                <div className="icon">
                                    <span className="icon-star"></span>
                                </div>
                                <h4>5 out of 5</h4>
                            </div>

                        </div>
                        {/*End Testimonial Three Single*/}
                        </SwiperSlide>
                    </Swiper>


                </div>
            </div>
        </section>
        

            
        </>
    )
}
