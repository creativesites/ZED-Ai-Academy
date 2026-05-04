
'use client'
import Link from "next/link"
import { Autoplay, Navigation, Pagination } from "swiper/modules"
import { Swiper, SwiperSlide } from "swiper/react"
import { useState } from 'react'

const swiperOptions = {
    modules: [Autoplay, Pagination, Navigation],
    slidesPerView: 1,
    spaceBetween: 0,
    
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



}


export default function Banner() {
    return (
        <>
            <section className="banner-one">
                <div className="banner-one__pattern"
                    style={{ backgroundImage: 'url(assets/images/pattern/banner-v1-pattern.png)' }} ></div>
                <div className="banner-one__pattern2"><img src="assets/images/pattern/banner-v1-pattern2.png" alt="#"/></div>

                <div className="banner-one__img1"><img className="float-bob-x" src="assets/images/banner/banner-v1-img1.png"
                        alt="#"/></div>
                <div className="banner-one__img5"><img className="float-bob-y" src="assets/images/banner/banner-v1-img5.png"
                        alt="#"/></div>
                <div className="shape1 rotate-me"><img src="assets/images/shapes/banner-v1-shape1.png" alt="#"/></div>
                <div className="container">
                    <div className="banner-one__location clearfix">

                        {/* Start Banner One Location single */}
                        <div className="banner-one__location-single style1">
                            <div className="round-box">
                                <div className="bdr"></div>
                            </div>
                            <div className="content-box">
                                <div className="img-box">
                                    <img src="assets/images/banner/banner-v1-flag1.png" alt=""/>
                                </div>
                                <div className="text-box">
                                    <h4>London</h4>
                                    <p>Logistic service <br/> provider </p>
                                </div>
                            </div>
                        </div>
                        {/* Start Banner One Location single */}

                        {/* Start Banner One Location single */}
                        <div className="banner-one__location-single style2">
                            <div className="round-box">
                                <div className="bdr"></div>
                            </div>
                            <div className="content-box">
                                <div className="img-box">
                                    <img src="assets/images/banner/banner-v1-flag1.png" alt=""/>
                                </div>
                                <div className="text-box">
                                    <h4>Alexander City</h4>
                                    <p>Logistic service <br/> provider </p>
                                </div>
                            </div>
                        </div>
                        {/*End Banner One Location single */}

                        {/* Start Banner One Location single */}
                        <div className="banner-one__location-single style3">
                            <div className="round-box">
                                <div className="bdr"></div>
                            </div>
                            <div className="content-box">
                                <div className="img-box">
                                    <img src="assets/images/banner/banner-v1-flag1.png" alt=""/>
                                </div>
                                <div className="text-box">
                                    <h4>Birmingham</h4>
                                    <p>Logistic service <br/> provider </p>
                                </div>
                            </div>
                        </div>
                        {/* End Banner One Location single */}

                        {/* Start Banner One Location single */}
                        <div className="banner-one__location-single style4">
                            <div className="round-box">
                                <div className="bdr"></div>
                            </div>
                            <div className="content-box">
                                <div className="img-box">
                                    <img src="assets/images/banner/banner-v1-flag1.png" alt=""/>
                                </div>
                                <div className="text-box">
                                    <h4>Guntersville</h4>
                                    <p>Logistic service <br/> provider </p>
                                </div>
                            </div>
                        </div>
                        {/* End Banner One Location single */}

                        {/* Start Banner One Location single */}
                        <div className="banner-one__location-single style5">
                            <div className="round-box">
                                <div className="bdr"></div>
                            </div>
                            <div className="content-box">
                                <div className="img-box">
                                    <img src="assets/images/banner/banner-v1-flag1.png" alt=""/>
                                </div>
                                <div className="text-box">
                                    <h4>Montgomery</h4>
                                    <p>Logistic service <br/> provider </p>
                                </div>
                            </div>
                        </div>
                        {/* End Banner One Location single */}

                        {/* Start Banner One Location single */}
                        <div className="banner-one__location-single style6">
                            <div className="round-box">
                                <div className="bdr"></div>
                            </div>

                            <div className="content-box">
                                <div className="img-box">
                                    <img src="assets/images/banner/banner-v1-flag1.png" alt=""/>
                                </div>
                                <div className="text-box">
                                    <h4>California</h4>
                                    <p>Logistic service <br/> provider </p>
                                </div>
                            </div>
                        </div>
                        {/* End Banner One Location single */}

                        {/* Start Banner One Location single */}
                        <div className="banner-one__location-single style7">
                            <div className="round-box">
                                <div className="bdr"></div>
                            </div>
                            <div className="content-box">
                                <div className="img-box">
                                    <img src="assets/images/banner/banner-v1-flag1.png" alt=""/>
                                </div>
                                <div className="text-box">
                                    <h4>Colorado</h4>
                                    <p>Logistic service <br/> provider </p>
                                </div>
                            </div>
                        </div>
                        {/* End Banner One Location single */}

                        {/* Start Banner One Location single */}
                        <div className="banner-one__location-single style8">
                            <div className="round-box">
                                <div className="bdr"></div>
                            </div>
                            <div className="content-box">
                                <div className="img-box">
                                    <img src="assets/images/banner/banner-v1-flag1.png" alt=""/>
                                </div>
                                <div className="text-box">
                                    <h4>Berlin</h4>
                                    <p>Logistic service <br/> provider </p>
                                </div>
                            </div>
                        </div>
                    </div>
                    {/* End Banner One Location single */}

                    <div className="banner-one__content">
                        <div className="banner-one__content-left wow fadeInLeft" data-wow-delay="0ms"
                            data-wow-duration="1500ms">
                            <h2>Modern Logistic <br/>
                                <span>Transport</span></h2>
                            <p>Specialist In Modern <br/> Transportation </p>
                        </div>

                        <div className="banner-one__content-right wow fadeInRight" data-wow-delay="0ms"
                            data-wow-duration="1500ms">
                            <div className="banner-one__content-right-text">
                                <p>Logistic service provider company plays a pivotal role <br/>
                                    in the global supply chain ecosystem managing.</p>
                            </div>

                            <div className="banner-one__content-right-middle">
                                <ul className="clearfix">
                                    <li>
                                        <div className="img-box"><img src="assets/images/banner/banner-v1-img2.jpg" alt="#"/>
                                        </div>
                                    </li>
                                    <li>
                                        <div className="img-box"><img src="assets/images/banner/banner-v1-img3.jpg" alt="#"/>
                                        </div>
                                    </li>
                                    <li>
                                        <div className="img-box"><img src="assets/images/banner/banner-v1-img4.jpg" alt="#"/>
                                        </div>
                                    </li>
                                </ul>

                                <div className="text-box">
                                    <h2>Customer Satisfied</h2>
                                    <p>4.8 (15k Reviews)</p>
                                </div>
                            </div>

                            <div className="banner-one__content-right-btn">
                                <Link className="thm-btn" href="about">About Us
                                    <i className="icon-right-arrow21"></i>
                                    <span className="hover-btn hover-bx"></span>
                                    <span className="hover-btn hover-bx2"></span>
                                    <span className="hover-btn hover-bx3"></span>
                                    <span className="hover-btn hover-bx4"></span>
                                </Link>
                            </div>
                        </div>
                    </div>
                </div>
            </section>
        
        </>
    )
}
