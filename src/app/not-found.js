import Layout from "@/components/layout/Layout"
import Link from "next/link"
export default function Error404() {

    return (
        <>
            <Layout headerStyle={1} footerStyle={2} breadcrumbTitle="Page Not Found">
            <section className="error-page">
                <div className="container">
                    <div className="error-page__inner text-center">
                        <div className="error-page__img float-bob-y">
                            <img src="assets/images/resources/error-page-img1.png" alt=""/>
                        </div>

                        <div className="error-page__content">
                            <h2>Oops! Page Not Found!</h2>
                            <p>The page you are looking for does not exist. It might have been moved or deleted.</p>
                            <div className="btn-box">
                                <Link className="thm-btn" href="/">Back To Home
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
            </Layout>
        </>
    )
}
