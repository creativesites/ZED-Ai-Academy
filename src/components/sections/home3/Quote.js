'use client'
import { useState } from "react"
export default function Quote() {
    const [activeIndex, setActiveIndex] = useState(1)
    const handleOnClick = (index) => {
        setActiveIndex(index)
    }
    return (
        <>

        <section className="quote-one">
            <div className="quote-one__bg" style={{ backgroundImage: 'url(assets/images/backgrounds/quote-v1-bg4.jpg)' }} ></div>
            <div className="container">
                <div className="row">
                    <div className="col-lg-12">
                        <div className="sec-title center text-center tg-heading-subheading animation-style2">
                            <div className="sec-title__tagline">
                                <div className="line"></div>
                                <div className="text tg-element-title">
                                    <h4>Shipping</h4>
                                </div>
                                <div className="icon">
                                    <span className="icon-plane2 float-bob-x3"></span>
                                </div>
                            </div>
                            <h2 className="sec-title__title tg-element-title">Request For A <span>Qoute</span></h2>
                        </div>

                        <div className="quote-tab wow fadeInUp" data-wow-delay="100ms">

                            <div className="quote-tab__button">
                                <ul className="tabs-button-box clearfix">
                                    <li className={activeIndex == 1 ? "tab-btn-item active-btn-item" : "tab-btn-item"} onClick={() => handleOnClick(1)}>
                                        <div className="quote-tab__button-inner">
                                            <h3>Request A Quote</h3>
                                        </div>
                                    </li>
                                    <li className={activeIndex == 2 ? "tab-btn-item active-btn-item" : "tab-btn-item"} onClick={() => handleOnClick(2)}>
                                        <div className="quote-tab__button-inner">
                                            <h3>Track & Trace</h3>
                                        </div>
                                    </li>
                                </ul>
                            </div>

                            {/*Start Tabs Content Box*/}
                            <div className="tabs-content-box">
                                {/*Start Tab*/}
                                <div className={activeIndex == 1 ? "tab-content-box-item fadeInUp animated show tab-content-box-item-active" : "tab-content-box-item fadeInUp animated"}>
                                    <div className="quote-tab-content-box-item">
                                        <div className="tab-content-box-item-img"
                                            style={{ backgroundImage: 'url(assets/images/backgrounds/quote-v1-bg2.jpg)' }} >
                                        </div>
                                        <div className="quotes-wrapper">
                                            <div className="quotes-wrapper-inner">
                                                <div className="title-box">
                                                    <h2>Shipment Point</h2>
                                                </div>

                                                <div className="quotes-weight">
                                                    <form className="contact-form-validated quote-one__form">

                                                        <div className="row">
                                                            <div className="col-xl-4 col-lg-4 col-md-4">
                                                                <div className="input-box">
                                                                    <label>Name</label>
                                                                    <input type="text" name="name"
                                                                        placeholder="Enter Name" />
                                                                </div>
                                                            </div>
                                                            <div className="col-xl-4 col-lg-4 col-md-4">
                                                                <div className="input-box">
                                                                    <label>Email Name</label>
                                                                    <input type="email" name="email"
                                                                        placeholder="Email address"/></div>
                                                            </div>
                                                            <div className="col-xl-4 col-lg-4 col-md-4">
                                                                <div className="input-box">
                                                                    <label>Phone Number</label>
                                                                    <input type="text" name="phone"
                                                                        placeholder="Mobile Num" />
                                                                </div>
                                                            </div>
                                                        </div>

                                                        <div className="row">
                                                            <div className="col-xl-4 col-lg-4 col-md-4">
                                                                <div className="input-box">
                                                                    <label>Freight</label>
                                                                    <div className="select-box">
                                                                        <select className="selectmenu wide">
                                                                            <option>Freight Type
                                                                            </option>
                                                                            <option>Freight Type 01</option>
                                                                            <option>Freight Type 02</option>
                                                                            <option>Freight Type 03</option>
                                                                            <option>Freight Type 04</option>
                                                                        </select>
                                                                    </div>
                                                                </div>
                                                            </div>

                                                            <div className="col-xl-4 col-lg-4 col-md-4">
                                                                <div className="input-box">
                                                                    <label>Weight</label>
                                                                    <input type="text" name="weight"
                                                                        placeholder="Weight" />
                                                                </div>
                                                            </div>
                                                            <div className="col-xl-4 col-lg-4 col-md-4">
                                                                <div className="input-box">
                                                                    <label>Lenght</label>
                                                                    <input type="number" name="lenght"
                                                                        placeholder="Lenght" />
                                                                </div>
                                                            </div>
                                                        </div>

                                                        <div className="row">
                                                            <div className="col-xl-12">
                                                                <div className="quote-redio-box">
                                                                    <div className="quote-redio">
                                                                        <label className="custom-rario">
                                                                            <input type="radio" name="myRadios" />
                                                                            <span className="radio-dot"></span>
                                                                            <span className="radio-text">Express
                                                                                Delivery</span>
                                                                        </label>
                                                                        <label className="custom-rario">
                                                                            <input type="radio" name="myRadios" />
                                                                            <span className="radio-dot"></span>
                                                                            <span className="radio-text">Insurance</span>
                                                                        </label>
                                                                        <label className="custom-rario">
                                                                            <input type="radio" name="myRadios" />
                                                                            <span className="radio-dot"></span>
                                                                            <span className="radio-text">Packaging</span>
                                                                        </label>
                                                                        <label className="custom-rario">
                                                                            <input type="radio" name="myRadios" />
                                                                            <span className="radio-dot"></span>
                                                                            <span className="radio-text">Incoterms</span>
                                                                        </label>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </div>

                                                        <div className="row">
                                                            <div className="col-xl-12">
                                                                <div className="quote-two__btn">
                                                                    <button type="submit" className="thm-btn">
                                                                        Request For A Quote
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
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                {/*End Tab*/}

                                {/*Start Tab*/}
                                <div className={activeIndex == 2 ? "tab-content-box-item fadeInUp animated show tab-content-box-item-active" : "tab-content-box-item fadeInUp animated"}>
                                    <div className="quote-tab-content-box-item">
                                        <div className="tab-content-box-item-img"
                                            style={{ backgroundImage: 'url(assets/images/backgrounds/quote-v1-bg.jpg)' }} >
                                        </div>
                                        <div className="quotes-wrapper">
                                            <div className="quotes-wrapper-inner">
                                                <div className="title-box">
                                                    <h2>Shipment Point</h2>
                                                </div>

                                                <div className="quotes-weight">
                                                    <form className="contact-form-validated quote-one__form">

                                                        <div className="row">
                                                            <div className="col-xl-4 col-lg-4 col-md-4">
                                                                <div className="input-box">
                                                                    <label>Name</label>
                                                                    <input type="text" name="name"
                                                                        placeholder="Enter Name" />
                                                                </div>
                                                            </div>
                                                            <div className="col-xl-4 col-lg-4 col-md-4">
                                                                <div className="input-box">
                                                                    <label>Email Name</label>
                                                                    <input type="email" name="email"
                                                                        placeholder="Email address"/></div>
                                                            </div>
                                                            <div className="col-xl-4 col-lg-4 col-md-4">
                                                                <div className="input-box">
                                                                    <label>Phone Number</label>
                                                                    <input type="text" name="phone"
                                                                        placeholder="Mobile Num" />
                                                                </div>
                                                            </div>
                                                        </div>

                                                        <div className="row">
                                                            <div className="col-xl-4 col-lg-4 col-md-4">
                                                                <div className="input-box">
                                                                    <label>Freight</label>
                                                                    <div className="select-box">
                                                                        <select className="selectmenu wide">
                                                                            <option>Freight Type
                                                                            </option>
                                                                            <option>Freight Type 01</option>
                                                                            <option>Freight Type 02</option>
                                                                            <option>Freight Type 03</option>
                                                                            <option>Freight Type 04</option>
                                                                        </select>
                                                                    </div>
                                                                </div>
                                                            </div>

                                                            <div className="col-xl-4 col-lg-4 col-md-4">
                                                                <div className="input-box">
                                                                    <label>Weight</label>
                                                                    <input type="text" name="weight"
                                                                        placeholder="Weight" />
                                                                </div>
                                                            </div>
                                                            <div className="col-xl-4 col-lg-4 col-md-4">
                                                                <div className="input-box">
                                                                    <label>Lenght</label>
                                                                    <input type="number" name="lenght"
                                                                        placeholder="Lenght" />
                                                                </div>
                                                            </div>
                                                        </div>

                                                        <div className="row">
                                                            <div className="col-xl-12">
                                                                <div className="quote-redio-box">
                                                                    <div className="quote-redio">
                                                                        <label className="custom-rario">
                                                                            <input type="radio" name="myRadios" />
                                                                            <span className="radio-dot"></span>
                                                                            <span className="radio-text">Express
                                                                                Delivery</span>
                                                                        </label>
                                                                        <label className="custom-rario">
                                                                            <input type="radio" name="myRadios" />
                                                                            <span className="radio-dot"></span>
                                                                            <span className="radio-text">Insurance</span>
                                                                        </label>
                                                                        <label className="custom-rario">
                                                                            <input type="radio" name="myRadios" />
                                                                            <span className="radio-dot"></span>
                                                                            <span className="radio-text">Packaging</span>
                                                                        </label>
                                                                        <label className="custom-rario">
                                                                            <input type="radio" name="myRadios" />
                                                                            <span className="radio-dot"></span>
                                                                            <span className="radio-text">Incoterms</span>
                                                                        </label>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </div>

                                                        <div className="row">
                                                            <div className="col-xl-12">
                                                                <div className="quote-two__btn">
                                                                    <button type="submit" className="thm-btn">
                                                                        Request For A Quote
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
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                {/*End Tab*/}
                            </div>
                            {/*End Tabs Content Box*/}
                        </div>
                    </div>
                </div>
            </div>
        </section>
        </>
    )
}
