'use client'
import Link from "next/link"
import CounterUp from "@/components/elements/CounterUp"

export default function About() {
    return (
        <>
        
        <section className="about-three">
            <div className="container">
                <div className="row">
                    {/*Start About Three Img*/}
                    <div className="col-xl-6">
                        <div className="about-three__img">
                            <div className="shape1 float-bob-x"><img src="assets/images/shapes/about-v2-shape2.png" alt=""/>
                            </div>
                            <div className="about-three__img-box">
                                <ul>
                                    <li>
                                        <div className="img-box reveal">
                                            <img src="assets/images/about/about-v3-img1.jpg" alt=""/>
                                        </div>
                                    </li>

                                    <li>
                                        <div className="about-three__experience-box">
                                            <div className="count-text-box count-box">
                                                <div className="count-number">
                                                <h3>25</h3>
                                                    <span className="plus">+</span>
                                                </div>
                                                <h4>Years of experience</h4>
                                            </div>
                                        </div>
                                        <div className="img-box reveal">
                                            <img src="assets/images/about/about-v3-img2.jpg" alt=""/>
                                        </div>


                                    </li>
                                </ul>
                            </div>
                        </div>
                    </div>
                    {/*End About Three Img*/}

                    {/*Start About Three Content*/}
                    <div className="col-xl-6">
                        <div className="about-three__content">
                            <div className="sec-title tg-heading-subheading animation-style2">
                                <div className="sec-title__tagline">
                                    <div className="line"></div>
                                    <div className="text tg-element-title">
                                        <h4>Who we are</h4>
                                    </div>
                                    <div className="icon">
                                        <span className="icon-plane2 float-bob-x3"></span>
                                    </div>
                                </div>
                                <h2 className="sec-title__title tg-element-title">Leading Global Logistic <br/>
                                    And Transport <span>Agency</span>
                                </h2>
                            </div>

                            <div className="about-three__content-text">
                                <p>Lorem Ipsum is simply dummy text of the printing and typesetting industry. Lorem
                                    Ipsum has been the industry's standard dummy text ever since the 1500s, when an
                                    unknown printer took a galley of type and scrambled.
                                </p>
                            </div>

                            <div className="about-three__content-list">
                                <ul>
                                    <li>
                                        <div className="icon">
                                            <span className="icon-global-services"></span>
                                        </div>

                                        <div className="content-box">
                                            <h2>Global Service</h2>
                                            <p>We always provide people a complete solution focused of <br/> any
                                                business.</p>
                                        </div>
                                    </li>

                                    <li>
                                        <div className="icon">
                                            <span className="icon-man"></span>
                                        </div>

                                        <div className="content-box">
                                            <h2>Local Service</h2>
                                            <p>We always provide people a complete solution focused of <br/> any
                                                business.</p>
                                        </div>
                                    </li>
                                </ul>
                            </div>

                            <div className="about-three__content-btn">
                                <Link className="thm-btn" href="#">More About Us
                                    <i className="icon-right-arrow21"></i>
                                    <span className="hover-btn hover-bx"></span>
                                    <span className="hover-btn hover-bx2"></span>
                                    <span className="hover-btn hover-bx3"></span>
                                    <span className="hover-btn hover-bx4"></span>
                                </Link>
                            </div>
                        </div>
                    </div>
                    {/*End About Three Content*/}
                </div>
            </div>
        </section>
        
        </>
    )
}
