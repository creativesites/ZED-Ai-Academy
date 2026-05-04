import Layout from "@/components/layout/Layout"
import Link from "next/link"
import { BlogComments } from "@/components/blog/BlogComments"
import { auth, currentUser } from "@clerk/nextjs/server"
import { Calendar, User, Tag, ArrowLeft, Zap, Clock } from "lucide-react"

/* ── Blog Post Data ──────────────────────────────────── */

const POSTS: Record<string, any> = {
    "5-ways-chatgpt-can-transform-your-workday": {
        title: "5 Ways ChatGPT Can Transform Your Workday Right Now",
        img: "https://images.unsplash.com/photo-1677442135703-1787eea5ce01?w=1200&q=80&auto=format&fit=crop",
        date: "12 April 2026", readTime: "7 min read",
        category: "Productivity", author: "Zed AI Team",
        tags: ["ChatGPT", "Efficiency", "Workplace", "Zambia"],
        body: [
            { type: "p", text: "Artificial intelligence is no longer something reserved for tech companies in Silicon Valley. Zambian professionals across every sector — from finance to farming, from marketing to medicine — are discovering that AI tools like ChatGPT can fundamentally change how they work. The best part? You do not need a computer science degree to start." },
            { type: "h2", text: "1. Draft emails and documents in seconds" },
            { type: "p", text: "One of the most immediate wins with ChatGPT is writing. Tell it what you need — 'draft a professional email declining a meeting' or 'write a project proposal for a mobile money integration' — and you will have a solid first draft in under 10 seconds. You can then refine the tone, add specific details, and send it off. Most professionals save 30–60 minutes per day on writing tasks alone." },
            { type: "callout", text: "💡 Pro Tip: Always include context in your prompt. Instead of 'write an email', try 'write a polite email to a client in the banking sector explaining a two-week project delay due to regulatory approval'." },
            { type: "h2", text: "2. Summarise long reports and documents" },
            { type: "p", text: "Paste in a lengthy contract, research report, or meeting transcript and ask ChatGPT to summarise the key points. What used to take 30 minutes of reading now takes 30 seconds. This is especially powerful for managers who receive dozens of reports each week." },
            { type: "h2", text: "3. Brainstorm ideas on demand" },
            { type: "p", text: "Struggling to come up with campaign ideas, product names, or problem-solving approaches? ChatGPT is a relentless brainstorming partner. Ask it for '10 social media content ideas for a Zambian fintech startup' and you will have a working list in seconds." },
            { type: "h2", text: "4. Automate repetitive data tasks" },
            { type: "p", text: "ChatGPT can help you write Excel formulas, clean up messy data, generate SQL queries, and even create simple scripts. If you spend time on repetitive spreadsheet work, this alone can save you hours each week." },
            { type: "h2", text: "5. Learn new skills faster" },
            { type: "p", text: "Use ChatGPT as a personal tutor. Ask it to explain concepts in simple terms, quiz you on what you have learned, or create a study plan for a new skill. It is like having a patient teacher available 24/7." },
            { type: "h2", text: "Getting started" },
            { type: "p", text: "The key to success with ChatGPT is practice. Start with one use case — perhaps email drafting — and build from there. Within a week, you will wonder how you ever worked without it. Our Prompt Engineering Mastery course covers all of these techniques and more, with hands-on exercises designed for Zambian professionals." },
        ],
    },
    "how-zambian-businesses-are-using-ai-in-2026": {
        title: "How Zambian Businesses Are Using AI in 2026",
        img: "https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=1200&q=80&auto=format&fit=crop",
        date: "28 March 2026", readTime: "8 min read",
        category: "Business", author: "Zed AI Team",
        tags: ["Business", "Strategy", "Automation", "Zambia"],
        body: [
            { type: "p", text: "Two years ago, AI felt like a distant technology reserved for global tech giants. Today, the story in Zambia is remarkably different. SMEs in Lusaka, Ndola, and Kitwe are embedding AI tools into their daily operations — and seeing real results." },
            { type: "h2", text: "Marketing and content creation" },
            { type: "p", text: "Marketing agencies and in-house teams are using AI to produce social media content, write ad copy, and generate campaign ideas at a pace that was previously impossible. One Lusaka-based digital agency told us they reduced their content production time by 60% after adopting AI writing tools." },
            { type: "h2", text: "Customer service automation" },
            { type: "p", text: "Several Zambian businesses have deployed AI-powered chatbots on WhatsApp to handle common customer queries. A mobile money agent network reported that their AI assistant handles over 200 customer questions per day — freeing up their human agents for complex cases." },
            { type: "callout", text: "📊 By the numbers: Zambian businesses using AI report an average 40% reduction in time spent on repetitive tasks and a 25% increase in customer response speed." },
            { type: "h2", text: "Financial analysis and reporting" },
            { type: "p", text: "Accountants and financial analysts are using AI to automate report generation, flag anomalies in transaction data, and create forecasting models. What used to take a full day of spreadsheet work can now be done in under an hour." },
            { type: "h2", text: "The road ahead" },
            { type: "p", text: "The businesses that invest in AI skills today will have a significant competitive advantage tomorrow. The technology is accessible, affordable, and immediately practical. The only barrier is knowledge — and that is exactly what Zed AI Academy is here to solve." },
        ],
    },
    "from-zero-to-ai-beginners-guide": {
        title: "From Zero to AI: A Beginner's Guide to Getting Started",
        img: "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=1200&q=80&auto=format&fit=crop",
        date: "10 March 2026", readTime: "10 min read",
        category: "Beginners", author: "Zed AI Team",
        tags: ["Beginners", "Getting Started", "Free Tools", "Learning"],
        body: [
            { type: "p", text: "Never touched an AI tool before? You are not alone — and you are not behind. This guide walks you through everything you need to know to start using AI confidently, even if you have zero technical background." },
            { type: "h2", text: "What is AI, really?" },
            { type: "p", text: "At its simplest, AI is software that can understand language, recognise patterns, and generate content. Think of it as a very smart assistant that can read, write, and analyse information at incredible speed. You do not need to understand how it works internally to use it effectively — just like you do not need to understand how a car engine works to drive." },
            { type: "h2", text: "The best free tools to start with" },
            { type: "p", text: "ChatGPT (free tier) is the best starting point for most people. It can write, summarise, brainstorm, and answer questions. Google Gemini is another excellent free option with strong research capabilities. For image generation, try Microsoft Copilot which includes DALL-E image creation at no cost." },
            { type: "h2", text: "Your first 7 days with AI" },
            { type: "p", text: "Day 1–2: Open ChatGPT and have a conversation. Ask it questions about your work. Day 3–4: Try drafting a real work email or document with AI help. Day 5–6: Ask AI to summarise a long article or report. Day 7: Brainstorm ideas for a real project using AI as your partner." },
            { type: "callout", text: "🎯 Remember: AI is a tool, not a replacement. The best results come from combining your expertise and judgment with AI's speed and capability." },
            { type: "h2", text: "Common mistakes beginners make" },
            { type: "p", text: "The biggest mistake is writing vague prompts. 'Write something about marketing' will give you generic content. 'Write a 200-word LinkedIn post about how Zambian SMEs can use WhatsApp Business to increase repeat customers' will give you something genuinely useful. Specificity is everything." },
            { type: "h2", text: "Next steps" },
            { type: "p", text: "Once you are comfortable with basic AI interactions, the next step is learning prompt engineering — the skill of communicating effectively with AI. This is the single most valuable AI skill you can learn, and it is the foundation of every course at Zed AI Academy." },
        ],
    },
    "midjourney-for-zambian-creatives": {
        title: "Midjourney for Zambian Creatives: A Practical First Look",
        img: "https://images.unsplash.com/photo-1542038784456-1ea8e935640e?w=1200&q=80&auto=format&fit=crop",
        date: "2 March 2026", readTime: "6 min read",
        category: "Creative", author: "Zed AI Team",
        tags: ["Midjourney", "Design", "Photography", "Creative AI"],
        body: [
            { type: "p", text: "Designers, photographers, and marketers — AI image generation is not here to replace you. It is here to supercharge your creative output. Midjourney is one of the most powerful tools in this space, and Zambian creatives are already using it to stunning effect." },
            { type: "h2", text: "What can Midjourney actually do?" },
            { type: "p", text: "Midjourney generates photorealistic images, illustrations, textures, and concept art from text descriptions. Need a hero image for a website? A product mockup? A social media visual? Describe what you want in natural language and Midjourney will create it in under 60 seconds." },
            { type: "h2", text: "Real use cases for Zambian creatives" },
            { type: "p", text: "A Lusaka-based branding agency uses Midjourney to generate mood boards and concept art during client pitches — cutting their preparation time from days to hours. A photographer in Livingstone uses it to create composite backgrounds for portrait sessions. A social media manager in Kitwe generates unique visual content for multiple clients daily." },
            { type: "callout", text: "🎨 Creative Tip: Use Midjourney for inspiration and starting points, then refine in Photoshop or Canva. The combination of AI generation and human curation produces the best results." },
            { type: "h2", text: "Getting started" },
            { type: "p", text: "Midjourney works through Discord. Join the Midjourney server, subscribe to a plan (starting at $10/month), and start creating. Our AI Photography & Design course includes a full module on mastering Midjourney prompts for professional-grade output." },
        ],
    },
    "ai-for-small-business-zambia": {
        title: "AI for Small Business in Zambia: Where to Start",
        img: "https://images.unsplash.com/photo-1556761175-5973dc0f32e7?w=1200&q=80&auto=format&fit=crop",
        date: "18 February 2026", readTime: "9 min read",
        category: "Business", author: "Zed AI Team",
        tags: ["SME", "Business", "Zambia", "Practical"],
        body: [
            { type: "p", text: "You do not need a big budget or a tech team to use AI in your business. Whether you run a shop in Kamwala, a farm in Southern Province, or a consulting firm in Kabulonga, there are AI tools that can make your work faster, cheaper, and better — starting today." },
            { type: "h2", text: "Start with what hurts most" },
            { type: "p", text: "Do not try to 'do AI' across your entire business at once. Pick the one task that wastes the most time or causes the most frustration. Is it writing proposals? Responding to customer enquiries? Creating marketing content? Start there." },
            { type: "h2", text: "Five AI tools every Zambian SME should know" },
            { type: "p", text: "1. ChatGPT — for writing, analysis, and problem-solving. 2. Canva AI — for professional graphics without a designer. 3. Otter.ai — for automatic meeting transcription. 4. QuickBooks AI — for automated bookkeeping insights. 5. WhatsApp Business API — for automated customer messaging." },
            { type: "callout", text: "💰 Most of these tools have free tiers or cost less than K200/month. The ROI in time savings alone typically pays for itself within the first week." },
            { type: "h2", text: "Measuring your results" },
            { type: "p", text: "Track two things: time saved and quality improved. If AI helps you write proposals 3x faster and your win rate stays the same or improves, that is a clear win. Keep a simple log for the first month so you can see the impact clearly." },
        ],
    },
    "writing-better-prompts-guide": {
        title: "Writing Better Prompts: The Guide Every AI Learner Needs",
        img: "https://images.unsplash.com/photo-1488190211105-8b0e65b80b4e?w=1200&q=80&auto=format&fit=crop",
        date: "5 February 2026", readTime: "11 min read",
        category: "Prompting", author: "Zed AI Team",
        tags: ["Prompting", "Skills", "ChatGPT", "Technique"],
        body: [
            { type: "p", text: "The quality of your prompt determines the quality of your output. This is the single most important principle in working with AI — and yet most people never learn it properly. This guide teaches you the framework our instructors use to get dramatically better results from any AI tool." },
            { type: "h2", text: "The CRISP Framework" },
            { type: "p", text: "We teach a five-part framework called CRISP: Context (background information), Role (who the AI should act as), Instruction (what you want it to do), Specifics (details like length, tone, format), and Purpose (why you need this output). Using all five elements transforms vague requests into precise, high-quality outputs." },
            { type: "h2", text: "Before and after examples" },
            { type: "p", text: "❌ Bad prompt: 'Write about marketing.' ✅ Good prompt: 'Act as a digital marketing consultant with expertise in the Zambian market. Write a 300-word LinkedIn article explaining three low-cost social media strategies that SMEs in Lusaka can implement this week to increase foot traffic. Use a professional but approachable tone.'" },
            { type: "callout", text: "🔑 The difference between a bad prompt and a great prompt is usually 30 extra seconds of thought. That small investment transforms your output quality completely." },
            { type: "h2", text: "Advanced techniques" },
            { type: "p", text: "Chain-of-thought prompting: Ask AI to 'think step by step' before answering complex questions. Few-shot prompting: Give 2–3 examples of the output format you want. Iterative refinement: Start broad, then ask AI to improve specific aspects of its response." },
            { type: "h2", text: "Practice makes perfect" },
            { type: "p", text: "Prompt engineering is a skill that improves with practice. We recommend spending 15 minutes per day experimenting with different prompt structures. Within two weeks, you will see a dramatic improvement in the quality of AI outputs you generate. Our Prompt Engineering Mastery course provides structured practice with feedback from expert instructors." },
        ],
    },
}

