import Link from "next/link"

export default function WhyChooseUs() {
    return (
        <>
       
       <section className="why-choose-one">
            <div className="why-choose-one__pattern">
                <img src="assets/images/pattern/why-choose-v1-pattern.png" alt=""/>
            </div>
            <div className="shape1 float-bob-y"><img src="assets/images/shapes/why-choose-v1-shape1.png" alt=""/></div>
            <div className="container">
                <div className="row">
                    {/*Start Why Choose One Content*/}
                    <div className="col-xl-6">
                        <div className="why-choose-one__content">
                            <div className="sec-title tg-heading-subheading animation-style2">
                                <div className="sec-title__tagline">
                                    <div className="line"></div>
                                    <div className="text tg-element-title">
                                        <h4>Why Choose us</h4>
                                    </div>
                                    <div className="icon">
                                        <span className="icon-plane2 float-bob-x3"></span>
                                    </div>
                                </div>
                                <h2 className="sec-title__title tg-element-title">Efficient, Safe, & Swift <br/> Logistics
                                    <span>Solution!</span></h2>
                            </div>

                            <div className="why-choose-one__content-list">
                                <ul>
                                    <li>
                                        <p><span className="icon-plane2"></span> Make long term business decisions</p>
                                    </li>
                                    <li>
                                        <p><span className="icon-plane2"></span> Transparent career journey and support.</p>
                                    </li>
                                    <li>
                                        <p><span className="icon-plane2"></span> Be a responsible member of the community
                                        </p>
                                    </li>
                                    <li>
                                        <p><span className="icon-plane2"></span> Provide a service we are proud of</p>
                                    </li>
                                </ul>
                            </div>

                            <div className="btn-box">
                                <Link className="thm-btn" href="contact">Contact Us
                                    <i className="icon-right-arrow21"></i>
                                    <span className="hover-btn hover-bx"></span>
                                    <span className="hover-btn hover-bx2"></span>
                                    <span className="hover-btn hover-bx3"></span>
                                    <span className="hover-btn hover-bx4"></span>
                                </Link>
                            </div>
                        </div>
                    </div>
                    {/*End Why Choose One Content*/}

                    {/*Start Why Choose One Form*/}
                    <div className="col-xl-6">
                        <div className="why-choose-one__form-box wow fadeInRight" data-wow-delay="0ms"
                            data-wow-duration="1500ms">
                            <div className="title-box">
                                <h2>Request a Quote</h2>
                            </div>

                            <form className="contact-form-validated why-choose-one__form" action="assets/inc/sendemail.php"
                                method="post" >
                                <div className="row">
                                    <div className="col-xl-6 col-lg-6 col-md-6">
                                        <div className="input-box">
                                            <input type="text" name="name" placeholder="Name" required=""/>
                                            <div className="icon"><span className="icon-user"></span></div>
                                        </div>
                                    </div>
                                    <div className="col-xl-6 col-lg-6 col-md-6">
                                        <div className="input-box">
                                            <input type="email" name="email" placeholder="Email" required=""/>
                                            <div className="icon"><span className="icon-email"></span></div>
                                        </div>
                                    </div>

                                    <div className="col-xl-6 col-lg-6 col-md-6">
                                        <div className="input-box">
                                            <input type="text" name="Phone" placeholder="Phone" required=""/>
                                            <div className="icon"><span className="icon-phone2"></span></div>
                                        </div>
                                    </div>
                                    <div className="col-xl-6 col-lg-6 col-md-6">
                                        <div className="input-box">
                                            <input type="text" name="date" placeholder="Date" id="datepicker" />
                                            <div className="icon"><span className="icon-calendar"></span></div>
                                        </div>
                                    </div>


                                    <div className="col-xl-12">
                                        <div className="why-choose-one__form-distance">
                                            <div className="title">
                                                <p>distance(Kilo):</p>
                                            </div>
                                            <div className="why-choose-one__form-distance-inner">
                                                <div className="input-box">
                                                    <input type="text" name="distance" placeholder="0" required=""/>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="col-xl-6 col-lg-6 col-md-6">
                                        <div className="input-box">
                                            <div className="select-box">
                                                <select className="selectmenu wide">
                                                    <option >Freight Type</option>
                                                    <option>Freight Type 01</option>
                                                    <option>Freight Type 02</option>
                                                    <option>Freight Type 03</option>
                                                    <option>Freight Type 04</option>
                                                    <option>Freight Type 05</option>
                                                </select>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="col-xl-6 col-lg-6 col-md-6">
                                        <div className="input-box">
                                            <div className="select-box">
                                                <select className="selectmenu wide">
                                                    <option >Load</option>
                                                    <option>Freight Type 01</option>
                                                    <option>Freight Type 02</option>
                                                    <option>Freight Type 03</option>
                                                    <option>Freight Type 04</option>
                                                    <option>Freight Type 05</option>
                                                </select>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="col-xl-12">
                                        <div className="why-choose-one__form-btn">
                                            <button type="submit" className="thm-btn">
                                                Contact Us
                                                <i className="icon-right-arrow21"></i>
                                                <span className="hover-btn hover-bx"></span>
                                                <span className="hover-btn hover-bx2"></span>
                                                <span className="hover-btn hover-bx3"></span>
                                                <span className="hover-btn hover-bx4"></span>
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </form>
                            <div className="result"></div>
                        </div>
                    </div>
                    {/*End Why Choose One Form*/}
                </div>
            </div>
        </section>
           
        </>
    )
}
