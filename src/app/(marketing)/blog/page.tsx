import Layout from "@/components/layout/Layout";
import Link from "next/link";
import { listPublishedBlogPosts } from "@/lib/blog-posts";

export default async function BlogPage() {
  const posts = await listPublishedBlogPosts();

  return (
    <Layout headerStyle={2} footerStyle={1} breadcrumbTitle="Blog &amp; AI Insights">
      <section className="blog-page">
        <div className="container">
          <div className="row">
            {posts.map((post, idx) => (
              <div key={post.id} className="col-xl-4 col-lg-6 wow fadeInUp" data-wow-delay={`${idx * 0.1}s`}>
                <div className="blog-one__single">
                  <div className="blog-one__single-img">
                    <Link href={`/blog/${post.slug}`}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={post.card_image_src || "/assets/images/blog/blog-v1-img1.jpg"}
                        alt={post.title}
                        style={{ height: 240, width: "100%", objectFit: "cover" }}
                      />
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
                          <div className="icon"><span className="icon-user"></span></div>
                          <div className="text-box"><p>{post.author_name}</p></div>
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
  );
}
