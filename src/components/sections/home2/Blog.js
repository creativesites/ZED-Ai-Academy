import Link from "next/link"
import { listPublishedBlogPosts } from "@/lib/blog-posts"

export default async function Blog() {
    const posts = await listPublishedBlogPosts(3)
    return (
        <>

        <section className="blog-one blog-one--two">
            <div className="container">
                <div className="sec-title center text-center tg-heading-subheading animation-style2">
                    <div className="sec-title__tagline">
                        <div className="line"></div>
                        <div className="text tg-element-title">
                            <h4>AI Insights</h4>
                        </div>
                        <div className="icon">
                            <span className="icon-plane2 float-bob-x3"></span>
                        </div>
                    </div>
                    <h2 className="sec-title__title tg-element-title">Latest AI Tips &amp; <br/> Guides From Our <span>Blog</span>
                    </h2>
                </div>
                <div className="row">
                    {posts.map((post, idx) => (
                        <div key={post.id} className={`col-xl-4 col-lg-6 wow ${idx === 1 ? 'fadeInDown' : 'fadeInUp'}`} data-wow-delay=".3s">
                            <div className="blog-one__single">
                                <div className="blog-one__single-img">
                                    <Link href={`/blog/${post.slug}`}>
                                        <img src={post.card_image_src || "/assets/images/blog/blog-v1-img1.jpg"} alt={post.title}/>
                                    </Link>
                                </div>

                                <div className="blog-one__single-content">
                                    <div className="date-box">
                                        <h2>{new Date(post.published_at).toLocaleDateString("en-US", { day: "2-digit" })}</h2>
                                        <p>{new Date(post.published_at).toLocaleDateString("en-US", { month: "short" }).toUpperCase()}</p>
                                    </div>
                                    <div className="blog-one__single-content-inner">
                                        <ul className="meta-box">
                                            <li>
                                                <div className="icon">
                                                    <span className="icon-user"></span>
                                                </div>
                                                <div className="text-box">
                                                    <p><Link href={`/blog/${post.slug}`}>{post.author_name}</Link></p>
                                                </div>
                                            </li>
                                        </ul>

                                        <h2><Link href={`/blog/${post.slug}`}>{post.title}</Link></h2>
                                        <p>{post.excerpt}</p>

                                        <div className="btn-box">
                                            <Link className="thm-btn" href={`/blog/${post.slug}`}>Read More
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
                        </div>
                    ))}
                </div>
            </div>
        </section>

        </>
    )
}
