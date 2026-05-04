'use client'
import Link from "next/link"
import { useEffect, useState } from "react"
import Layout from "@/components/layout/Layout"
import VideoModal from "@/components/shared/video-modal"
import { getResolvedPageMediaSlot } from "@/lib/page-media"

const FAQ_SECTIONS = [
    {
        heading: "Courses & Learning",
        items: [
            {
                q: "What kind of courses do you offer?",
                a: "We offer short, practical AI courses covering tools like ChatGPT, Midjourney, Claude, and more. Every course is designed to give you skills you can use immediately — no technical background required.",
            },
            {
                q: "How long are the courses?",
                a: "Most courses are 2–6 hours of video content, broken into short lessons you can complete in 15–30 minutes each. You learn at your own pace — start, pause and come back anytime.",
            },
            {
                q: "Do I need any prior AI knowledge to enrol?",
                a: "No. Our courses are designed for beginners and working professionals. We start from the basics and build up — even if you have never used an AI tool before.",
            },
            {
                q: "Can I access courses on mobile?",
                a: "Yes. The platform works on any device — phone, tablet, or laptop. Your progress syncs automatically so you can pick up where you left off.",
            },
        ],
    },
    {
        heading: "Pricing & Payments",
        items: [
            {
                q: "Can I pay with MTN MoMo or Airtel Money?",
                a: "Yes. We accept MTN Mobile Money, Airtel Money, Visa, and Mastercard. All prices are in Zambian Kwacha (ZMW) — no hidden foreign exchange fees.",
            },
            {
                q: "Is there a free plan?",
                a: "Yes — you can access all free courses with no credit card required. The Free plan includes the AI Tutor in free lessons and progress tracking.",
            },
            {
                q: "Can I get a refund if I am not happy?",
                a: "We offer a 7-day refund on subscription plans if you have not completed more than 20% of any paid course. Contact us at creativesites263@gmail.com.",
            },
            {
                q: "Can my company get an invoice in ZMW?",
                a: "Yes. After purchase, contact us and we will email a formal invoice in Zambian Kwacha for your finance team.",
            },
        ],
    },
    {
        heading: "Teams & Companies",
        items: [
            {
                q: "Do you offer plans for companies?",
                a: "Yes. Our team plans start at 5 seats with volume discounts. You get a company dashboard, seat management, bulk course assignments, and org-level analytics.",
            },
            {
                q: "How do team seats work?",
                a: "You purchase a block of seats. Each seat is assigned to one team member who gets full Pro access. You can reassign seats as your team changes.",
            },
            {
                q: "Can I track my team's progress?",
                a: "Yes. The company dashboard shows each team member's enrolment, progress percentage, and completion status across all assigned courses.",
            },
        ],
    },
    {
        heading: "Certificates",
        items: [
            {
                q: "Do I get a certificate when I complete a course?",
                a: "Yes. Every completed course generates a verified digital certificate you can download, share on LinkedIn, or send to employers.",
            },
            {
                q: "Are the certificates recognised by employers?",
                a: "Our certificates demonstrate practical, verifiable AI skills. We are actively building employer partnerships in Zambia. Graduates consistently report that the practical skills themselves are what make the biggest difference.",
            },
        ],
    },
]

export default function FaqPage() {
    const [activeKey, setActiveKey] = useState({ section: 0, key: 0 })
    const [isOpen, setOpen] = useState(false)
    const [featureImg, setFeatureImg] = useState("/assets/images/resources/faq-v1-img1.jpg")

    useEffect(() => {
        getResolvedPageMediaSlot("faq", "feature_primary", "/assets/images/resources/faq-v1-img1.jpg")
            .then(({ url }) => setFeatureImg(url))
    }, [])

    const handleToggle = (section, key) => {
        if (activeKey.section === section && activeKey.key === key) {
            setActiveKey({ section: -1, key: -1 })
        } else {
            setActiveKey({ section, key })
        }
    }

    return (
        <>
        <Layout headerStyle={2} footerStyle={1} breadcrumbTitle="FAQ">

            {/*──────────────────────────────────────────
              Main FAQ accordion
            ──────────────────────────────────────────*/}
            <section className="faq-one faq-one--faq">
                <div className="shape1 float-bob-x">
                    <img src="assets/images/shapes/faq-v1-shape1.png" alt=""/>
                </div>
                <div className="container">
                    <div className="row">

                        {/*Left — accordions*/}
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
                                                <span className="icon-plane2"></span>
                                            </div>
                                        </div>
                                        <h2 className="sec-title__title tg-element-title">
                                            Frequently Asked <br/> <span>Questions</span>
                                        </h2>
                                    </div>

                                    {FAQ_SECTIONS.map((section, sIdx) => (
                                        <div key={sIdx} style={{ marginBottom: '30px' }}>
                                            <h4 style={{ fontWeight: 700, marginBottom: '12px', color: '#062e39', fontSize: '15px', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                                                {section.heading}
                                            </h4>
                                            <div className="accrodion-grp faq-one-accrodion">
                                                {section.items.map((item, iIdx) => (
                                                    <div
                                                        key={iIdx}
                                                        className={activeKey.section === sIdx && activeKey.key === iIdx ? "accrodion active" : "accrodion"}
                                                        onClick={() => handleToggle(sIdx, iIdx)}
                                                    >
                                                        <div className="accrodion-title">
                                                            <h4>{item.q}</h4>
                                                        </div>
                                                        <div className="accrodion-content">
                                                            <div className="inner">
                                                                <p>{item.a}</p>
                                                            </div>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/*Right — image + video + CTA*/}
                        <div className="col-xl-6">
                            <div className="faq-one__img">
                                <div className="faq-one__img-box">
                                    <img src={featureImg} alt="AI learning Zambia"/>
                                    <div className="faq-one__video-link">
                                        <a onClick={() => setOpen(true)} className="video-popup" style={{ cursor: 'pointer' }}>
                                            <div className="faq-one__video-icon">
                                                <span className="icon-video"></span>
                                                <i className="ripple"></i>
                                            </div>
                                        </a>
                                    </div>
                                </div>
                            </div>

                            {/*Still have a question box*/}
                            <div style={{
                                marginTop: '30px',
                                background: '#062e39',
                                borderRadius: '16px',
                                padding: '30px',
                                color: '#fff',
                            }}>
                                <h3 style={{ color: '#fff', marginBottom: '10px' }}>Still have a question?</h3>
                                <p style={{ color: 'rgba(255,255,255,0.72)', marginBottom: '20px', fontSize: '14px', lineHeight: '1.7' }}>
                                    Can&apos;t find what you&apos;re looking for? Reach out to our team directly — we typically respond within one business day.
                                </p>
                                <Link className="thm-btn" href="/contact">
                                    Contact Us
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

                {/*Sliding ticker*/}
                <div className="sliding-text-one">
                    <div className="sliding-text-one__wrap">
                        <ul className="sliding-text__list list-unstyled marquee_mode">
                            {[1,2,3,4,5].map(i => (
                                <li key={i}>
                                    <h2 data-hover="PRACTICAL AI FOR ZAMBIA" className="sliding-text__title">
                                        PRACTICAL AI FOR ZAMBIA
                                        <img src="assets/images/icon/sliding-text-icon-1.png" alt=""/>
                                    </h2>
                                </li>
                            ))}
                        </ul>
                    </div>
                </div>
            </section>

        </Layout>
        <VideoModal isOpen={isOpen} onClose={() => setOpen(false)} videoId="Get7rqXYrbQ" />
        </>
    )
}
