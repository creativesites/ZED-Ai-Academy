import Link from "next/link"


export default function Blog() {
    return (
        <>
        <section className="blog-one">
            <div className="container">
                <div className="sec-title center text-center tg-heading-subheading animation-style2">
                    <div className="sec-title__tagline">
                        <div className="line"></div>
                        <div className="text tg-element-title">
                            <h4>Blog & News</h4>
                        </div>
                        <div className="icon">
                            <span className="icon-plane2 float-bob-x3"></span>
                        </div>
                    </div>
                    <h2 className="sec-title__title tg-element-title">Latest News Directly <br/> From Our <span>Blog</span>
                    </h2>
                </div>
                <div className="row">
                    {/*Start Blog One Single*/}
                    <div className="col-xl-4 col-lg-6 wow fadeInUp" data-wow-delay=".3s">
                        <div className="blog-one__single">
                            <div className="blog-one__single-img">
                                <img src="assets/images/blog/blog-v1-img1.jpg" alt=""/>
                            </div>

                            <div className="blog-one__single-content">
                                <div className="date-box">
                                    <h2>05</h2>
                                    <p>FEB</p>
                                </div>
                                <div className="blog-one__single-content-inner">
                                    <ul className="meta-box">
                                        <li>
                                            <div className="icon">
                                                <span className="icon-user"></span>
                                            </div>

                                            <div className="text-box">
                                                <p><Link href="#">Robert Fox</Link></p>
                                            </div>
                                        </li>

                                        <li>
                                            <div className="icon">
                                                <span className="icon-chat"></span>
                                            </div>

                                            <div className="text-box">
                                                <p><Link href="#">2 Comment</Link></p>
                                            </div>
                                        </li>
                                    </ul>

                                    <h2><Link href="blog-details">How Will You Know Success <br/> When it Show Up?</Link>
                                    </h2>
                                    <p>Logistic service provider company plays a pivotal role in the global supply chain
                                        ecosystem by efficiently... </p>

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
                    </div>
                    {/*End Blog One Single*/}

                    {/*Start Blog One Single*/}
                    <div className="col-xl-4 col-lg-6 wow fadeInDown" data-wow-delay=".3s">
                        <div className="blog-one__single">
                            <div className="blog-one__single-img">
                                <img src="assets/images/blog/blog-v1-img2.jpg" alt=""/>
                            </div>

                            <div className="blog-one__single-content">
                                <div className="date-box">
                                    <h2>05</h2>
                                    <p>FEB</p>
                                </div>
                                <div className="blog-one__single-content-inner">
                                    <ul className="meta-box">
                                        <li>
                                            <div className="icon">
                                                <span className="icon-user"></span>
                                            </div>

                                            <div className="text-box">
                                                <p><Link href="#">Robert Fox</Link></p>
                                            </div>
                                        </li>

                                        <li>
                                            <div className="icon">
                                                <span className="icon-chat"></span>
                                            </div>

                                            <div className="text-box">
                                                <p><Link href="#">2 Comment</Link></p>
                                            </div>
                                        </li>
                                    </ul>

                                    <h2><Link href="blog-details">Mastering Last Mile Delivery <br/> Strategies for
                                            Success</Link></h2>
                                    <p>Logistic service provider company plays a pivotal role in the global supply chain
                                        ecosystem by efficiently... </p>

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
                    </div>
                    {/*End Blog One Single*/}

                    {/*Start Blog One Single*/}
                    <div className="col-xl-4 col-lg-6 wow fadeInUp" data-wow-delay=".3s">
                        <div className="blog-one__single">
                            <div className="blog-one__single-img">
                                <img src="assets/images/blog/blog-v1-img3.jpg" alt=""/>
                            </div>

                            <div className="blog-one__single-content">
                                <div className="date-box">
                                    <h2>05</h2>
                                    <p>FEB</p>
                                </div>
                                <div className="blog-one__single-content-inner">
                                    <ul className="meta-box">
                                        <li>
                                            <div className="icon">
                                                <span className="icon-user"></span>
                                            </div>

                                            <div className="text-box">
                                                <p><Link href="#">Robert Fox</Link></p>
                                            </div>
                                        </li>

                                        <li>
                                            <div className="icon">
                                                <span className="icon-chat"></span>
                                            </div>

                                            <div className="text-box">
                                                <p><Link href="#">2 Comment</Link></p>
                                            </div>
                                        </li>
                                    </ul>

                                    <h2><Link href="blog-details">Logistics Announces Launch <br/> of Greenhouse
                                            Gas</Link></h2>
                                    <p>Logistic service provider company plays a pivotal role in the global supply chain
                                        ecosystem by efficiently... </p>

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
                    </div>
                    {/*End Blog One Single*/}
                </div>
            </div>
        </section>
        </>
    )
}
