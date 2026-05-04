'use client'
import Link from "next/link"
import { Autoplay, Navigation, Pagination } from "swiper/modules"
import { Swiper, SwiperSlide } from "swiper/react"


const swiperOptions = {
    modules: [Autoplay, Pagination, Navigation],
    slidesPerView: 6,
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
            slidesPerView: 3,
            
        },
        767: {
            slidesPerView: 4,
            
        },
        991: {
            slidesPerView: 5,
            
        },
        1199: {
            slidesPerView: 6,
            
        },
        1350: {
            slidesPerView: 6,
            
        },
    }
}
export default function Brands() {
    return (
        <>
        <section className="brand-one">
            <div className="container">
                <div className="">
                    <Swiper {...swiperOptions} className="brand-one__carousel owl-carousel owl-theme">
                        <SwiperSlide>
                            <div className="brand-one__single">
                                <div className="brand-one__single-inner">
                                    <Link href="#"><img src="assets/images/brand/brand-v1-img1.png" alt=""/></Link>
                                </div>
                            </div>
                        </SwiperSlide>
                        <SwiperSlide>
                            <div className="brand-one__single">
                                <div className="brand-one__single-inner">
                                    <Link href="#"><img src="assets/images/brand/brand-v1-img2.png" alt=""/></Link>
                                </div>
                            </div>                         
                        </SwiperSlide>
                        <SwiperSlide>
                            <div className="brand-one__single">
                                <div className="brand-one__single-inner">
                                    <Link href="#"><img src="assets/images/brand/brand-v1-img3.png" alt=""/></Link>
                                </div>
                            </div>                         
                        </SwiperSlide>
                        <SwiperSlide>
                            <div className="brand-one__single">
                                <div className="brand-one__single-inner">
                                    <Link href="#"><img src="assets/images/brand/brand-v1-img4.png" alt=""/></Link>
                                </div>
                            </div>                         
                        </SwiperSlide>
                        <SwiperSlide>
                            <div className="brand-one__single">
                                <div className="brand-one__single-inner">
                                    <Link href="#"><img src="assets/images/brand/brand-v1-img5.png" alt=""/></Link>
                                </div>
                            </div>                         
                        </SwiperSlide>
                        <SwiperSlide>
                            <div className="brand-one__single">
                                <div className="brand-one__single-inner">
                                    <Link href="#"><img src="assets/images/brand/brand-v1-img6.png" alt=""/></Link>
                                </div>
                            </div>                         
                        </SwiperSlide>
                        <SwiperSlide>
                            <div className="brand-one__single">
                                <div className="brand-one__single-inner">
                                    <Link href="#"><img src="assets/images/brand/brand-v1-img1.png" alt=""/></Link>
                                </div>
                            </div>
                        </SwiperSlide>
                        <SwiperSlide>
                            <div className="brand-one__single">
                                <div className="brand-one__single-inner">
                                    <Link href="#"><img src="assets/images/brand/brand-v1-img2.png" alt=""/></Link>
                                </div>
                            </div>                         
                        </SwiperSlide>
                        <SwiperSlide>
                            <div className="brand-one__single">
                                <div className="brand-one__single-inner">
                                    <Link href="#"><img src="assets/images/brand/brand-v1-img3.png" alt=""/></Link>
                                </div>
                            </div>                         
                        </SwiperSlide>
                        <SwiperSlide>
                            <div className="brand-one__single">
                                <div className="brand-one__single-inner">
                                    <Link href="#"><img src="assets/images/brand/brand-v1-img4.png" alt=""/></Link>
                                </div>
                            </div>                         
                        </SwiperSlide>
                        <SwiperSlide>
                            <div className="brand-one__single">
                                <div className="brand-one__single-inner">
                                    <Link href="#"><img src="assets/images/brand/brand-v1-img5.png" alt=""/></Link>
                                </div>
                            </div>                         
                        </SwiperSlide>
                        <SwiperSlide>
                            <div className="brand-one__single">
                                <div className="brand-one__single-inner">
                                    <Link href="#"><img src="assets/images/brand/brand-v1-img6.png" alt=""/></Link>
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
