import Link from "next/link"


export default function Pricing() {
    return (
        <>
        <section className="pricing-one">
            <div className="pricing-one__pattern"
                style={{ backgroundImage: 'url(assets/images/pattern/pricing-v1-pattern.png)' }} ></div>
            <div className="container">
                <div className="sec-title center text-center tg-heading-subheading animation-style2">
                    <div className="sec-title__tagline">
                        <div className="line"></div>
                        <div className="text tg-element-title">
                            <h4>OUR PRICING PLAN</h4>
                        </div>
                        <div className="icon">
                            <span className="icon-plane2 float-bob-x3"></span>
                        </div>
                    </div>
                    <h2 className="sec-title__title tg-element-title">Our Effective and Affordable <br/>
                        Pricing <span>Plans</span></h2>
                </div>

                <div className="row">

                    {/*Start Pricing One Single*/}
                    <div className="col-xl-4 col-lg-4 wow fadeInUp" data-wow-delay=".3s">
                        <div className="pricing-one__single">
                            <div className="pricing-one__single-inner">
                                <div className="table-header">
                                    <div className="img-box">
                                        <img src="assets/images/resources/pricing-v1-img1.jpg" alt=""/>
                                    </div>
                                    <div className="title-box">
                                        <h2>Road Cargo</h2>
                                        <h3>$99 <span>/50kg</span></h3>
                                    </div>
                                </div>

                                <div className="table-content">
                                    <ul>
                                        <li>
                                            <div className="icon">
                                                <span className="fa fa-check-circle"></span>
                                            </div>

                                            <div className="text-box">
                                                <p>Pickup and delivery</p>
                                            </div>
                                        </li>

                                        <li>
                                            <div className="icon">
                                                <span className="fa fa-check-circle"></span>
                                            </div>

                                            <div className="text-box">
                                                <p>Custom coverage</p>
                                            </div>
                                        </li>

                                        <li>
                                            <div className="icon">
                                                <span className="fa fa-check-circle"></span>
                                            </div>

                                            <div className="text-box">
                                                <p>Customer Management</p>
                                            </div>
                                        </li>

                                        <li>
                                            <div className="icon">
                                                <span className="fa fa-check-circle"></span>
                                            </div>

                                            <div className="text-box">
                                                <p>Deliver in 2-3 days</p>
                                            </div>
                                        </li>

                                        <li>
                                            <div className="icon">
                                                <span className="fa fa-check-circle"></span>
                                            </div>

                                            <div className="text-box">
                                                <p>24 Hours Support</p>
                                            </div>
                                        </li>
                                    </ul>
                                </div>

                                <div className="table-footer">
                                    <div className="btn-box">
                                        <Link className="thm-btn" href="#">Choose Plan
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
                    {/*End Pricing One Single*/}

                    {/*Start Pricing One Single*/}
                    <div className="col-xl-4 col-lg-4 wow fadeInDown" data-wow-delay=".3s">
                        <div className="pricing-one__single">
                            <div className="pricing-one__single-inner">
                                <div className="table-header">
                                    <div className="img-box">
                                        <img src="assets/images/resources/pricing-v1-img2.jpg" alt=""/>
                                    </div>
                                    <div className="title-box">
                                        <h2>Sea Freight</h2>
                                        <h3>$199 <span>/50kg</span></h3>
                                    </div>
                                </div>

                                <div className="table-content">
                                    <ul>
                                        <li>
                                            <div className="icon">
                                                <span className="fa fa-check-circle"></span>
                                            </div>

                                            <div className="text-box">
                                                <p>Pickup and delivery</p>
                                            </div>
                                        </li>

                                        <li>
                                            <div className="icon">
                                                <span className="fa fa-check-circle"></span>
                                            </div>

                                            <div className="text-box">
                                                <p>Custom coverage</p>
                                            </div>
                                        </li>

                                        <li>
                                            <div className="icon">
                                                <span className="fa fa-check-circle"></span>
                                            </div>

                                            <div className="text-box">
                                                <p>Customer Management</p>
                                            </div>
                                        </li>

                                        <li>
                                            <div className="icon">
                                                <span className="fa fa-check-circle"></span>
                                            </div>

                                            <div className="text-box">
                                                <p>Deliver in 2-3 days</p>
                                            </div>
                                        </li>

                                        <li>
                                            <div className="icon">
                                                <span className="fa fa-check-circle"></span>
                                            </div>

                                            <div className="text-box">
                                                <p>24 Hours Support</p>
                                            </div>
                                        </li>
                                    </ul>
                                </div>

                                <div className="table-footer">
                                    <div className="btn-box">
                                        <Link className="thm-btn" href="#">Choose Plan
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
                    {/*End Pricing One Single*/}

                    {/*Start Pricing One Single*/}
                    <div className="col-xl-4 col-lg-4 wow fadeInUp" data-wow-delay=".3s">
                        <div className="pricing-one__single">
                            <div className="pricing-one__single-inner">
                                <div className="table-header">
                                    <div className="img-box">
                                        <img src="assets/images/resources/pricing-v1-img3.jpg" alt=""/>
                                    </div>
                                    <div className="title-box">
                                        <h2>Ship Cargo</h2>
                                        <h3>$250 <span>/100kg</span></h3>
                                    </div>
                                </div>

                                <div className="table-content">
                                    <ul>
                                        <li>
                                            <div className="icon">
                                                <span className="fa fa-check-circle"></span>
                                            </div>

                                            <div className="text-box">
                                                <p>Pickup and delivery</p>
                                            </div>
                                        </li>

                                        <li>
                                            <div className="icon">
                                                <span className="fa fa-check-circle"></span>
                                            </div>

                                            <div className="text-box">
                                                <p>Custom coverage</p>
                                            </div>
                                        </li>

                                        <li>
                                            <div className="icon">
                                                <span className="fa fa-check-circle"></span>
                                            </div>

                                            <div className="text-box">
                                                <p>Customer Management</p>
                                            </div>
                                        </li>

                                        <li>
                                            <div className="icon">
                                                <span className="fa fa-check-circle"></span>
                                            </div>

                                            <div className="text-box">
                                                <p>Deliver in 2-3 days</p>
                                            </div>
                                        </li>

                                        <li>
                                            <div className="icon">
                                                <span className="fa fa-check-circle"></span>
                                            </div>

                                            <div className="text-box">
                                                <p>24 Hours Support</p>
                                            </div>
                                        </li>
                                    </ul>
                                </div>

                                <div className="table-footer">
                                    <div className="btn-box">
                                        <Link className="thm-btn" href="#">Choose Plan
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
                    {/*End Pricing One Single*/}
                </div>
            </div>
        </section>
        </>
    )
}
