import Link from "next/link"

export default function Skills() {
    return (
        <>
        <section className="skill-one">
            <div className="container">
                <div className="row">
                    {/*Start Skill One Img*/}
                    <div className="col-xl-5">
                        <div className="skill-one__img">
                            <div className="shape1 float-bob-y"><img src="assets/images/shapes/skill-v1-shape1.png" alt=""/>
                            </div>
                            <div className="shape2 float-bob-y"><img src="assets/images/shapes/skill-v1-shape2.png" alt=""/>
                            </div>
                            <div className="skill-one__img1 wow fadeInLeft" data-wow-delay="0ms" data-wow-duration="1500ms">
                                <img src="assets/images/resources/skill-v1-img1.jpg" alt=""/>
                            </div>
                            <div className="skill-one__img2 wow fadeInRight" data-wow-delay="0ms"
                                data-wow-duration="1500ms">
                                <div className="inner">
                                    <img src="assets/images/resources/skill-v1-img2.jpg" alt=""/>
                                </div>
                            </div>
                        </div>
                    </div>
                    {/*End Skill One Img*/}

                    {/*Start Skill One Content*/}
                    <div className="col-xl-7">
                        <div className="skill-one__content">
                            <div className="sec-title tg-heading-subheading animation-style2">
                                <div className="sec-title__tagline">
                                    <div className="line"></div>
                                    <div className="text tg-element-title">
                                        <h4>Our Skills</h4>
                                    </div>
                                    <div className="icon">
                                        <span className="icon-plane2 float-bob-x3"></span>
                                    </div>
                                </div>
                                <h2 className="sec-title__title tg-element-title">Transportation Services <br/> We Are Often
                                    <span>Considered</span> </h2>
                            </div>

                            <div className="skill-one__content-text">
                                <p>A logistic service provider company plays a pivotal role in the global supply chain
                                    ecosystem by efficiently managing the movement of goods from point of origin to
                                    final destination. These companies offer a diverse range.</p>
                            </div>

                            <ul className="skill-one__progress">
                                <li>
                                    <div className="skill-one__progress-single">
                                        <div className="title-box">
                                            <p>Shipping</p>
                                        </div>

                                        <div className="bar">
                                            <div className="bar-inner count-bar" data-percent="85%" style={{ width: '85%' }}>
                                                <div className="count-text">85%</div>
                                            </div>
                                        </div>
                                    </div>
                                </li>

                                <li>
                                    <div className="skill-one__progress-single">
                                        <div className="title-box">
                                            <p>Management</p>
                                        </div>

                                        <div className="bar">
                                            <div className="bar-inner count-bar" data-percent="90%" style={{ width: '90%' }}>
                                                <div className="count-text">90%</div>
                                            </div>
                                        </div>
                                    </div>
                                </li>

                                <li>
                                    <div className="skill-one__progress-single">
                                        <div className="title-box">
                                            <p>Warehousing</p>
                                        </div>

                                        <div className="bar">
                                            <div className="bar-inner count-bar" data-percent="70%" style={{ width: '70%' }}>
                                                <div className="count-text">70%</div>
                                            </div>
                                        </div>
                                    </div>
                                </li>
                            </ul>

                            <div className="skill-one__content-btn">
                                <Link className="thm-btn" href="about">Book Your Parcel
                                    <i className="icon-right-arrow21"></i>
                                    <span className="hover-btn hover-bx"></span>
                                    <span className="hover-btn hover-bx2"></span>
                                    <span className="hover-btn hover-bx3"></span>
                                    <span className="hover-btn hover-bx4"></span>
                                </Link>
                            </div>
                        </div>
                    </div>
                    {/*End Skill One Content*/}
                </div>
            </div>
        </section>
        </>
    )
}
