'use client'
import { useState } from 'react'
import VideoModal from '@/components/shared/video-modal'

const faqs = [
    {
        q: "What kind of courses do you offer?",
        a: "We offer short, practical AI courses covering tools like ChatGPT, Midjourney, Claude, and more. Every course is designed to give you skills you can use immediately in your work — no technical background required.",
    },
    {
        q: "How do I access my courses after enrolling?",
        a: "Once you enrol, your course is available in your learner dashboard at any time. You can learn at your own pace, on any device, and pick up exactly where you left off.",
    },
    {
        q: "Do you offer plans for companies and teams?",
        a: "Yes. We offer B2B team plans that let companies train multiple employees at once. You get a company dashboard with progress tracking, seat management and volume pricing. Visit our Pricing page to learn more.",
    },
    {
        q: "Are the certificates recognised by employers?",
        a: "Our certificates demonstrate practical, verifiable AI skills. While we are building partnerships with Zambian employers, our graduates consistently report that the skills themselves — not just the certificate — are what make the difference in their careers.",
    },
]

export default function Faq() {
    const [isActive, setIsActive] = useState({ status: false, key: 1 })
    const handleToggle = (key) => {
        if (isActive.key === key) {
            setIsActive({ status: false })
        } else {
            setIsActive({ status: true, key })
        }
    }
    const [isOpen, setOpen] = useState(false)
    return (
        <>

        <section className="faq-one">
            <div className="shape1 float-bob-x"><img src="images/logo-dark.png" style={{width:'24rem', opacity: '0.5', marginTop: '5rem'}} alt=""/></div>
            <div className="container">
                <div className="row">
                    {/*Start Faq One Content*/}
                    <div className="col-xl-6">
                        <div className="faq-one__content">
                            <div className="faq-one__content-faq">
                                <div className="sec-title tg-heading-subheading animation-style2">
                                    <div className="sec-title__tagline">
                                        <div className="line"></div>
                                        <div className="text tg-element-title">
                                            <h4>Common Questions</h4>
                                        </div>
                                        <div className="icon">
                                            <span className="icon-plane2 float-bob-x3"></span>
                                        </div>
                                    </div>
                                    <h2 className="sec-title__title tg-element-title">Frequently Asked <br/>
                                        <span>Questions</span> </h2>
                                </div>

                                <div className="accrodion-grp faq-one-accrodion" data-grp-name="faq-one-accrodion-1">
                                    {faqs.map((faq, idx) => (
                                        <div key={idx} className={isActive.key == idx + 1 ? "accrodion active" : "accrodion"} onClick={() => handleToggle(idx + 1)}>
                                            <div className="accrodion-title">
                                                <h4>{faq.q}</h4>
                                            </div>
                                            <div className="accrodion-content">
                                                <div className="inner">
                                                    <p>{faq.a}</p>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                    {/*End Faq One Content*/}

                    {/*Start Faq One Img*/}
                    <div className="col-xl-6">
                        <div className="faq-one__img">
                            <div className="faq-one__img-box">
                                <img src="images/pngtree-native-african-black-man-using-smart-phone-fashion-arab-muslim-photo-image_42278090.jpg" alt="AI learning"/>

                                {/* <div className="faq-one__video-link">
                                    <a onClick={() => setOpen(true)} className="video-popup">
                                        <div className="faq-one__video-icon">
                                            <span className="icon-video"></span>
                                            <i className="ripple"></i>
                                        </div>
                                    </a>
                                </div> */}
                            </div>
                        </div>
                    </div>
                    {/*End Faq One Img*/}
                </div>
            </div>

            {/*Start Sliding Text One*/}
            {/* <div className="sliding-text-one">
                <div className="sliding-text-one__wrap">
                    <ul className="sliding-text__list list-unstyled marquee_mode">
                        <li>
                            <h2 data-hover="PRACTICAL AI FOR ZAMBIA" className="sliding-text__title">PRACTICAL AI FOR ZAMBIA
                                <img src="images/zed-ai-logo.png" alt=""/></h2>
                        </li>
                        <li>
                            <h2 data-hover="PRACTICAL AI FOR ZAMBIA" className="sliding-text__title">PRACTICAL AI FOR ZAMBIA
                                <img src="images/zed-ai-logo.png" alt=""/></h2>
                        </li>
                        <li>
                            <h2 data-hover="PRACTICAL AI FOR ZAMBIA" className="sliding-text__title">PRACTICAL AI FOR ZAMBIA
                                <img src="images/zed-ai-logo.png" alt=""/></h2>
                        </li>
                        <li>
                            <h2 data-hover="PRACTICAL AI FOR ZAMBIA" className="sliding-text__title">PRACTICAL AI FOR ZAMBIA
                                <img src="images/zed-ai-logo.png" alt=""/></h2>
                        </li>
                        <li>
                            <h2 data-hover="PRACTICAL AI FOR ZAMBIA" className="sliding-text__title">PRACTICAL AI FOR ZAMBIA
                                <img src="images/zed-ai-logo.png" alt=""/></h2>
                        </li>
                    </ul>
                </div>
            </div> */}
            {/*End Sliding Text One*/}
        </section>
        <VideoModal isOpen={isOpen} onClose={() => setOpen(false)} videoId="Get7rqXYrbQ" />

        </>
    )
}
