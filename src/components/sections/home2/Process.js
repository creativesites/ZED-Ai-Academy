'use client'
import Link from "next/link"

export default function Process() {

    return (
        <>

        {/*Start Working Process One*/}
        <section className="working-process-one">
            <div className="working-process-one__pattern"
                style={{ backgroundImage: 'url(assets/images/pattern/working-process-v1-pattern.jpg)' }} ></div>
            <div className="container">
                <div className="shape1"><img src="assets/images/shapes/working-process-v1-shape1.png" alt=""/></div>
                <div className="sec-title center text-center tg-heading-subheading animation-style2">
                    <div className="sec-title__tagline">
                        <div className="line"></div>
                        <div className="text tg-element-title">
                            <h4>How It Works</h4>
                        </div>
                        <div className="icon">
                            <span className="icon-plane2 float-bob-x3"></span>
                        </div>
                    </div>
                    <h2 className="sec-title__title tg-element-title">Start Learning AI <br/>
                        in <span>4 Steps</span></h2>
                </div>

                <div className="row">
                    {/*Start Working Process One Single*/}
                    <div className="col-xl-3 col-lg-6 col-md-6 wow fadeInLeft" data-wow-delay="0ms"
                        data-wow-duration="1500ms">
                        <div className="working-process-one__single">
                            <div className="icon">
                                <div className="count-box">01</div>
                                <span className="icon-quote"></span>
                            </div>

                            <div className="content-box">
                                <h2><Link href="/register">Create Account</Link></h2>
                                <p>Sign up free in under <br/>
                                    60 seconds — no card needed</p>
                            </div>
                            <div className="plane-icon">
                                <span className="icon-plane"></span>
                            </div>
                        </div>
                    </div>
                    {/*End Working Process One Single*/}

                    {/*Start Working Process One Single*/}
                    <div className="col-xl-3 col-lg-6 col-md-6 wow fadeInRight" data-wow-delay="0ms"
                        data-wow-duration="1500ms">
                        <div className="working-process-one__single">
                            <div className="icon">
                                <div className="count-box">02</div>
                                <span className="icon-protection"></span>
                            </div>

                            <div className="content-box">
                                <h2><Link href="/courses">Choose Your Course</Link></h2>
                                <p>Pick from our library of <br/>
                                    practical AI courses</p>
                            </div>
                            <div className="plane-icon">
                                <span className="icon-plane"></span>
                            </div>
                        </div>
                    </div>
                    {/*End Working Process One Single*/}

                    {/*Start Working Process One Single*/}
                    <div className="col-xl-3 col-lg-6 col-md-6 wow fadeInLeft" data-wow-delay="0ms"
                        data-wow-duration="1500ms">
                        <div className="working-process-one__single">
                            <div className="icon">
                                <div className="count-box">03</div>
                                <span className="icon-service"></span>
                            </div>

                            <div className="content-box">
                                <h2><Link href="/courses">Learn at Your Pace</Link></h2>
                                <p>Watch lessons, complete quizzes <br/>
                                    and apply what you learn</p>
                            </div>
                            <div className="plane-icon">
                                <span className="icon-plane"></span>
                            </div>
                        </div>
                    </div>
                    {/*End Working Process One Single*/}

                    {/*Start Working Process One Single*/}
                    <div className="col-xl-3 col-lg-6 col-md-6 wow fadeInRight" data-wow-delay="0ms"
                        data-wow-duration="1500ms">
                        <div className="working-process-one__single">
                            <div className="icon">
                                <div className="count-box">04</div>
                                <span className="icon-new-product"></span>
                            </div>

                            <div className="content-box">
                                <h2><Link href="/courses">Earn Your Certificate</Link></h2>
                                <p>Complete the course and get <br/>
                                    a verified digital certificate</p>
                            </div>
                        </div>
                    </div>
                    {/*End Working Process One Single*/}
                </div>
            </div>
        </section>
        {/*End Working Process One*/}

        </>
    )
}
