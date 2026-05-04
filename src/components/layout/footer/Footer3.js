import Link from "next/link"

export default function Footer3() {
    return (
        <>
       
        {/*Start Footer Two*/}
        <footer className="footer-one footer-one--two">
            <div className="footer-one__pattern">
                <img src="assets/images/pattern/footer-v1-pattern.png" alt="#"/>
            </div>
            <div className="shape3 float-bob-y">
                <img src="assets/images/shapes/footer-v2-shape3.png" alt=""/>
            </div>
            <div className="footer-one__top">
                <div className="container">

                    <div className="footer-one--two__cta">
                        <div className="shape1">
                            <img className="float-bob-x3" src="assets/images/shapes/footer-v2-shape2.png" alt=""/>
                        </div>
                        <div className="shape2">
                            <img className="float-bob-y" src="assets/images/shapes/footer-v2-shape1.png" alt=""/>
                        </div>
                        <div className="footer-one--two__cta-inner">
                            <div className="text-box">
                                <h2>Efficient, Safe, & Swift Logistics Solution!</h2>
                            </div>

                            <div className="btn-box">
                                <Link className="thm-btn" href="contact">Contact with Us
                                    <i className="icon-right-arrow21"></i>
                                    <span className="hover-btn hover-bx"></span>
                                    <span className="hover-btn hover-bx2"></span>
                                    <span className="hover-btn hover-bx3"></span>
                                    <span className="hover-btn hover-bx4"></span>
                                </Link>
                            </div>
                        </div>
                    </div>

                    <div className="footer-one__top-inner">
                        <div className="row">
                            <div className="col-xl-3 col-lg-6 col-md-6 wow fadeInUp" data-wow-delay="100ms">
                                <div className="footer-widget__single footer-one__about">
                                    <div className="footer-one__about-logo">
                                        <Link href="/"><img src="assets/images/resources/footer-logo.png"
                                                alt=""/></Link>
                                    </div>
                                    <p className="footer-one__about-text">Logistic service provider company plays a
                                        pivotal role in the global supply chain logistic service provider.</p>

                                    <div className="footer-one__about-contact-info">
                                        <div className="icon">
                                            <span className="icon-support"></span>
                                        </div>

                                        <div className="text-box">
                                            <p>Make a Call</p>
                                            <h4><Link href="tel:+1234567890">+880 123 456 789</Link></h4>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="col-xl-3 col-lg-6 col-md-6 wow fadeInUp" data-wow-delay="200ms">
                                <div className="footer-widget__single footer-one__quick-links">
                                    <div className="title">
                                        <h2>Quick Links <span className="icon-plane3"></span></h2>
                                    </div>

                                    <ul className="footer-one__quick-links-list">
                                        <li><Link href="/"><span className="icon-right-arrow1"></span> Home</Link></li>
                                        <li><Link href="about"><span className="icon-right-arrow1"></span> About Us</Link>
                                        </li>
                                        <li><Link href="service"><span className="icon-right-arrow1"></span> Service</Link>
                                        </li>
                                        <li><Link href="project"><span className="icon-right-arrow1"></span> Latest
                                                Project</Link></li>
                                        <li><Link href="contact"><span className="icon-right-arrow1"></span> Contact
                                                Us</Link></li>
                                    </ul>
                                </div>
                            </div>

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
                                                    <p>3060 Commercial Street Road <br/> Fratton, Australia</p>
                                                </div>
                                            </li>

                                            <li>
                                                <div className="icon">
                                                    <span className="icon-email"></span>
                                                </div>
                                                <div className="text-box">
                                                    <p><Link href="mailto:yourmail@email.com">support@logistra.com</Link></p>
                                                    <p><Link href="mailto:yourmail@email.com">info@logistra.com</Link></p>
                                                </div>
                                            </li>

                                            <li>
                                                <div className="icon">
                                                    <span className="icon-phone"></span>
                                                </div>
                                                <div className="text-box">
                                                    <p><Link href="tel:1234567890">+880 123 456 789 </Link></p>
                                                </div>
                                            </li>
                                        </ul>
                                    </div>
                                </div>
                            </div>

                            <div className="col-xl-3 col-lg-6 col-md-6 wow fadeInUp" data-wow-delay="400ms">
                                <div className="footer-widget__single footer-one__subscribe">
                                    <div className="title">
                                        <h2>Subscribe Us <span className="icon-plane3"></span></h2>
                                    </div>

                                    <p className="footer-one__subscribe-text">Sign up for alerts, our latest blogs, <br/>
                                        thoughts, and insights</p>

                                    <div className="footer-one__subscribe-form">
                                        <form className="subscribe-form" action="#">
                                            <input type="email" name="email" placeholder="Your E-mail" />
                                            <button type="submit" className="thm-btn">Subcribe
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
                            <p>© Copyright 2024 <Link href="/">Logistiq.</Link> All Rights Reserved</p>
                        </div>

                        <div className="footer-one__social-links">
                            <ul>
                                <li>
                                    <Link href="#"><span className="icon-facebook-f"></span></Link>
                                </li>

                                <li>
                                    <Link href="#"><span className="icon-instagram"></span></Link>
                                </li>

                                <li>
                                    <Link href="#"><span className="icon-twitter1"></span></Link>
                                </li>
                                <li>
                                    <Link href="#"><span className="icon-linkedin"></span></Link>
                                </li>
                            </ul>
                        </div>
                    </div>
                </div>
            </div>
        </footer>
        {/*End Footer Two*/}
      


        </>
    )
}
