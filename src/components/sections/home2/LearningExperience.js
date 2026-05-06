import { MessageSquare, Terminal, Award, BookOpen } from "lucide-react";
import Link from "next/link";

export default function LearningExperience() {
    const features = [
        {
            title: "Lesson-Aware AI Coach",
            desc: "Get 24/7 help from our AI Coach that knows exactly what you're learning. Ask questions, get explanations, and master complex concepts instantly.",
            icon: <MessageSquare size={32} />,
            color: "#fd5523"
        },
        {
            title: "Interactive Practice Studio",
            desc: "Don't just watch — do. Our built-in Practice Studio lets you engineer prompts and test AI workflows directly inside the academy.",
            icon: <Terminal size={32} />,
            color: "#062e39"
        },
        {
            title: "Verified AI Certificates",
            desc: "Prove your skills to employers. Earn digital certificates verified on the blockchain for every course you complete.",
            icon: <Award size={32} />,
            color: "#fd5523"
        },
        {
            title: "Practical Curriculum",
            desc: "Every lesson is built for the Zambian market. Learn how to apply AI to local business challenges and opportunities.",
            icon: <BookOpen size={32} />,
            color: "#062e39"
        }
    ];

    return (
        <section className="learning-experience" style={{ padding: "100px 0", background: "#fff" }}>
            <div className="container">
                <div className="row align-items-center">
                    <div className="col-xl-5">
                        <div className="sec-title tg-heading-subheading animation-style2">
                            <div className="sec-title__tagline">
                                <div className="line"></div>
                                <div className="text tg-element-title">
                                    <h4>The Experience</h4>
                                </div>
                            </div>
                            <h2 className="sec-title__title tg-element-title">A World-Class <br/> <span>Learning Ecosystem</span></h2>
                        </div>
                        <p className="mt-3" style={{ fontSize: "16px", color: "#666", lineHeight: "1.7" }}>
                            Zed AI Academy isn't just a collection of videos. We've built a complete 
                            intelligence dock designed to help you master AI through active learning 
                            and hands-on practice.
                        </p>
                        <div className="mt-4">
                            <Link href="/courses" className="thm-btn">
                                Explore the Platform
                                <i className="icon-right-arrow21"></i>
                                <span className="hover-btn hover-bx"></span>
                                <span className="hover-btn hover-bx2"></span>
                                <span className="hover-btn hover-bx3"></span>
                                <span className="hover-btn hover-bx4"></span>
                            </Link>
                        </div>
                    </div>
                    <div className="col-xl-7">
                        <div className="row gutter-y-30">
                            {features.map((f, idx) => (
                                <div key={idx} className="col-md-6 wow fadeInRight" data-wow-delay={`${idx * 100}ms`}>
                                    <div className="experience-card" style={{
                                        padding: "40px 30px",
                                        borderRadius: "30px",
                                        background: idx % 2 === 0 ? "#f8f9fa" : "#fff",
                                        border: "1px solid #f0f2f5",
                                        height: "100%",
                                        transition: "all 0.3s ease"
                                    }}>
                                        <div className="experience-card__icon" style={{ 
                                            color: f.color, 
                                            marginBottom: "20px",
                                            display: "flex",
                                            alignItems: "center",
                                            justifyContent: "center",
                                            width: "60px",
                                            height: "60px",
                                            borderRadius: "18px",
                                            background: idx % 2 === 0 ? "#fff" : "#f8f9fa"
                                        }}>
                                            {f.icon}
                                        </div>
                                        <h3 style={{ fontSize: "18px", fontWeight: "800", color: "#062e39", marginBottom: "15px" }}>{f.title}</h3>
                                        <p style={{ fontSize: "14px", color: "#666", lineHeight: "1.6", margin: 0 }}>{f.desc}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
            <style dangerouslySetInnerHTML={{ __html: `
                .experience-card:hover {
                    transform: translateY(-5px);
                    box-shadow: 0 15px 35px rgba(0,0,0,0.05);
                    border-color: #fd552340 !important;
                }
            `}} />
        </section>
    );
}
