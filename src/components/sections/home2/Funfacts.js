'use client'
import CounterUp from "@/components/elements/CounterUp"
export default function Funfacts() {
    return (
        <>

        <section className="counter-one counter-one--two">
            <div className="big-title wow slideInRight" data-wow-delay="100ms" data-wow-duration="2500ms">
                <h2>ZED AI ACADEMY</h2>
            </div>
            <div className="container clearfix">
                <div className="counter-one--two__inner">
                    <ul>
                        {/*Start Counter Two Single*/}
                        <li className="counter-one__single wow fadeInLeft" data-wow-delay="0ms" data-wow-duration="1500ms">
                            <div className="counter-one__single-inner">
                                <div className="content-box">
                                    <div className="count-text-box count-box">
                                    <h3> <CounterUp end={20} /></h3>
                                        <span className="plus">+</span>
                                    </div>
                                    <div className="text-box">
                                        <p>Courses Published</p>
                                    </div>
                                </div>
                            </div>
                        </li>
                        {/*End Counter Two Single*/}

                        {/*Start Counter Two Single*/}
                        <li className="counter-one__single wow fadeInRight" data-wow-delay="0ms" data-wow-duration="1500ms">
                            <div className="counter-one__single-inner">
                                <div className="content-box">
                                    <div className="count-text-box count-box">
                                        <h3> <CounterUp end={500} /></h3>
                                        <span className="plus">+</span>
                                    </div>
                                    <div className="text-box">
                                        <p>Learners Enrolled</p>
                                    </div>
                                </div>
                            </div>
                        </li>
                        {/*End Counter Two Single*/}

                        {/*Start Counter Two Single*/}
                        <li className="counter-one__single wow fadeInLeft" data-wow-delay="0ms" data-wow-duration="1500ms">
                            <div className="counter-one__single-inner">
                                <div className="content-box">
                                    <div className="count-text-box count-box">
                                        <h3> <CounterUp end={30} /></h3>
                                        <span className="plus">+</span>
                                    </div>
                                    <div className="text-box">
                                        <p>Companies Trained</p>
                                    </div>
                                </div>
                            </div>
                        </li>
                        {/*End Counter Two Single*/}
                    </ul>
                </div>
            </div>
        </section>

        </>
    )
}
