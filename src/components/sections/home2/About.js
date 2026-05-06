import CounterUp from "@/components/elements/CounterUp"
import Link from "next/link"
import { Target } from "lucide-react"
import { getResolvedPageMediaSlots } from "@/lib/page-media";

export default async function About() {
    const slots = await getResolvedPageMediaSlots("home");
    const primary = slots.find((slot) => slot.slot_key === "about_primary");
    const secondary = slots.find((slot) => slot.slot_key === "about_secondary");

    return (
        <>

        <section className="about-two">
            <div className="shape5"><img src="assets/images/shapes/about-v2-shape5.png" alt=""/></div>
            <div className="container">
                <div className="row">
                    {/*Start About Two Img*/}
                    <div className="col-xl-6">
                        <div className="about-two__img">
                            <div className="shape2 float-bob-x"><img src="assets/images/shapes/about-v2-shape2.png" alt=""/>
                            </div>
                            <div className="shape3 float-bob-y"><img src="assets/images/shapes/about-v2-shape3.png" alt=""/>
                            </div>
                            <div className="shape4 float-bob-y"><img src="assets/images/shapes/about-v2-shape4.png" alt=""/>
                            </div>
                            <div className="about-two__img1">
                                <div className="inner reveal">
                                    <img src={primary?.resolved_url || "images/emmanuel-ikwuegbu-81fRHbVliQI-unsplash.jpg"} alt={primary?.resolved_alt_text || "Professional learning AI skills"}/>
                                </div>
                                <div className="about-two__counter">
                                    <div className="shape1"><img src="assets/images/shapes/about-v2-shape1.png" alt=""/>
                                    </div>
                                    <div className="count-text-box count-box">
                                    <h2> <CounterUp end={98} /></h2>
                                        <span className="plus">%</span>
                                    </div>

                                    <p>Completion <br/>
                                        Rate</p>
                                </div>
                            </div>

                            <div className="about-two__img2 reveal">
                                <img src={secondary?.resolved_url || "images/african-american-woman-working-late-night-on-laptop-picture-id1300822118.jpg"} alt={secondary?.resolved_alt_text || "Zambia professionals using AI"}/>
                            </div>
                        </div>
                    </div>
                    {/*End About Two Img*/}

                    {/*Start About Two Content*/}
                    <div className="col-xl-6">
                        <div className="about-two__content">
                            <div className="sec-title tg-heading-subheading animation-style2">
                                <div className="sec-title__tagline">
                                    <div className="line"></div>
                                    <div className="text tg-element-title">
                                        <h4>About Us</h4>
                                    </div>
                                    <div className="icon">
                                        <Target className="text-[#fd5523]" size={20} />
                                    </div>
                                </div>
                                <h2 className="sec-title__title tg-element-title">Zambia&apos;s AI Learning <br/>
                                    <span>Platform</span>
                                </h2>
                            </div>

                            <div className="about-two__content-text1">
                                <p>Zed AI Academy was founded with a single mission: to ensure Zambian 
                                    professionals aren't left behind in the global AI race. We believe 
                                    in democratizing access to world-class AI training, tailored for our local 
                                    market and economy.</p>
                            </div>

                            <div className="about-two__content-text2">
                                <div className="row">
                                    <div className="col-xl-6 col-lg-6 col-md-6">
                                        <ul className="about-two__content-text2-list">
                                            <li>
                                                <p><span className="icon-check1"></span> Practical, Hands-On Courses</p>
                                            </li>
                                            <li>
                                                <p><span className="icon-check1"></span> AI Tools You Can Use Today</p>
                                            </li>
                                        </ul>
                                    </div>

                                    <div className="col-xl-6 col-lg-6 col-md-6">
                                        <ul className="about-two__content-text2-list">
                                            <li>
                                                <p><span className="icon-check1"></span> Zambia-First Perspective</p>
                                            </li>
                                            <li>
                                                <p><span className="icon-check1"></span> Career-Ready Certificates</p>
                                            </li>
                                        </ul>
                                    </div>
                                </div>
                            </div>

                            <div className="about-two__content-bottom">
                                <div className="btn-box">
                                    <Link className="thm-btn" href="/about">Discover More
                                        <i className="icon-right-arrow21"></i>
                                        <span className="hover-btn hover-bx"></span>
                                        <span className="hover-btn hover-bx2"></span>
                                        <span className="hover-btn hover-bx3"></span>
                                        <span className="hover-btn hover-bx4"></span>
                                    </Link>
                                </div>

                                <div className="author-info">
                                    <div className="img-box">
                                        <img src="/images/zed-ai-logo.png" alt="Zed AI Academy"/>
                                    </div>
                                    <div className="text-box">
                                        <h3>Zed AI Academy</h3>
                                        <p>LUSAKA, ZAMBIA 🇿🇲</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                    {/*End About Two Content*/}
                </div>
            </div>
        </section>

        </>
    )
}
