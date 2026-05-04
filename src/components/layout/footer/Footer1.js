import Link from "next/link"

export default function Footer1() {
    return (
        <>
        {/*Start Footer One*/}
        <footer className="footer-one">
            <div className="footer-one__pattern">
                <img src="/assets/images/pattern/footer-v1-pattern.png" alt="" />
            </div>

            <div className="footer-one__top">
                <div className="container">
                    <div className="footer-one__top-inner">
                        <div className="row">

                            {/* About / Brand */}
                            <div className="col-xl-3 col-lg-6 col-md-6 wow fadeInUp" data-wow-delay="100ms">
                                <div className="footer-widget__single footer-one__about">
                                    <div className="footer-one__about-logo">
                                        <Link href="/">
                                            <img src="/images/zed-ai-logo.png" alt="Zed AI Academy" />
                                        </Link>
                                    </div>
                                    <p className="footer-one__about-text">
                                        Zambia&apos;s leading platform for practical AI training — built for professionals
                                        who want applied skills, not theory.
                                    </p>
                                    <div className="footer-one__about-contact-info">
                                        <div className="icon">
                                            <span className="icon-support"></span>
                                        </div>
                                        <div className="text-box">
                                            <p>Talk to Admissions</p>
                                            <h4><Link href="tel:+260979046745">0979 046 745</Link></h4>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Quick Links */}
                            <div className="col-xl-3 col-lg-6 col-md-6 wow fadeInUp" data-wow-delay="200ms">
                                <div className="footer-widget__single footer-one__quick-links">
                                    <div className="title">
                                        <h2>Quick Links <span className="icon-plane3"></span></h2>
                                    </div>
                                    <ul className="footer-one__quick-links-list">
                                        <li><Link href="/"><span className="icon-right-arrow1"></span> Home</Link></li>
                                        <li><Link href="/courses"><span className="icon-right-arrow1"></span> Browse Courses</Link></li>
                                        <li><Link href="/pricing"><span className="icon-right-arrow1"></span> Pricing</Link></li>
                                        <li><Link href="/pricing#teams"><span className="icon-right-arrow1"></span> Team Plans</Link></li>
                                        <li><Link href="/about"><span className="icon-right-arrow1"></span> About Us</Link></li>
                                        <li><Link href="/blog"><span className="icon-right-arrow1"></span> Blog</Link></li>
                                        <li><Link href="/faq"><span className="icon-right-arrow1"></span> FAQ</Link></li>
                                        <li><Link href="/contact"><span className="icon-right-arrow1"></span> Contact</Link></li>
                                    </ul>
                                </div>
                            </div>

                            {/* Contact Info */}
                            <div className="col-xl-3 col-lg-6 col-md-6 wow fadeInUp" data-wow-delay="300ms">
                                <div className="footer-widget__single footer-one__contact">
                                    <div className="title">
                                        <h2>Get In Touch <span className="icon-plane3"></span></h2>
                                    </div>
                                    <div className="footer-one__contact-box">
                                        <ul>
                                            <li>
                                                <div className="icon">
                                                    <span className="icon-address"></span>
                                                </div>
                                                <div className="text-box">
                                                    <p>Lusaka, Zambia 🇿🇲<br />Zambia-first AI learning</p>
                                                </div>
                                            </li>
                                            <li>
                                                <div className="icon">
                                                    <span className="icon-email"></span>
                                                </div>
                                                <div className="text-box">
                                                    <p><Link href="mailto:creativesites263@gmail.com">creativesites263@gmail.com</Link></p>
                                                    <p><Link href="mailto:teams@zedaiacademy.com">teams@zedaiacademy.com</Link></p>
                                                </div>
                                            </li>
                                            <li>
                                                <div className="icon">
                                                    <span className="icon-phone"></span>
                                                </div>
                                                <div className="text-box">
                                                    <p><Link href="tel:+260979046745">0979 046 745</Link></p>
                                                </div>
                                            </li>
                                        </ul>
                                    </div>
                                </div>
                            </div>

                            {/* Newsletter */}
                            <div className="col-xl-3 col-lg-6 col-md-6 wow fadeInUp" data-wow-delay="400ms">
                                <div className="footer-widget__single footer-one__subscribe">
                                    <div className="title">
                                        <h2>Stay Updated <span className="icon-plane3"></span></h2>
                                    </div>
                                    <p className="footer-one__subscribe-text">
                                        Get new course launches, AI workflow tips,<br />
                                        and Zambia tech news in your inbox.
                                    </p>
                                    <div className="footer-one__subscribe-form">
                                        <form className="subscribe-form" action="#">
                                            <input type="email" name="email" placeholder="Your Email Address" />
                                            <button type="submit" className="thm-btn">
                                                Subscribe
                                                <i className="icon-right-arrow21"></i>
                                                <span className="hover-btn hover-bx"></span>
                                                <span className="hover-btn hover-bx2"></span>
                                                <span className="hover-btn hover-bx3"></span>
                                                <span className="hover-btn hover-bx4"></span>
                                            </button>
                                        </form>
                                    </div>
                                </div>
                            </div>

                        </div>
                    </div>
                </div>
            </div>

            <div className="footer-one__bottom">
                <div className="container">
                    <div className="footer-one__bottom-inner">
                        <div className="footer-one__bottom-text">
                            <p>© Copyright 2026 <Link href="/">Zed AI Academy.</Link> All Rights Reserved.</p>
                        </div>
                        <div className="footer-one__social-links">
                            <ul>
                                <li><Link href="#"><span className="icon-twitter1"></span></Link></li>
                                <li><Link href="#"><span className="icon-linkedin"></span></Link></li>
                                <li><Link href="#"><span className="icon-instagram"></span></Link></li>
                                <li><Link href="#"><span className="icon-youtube"></span></Link></li>
                            </ul>
                        </div>
                    </div>
                </div>
            </div>
        </footer>
        {/*End Footer One*/}
        </>
    )
}
