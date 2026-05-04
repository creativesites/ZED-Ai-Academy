import Link from "next/link"


export default function Features() {
    return (
        <>
           
        <section className="features-one">
            <div className="container">
                <div className="row">
                    {/*Start Features One Single*/}
                    <div className="col-xl-4 wow fadeInLeft" data-wow-delay="0ms" data-wow-duration="1500ms">
                        <div className="features-one__single">
                            <div className="features-one__single-icon text-center">
                                <div className="icon">
                                    <span className="icon-customer-loyalty"></span>
                                </div>
                                <div className="text-box">
                                    <h2>01</h2>
                                </div>
                            </div>

                            <div className="features-one__single-content">
                                <h2><Link href="#">Premium Quality</Link></h2>
                                <p>It is a long established fact that a reader be distracted by the readable
                                    content.</p>
                            </div>
                        </div>
                    </div>
                    {/*End Features One Single*/}

                    {/*Start Features One Single*/}
                    <div className="col-xl-4 wow fadeInRight" data-wow-delay="0ms" data-wow-duration="1500ms">
                        <div className="features-one__single">
                            <div className="features-one__single-icon text-center">
                                <div className="icon">
                                    <span className="icon-quote"></span>
                                </div>
                                <div className="text-box">
                                    <h2>02</h2>
                                </div>
                            </div>

                            <div className="features-one__single-content">
                                <h2><Link href="#">License & Insurance</Link></h2>
                                <p>It is a long established fact that a reader be distracted by the readable
                                    content.</p>
                            </div>
                        </div>
                    </div>
                    {/*End Features One Single*/}

                    {/*Start Features One Single*/}
                    <div className="col-xl-4 wow fadeInLeft" data-wow-delay="0ms" data-wow-duration="1500ms">
                        <div className="features-one__single">
                            <div className="features-one__single-icon text-center">
                                <div className="icon">
                                    <span className="icon-professional-services"></span>
                                </div>
                                <div className="text-box">
                                    <h2>03</h2>
                                </div>
                            </div>

                            <div className="features-one__single-content">
                                <h2><Link href="#">Certified Expert</Link></h2>
                                <p>It is a long established fact that a reader be distracted by the readable
                                    content.</p>
                            </div>
                        </div>
                    </div>
                    {/*End Features One Single*/}
                </div>
            </div>
        </section>
       
        
        </>
    )
}
