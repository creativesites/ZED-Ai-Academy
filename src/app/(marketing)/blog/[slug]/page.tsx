import Layout from "@/components/layout/Layout";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BlogComments } from "@/components/blog/BlogComments";
import { auth, currentUser } from "@clerk/nextjs/server";
import { Calendar, User, Tag, ArrowLeft, Zap, Clock } from "lucide-react";
import { getPublishedBlogPostBySlug, listPublishedBlogPosts } from "@/lib/blog-posts";

const categoryDisplayMap: Record<string, string> = {
  Productivity: "Productivity",
  Business: "Business",
  "Prompt Engineering": "Prompt Engineering",
  Creative: "Creative AI",
  Beginners: "Beginners",
};

export default async function BlogDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { userId } = await auth();
  const user = userId ? await currentUser() : null;
  const userName = user ? [user.firstName, user.lastName].filter(Boolean).join(" ") : null;

  const [post, allPosts] = await Promise.all([
    getPublishedBlogPostBySlug(slug),
    listPublishedBlogPosts(),
  ]);

  if (!post) {
    notFound();
  }

  const categoryCounts = allPosts.reduce<Record<string, number>>((acc, item) => {
    const key = categoryDisplayMap[item.category] ?? item.category;
    acc[key] = (acc[key] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <Layout headerStyle={2} footerStyle={1} breadcrumbTitle={post.category}>
      <section className="blog-details py-24">
        <div className="container">
          <div className="row">
            <div className="col-xl-8">
              <div className="blog-details__content">
                <div className="mb-12">
                  <Link href="/blog" className="inline-flex items-center gap-2 text-sm font-bold text-[#fd5523] hover:-translate-x-1 transition-transform mb-8">
                    <ArrowLeft className="h-4 w-4" />
                    Back to all articles
                  </Link>
                  <h1 className="text-4xl sm:text-5xl font-extrabold text-[#062e39] leading-[1.1] tracking-tight mb-8">
                    {post.title}
                  </h1>
                  <div className="flex flex-wrap items-center gap-6 sm:gap-8 py-6 border-y border-slate-100">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-full bg-slate-100 flex items-center justify-center text-[#062e39]">
                        <User className="h-5 w-5" />
                      </div>
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Author</p>
                        <p className="text-sm font-bold text-[#062e39]">{post.author_name}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-full bg-slate-100 flex items-center justify-center text-[#062e39]">
                        <Calendar className="h-5 w-5" />
                      </div>
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Date</p>
                        <p className="text-sm font-bold text-[#062e39]">
                          {new Date(post.published_at).toLocaleDateString("en-US", {
                            day: "numeric",
                            month: "long",
                            year: "numeric",
                          })}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-full bg-[#fff2e9] flex items-center justify-center text-[#fd5523]">
                        <Clock className="h-5 w-5" />
                      </div>
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Read</p>
                        <p className="text-sm font-bold text-[#fd5523]">{post.read_time}</p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="rounded-[2rem] sm:rounded-[3rem] overflow-hidden mb-12 shadow-2xl">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={post.hero_image_src || post.card_image_src || "/assets/images/blog/blog-v1-img1.jpg"} alt={post.title} className="w-full h-auto object-cover" />
                </div>

                <div className="prose-style mb-16">
                  {post.content_blocks.map((block, idx) => {
                    if (block.type === "h2") {
                      return (
                        <h2 key={idx} className="text-2xl sm:text-3xl font-extrabold text-[#062e39] mt-12 mb-6 tracking-tight">
                          {block.text}
                        </h2>
                      );
                    }

                    if (block.type === "callout") {
                      return (
                        <div key={idx} className="my-8 p-6 sm:p-8 rounded-2xl bg-[#fffbf8] border-l-4 border-[#fd5523]">
                          <p className="text-base leading-relaxed text-[#062e39] font-medium">{block.text}</p>
                        </div>
                      );
                    }

                    return (
                      <p key={idx} className="text-lg leading-relaxed text-slate-600 mb-6">
                        {block.text}
                      </p>
                    );
                  })}
                </div>

                <div className="flex flex-wrap items-center justify-between gap-6 py-8 border-y border-slate-100 mb-12">
                  <div className="flex items-center gap-3 flex-wrap">
                    <Tag className="h-4 w-4 text-slate-400" />
                    {(post.tags as string[]).map((tag) => (
                      <Link key={tag} href="/blog" className="px-4 py-2 rounded-full bg-slate-50 text-slate-500 text-xs font-bold hover:bg-[#fd5523] hover:text-white transition-all">
                        {tag}
                      </Link>
                    ))}
                  </div>
                </div>

                <BlogComments postId={slug} userId={userId || null} userName={userName} />
              </div>
            </div>

            <div className="col-xl-4">
              <aside className="sticky top-24 space-y-10 pl-0 lg:pl-4">
                <div className="p-8 sm:p-10 rounded-[2.5rem] bg-white border-2 border-slate-50 shadow-xl shadow-slate-200/40">
                  <h3 className="text-lg font-bold text-[#062e39] mb-6 tracking-tight">Categories</h3>
                  <ul className="space-y-3">
                    {Object.entries(categoryCounts).map(([name, count]) => (
                      <li key={name}>
                        <Link href="/blog" className="flex items-center justify-between group py-1">
                          <span className="text-slate-600 text-sm font-medium group-hover:text-[#fd5523] transition-colors">{name}</span>
                          <span className="h-6 w-8 rounded-lg bg-slate-50 text-slate-400 text-[10px] font-bold flex items-center justify-center group-hover:bg-[#fd5523] group-hover:text-white transition-all">{count}</span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="p-8 sm:p-10 rounded-[2.5rem] bg-[#062e39] text-white overflow-hidden relative shadow-2xl">
                  <div className="absolute inset-0 opacity-10 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')]" />
                  <div className="relative z-10">
                    <div className="h-12 w-12 rounded-2xl bg-[#fd5523] flex items-center justify-center mb-6 shadow-xl shadow-[#fd5523]/20">
                      <Zap className="h-6 w-6 text-white" />
                    </div>
                    <h3 className="text-xl font-bold mb-3 tracking-tight">Accelerate Your AI Journey</h3>
                    <p className="text-white/60 text-sm leading-relaxed mb-8">
                      Get structured training, expert guidance, and industry-recognised certificates.
                    </p>
                    <Link href="/courses" className="thm-btn w-full text-center block">
                      Browse Courses
                      <i className="icon-right-arrow21"></i>
                    </Link>
                  </div>
                </div>
              </aside>
            </div>
          </div>
        </div>
      </section>
    </Layout>
  );
}
