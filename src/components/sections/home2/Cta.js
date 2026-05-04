import Link from "next/link";
import { getResolvedPageMediaSlot } from "@/lib/page-media";

export default async function Cta() {
    const { url: ctaImg, altText } = await getResolvedPageMediaSlot(
        "home",
        "cta_primary",
        "images/118620.jpg"
    );

    return (
        <>

        <section className="cta-one">
            <div className="container">
                <div className="cta-one__inner" style={{ overflow: 'hidden' }}>
                    <div className="cta-one__img wow fadeInRight" data-wow-delay="0ms" data-wow-duration="1500ms" style={{ maxWidth: '450px', right: '50px', bottom: '0' }}>
                        <img
                            src="images/118620.jpg"
                            alt={altText || "Team training on AI skills"}
                            style={{ width: '100%', height: 'auto', display: 'block', objectFit: 'contain' }}
                        />
                    </div>
                    <div className="cta-one__pattern"><img src="assets/images/pattern/cta-v1-pattern.png" alt=""/></div>
                    <div className="shape1 float-bob-x"><img src="assets/images/shapes/cta-v1-shape1.png" alt=""/></div>
                    <div className="shape2"><img src="assets/images/shapes/cta-v1-shape2.png" alt=""/></div>
                    <div className="shape3"><img src="assets/images/shapes/cta-v1-shape3.png" alt=""/></div>
                    <div className="cta-one__content">
                        <h2>Train Your Whole Team <br/> on <span>AI Skills!</span></h2>
                        <p>Get volume access for your company, track team progress <br/>
                            and upskill everyone at once with our B2B plans.</p>
                        <div className="btn-box">
                            <Link className="thm-btn" href="/pricing#teams">See Team Plans
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
        </section>

        </>
    )
}
