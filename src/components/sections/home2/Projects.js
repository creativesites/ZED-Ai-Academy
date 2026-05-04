import Link from "next/link"

const projects = [
    {
        img: "https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=900&q=80&auto=format&fit=crop",
        category: "AI Analytics",
        title: "Business Intelligence Dashboard",
        href: "/courses",
    },
    {
        img: "https://images.unsplash.com/photo-1677442135703-1787eea5ce01?w=600&q=80&auto=format&fit=crop",
        category: "Prompt Engineering",
        title: "Automated Content Pipeline",
        href: "/courses",
    },
    {
        img: "https://images.unsplash.com/photo-1542038784456-1ea8e935640e?w=600&q=80&auto=format&fit=crop",
        category: "AI Creative",
        title: "AI Photography Portfolio",
        href: "/courses",
    },
    {
        img: "https://images.unsplash.com/photo-1762341107834-a3437dd0ae62?w=600&q=80&auto=format&fit=crop",
        category: "AI for Business",
        title: "Workflow Automation System",
        href: "/courses",
    },
]

export default function Projects() {
    return (
        <>
        <section className="project-one project-one--two">
            <div className="container">
                <div className="row">
                    {/*Start Title*/}
                    <div className="col-xl-5 col-lg-5 wow fadeInLeft" data-wow-delay="0ms" data-wow-duration="1500ms">
                        <div className="project-one__title">
                            <div className="sec-title tg-heading-subheading animation-style2">
                                <div className="sec-title__tagline">
                                    <div className="line"></div>
                                    <div className="text tg-element-title">
                                        <h4>Learner Achievements</h4>
                                    </div>
                                    <div className="icon">
                                        <span className="icon-plane2 float-bob-x3"></span>
                                    </div>
                                </div>
                                <h2 className="sec-title__title tg-element-title">Real Projects Built <br/>
                                    by Our <span>Graduates</span></h2>
                            </div>

                            <div className="btn-box">
                                <Link className="thm-btn" href="/courses">Browse Courses
                                    <i className="icon-right-arrow21"></i>
                                    <span className="hover-btn hover-bx"></span>
                                    <span className="hover-btn hover-bx2"></span>
                                    <span className="hover-btn hover-bx3"></span>
                                    <span className="hover-btn hover-bx4"></span>
                                </Link>
                            </div>
                        </div>
                    </div>
                    {/*End Title*/}

                    {/*Start Project One Single - large*/}
                    <div className="col-xl-7 col-lg-7 wow fadeInRight" data-wow-delay="0ms" data-wow-duration="1500ms">
                        <div className="project-one__single">
                            <div className="project-one__single-img">
                                <div className="inner">
                                    <img src={projects[0].img} alt={projects[0].title}/>
                                    <div className="project-one__overlay-content">
                                        <div className="text-box">
                                            <p>{projects[0].category}</p>
                                            <h2><Link href={projects[0].href}>{projects[0].title}</Link></h2>
                                        </div>
                                        <div className="icon">
                                            <Link href={projects[0].href}><span className="icon-right-arrow21"></span></Link>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                    {/*End Project One Single*/}

                    {projects.slice(1).map((project, idx) => (
                        <div key={idx} className="col-xl-4 col-lg-4 wow fadeInLeft" data-wow-delay="0ms" data-wow-duration="1500ms">
                            <div className="project-one__single">
                                <div className="project-one__single-img">
                                    <div className="inner">
                                        <img src={project.img} alt={project.title}/>
                                        <div className="project-one__overlay-content">
                                            <div className="text-box">
                                                <p>{project.category}</p>
                                                <h2><Link href={project.href}>{project.title}</Link></h2>
                                            </div>
                                            <div className="icon">
                                                <Link href={project.href}><span className="icon-right-arrow21"></span></Link>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </section>
        </>
    )
}
