import Layout from "@/components/layout/Layout"
import Link from "next/link"

const POSTS = [
    {
        slug: "5-ways-chatgpt-can-transform-your-workday",
        img: "https://images.unsplash.com/photo-1677442135703-1787eea5ce01?w=600&q=80&auto=format&fit=crop",
        day: "12", month: "APR",
        author: "Zed AI Team",
        category: "Productivity",
        title: "5 Ways ChatGPT Can Transform Your Workday Right Now",
        excerpt: "From drafting emails to summarising meetings — discover the most immediately useful ChatGPT workflows for Zambian professionals.",
    },
    {
        slug: "how-zambian-businesses-are-using-ai-in-2026",
        img: "https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=600&q=80&auto=format&fit=crop",
        day: "28", month: "MAR",
        author: "Zed AI Team",
        category: "Business",
        title: "How Zambian Businesses Are Using AI in 2026",
        excerpt: "We spoke with SME owners and corporate teams across Lusaka to find out how AI tools are changing the way Zambia does business.",
    },
    {
        slug: "from-zero-to-ai-beginners-guide",
        img: "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=600&q=80&auto=format&fit=crop",
        day: "10", month: "MAR",
        author: "Zed AI Team",
        category: "Beginners",
        title: "From Zero to AI: A Beginner's Guide to Getting Started",
        excerpt: "Never touched an AI tool before? This guide walks you through the first steps, the best free tools and what to learn first.",
    },
    {
        slug: "midjourney-for-zambian-creatives",
        img: "https://images.unsplash.com/photo-1542038784456-1ea8e935640e?w=600&q=80&auto=format&fit=crop",
        day: "02", month: "MAR",
        author: "Zed AI Team",
        category: "Creative",
        title: "Midjourney for Zambian Creatives: A Practical First Look",
        excerpt: "Designers, photographers and marketers — here is how to use Midjourney to elevate your creative output without a design degree.",
    },
    {
        slug: "ai-for-small-business-zambia",
        img: "https://images.unsplash.com/photo-1556761175-5973dc0f32e7?w=600&q=80&auto=format&fit=crop",
        day: "18", month: "FEB",
        author: "Zed AI Team",
        category: "Business",
        title: "AI for Small Business in Zambia: Where to Start",
        excerpt: "You do not need a big budget or a tech team to use AI. Here are the highest-leverage tools any SME can adopt today.",
    },
    {
        slug: "writing-better-prompts-guide",
        img: "https://images.unsplash.com/photo-1488190211105-8b0e65b80b4e?w=600&q=80&auto=format&fit=crop",
        day: "05", month: "FEB",
        author: "Zed AI Team",
        category: "Prompting",
        title: "Writing Better Prompts: The Guide Every AI Learner Needs",
        excerpt: "The quality of your prompt determines the quality of your output. Learn the core framework our instructors teach.",
    },
]

export default function BlogPage() {
    return (
        <Layout headerStyle={2} footerStyle={1} breadcrumbTitle="Blog &amp; AI Insights">
            <section className="blog-page">
                <div className="container">
                    <div className="row">
                        {POSTS.map((post, idx) => (
                            <div key={post.slug} className={`col-xl-4 col-lg-6 wow fadeInUp`} data-wow-delay={`${idx * 0.1}s`}>
                                <div className="blog-one__single">
                                    <div className="blog-one__single-img">
                                        <Link href={`/blog/${post.slug}`}>
                                            <img src={post.img} alt={post.title} style={{ height: 240, width: "100%", objectFit: "cover" }} />
                                        </Link>
                                    </div>

                                    <div className="blog-one__single-content">
                                        <div className="date-box">
                                            <h2>{post.day}</h2>
                                            <p>{post.month}</p>
                                        </div>
                                        <div className="blog-one__single-content-inner">
                                            <ul className="meta-box">
                                                <li>
                                                    <div className="icon"><span className="icon-user"></span></div>
                                                    <div className="text-box"><p>{post.author}</p></div>
                                                </li>
                                                <li>
                                                    <div className="icon"><span className="icon-chat"></span></div>
                                                    <div className="text-box"><p>{post.category}</p></div>
                                                </li>
                                            </ul>

                                            <h2><Link href={`/blog/${post.slug}`}>{post.title}</Link></h2>
                                            <p>{post.excerpt}</p>

                                            <div className="btn-box">
                                                <Link className="thm-btn" href={`/blog/${post.slug}`}>
                                                    Read More
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
        </Layout>
    )
}
