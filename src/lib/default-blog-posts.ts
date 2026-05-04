import type { Json } from "@/types/database";

export type BlogContentBlock =
  | { type: "p"; text: string }
  | { type: "h2"; text: string }
  | { type: "callout"; text: string };

export type DefaultBlogPost = {
  slug: string;
  title: string;
  excerpt: string;
  category: string;
  author_name: string;
  read_time: string;
  tags: string[];
  card_image_url: string;
  hero_image_url: string;
  published_at: string;
  content: BlogContentBlock[];
};

export const DEFAULT_BLOG_POSTS: DefaultBlogPost[] = [
  {
    slug: "5-ways-chatgpt-can-transform-your-workday",
    title: "5 Ways ChatGPT Can Transform Your Workday Right Now",
    excerpt: "From drafting emails to summarising meetings — discover the most immediately useful ChatGPT workflows for Zambian professionals.",
    category: "Productivity",
    author_name: "Zed AI Team",
    read_time: "7 min read",
    tags: ["ChatGPT", "Efficiency", "Workplace", "Zambia"],
    card_image_url: "https://images.unsplash.com/photo-1677442135703-1787eea5ce01?w=600&q=80&auto=format&fit=crop",
    hero_image_url: "https://images.unsplash.com/photo-1677442135703-1787eea5ce01?w=1200&q=80&auto=format&fit=crop",
    published_at: "2026-04-12T08:00:00.000Z",
    content: [
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
      { type: "p", text: "The key to success with ChatGPT is practice. Start with one use case — perhaps email drafting — and build from there. Within a week, you will wonder how you ever worked without it. Our Prompt Engineering Mastery course covers all of these techniques and more, with hands-on exercises designed for Zambian professionals." }
    ],
  },
  {
    slug: "how-zambian-businesses-are-using-ai-in-2026",
    title: "How Zambian Businesses Are Using AI in 2026",
    excerpt: "We spoke with SME owners and corporate teams across Lusaka to find out how AI tools are changing the way Zambia does business.",
    category: "Business",
    author_name: "Zed AI Team",
    read_time: "8 min read",
    tags: ["Business", "Strategy", "Automation", "Zambia"],
    card_image_url: "https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=600&q=80&auto=format&fit=crop",
    hero_image_url: "https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=1200&q=80&auto=format&fit=crop",
    published_at: "2026-03-28T08:00:00.000Z",
    content: [
      { type: "p", text: "Two years ago, AI felt like a distant technology reserved for global tech giants. Today, the story in Zambia is remarkably different. SMEs in Lusaka, Ndola, and Kitwe are embedding AI tools into their daily operations — and seeing real results." },
      { type: "h2", text: "Marketing and content creation" },
      { type: "p", text: "Marketing agencies and in-house teams are using AI to produce social media content, write ad copy, and generate campaign ideas at a pace that was previously impossible. One Lusaka-based digital agency told us they reduced their content production time by 60% after adopting AI writing tools." },
      { type: "h2", text: "Customer service automation" },
      { type: "p", text: "Several Zambian businesses have deployed AI-powered chatbots on WhatsApp to handle common customer queries. A mobile money agent network reported that their AI assistant handles over 200 customer questions per day — freeing up their human agents for complex cases." },
      { type: "callout", text: "📊 By the numbers: Zambian businesses using AI report an average 40% reduction in time spent on repetitive tasks and a 25% increase in customer response speed." },
      { type: "h2", text: "Financial analysis and reporting" },
      { type: "p", text: "Accountants and financial analysts are using AI to automate report generation, flag anomalies in transaction data, and create forecasting models. What used to take a full day of spreadsheet work can now be done in under an hour." },
      { type: "h2", text: "The road ahead" },
      { type: "p", text: "The businesses that invest in AI skills today will have a significant competitive advantage tomorrow. The technology is accessible, affordable, and immediately practical. The only barrier is knowledge — and that is exactly what Zed AI Academy is here to solve." }
    ],
  },
  {
    slug: "from-zero-to-ai-beginners-guide",
    title: "From Zero to AI: A Beginner's Guide to Getting Started",
    excerpt: "Never touched an AI tool before? This guide walks you through the first steps, the best free tools and what to learn first.",
    category: "Beginners",
    author_name: "Zed AI Team",
    read_time: "10 min read",
    tags: ["Beginners", "Getting Started", "Free Tools", "Learning"],
    card_image_url: "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=600&q=80&auto=format&fit=crop",
    hero_image_url: "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=1200&q=80&auto=format&fit=crop",
    published_at: "2026-03-10T08:00:00.000Z",
    content: [
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
      { type: "p", text: "Once you are comfortable with basic AI interactions, the next step is learning prompt engineering — the skill of communicating effectively with AI. This is the single most valuable AI skill you can learn, and it is the foundation of every course at Zed AI Academy." }
    ],
  },
  {
    slug: "midjourney-for-zambian-creatives",
    title: "Midjourney for Zambian Creatives: A Practical First Look",
    excerpt: "Designers, photographers and marketers — here is how to use Midjourney to elevate your creative output without a design degree.",
    category: "Creative",
    author_name: "Zed AI Team",
    read_time: "6 min read",
    tags: ["Midjourney", "Design", "Photography", "Creative AI"],
    card_image_url: "https://images.unsplash.com/photo-1542038784456-1ea8e935640e?w=600&q=80&auto=format&fit=crop",
    hero_image_url: "https://images.unsplash.com/photo-1542038784456-1ea8e935640e?w=1200&q=80&auto=format&fit=crop",
    published_at: "2026-03-02T08:00:00.000Z",
    content: [
      { type: "p", text: "Designers, photographers, and marketers — AI image generation is not here to replace you. It is here to supercharge your creative output. Midjourney is one of the most powerful tools in this space, and Zambian creatives are already using it to stunning effect." },
      { type: "h2", text: "What can Midjourney actually do?" },
      { type: "p", text: "Midjourney generates photorealistic images, illustrations, textures, and concept art from text descriptions. Need a hero image for a website? A product mockup? A social campaign visual? Midjourney can produce compelling starting points in minutes." },
      { type: "h2", text: "Why creatives should care" },
      { type: "p", text: "The real power is speed. Instead of waiting days for a mockup or spending hours assembling references, you can generate dozens of concepts, evaluate them, and move forward with the strongest direction. It sharpens the creative process instead of slowing it down." },
      { type: "callout", text: "🖼️ Best practice: treat AI images as concept accelerators and production tools — but keep your own taste, art direction, and editing standards in the loop." },
      { type: "h2", text: "Where it fits in the Zambian market" },
      { type: "p", text: "For local agencies, studios, and freelancers, Midjourney can reduce concepting time, support client pitches, and help produce visuals for campaigns that would otherwise need a much larger production budget." },
      { type: "h2", text: "Start practical" },
      { type: "p", text: "Begin with simple prompts tied to real work. Generate three hero concepts for a fintech landing page. Create moodboards for a wedding photography brand. Build social ad variations for a Lusaka retail campaign. The goal is not novelty — it is better creative throughput." }
    ],
  },
  {
    slug: "ai-for-small-business-zambia",
    title: "AI for Small Business in Zambia: Where to Start",
    excerpt: "You do not need a big budget or a tech team to use AI. Here are the highest-leverage tools any SME can adopt today.",
    category: "Business",
    author_name: "Zed AI Team",
    read_time: "7 min read",
    tags: ["SMEs", "Automation", "Growth", "Zambia"],
    card_image_url: "https://images.unsplash.com/photo-1556761175-5973dc0f32e7?w=600&q=80&auto=format&fit=crop",
    hero_image_url: "https://images.unsplash.com/photo-1556761175-5973dc0f32e7?w=1200&q=80&auto=format&fit=crop",
    published_at: "2026-02-18T08:00:00.000Z",
    content: [
      { type: "p", text: "For many SME owners, AI still sounds expensive, complex, or irrelevant. In practice, the opposite is often true. The best AI use cases for small businesses are inexpensive, fast to implement, and immediately useful." },
      { type: "h2", text: "Start with communication" },
      { type: "p", text: "Use AI to draft customer messages, social captions, sales follow-ups, and support replies. Communication is where most small businesses feel the impact first because the time savings show up immediately." },
      { type: "h2", text: "Use AI on repetitive admin" },
      { type: "p", text: "AI can help summarise meeting notes, format quotations, create product descriptions, and organise internal knowledge. That means owners and managers spend less time on routine tasks and more time on customers and growth." },
      { type: "h2", text: "Adopt only one workflow at a time" },
      { type: "p", text: "The mistake is trying ten tools at once. Pick one workflow — perhaps WhatsApp reply templates or proposal drafting — and make that routine first. Once it works, add the next workflow." },
      { type: "callout", text: "⚙️ Rule of thumb: if a task is repeated every week and follows a recognisable pattern, AI can probably reduce the time it takes." },
      { type: "h2", text: "Build skill, not dependency" },
      { type: "p", text: "The goal is not to let AI run your business unsupervised. The goal is to make your team faster, clearer, and more consistent. The highest-leverage investment is not just the tool — it is learning how to direct it well." }
    ],
  },
  {
    slug: "writing-better-prompts-guide",
    title: "Writing Better Prompts: The Guide Every AI Learner Needs",
    excerpt: "The quality of your prompt determines the quality of your output. Learn the core framework our instructors teach.",
    category: "Prompt Engineering",
    author_name: "Zed AI Team",
    read_time: "9 min read",
    tags: ["Prompting", "Frameworks", "ChatGPT", "Learning"],
    card_image_url: "https://images.unsplash.com/photo-1488190211105-8b0e65b80b4e?w=600&q=80&auto=format&fit=crop",
    hero_image_url: "https://images.unsplash.com/photo-1488190211105-8b0e65b80b4e?w=1200&q=80&auto=format&fit=crop",
    published_at: "2026-02-05T08:00:00.000Z",
    content: [
      { type: "p", text: "The quality of your prompt determines the quality of your output. This is the single most important principle in working with AI — and yet most people never learn it properly. This guide teaches you the framework our instructors use to get dramatically better results from any AI tool." },
      { type: "h2", text: "Start with context" },
      { type: "p", text: "Tell the model what situation it is operating in. What industry? What audience? What goal? Context reduces generic responses and gives the model a better target." },
      { type: "h2", text: "Be explicit about the output" },
      { type: "p", text: "If you want bullet points, say so. If you want a table, say so. If you want a 200-word answer in a professional tone, say so. Ambiguous prompts create ambiguous output." },
      { type: "h2", text: "Add constraints and examples" },
      { type: "p", text: "Useful prompts include what to avoid, what tone to use, and examples of good output. Constraints turn AI from a vague assistant into a disciplined collaborator." },
      { type: "callout", text: "🧠 Prompt framework: Context + Task + Output Format + Constraints + Examples. That one structure will outperform most casual prompting." },
      { type: "h2", text: "Iterate deliberately" },
      { type: "p", text: "Prompt engineering is not writing one perfect prompt. It is running an iteration loop. Ask, inspect the result, identify what is missing, and sharpen the next prompt." },
      { type: "h2", text: "Practice daily" },
      { type: "p", text: "Prompt engineering is a skill that improves with practice. We recommend spending 15 minutes per day experimenting with different prompt structures. Within two weeks, you will see a dramatic improvement in the quality of AI outputs you generate. Our Prompt Engineering Mastery course provides structured practice with feedback from expert instructors." }
    ],
  },
];

export function serializeBlogContent(content: DefaultBlogPost["content"]): Json {
  return content as Json;
}
