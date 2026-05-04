'use client';

import { useState, useEffect } from "react";
import Link from "next/link";
import { getSiteAsset } from "@/lib/site-assets";

export default function Banner() {
    const [bannerImg, setBannerImg] = useState("https://images.unsplash.com/photo-1604933762021-54a5858c9832?w=1200&q=80&auto=format&fit=crop");

    useEffect(() => {
        getSiteAsset("banner_image", bannerImg).then(setBannerImg);
    }, []);

    return (
        <>
        <section className="banner-two">
            <div className="banner-two__img1 float-bob-y" style={{ height: '100%', top: '40px' }}>
                <div className="inner" style={{ height: '90%' }}>
                    <img src={bannerImg} alt="Professional using AI tools" style={{ height: '100%', width: '100%', objectFit: 'cover' }} />
                </div>
            </div>
            <div className="banner-two__img2 float-bob-x"><img src="assets/images/banner/banner-v2-img2.png" alt=""/></div>
            <div className="shape1 float-bob-y"><img src="assets/images/shapes/banner-v2-shape1.png" alt=""/></div>
            <div className="shape2"><img src="assets/images/shapes/banner-v2-shape2.png" alt=""/></div>
            <div className="container clearfix">
                <div className="banner-two__content">
                    <div className="banner-two__content-top wow fadeInLeft" data-wow-delay="0ms" data-wow-duration="1500ms">
                        <div className="title-box">
                            <h2>MASTER AI TOOLS <br/> <span>IN WEEKS</span></h2>
                        </div>
                    </div>

                    <div className="banner-two__content-bottom wow fadeInRight" data-wow-delay="0ms"
                        data-wow-duration="1500ms">
                        <div className="text-box">
                            <p>Practical AI courses built for Zambian professionals — learn to use ChatGPT,
                                Midjourney, Claude and more to transform how you work and create.</p>
                        </div>

                        <div className="banner-two__tab-box">
                            <div className="btn-box" style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', marginTop: '30px' }}>
                                <Link className="thm-btn" href="/courses">
                                    Browse Courses
                                    <i className="icon-right-arrow21"></i>
                                    <span className="hover-btn hover-bx"></span>
                                    <span className="hover-btn hover-bx2"></span>
                                    <span className="hover-btn hover-bx3"></span>
                                    <span className="hover-btn hover-bx4"></span>
                                </Link>
                                <Link className="thm-btn" href="/pricing" style={{ background: 'transparent', border: '2px solid currentColor' }}>
                                    View Pricing
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
            </div>
        </section>
        </>
    )
}
