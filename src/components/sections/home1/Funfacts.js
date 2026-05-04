'use client'
import CounterUp from "@/components/elements/CounterUp"
export default function Funfacts() {
    return (
        <>

        <section className="counter-one">
            <div className="container">
                <div className="row">
                    {/*Start Counter One Single*/}
                    <div className="col-xl-4 col-lg-4 wow fadeInLeft" data-wow-delay="0ms" data-wow-duration="1500ms">
                        <div className="counter-one__single">
                            <div className="counter-one__single-inner">
                                <div className="icon">
                                    <span className="icon-box"></span>
                                </div>

                                <div className="content-box">
                                    <div className="count-text-box count-box">
                                        <h3> <CounterUp end={54} /></h3>
                                        <span className="plus">+</span>
                                    </div>
                                    <div className="text-box">
                                        <p>Distribution Center</p>
                                    </div>
                                </div>
                            </div>
                            <div className="shape1"></div>
                        </div>
                    </div>
                    {/*End Counter One Single*/}

                    {/*Start Counter One Single*/}
                    <div className="col-xl-4 col-lg-4 wow fadeInRight" data-wow-delay="0ms" data-wow-duration="1500ms">
                        <div className="counter-one__single">
                            <div className="counter-one__single-inner">
                                <div className="icon">
                                    <span className="icon-location"></span>
                                </div>

                                <div className="content-box">
                                    <div className="count-text-box count-box">
                                    <h3> <CounterUp end={76} /></h3>
                                        <span className="plus">+</span>
                                    </div>
                                    <div className="text-box">
                                        <p>Countries & Regions</p>
                                    </div>
                                </div>
                            </div>
                            <div className="shape1"></div>
                        </div>
                    </div>
                    {/*End Counter One Single*/}

                    {/*Start Counter One Single*/}
                    <div className="col-xl-4 col-lg-4 wow fadeInLeft" data-wow-delay="0ms" data-wow-duration="1500ms">
                        <div className="counter-one__single">
                            <div className="counter-one__single-inner">
                                <div className="icon">
                                    <span className="icon-customer-loyalty"></span>
                                </div>

                                <div className="content-box">
                                    <div className="count-text-box count-box">
                                        <h3> <CounterUp end={20} /></h3>
                                        <span className="plus">+</span>
                                    </div>
                                    <div className="text-box">
                                        <p>Years Of Expirence</p>
                                    </div>
                                </div>
                            </div>
                            <div className="shape1"></div>
                        </div>
                    </div>
                    {/*End Counter One Single*/}
                </div>
            </div>
        </section>
    
            

        </>
    )
}
