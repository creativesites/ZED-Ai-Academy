import Link from "next/link"

const posts = [
    {
        img: "assets/images/blog/blog-v1-img1.jpg",
        day: "12",
        month: "APR",
        author: "Zed AI Team",
        title: "5 Ways ChatGPT Can Transform Your Workday Right Now",
        excerpt: "From drafting emails to summarising meetings, here are the most immediately useful ChatGPT workflows for Zambian professionals...",
    },
    {
        img: "assets/images/blog/blog-v1-img2.jpg",
        day: "28",
        month: "MAR",
        author: "Zed AI Team",
        title: "How Zambian Businesses Are Using AI in 2026",
        excerpt: "We spoke with SME owners and corporate teams across Lusaka to find out how AI tools are changing the way Zambia does business...",
    },
    {
        img: "assets/images/blog/blog-v1-img3.jpg",
        day: "10",
        month: "MAR",
        author: "Zed AI Team",
        title: "From Zero to AI: A Beginner's Guide to Getting Started",
        excerpt: "Never touched an AI tool before? No problem. This guide walks you through the first steps, the best free tools and what to learn first...",
    },
]

export default function Blog() {
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
                        <div key={idx} className={`col-xl-4 col-lg-6 wow ${idx === 1 ? 'fadeInDown' : 'fadeInUp'}`} data-wow-delay=".3s">
                            <div className="blog-one__single">
                                <div className="blog-one__single-img">
                                    <img src={post.img} alt={post.title}/>
                                </div>

                                <div className="blog-one__single-content">
                                    <div className="date-box">
                                        <h2>{post.day}</h2>
                                        <p>{post.month}</p>
                                    </div>
                                    <div className="blog-one__single-content-inner">
                                        <ul className="meta-box">
                                            <li>
                                                <div className="icon">
                                                    <span className="icon-user"></span>
                                                </div>
                                                <div className="text-box">
                                                    <p><Link href="#">{post.author}</Link></p>
                                                </div>
                                            </li>
                                        </ul>

                                        <h2><Link href="#">{post.title}</Link></h2>
                                        <p>{post.excerpt}</p>

                                        <div className="btn-box">
                                            <Link className="thm-btn" href="#">Read More
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
