import Link from "next/link"
export default function Blog() {
    return (
        <>
          
        <section className="blog-three">
            <div className="container">
                <div className="sec-title center text-center tg-heading-subheading animation-style2">
                    <div className="sec-title__tagline">
                        <div className="line"></div>
                        <div className="text tg-element-title">
                            <h4>Latest Blogs</h4>
                        </div>
                        <div className="icon">
                            <span className="icon-plane2 float-bob-x3"></span>
                        </div>
                    </div>
                    <h2 className="sec-title__title tg-element-title">Latest Blogs & <span>News</span></h2>
                </div>

                <div className="row">
                    {/*Start Blog Two Single*/}
                    <div className="col-xl-4 col-lg-4 wow fadeInUp" data-wow-delay="00ms">
                        <div className="blog-three__single">
                            <div className="blog-three__single-img">
                                <div className="inner">
                                    <img src="assets/images/blog/blog-v3-img1.jpg" alt=""/>
                                    <img src="assets/images/blog/blog-v3-img1.jpg" alt=""/>
                                </div>
                            </div>

                            <div className="blog-three__single-content">
                                <ul className="meta-box">
                                    <li><i className="icon-user"></i> Admin</li>
                                    <li className="bg2"><i className="icon-clock"></i> 20 Jan 2024
                                    </li>
                                </ul>

                                <h2><Link href="blog-details">What is the Future of Truckload <br/> Transportation?</Link>
                                </h2>
                                <p>Phosfluorecent synergize holistic leadership skills before effective technology.</p>

                                <div className="btn-box">
                                    <Link className="thm-btn" href="blog-details">Read More
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
                    {/*End Blog Two Single*/}

                    {/*Start Blog Two Single*/}
                    <div className="col-xl-4 col-lg-4 wow fadeInUp" data-wow-delay="200ms">
                        <div className="blog-three__single">
                            <div className="blog-three__single-img">
                                <div className="inner">
                                    <img src="assets/images/blog/blog-v3-img2.jpg" alt=""/>
                                    <img src="assets/images/blog/blog-v3-img2.jpg" alt=""/>
                                </div>
                            </div>

                            <div className="blog-three__single-content">
                                <ul className="meta-box">
                                    <li><i className="icon-user"></i> Admin</li>
                                    <li className="bg2"><i className="icon-clock"></i> 20 Jan 2024
                                    </li>
                                </ul>

                                <h2><Link href="blog-details">Cargo Follow Through the <br/> Best Supply Your Metal</Link>
                                </h2>
                                <p>Phosfluorecent synergize holistic leadership skills before effective technology.</p>

                                <div className="btn-box">
                                    <Link className="thm-btn" href="blog-details">Read More
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
                    {/*End Blog Two Single*/}

                    {/*Start Blog Two Single*/}
                    <div className="col-xl-4 col-lg-4 wow fadeInUp" data-wow-delay="400ms">
                        <div className="blog-three__single">
                            <div className="blog-three__single-img">
                                <div className="inner">
                                    <img src="assets/images/blog/blog-v3-img3.jpg" alt=""/>
                                    <img src="assets/images/blog/blog-v3-img3.jpg" alt=""/>
                                </div>
                            </div>

                            <div className="blog-three__single-content">
                                <ul className="meta-box">
                                    <li><i className="icon-user"></i> Admin</li>
                                    <li className="bg2"><i className="icon-clock"></i> 20 Jan 2024
                                    </li>
                                </ul>

                                <h2><Link href="blog-details">Fast and Reliable Shipping <br/> Guaranteey Trusted</Link>
                                </h2>
                                <p>Phosfluorecent synergize holistic leadership skills before effective technology.</p>

                                <div className="btn-box">
                                    <Link className="thm-btn" href="blog-details">Read More
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
                    {/*End Blog Two Single*/}
                </div>
            </div>
        </section>
        
        </>
    )
}