const CATEGORIES = [
    { name: "Productivity", count: 8 },
    { name: "Business", count: 12 },
    { name: "Prompt Engineering", count: 6 },
    { name: "Creative AI", count: 5 },
    { name: "Beginners", count: 4 },
]

/* ── Page ────────────────────────────────────────────── */

export default async function BlogDetailPage({ params }: { params: { slug: string } }) {
    const { userId } = await auth();
    const user = userId ? await currentUser() : null;
    const userName = user ? [user.firstName, user.lastName].filter(Boolean).join(" ") : null;

    const post = POSTS[params.slug] ?? POSTS["5-ways-chatgpt-can-transform-your-workday"]

    return (
        <Layout headerStyle={2} footerStyle={1} breadcrumbTitle={post.category}>
            <section className="blog-details py-24">
                <div className="container">
                    <div className="row">
                        {/* Main Content */}
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
                                                <p className="text-sm font-bold text-[#062e39]">{post.author}</p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <div className="h-10 w-10 rounded-full bg-slate-100 flex items-center justify-center text-[#062e39]">
                                                <Calendar className="h-5 w-5" />
                                            </div>
                                            <div>
                                                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Date</p>
                                                <p className="text-sm font-bold text-[#062e39]">{post.date}</p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <div className="h-10 w-10 rounded-full bg-[#fff2e9] flex items-center justify-center text-[#fd5523]">
                                                <Clock className="h-5 w-5" />
                                            </div>
                                            <div>
                                                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Read</p>
                                                <p className="text-sm font-bold text-[#fd5523]">{post.readTime}</p>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="rounded-[2rem] sm:rounded-[3rem] overflow-hidden mb-12 shadow-2xl">
                                    <img src={post.img} alt={post.title} className="w-full h-auto object-cover" />
                                </div>

                                <div className="prose-style mb-16">
                                    {post.body.map((block: any, idx: number) => {
                                        if (block.type === "h2") return (
                                            <h2 key={idx} className="text-2xl sm:text-3xl font-extrabold text-[#062e39] mt-12 mb-6 tracking-tight">
                                                {block.text}
                                            </h2>
                                        )
                                        if (block.type === "callout") return (
                                            <div key={idx} className="my-8 p-6 sm:p-8 rounded-2xl bg-[#fffbf8] border-l-4 border-[#fd5523]">
                                                <p className="text-base leading-relaxed text-[#062e39] font-medium">{block.text}</p>
                                            </div>
                                        )
                                        return (
                                            <p key={idx} className="text-lg leading-relaxed text-slate-600 mb-6">
                                                {block.text}
                                            </p>
                                        )
                                    })}
                                </div>

                                {/* Tags + Share */}
                                <div className="flex flex-wrap items-center justify-between gap-6 py-8 border-y border-slate-100 mb-12">
                                    <div className="flex items-center gap-3 flex-wrap">
                                        <Tag className="h-4 w-4 text-slate-400" />
                                        {post.tags?.map((tag: string) => (
                                            <Link key={tag} href="/blog" className="px-4 py-2 rounded-full bg-slate-50 text-slate-500 text-xs font-bold hover:bg-[#fd5523] hover:text-white transition-all">
                                                {tag}
                                            </Link>
                                        ))}
                                    </div>
                                </div>

                                {/* Comments */}
                                <BlogComments postId={params.slug} userId={userId || null} userName={userName} />
                            </div>
                        </div>

                        {/* Sidebar */}
                        <div className="col-xl-4">
                            <aside className="sticky top-24 space-y-10 pl-0 lg:pl-4">
                                <div className="p-8 sm:p-10 rounded-[2.5rem] bg-white border-2 border-slate-50 shadow-xl shadow-slate-200/40">
                                    <h3 className="text-lg font-bold text-[#062e39] mb-6 tracking-tight">Categories</h3>
                                    <ul className="space-y-3">
                                        {CATEGORIES.map(cat => (
                                            <li key={cat.name}>
                                                <Link href="/blog" className="flex items-center justify-between group py-1">
                                                    <span className="text-slate-600 text-sm font-medium group-hover:text-[#fd5523] transition-colors">{cat.name}</span>
                                                    <span className="h-6 w-8 rounded-lg bg-slate-50 text-slate-400 text-[10px] font-bold flex items-center justify-center group-hover:bg-[#fd5523] group-hover:text-white transition-all">{cat.count}</span>
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
    )
}
