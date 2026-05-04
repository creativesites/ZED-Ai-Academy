'use client'
import Link from "next/link"
import { Autoplay, Navigation, Pagination } from "swiper/modules"
import { Swiper, SwiperSlide } from "swiper/react"


const swiperOptions = {
    modules: [Autoplay, Pagination, Navigation],
    slidesPerView: 5,
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
            slidesPerView: 2,
            
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

export default function Services() {
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
                            <h4>Our Service</h4>
                        </div>
                        <div className="icon">
                            <span className="icon-plane2 float-bob-x3"></span>
                        </div>
                    </div>
                    <h2 className="sec-title__title tg-element-title">Provide Efficient Logistics
                        <br/> Solutions <span>Business</span></h2>
                </div>

                <div className="row">
                    <Swiper {...swiperOptions} className="service-one__carousel owl-carousel owl-theme owl-dot-style1">
                        <SwiperSlide>
                        {/*Start Service One Single*/}
                        <div className="service-one__single">
                            <div className="service-one__single-inner">
                                <div className="service-one__single-img">
                                    <img src="assets/images/services/services-v1-img1.jpg" alt="#"/>
                                </div>

                                <div className="service-one__single-content">
                                    <h2><Link href="international-transport">Fast Personal Delivery </Link></h2>
                                    <p>A logistic service provider company plays
                                        a pivotal role in the global supply chain logistic service.</p>
                                    <div className="btn-box">
                                        <Link href="international-transport">Read More <span
                                                className="icon-right-arrow21"></span></Link>
                                    </div>
                                </div>
                            </div>

                            <div className="icon">
                                <span className="icon-delivery-man"></span>
                            </div>
                        </div>
                        {/*End Service One Single*/}
                        </SwiperSlide>
                        <SwiperSlide>
                        {/*Start Service One Single*/}
                        <div className="service-one__single">
                            <div className="service-one__single-inner">
                                <div className="service-one__single-img">
                                    <img src="assets/images/services/services-v1-img2.jpg" alt="#"/>
                                </div>

                                <div className="service-one__single-content">
                                    <h2><Link href="international-transport">Local Truck Transport</Link></h2>
                                    <p>A logistic service provider company plays
                                        a pivotal role in the global supply chain logistic service.</p>
                                    <div className="btn-box">
                                        <Link href="international-transport">Read More <span
                                                className="icon-right-arrow21"></span></Link>
                                    </div>
                                </div>
                            </div>

                            <div className="icon">
                                <span className="icon-shipment"></span>
                            </div>
                        </div>
                        {/*End Service One Single*/}
                        </SwiperSlide>
                        <SwiperSlide>
                        {/*Start Service One Single*/}
                        <div className="service-one__single">
                            <div className="service-one__single-inner">
                                <div className="service-one__single-img">
                                    <img src="assets/images/services/services-v1-img3.jpg" alt="#"/>
                                </div>

                                <div className="service-one__single-content">
                                    <h2><Link href="international-transport">International Transport</Link></h2>
                                    <p>A logistic service provider company plays
                                        a pivotal role in the global supply chain logistic service.</p>
                                    <div className="btn-box">
                                        <Link href="international-transport">Read More <span
                                                className="icon-right-arrow21"></span></Link>
                                    </div>
                                </div>
                            </div>

                            <div className="icon">
                                <span className="icon-international-shipping"></span>
                            </div>
                        </div>
                        {/*End Service One Single*/}
                        </SwiperSlide>
                        <SwiperSlide>
                        {/*Start Service One Single*/}
                        <div className="service-one__single">
                            <div className="service-one__single-inner">
                                <div className="service-one__single-img">
                                    <img src="assets/images/services/services-v1-img1.jpg" alt="#"/>
                                </div>

                                <div className="service-one__single-content">
                                    <h2><Link href="international-transport">Fast Personal Delivery </Link></h2>
                                    <p>A logistic service provider company plays
                                        a pivotal role in the global supply chain logistic service.</p>
                                    <div className="btn-box">
                                        <Link href="international-transport">Read More <span
                                                className="icon-right-arrow21"></span></Link>
                                    </div>
                                </div>
                            </div>

                            <div className="icon">
                                <span className="icon-delivery-man"></span>
                            </div>
                        </div>
                        {/*End Service One Single*/}
                        </SwiperSlide>
                        <SwiperSlide>
                        {/*Start Service One Single*/}
                        <div className="service-one__single">
                            <div className="service-one__single-inner">
                                <div className="service-one__single-img">
                                    <img src="assets/images/services/services-v1-img2.jpg" alt="#"/>
                                </div>

                                <div className="service-one__single-content">
                                    <h2><Link href="international-transport">Local Truck Transport</Link></h2>
                                    <p>A logistic service provider company plays
                                        a pivotal role in the global supply chain logistic service.</p>
                                    <div className="btn-box">
                                        <Link href="international-transport">Read More <span
                                                className="icon-right-arrow21"></span></Link>
                                    </div>
                                </div>
                            </div>

                            <div className="icon">
                                <span className="icon-shipment"></span>
                            </div>
                        </div>
                        {/*End Service One Single*/}
                        </SwiperSlide>
                        <SwiperSlide>
                        {/*Start Service One Single*/}
                        <div className="service-one__single">
                            <div className="service-one__single-inner">
                                <div className="service-one__single-img">
                                    <img src="assets/images/services/services-v1-img3.jpg" alt="#"/>
                                </div>

                                <div className="service-one__single-content">
                                    <h2><Link href="international-transport">International Transport</Link></h2>
                                    <p>A logistic service provider company plays
                                        a pivotal role in the global supply chain logistic service.</p>
                                    <div className="btn-box">
                                        <Link href="international-transport">Read More <span
                                                className="icon-right-arrow21"></span></Link>
                                    </div>
                                </div>
                            </div>

                            <div className="icon">
                                <span className="icon-international-shipping"></span>
                            </div>
                        </div>
                        {/*End Service One Single*/}
                        </SwiperSlide>
                        <SwiperSlide>
                        {/*Start Service One Single*/}
                        <div className="service-one__single">
                            <div className="service-one__single-inner">
                                <div className="service-one__single-img">
                                    <img src="assets/images/services/services-v1-img1.jpg" alt="#"/>
                                </div>

                                <div className="service-one__single-content">
                                    <h2><Link href="international-transport">Fast Personal Delivery </Link></h2>
                                    <p>A logistic service provider company plays
                                        a pivotal role in the global supply chain logistic service.</p>
                                    <div className="btn-box">
                                        <Link href="international-transport">Read More <span
                                                className="icon-right-arrow21"></span></Link>
                                    </div>
                                </div>
                            </div>

                            <div className="icon">
                                <span className="icon-delivery-man"></span>
                            </div>
                        </div>
                        {/*End Service One Single*/}
                        </SwiperSlide>
                        <SwiperSlide>
                        {/*Start Service One Single*/}
                        <div className="service-one__single">
                            <div className="service-one__single-inner">
                                <div className="service-one__single-img">
                                    <img src="assets/images/services/services-v1-img2.jpg" alt="#"/>
                                </div>

                                <div className="service-one__single-content">
                                    <h2><Link href="international-transport">Local Truck Transport</Link></h2>
                                    <p>A logistic service provider company plays
                                        a pivotal role in the global supply chain logistic service.</p>
                                    <div className="btn-box">
                                        <Link href="international-transport">Read More <span
                                                className="icon-right-arrow21"></span></Link>
                                    </div>
                                </div>
                            </div>

                            <div className="icon">
                                <span className="icon-shipment"></span>
                            </div>
                        </div>
                        {/*End Service One Single*/}
                        </SwiperSlide>
                        <SwiperSlide>
                        {/*Start Service One Single*/}
                        <div className="service-one__single">
                            <div className="service-one__single-inner">
                                <div className="service-one__single-img">
                                    <img src="assets/images/services/services-v1-img3.jpg" alt="#"/>
                                </div>

                                <div className="service-one__single-content">
                                    <h2><Link href="international-transport">International Transport</Link></h2>
                                    <p>A logistic service provider company plays
                                        a pivotal role in the global supply chain logistic service.</p>
                                    <div className="btn-box">
                                        <Link href="international-transport">Read More <span
                                                className="icon-right-arrow21"></span></Link>
                                    </div>
                                </div>
                            </div>

                            <div className="icon">
                                <span className="icon-international-shipping"></span>
                            </div>
                        </div>
                        {/*End Service One Single*/}
                        </SwiperSlide>
                    </Swiper>
                </div>
            </div>
        </section>
       
        </>
    )
}
