'use client'
import { useState } from 'react'
import CounterUp from "@/components/elements/CounterUp"
import VideoModal from '@/components/shared/video-modal'
export default function WhyChooseUs() {
    const [isOpen, setOpen] = useState(false)
    return (
        <>

       <section className="why-choose-two">
            <div className="why-choose-two__bg"
                style={{ backgroundImage: 'url(images/ali.jpg)' }} >
                <div className="shape3 float-bob-x"><img src="assets/images/shapes/why-choose-v2-shape3.png" alt=""/></div>
                {/* <div className="why-choose-two__video-box">
                    <a onClick={() => setOpen(true)} className="video-popup">
                        <div className="why-choose-two__video-box-icon">
                            <span className="icon-video"></span>
                            <i className="ripple"></i>
                        </div>
                    </a>
                </div> */}
            </div>
            <div className="shape1"><img src="assets/images/shapes/why-choose-v2-shape1.png" alt=""/></div>
            <div className="container">
                <div className="why-choose-two__content">
                    <div className="sec-title tg-heading-subheading animation-style2">
                        <div className="sec-title__tagline">
                            <div className="line"></div>
                            <div className="text tg-element-title">
                                <h4>Why Choose Us</h4>
                            </div>
                            <div className="icon">
                                <span className="icon-plane2 float-bob-x3"></span>
                            </div>
                        </div>
                        <h2 className="sec-title__title tg-element-title">The AI Academy Built <br/> For
                            <span>Zambia</span>
                        </h2>
                    </div>

                    <div className="why-choose-two__content-text">
                        <p>Every course on Zed AI Academy is designed with the Zambian professional in mind —
                            practical, affordable, and focused on the tools that are transforming work right now.</p>
                    </div>

                    <div className="why-choose-two__content-bottom">
                        <div className="shape2 float-bob-x"><img src="assets/images/shapes/why-choose-v2-shape2.png" alt=""/>
                        </div>
                        <div className="client-box">
                            <ul>
                                <li>
                                    <div className="img-box">
                                        <img src="images/istockphoto-1644128335-612x612-1.jpg" alt=""/>
                                    </div>
                                </li>
                                <li>
                                    <div className="img-box">
                                        <img src="images/beauty-charisma-head-shot-portrait-600nw-2647728057.webp" alt=""/>
                                    </div>
                                </li>
                                <li>
                                    <div className="img-box">
                                        <img src="images/photo-1522529599102-193c0d76b5b6.avif" alt=""/>
                                    </div>
                                </li>
                                <li>
                                    <div className="img-box">
                                        <img src="images/9b2879c1af82d24e1ad2336583952385.jpeg" alt=""/>
                                    </div>
                                </li>
                            </ul>

                            <div className="count-text-box count-box">
                                <h3><CounterUp end={50} /></h3>
                                <span className="plus">+</span>
                            </div>
                            <h3>Happy Learners</h3>
                        </div>

                        <div className="why-choose-two__content-bottom-content wow fadeInRight" data-wow-delay="0ms"
                            data-wow-duration="1500ms">
                            <div className="why-choose-two__pattern2"
                                style={{ backgroundImage: 'url(assets/images/pattern/why-choose-v2-pattern2.png)' }} ></div>
                            <ul>
                                <li className="why-choose-two__single">
                                    <div className="why-choose-two__single-top">
                                        <div className="icon">
                                            <span className="icon-international-shipping"></span>
                                        </div>

                                        <div className="title">
                                            <h4>Zambia-First <br/>
                                                Curriculum</h4>
                                        </div>
                                    </div>
                                    <div className="text-box">
                                        <p>Content designed for the Zambian <br/> market and business context
                                        </p>
                                    </div>
                                </li>

                                <li className="why-choose-two__single">
                                    <div className="why-choose-two__single-top">
                                        <div className="icon">
                                            <span className="icon-protection"></span>
                                        </div>

                                        <div className="title">
                                            <h4>Practical, Not <br/>
                                                Theory</h4>
                                        </div>
                                    </div>
                                    <div className="text-box">
                                        <p>Every lesson teaches you something <br/> you can use that same day
                                        </p>
                                    </div>
                                </li>
                            </ul>

                            <ul>
                                <li className="why-choose-two__single">
                                    <div className="why-choose-two__single-top">
                                        <div className="icon">
                                            <span className="icon-professional-services"></span>
                                        </div>

                                        <div className="title">
                                            <h4>Expert AI <br/> Instructors</h4>
                                        </div>
                                    </div>
                                    <div className="text-box">
                                        <p>Learn from practitioners who use <br/> these tools in real work daily
                                        </p>
                                    </div>
                                </li>

                                <li className="why-choose-two__single">
                                    <div className="why-choose-two__single-top">
                                        <div className="icon">
                                            <span className="icon-tracking"></span>
                                        </div>

                                        <div className="title">
                                            <h4>Verified <br/>
                                                Certificates</h4>
                                        </div>
                                    </div>
                                    <div className="text-box">
                                        <p>Earn a certificate when you complete <br/> any course on the platform
                                        </p>
                                    </div>
                                </li>
                            </ul>
                        </div>
                    </div>
                </div>
            </div>
        </section>
        <VideoModal isOpen={isOpen} onClose={() => setOpen(false)} videoId="Get7rqXYrbQ" />
        </>
    )
}
