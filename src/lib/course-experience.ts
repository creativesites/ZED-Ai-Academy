import type { CourseLevel, PriceType } from "@/types/database";

export const COURSE_CATEGORIES = [
  "Prompt Engineering",
  "AI Tools",
  "Machine Learning",
  "AI for Business",
  "Data Science",
  "Natural Language Processing",
  "Computer Vision",
  "Photography",
  "AI Ethics",
] as const;

export const COURSE_CATEGORY_FILTERS = [
  "all",
  "prompt-engineering",
  "ai-tools",
  "ai-for-business",
  "machine-learning",
  "computer-vision",
  "photography",
] as const;

export const COURSE_LEVEL_FILTERS = ["all", "beginner", "intermediate", "advanced"] as const;

type CourseMeta = {
  audience: string;
  firstWin: string;
  tools: string[];
  whatYoullLearn: string[];
  isFor: string[];
};

const COURSE_META: Record<string, CourseMeta> = {
  "Prompt Engineering": {
    audience: "Operators, analysts, consultants, founders, and team leads.",
    firstWin: "Turn one vague request into a prompt that reliably produces client-ready output.",
    tools: ["Claude", "ChatGPT", "Gemini", "Perplexity"],
    whatYoullLearn: [
      "Write prompts that produce consistent, usable output every time",
      "Structure multi-step instructions for complex knowledge tasks",
      "Build a reusable prompt library for your most common workflows",
      "Test and improve prompts without wasting hours on trial and error",
      "Apply role, context, and format techniques used by professionals",
      "Spot when an AI response needs correction — and fix it fast",
    ],
    isFor: [
      "Professionals who send the same type of request repeatedly and want better results",
      "Team leads who want a shared prompt library their team can rely on",
      "Anyone frustrated with inconsistent AI output across tools",
    ],
  },
  "AI Tools": {
    audience: "Busy professionals who need leverage without deep technical setup.",
    firstWin: "Automate a repetitive knowledge task in under 10 minutes.",
    tools: ["Claude", "Zapier", "Make", "Notion AI"],
    whatYoullLearn: [
      "Match the right AI tool to the right job — without getting overwhelmed by options",
      "Automate repetitive knowledge tasks with no-code or low-code setups",
      "Connect AI tools to the apps you already use (email, docs, CRM)",
      "Build a lightweight SOP for recurring AI-assisted work",
      "Evaluate tool quality and know when to switch or combine tools",
      "Protect sensitive data when using third-party AI services",
    ],
    isFor: [
      "Professionals who want to use AI but don't know where to start",
      "Small teams looking to automate repetitive back-office or communication work",
      "Managers who want to evaluate AI tools for their team without technical help",
    ],
  },
  "Machine Learning": {
    audience: "Technical professionals, product teams, and AI implementers.",
    firstWin: "Translate a model concept into a business decision you can defend.",
    tools: ["Python", "Jupyter", "Pandas", "scikit-learn"],
    whatYoullLearn: [
      "Understand the core concepts behind supervised and unsupervised learning",
      "Choose the right model type for classification, regression, and clustering problems",
      "Evaluate model performance with the metrics that actually matter",
      "Avoid data leakage and common pitfalls that break production models",
      "Communicate ML results clearly to non-technical stakeholders",
      "Plan a practical model deployment and monitoring workflow",
    ],
    isFor: [
      "Technical professionals moving from theory to applied machine learning",
      "Product managers who work alongside data science teams and need to ask better questions",
      "Analysts ready to go beyond dashboards into predictive models",
    ],
  },
  "AI for Business": {
    audience: "Managers, founders, marketers, revenue teams, and operations leaders.",
    firstWin: "Save time on meetings, reporting, or customer communication by the end of module one.",
    tools: ["Claude", "ChatGPT", "Otter.ai", "Zapier"],
    whatYoullLearn: [
      "Identify the highest-ROI AI use cases in your specific business function",
      "Redesign one recurring process with AI and measure the time saved",
      "Write AI policy guidelines your team can follow without confusion",
      "Evaluate AI vendor claims and avoid tools that don't deliver",
      "Build a before-and-after ROI story to share with stakeholders",
      "Set up basic AI governance for data, decisions, and quality checks",
    ],
    isFor: [
      "Business leaders who want practical AI adoption, not just theory",
      "Founders and operators looking to reduce overhead with intelligent automation",
      "Managers responsible for improving team efficiency through new tools",
    ],
  },
  "Computer Vision": {
    audience: "Photographers, creative professionals, and visual content teams.",
    firstWin: "Remove a background from a client photo in 30 seconds — no masking required.",
    tools: ["Topaz Photo AI", "Remove.bg", "Adobe Firefly", "Lightroom", "Canva AI"],
    whatYoullLearn: [
      "Use AI background removal tools that produce clean, professional results",
      "Batch-process dozens of images in the time it used to take to edit one",
      "Apply AI sharpening and denoising without losing your photographic style",
      "Use generative fill and object removal for clean, natural results",
      "Build an automated export pipeline from shoot to client delivery",
      "Audit AI-enhanced images for artifacts and style consistency",
    ],
    isFor: [
      "Creative professionals who process large volumes of images and need faster turnaround",
      "Photography studio owners looking to scale output without hiring more editors",
      "Visual content teams that want consistent quality across every asset",
    ],
  },
  "Photography": {
    audience: "Portrait, event, and commercial photographers who want to scale output.",
    firstWin: "Edit a full 20-photo shoot in under 5 minutes using AI batch enhancement.",
    tools: ["Lightroom", "Topaz Photo AI", "Remove.bg", "Canva AI", "Adobe Firefly"],
    whatYoullLearn: [
      "Cull a 200-shot shoot in minutes using AI selection tools",
      "Apply consistent colour grading across an entire session automatically",
      "Retouch portraits naturally — without the plastic AI look",
      "Remove backgrounds, objects, and distractions in seconds",
      "Deliver polished client galleries faster without sacrificing your signature style",
      "Build a repeatable shoot-to-delivery SOP powered by AI",
    ],
    isFor: [
      "Photographers spending more time editing than shooting — and ready to flip that ratio",
      "Studio owners who want to handle more clients without burning out their team",
      "Freelancers who want to compete with larger studios by automating post-production",
    ],
  },
  default: {
    audience: "Professionals who want measurable AI skills, not abstract exposure.",
    firstWin: "Apply AI to a real task within the first lesson instead of staying in theory.",
    tools: ["Claude", "ChatGPT", "Zapier", "Notion AI"],
    whatYoullLearn: [
      "Apply AI to a real work task by the end of the first lesson",
      "Build a repeatable workflow you can use in your role immediately",
      "Avoid the most common AI mistakes that waste time and produce bad output",
      "Evaluate AI output quality and know when not to trust it",
      "Adapt AI tools to your specific industry context",
      "Document your AI workflow so your team can use it too",
    ],
    isFor: [
      "Professionals who want to use AI at work but aren't sure where to start",
      "Anyone who has tried AI tools casually and wants a structured approach",
      "Teams looking to build a consistent AI practice across their organisation",
    ],
  },
};

export function slugify(text: string) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export function formatCategoryLabel(slug: string) {
  if (slug === "all") return "All";
  return slug
    .split("-")
    .map((part) => part[0].toUpperCase() + part.slice(1))
    .join(" ");
}

export function formatLevelLabel(level: string | null | undefined) {
  if (!level) return "All levels";
  return level[0].toUpperCase() + level.slice(1);
}

export function formatPrice(priceType: PriceType, priceAmount: number | null) {
  if (priceType === "free") return "Free";
  if (priceAmount) return `ZMW ${priceAmount.toLocaleString()}`;
  return priceType === "subscription_only" ? "Subscription" : "Flexible pricing";
}

export function getCourseMeta(category: string | null | undefined): CourseMeta {
  if (!category) return COURSE_META.default;
  return COURSE_META[category] ?? COURSE_META.default;
}
