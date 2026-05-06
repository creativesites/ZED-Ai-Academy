import Link from "next/link";
import { UserPlus, Search, Play, GraduationCap } from "lucide-react";

export default function Process() {
    const steps = [
        {
            num: "01",
            title: "Create Account",
            desc: "Sign up free in under 60 seconds — no credit card needed.",
            icon: <UserPlus size={28} />,
            link: "/sign-up"
        },
        {
            num: "02",
            title: "Choose Course",
            desc: "Pick from our library of practical AI courses for your industry.",
            icon: <Search size={28} />,
            link: "/courses"
        },
        {
            num: "03",
            title: "Learn & Apply",
            desc: "Watch lessons, use the AI Coach, and apply skills in the Studio.",
            icon: <Play size={28} />,
            link: "/courses"
        },
        {
            num: "04",
            title: "Get Certified",
            desc: "Complete the course and earn a verified digital certificate.",
            icon: <GraduationCap size={28} />,
            link: "/certificates"
        }
    ];

    return (
        <section className="working-process-one" style={{ padding: "100px 0", background: "#f8f9fa" }}>
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
                    </div>
                    <h2 className="sec-title__title tg-element-title">Your Path to AI <span>Mastery</span></h2>
                </div>

                <div className="row gutter-y-30">
                    {steps.map((step, idx) => (
                        <div key={idx} className="col-xl-3 col-lg-6 col-md-6 wow fadeInUp" data-wow-delay={`${idx * 150}ms`}>
                            <div className="working-process-one__single" style={{ 
                                height: "100%", 
                                padding: "40px 30px", 
                                background: "#fff", 
                                borderRadius: "24px", 
                                border: "1px solid #eef0f2",
                                position: "relative",
                                transition: "all 0.3s ease"
                            }}>
                                <div className="icon" style={{ 
                                    display: "flex", 
                                    alignItems: "center", 
                                    justifyContent: "center", 
                                    width: "70px", 
                                    height: "70px", 
                                    background: "rgba(253,85,35,0.08)", 
                                    color: "#fd5523",
                                    borderRadius: "20px",
                                    marginBottom: "25px",
                                    position: "relative"
                                }}>
                                    <div className="count-box" style={{
                                        position: "absolute",
                                        top: "-10px",
                                        right: "-10px",
                                        width: "28px",
                                        height: "28px",
                                        background: "#062e39",
                                        color: "#fff",
                                        borderRadius: "50%",
                                        fontSize: "12px",
                                        fontWeight: "800",
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "center",
                                        border: "2px solid #fff"
                                    }}>{step.num}</div>
                                    {step.icon}
                                </div>

                                <div className="content-box">
                                    <h2 style={{ fontSize: "18px", fontWeight: "800", color: "#062e39", marginBottom: "12px" }}>
                                        <Link href={step.link} style={{ color: "inherit", textDecoration: "none" }}>{step.title}</Link>
                                    </h2>
                                    <p style={{ fontSize: "14px", color: "#666", lineHeight: "1.6", margin: 0 }}>{step.desc}</p>
                                </div>
                                
                                {idx < 3 && (
                                    <div className="plane-icon" style={{ opacity: 0.2 }}>
                                        <span className="icon-plane"></span>
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
            <style dangerouslySetInnerHTML={{ __html: `
                .working-process-one__single:hover {
                    transform: translateY(-8px);
                    box-shadow: 0 15px 40px rgba(0,0,0,0.06);
                    border-color: #fd552340 !important;
                }
            `}} />
        </section>
    )
}

