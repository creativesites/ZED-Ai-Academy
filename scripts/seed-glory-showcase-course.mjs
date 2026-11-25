import fs from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

// Load .env.local if env vars are not already set
const envPath = path.resolve(process.cwd(), ".env.local");
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && !process.env[m[1]]) {
      process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  }
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl || !serviceKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceKey, {
  auth: { persistSession: false },
});

// Glory Academy tenant & personas (verified in Supabase)
const GLORY_COMPANY_ID = "org_3DY88EgTBaSfnjlfZJR81KReoUa";
const GLORY_INSTRUCTOR_ID = "user_3DH0UDkmDuV7ORQUn3N7hBIKlAL";
const PERSONA_TINASHE_ID = "910e0000-0000-4000-8000-000000000001";
const PERSONA_MWILA_ID = "910e0000-0000-4000-8000-000000000002";

// Deterministic UUIDs for idempotent re-seeding
const COURSE_ID = "910e0000-0000-4000-8000-000000000301";
const COURSE_SLUG = "practical-ai-productivity-mastery";

const MOD = {
  m1: "910e0000-0000-4000-8000-000000000311",
  m2: "910e0000-0000-4000-8000-000000000312",
  m3: "910e0000-0000-4000-8000-000000000313",
};

const LES = {
  l1: "910e0000-0000-4000-8000-000000000321",
  l2: "910e0000-0000-4000-8000-000000000322",
  l3: "910e0000-0000-4000-8000-000000000323",
  l4: "910e0000-0000-4000-8000-000000000324",
  l5: "910e0000-0000-4000-8000-000000000325",
  l6: "910e0000-0000-4000-8000-000000000326",
};

const SCEN = {
  promptMakeover: "910e0000-0000-4000-8000-000000000351",
  roiSandbox: "910e0000-0000-4000-8000-000000000352",
  pitchRoleplay: "910e0000-0000-4000-8000-000000000353",
};

const QUIZ = {
  q1: "910e0000-0000-4000-8000-000000000361",
  q2: "910e0000-0000-4000-8000-000000000362",
  q3: "910e0000-0000-4000-8000-000000000363",
};

async function run() {
  console.log("Seeding Glory Academy showcase course...");

  // 1. Upsert the 3 custom published AI Teacher scenarios (visibility: tenant_library so /try/[id] works with zero login!)
  const scenarios = [
    {
      id: SCEN.promptMakeover,
      company_id: GLORY_COMPANY_ID,
      course_id: COURSE_ID,
      lesson_id: LES.l2,
      persona_id: PERSONA_MWILA_ID,
      title: "Prompt Makeover Lab with Maureen",
      goal: "Transform a vague everyday work request into a crisp, executive-ready R.C.T.F. (Role, Context, Task, Format) prompt in 3 interactive turns using side-by-side board comparisons and quick choices.",
      skill_pack: "general-tutor",
      level: "Beginner · Interactive",
      style: "guided_lesson",
      scene: "Scene_Studio",
      max_minutes: 4,
      status: "published",
      visibility: "tenant_library",
      allowed_modes: ["voice", "text"],
      beats: [
        {
          id: "spot-gap",
          goal: "Show a compare board ('Weak: Write a follow-up email' vs 'Strong: R.C.T.F. prompt') and use ask_choice so the learner picks a workplace task (client follow-up, meeting summary, or project proposal) or types their own",
          targetItems: ["Role + Context"],
        },
        {
          id: "add-role-context",
          goal: "Coach the learner to add a clear Role and 1–2 sentences of Context for their chosen task",
          targetItems: ["Role + Context"],
        },
        {
          id: "lock-format",
          goal: "Have the learner lock in Task & Format constraints (length, bullets, tone) and display their upgraded R.C.T.F. prompt on the board",
          targetItems: ["Task + Format"],
        },
      ],
      target_items: [
        { text: "Role + Context", meaning: "Tell AI who it is and the exact situation" },
        { text: "Task + Format", meaning: "State the concrete deliverable, tone, and length" },
      ],
    },
    {
      id: SCEN.roiSandbox,
      company_id: GLORY_COMPANY_ID,
      course_id: COURSE_ID,
      lesson_id: LES.l4,
      persona_id: PERSONA_TINASHE_ID,
      title: "Live AI ROI & Time-Saved Lab with Tinashe",
      goal: "Calculate how many hours and dollars a simple AI workflow saves each month using a live Formula Sandbox equation (MonthlySavings = HoursPerWeek * 4 * HourlyRate) and an interactive Bar/Line/Donut workflow chart.",
      skill_pack: "general-tutor",
      level: "Practical · Visual Math",
      style: "guided_lesson",
      scene: "Scene_Classroom",
      max_minutes: 5,
      status: "published",
      visibility: "tenant_library",
      allowed_modes: ["voice", "text"],
      beats: [
        {
          id: "formula-sandbox",
          goal: "Show an equation board with the exact formula 'MonthlySavings = HoursPerWeek * 4 * HourlyRate' so interactive sliders appear, and use ask_choice to let the learner pick a weekly time-saving target or test their own slider numbers",
          targetItems: ["MonthlySavings = HoursPerWeek * 4 * HourlyRate"],
        },
        {
          id: "workflow-chart",
          goal: "Show a chart board comparing weekly hours spent across 3 tasks ('Email Triage: 5', 'Meeting Notes: 4', 'Report Drafting: 6') and ask which single task offers the fastest win",
          targetItems: ["High-frequency × High-friction"],
        },
        {
          id: "pick-highest-roi",
          goal: "Confirm the learner's #1 high-leverage workflow to pilot this week and celebrate their concrete monthly ROI number",
          targetItems: ["High-frequency × High-friction"],
        },
      ],
      target_items: [
        { text: "MonthlySavings = HoursPerWeek * 4 * HourlyRate", meaning: "Simple monthly ROI calculation for any workflow" },
        { text: "High-frequency × High-friction", meaning: "The sweet spot for your first AI automation" },
      ],
    },
    {
      id: SCEN.pitchRoleplay,
      company_id: GLORY_COMPANY_ID,
      course_id: COURSE_ID,
      lesson_id: LES.l6,
      persona_id: PERSONA_MWILA_ID,
      title: "Executive AI Pitch Roleplay with Maureen",
      goal: "Roleplay pitching a 2-week AI workflow pilot to Maureen (acting as a sharp Operations Director), defending time saved, Traffic-Light data privacy, and human-in-the-loop review.",
      skill_pack: "general-tutor",
      level: "Capstone · Roleplay",
      style: "scene",
      scene: "Scene_Studio",
      max_minutes: 5,
      status: "published",
      visibility: "tenant_library",
      allowed_modes: ["voice", "text"],
      beats: [
        {
          id: "value-pitch",
          goal: "Play a sharp Operations Director, display a 3-step diagram board ('1. Time Saved -> 2. Data Privacy -> 3. Human Review'), and ask the learner to pitch their workflow problem & hours saved (with ask_choice starters)",
          targetItems: ["Human-in-the-Loop Pilot"],
        },
        {
          id: "privacy-guardrail",
          goal: "Challenge the learner on how confidential client data stays safe under the Traffic-Light Privacy Rule",
          targetItems: ["Traffic-Light Privacy Rule"],
        },
        {
          id: "pilot-plan",
          goal: "Ask for a safe 2-week human-in-the-loop pilot plan, then approve the pitch with specific encouraging praise",
          targetItems: ["Human-in-the-Loop Pilot"],
        },
      ],
      target_items: [
        { text: "Traffic-Light Privacy Rule", meaning: "Never paste sensitive client or financial records into public tools" },
        { text: "Human-in-the-Loop Pilot", meaning: "Start small, measure results, and verify every output" },
      ],
    },
  ];

  // 1a. Upsert Course, Modules, and Lessons first so practice_scenarios.course_id & lesson_id FKs are satisfied
  const { error: courseErr } = await supabase.from("courses").upsert(
    {
      id: COURSE_ID,
      company_id: GLORY_COMPANY_ID,
      instructor_id: GLORY_INSTRUCTOR_ID,
      slug: COURSE_SLUG,
      title: "Practical AI & Productivity Mastery: Work 3× Smarter in 60 Minutes",
      description:
        "A free course from Glory Academy — no sign-up needed. Learn the R.C.T.F. prompt formula, build repeatable no-code AI workflows, calculate the real time and money AI saves you with live sliders, master AI privacy guardrails, and practise face-to-face with friendly AI teachers who talk, write on the board and give you feedback.",
      thumbnail_url:
        "https://images.unsplash.com/photo-1677442136019-21780ecad995?auto=format&fit=crop&w=1200&q=80",
      category: "AI & Productivity",
      level: "beginner",
      status: "published",
      price_type: "free",
      price_amount: 0,
      is_featured: true,
      require_certificate_viva: false,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "id" },
  );
  if (courseErr) throw courseErr;

  // 2. Upsert Modules
  const modules = [
    { id: MOD.m1, course_id: COURSE_ID, title: "How Modern AI Works & The Prompt Formula", position: 1 },
    { id: MOD.m2, course_id: COURSE_ID, title: "No-Code AI Workflows & Live ROI Coaching", position: 2 },
    { id: MOD.m3, course_id: COURSE_ID, title: "AI Safety, Grounding & Executive Pitch Capstone", position: 3 },
  ];
  for (const m of modules) {
    const { error } = await supabase.from("modules").upsert(m, { onConflict: "id" });
    if (error) throw error;
  }

  // 3. Upsert Lessons (ALL is_preview: true so guests can play the entire course with zero login!)
  const lessons = [
    { id: LES.l1, module_id: MOD.m1, title: "Inside Modern AI: Turning Hype into Everyday Leverage", position: 1, is_preview: true },
    { id: LES.l2, module_id: MOD.m1, title: "The R.C.T.F. Prompt Formula & Live Prompt Makeover", position: 2, is_preview: true },
    { id: LES.l3, module_id: MOD.m2, title: "Building a Repeatable 3-Step AI Workflow (No Code)", position: 1, is_preview: true },
    { id: LES.l4, module_id: MOD.m2, title: "Measuring Time Saved & ROI with Live Formula Sliders", position: 2, is_preview: true },
    { id: LES.l5, module_id: MOD.m3, title: "Preventing Hallucinations & The Traffic-Light Privacy Rule", position: 1, is_preview: true },
    { id: LES.l6, module_id: MOD.m3, title: "Capstone: Pitch Your AI Workflow to Leadership", position: 2, is_preview: true },
  ];
  for (const l of lessons) {
    const { error } = await supabase.from("lessons").upsert(l, { onConflict: "id" });
    if (error) throw error;
  }
  console.log("✓ Course, 3 modules, and 6 open-access lessons upserted.");

  // 3b. Upsert the 3 custom AI Teacher scenarios
  for (const s of scenarios) {
    const { error } = await supabase.from("practice_scenarios").upsert(s, { onConflict: "id" });
    if (error) throw error;
  }
  console.log("✓ 3 AI Teacher scenarios upserted.");

  // 4. Replace content blocks per lesson cleanly (idempotent)
  const lessonIds = Object.values(LES);
  const { error: delBlocksErr } = await supabase
    .from("content_blocks")
    .delete()
    .in("lesson_id", lessonIds);
  if (delBlocksErr) throw delBlocksErr;

  const blocksByLesson = {
    [LES.l1]: [
      {
        type: "learning_objectives",
        content: {
          title: "What You Will Master in This Course",
          objectives: [
            "Explain how Large Language Models actually generate answers — and why clear context beats clever tricks.",
            "Write executive-grade prompts in 30 seconds using the 4-part R.C.T.F. framework.",
            "Design a repeatable 3-step AI workflow and calculate its monthly ROI using live interactive sliders.",
            "Apply privacy guardrails and RAG verification so your AI-assisted work stays accurate and trustworthy.",
          ],
        },
      },
      {
        type: "video",
        content: {
          youtube_id: "LPZh9BOjkQs",
          title: "Large Language Models Explained Briefly (3Blue1Brown)",
        },
      },
      {
        type: "text",
        content: {
          html: `<h2>Why Most People Get Mediocre Results from AI</h2>
<p>Modern AI assistants like <strong>Gemini</strong>, <strong>Claude</strong>, and <strong>ChatGPT</strong> are not search engines looking up a single stored answer. They are <strong>pattern-prediction engines</strong> trained on billions of documents. When you type a vague 5-word request, the model predicts the most generic average response on the internet.</p>
<p>The secret to 10× better output is surprisingly simple: <strong>treat AI like a brilliant new colleague on their first Monday.</strong> They have world-class writing, analytical, and coding ability — but zero knowledge of your audience, goals, or constraints until you put those details on their desk.</p>`,
        },
      },
      {
        type: "image",
        content: {
          url: "https://images.unsplash.com/photo-1522071820081-009f0129c71c?auto=format&fit=crop&w=1200&q=80",
          alt: "Modern professionals collaborating around laptops in a bright workspace",
          caption: "High-performing teams treat AI as an interactive collaborator — pairing human judgment with machine speed.",
        },
      },
      {
        type: "callout",
        content: {
          variant: "important",
          title: "The Context Window Is Your Working Desk",
          body: "Everything you paste into a chat — examples, customer tone, bullet notes, constraints — sits on the AI's desk while it thinks. Better ingredients on the desk always produce sharper work.",
        },
      },
      {
        type: "glossary",
        content: {
          title: "5 Essential AI Terms in Plain English",
          terms: [
            {
              term: "Context Window",
              definition: "The AI's short-term working memory — everything in your current conversation that it can read before generating its next reply.",
            },
            {
              term: "Few-Shot Prompting",
              definition: "Showing 2–3 examples of the exact output style you want before asking AI to produce a new one.",
            },
            {
              term: "Hallucination",
              definition: "A confident, fluent-sounding answer that invents facts, citations, or numbers because the model predicted plausible words instead of checking a source.",
            },
            {
              term: "Grounding / RAG",
              definition: "Retrieval-Augmented Generation — supplying your own verified documents, policies, or data so the AI answers strictly from trusted facts.",
            },
            {
              term: "Human-in-the-Loop",
              definition: "Keeping a skilled person in charge of reviewing, refining, and approving AI drafts before anything reaches a client or decision-maker.",
            },
          ],
        },
      },
      {
        type: "key_takeaway",
        content: {
          title: "Lesson 1.1 Key Takeaways",
          points: [
            "AI predicts the most likely continuation of your input — vague prompts create generic outputs.",
            "Give AI the same briefing you would give a capable teammate on Day 1.",
            "Tap the Ask button at the top of any lesson to ask questions about this lesson without leaving the page.",
          ],
        },
      },
    ],

    [LES.l2]: [
      {
        type: "video",
        content: {
          youtube_id: "jC4v5AS4RIM",
          title: "Master the Perfect Prompt Formula in 8 Minutes (Jeff Su)",
        },
      },
      {
        type: "steps",
        content: {
          title: "The R.C.T.F. Prompt Formula (4 Building Blocks)",
          steps: [
            {
              title: "R — Role (Who should AI act as?)",
              body: "Anchor the perspective and vocabulary: e.g., 'Act as a senior customer success manager writing to a busy operations director.'",
            },
            {
              title: "C — Context (What is the real situation?)",
              body: "Share the goal, audience, constraints, and rough notes so AI doesn't guess. Two sentences of context beat ten adjectives.",
            },
            {
              title: "T — Task (What exact action should it perform?)",
              body: "Start with a strong verb: summarize, draft, compare, critique, extract action items, or rewrite for clarity.",
            },
            {
              title: "F — Format (What should the finished output look like?)",
              body: "Define structure and length: 'A 3-bullet executive summary under 120 words, followed by a 2-column action table with owners.'",
            },
          ],
        },
      },
      {
        type: "before_after",
        content: {
          before_url: "https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?auto=format&fit=crop&w=1200&q=80",
          after_url: "https://images.unsplash.com/photo-1551288049-bebda4e38f71?auto=format&fit=crop&w=1200&q=80",
          caption: "Drag the slider: Moving from unstructured manual notes & blank pages (Before) to structured, executive-ready insights in minutes (After).",
        },
      },
      {
        type: "ai_prompt",
        content: {
          label: "Copy-and-Use R.C.T.F. Template",
          tool: "Works in Gemini, ChatGPT & Claude",
          prompt: `ROLE: Act as a clear, concise operations lead.
CONTEXT: I just finished a 30-minute client onboarding call. Our client wants to launch in 14 days, is worried about staff training time, and needs pricing confirmation by Friday.
TASK: Turn my rough bullet notes below into a warm, confident follow-up email that confirms next steps and builds trust.
FORMAT:
- Subject line (under 8 words)
- 3-sentence opening paragraph
- Bulleted "Next Steps & Owners" list (max 4 bullets)
- Total length under 160 words. Tone: warm, direct, zero jargon.

MY ROUGH NOTES:
[Paste your messy notes here]`,
        },
      },
      {
        type: "comparison_table",
        content: {
          title: "Vague Prompt vs. R.C.T.F. Prompt — Side by Side",
          headers: ["Dimension", "Vague Prompt", "R.C.T.F. Prompt"],
          rows: [
            { label: "First-draft usability", values: ["~30% (needs heavy rewriting)", "~90% (ready after quick polish)"] },
            { label: "Matches your audience & tone", values: [false, true] },
            { label: "Consistent team format", values: [false, true] },
            { label: "Average time to final email", values: ["12–15 minutes", "2–3 minutes"] },
            { label: "Reusable across colleagues", values: [false, true] },
          ],
        },
      },
      {
        type: "tutor_session",
        content: {
          scenarioId: SCEN.promptMakeover,
          title: "Interactive Lab: Prompt Makeover with Maureen",
          intro:
            "Step into the live AI Studio with Maureen. You'll pick a real work task and transform a weak prompt into a sharp R.C.T.F. prompt together.",
          style: "guided_lesson",
          required: false,
        },
      },
      {
        type: "quiz",
        content: {},
      },
    ],

    [LES.l3]: [
      {
        type: "video",
        content: {
          youtube_id: "p09yRj47kNM",
          title: "Practical AI Prompting & Workflow Essentials (Tina Huang)",
        },
      },
      {
        type: "case_study",
        content: {
          title: "How a 6-Person Service Team Reclaimed 14 Hours Every Week",
          body: `<p>A growing training & consulting team spent every Friday afternoon manually turning scattered WhatsApp notes, meeting recordings, and spreadsheet rows into client status reports and follow-up emails. Each manager lost <strong>2.5 hours per week</strong> to formatting alone.</p>
<p>Instead of buying expensive custom software, they built a <strong>3-step reusable AI workflow</strong>:</p>
<ol>
<li><strong>Capture:</strong> Drop raw meeting bullet notes into one shared weekly template.</li>
<li><strong>Transform:</strong> Run one locked R.C.T.F. prompt that extracts decisions, blockers, and a client-ready email draft.</li>
<li><strong>Verify &amp; Send:</strong> A team lead spends 3 minutes verifying dates and figures before sending.</li>
</ol>`,
          outcome:
            "Result: Weekly reporting time dropped from 150 minutes to 22 minutes per manager — reclaiming 14+ hours/week across the team with zero new software budget.",
        },
      },
      {
        type: "tool_spotlight",
        content: {
          name: "Google Gemini Workspace",
          icon: "✨",
          description:
            "Best for synthesizing long documents, drafting structured proposals, analyzing tables, and brainstorming alongside Google Docs & Sheets.",
          url: "https://gemini.google.com",
        },
      },
      {
        type: "tool_spotlight",
        content: {
          name: "Make / Zapier No-Code Automations",
          icon: "⚡",
          description:
            "Connect forms, spreadsheets, email, and AI steps automatically so routine summaries and intake routing run in the background while you focus on customers.",
          url: "https://www.make.com",
        },
      },
      {
        type: "checklist",
        content: {
          title: "Your 15-Minute AI Workflow Audit (Check Off As You Go!)",
          items: [
            "List 3 tasks you repeat every single week (emails, meeting recaps, reports, proposals).",
            "Circle the one task that feels most repetitive AND follows a predictable structure.",
            "Save one anonymized 'gold standard' example of what a great finished version looks like.",
            "Write a reusable R.C.T.F. prompt that includes your gold standard example.",
            "Time yourself before and after — keep the prompt in a shared team library if it saves >50% time.",
          ],
        },
      },
      {
        type: "practice_exercise",
        content: {
          title: "Build Your First Reusable Workflow Prompt",
          mode: "text_response",
          estimated_minutes: 5,
          brief:
            "Pick one repetitive task from your own work or studies (e.g., weekly progress update, lesson plan, customer quote, or study notes). Use the built-in Practice Studio button below to optimize it into a reusable prompt!",
          instructions: [
            "Click 'Launch Practice Studio' (or draft directly below) and select Prompt Optimizer or Workflow Generator.",
            "Include a clear Role, real-world Context, concrete Task, and strict output Format.",
            "Review the generated workflow and note how many minutes per week it could save you.",
          ],
        },
      },
    ],

    [LES.l4]: [
      {
        type: "image",
        content: {
          url: "https://images.unsplash.com/photo-1460925895917-afdab827c52f?auto=format&fit=crop&w=1200&q=80",
          alt: "Clean financial and productivity dashboard displayed on a laptop",
          caption: "Measuring reclaimed hours turns 'cool AI tricks' into an undeniable business case.",
        },
      },
      {
        type: "text",
        content: {
          html: `<h2>The One-Line AI Productivity Formula</h2>
<p>Great teams don't adopt AI because it's trendy — they adopt it where the math is obvious. Before automating any process, run this 10-second calculation:</p>
<blockquote><strong>Monthly Savings = Hours Saved per Week × 4 × Hourly Value</strong></blockquote>
<p>Even saving just <strong>3 hours per week</strong> on meeting notes, reporting, and email drafting unlocks <strong>12 hours every month</strong> — a full workday and a half returned to high-value thinking, sales, or teaching.</p>`,
        },
      },
      {
        type: "expert_note",
        author: "Tinashe · Lead Productivity Coach, Glory Academy",
        content: {
          author: "Tinashe · Lead Productivity Coach, Glory Academy",
          note: "Don't chase 100% automation on Day 1. Automating 75% of the messy first draft while keeping a sharp human in charge of the final 25% gives you the biggest speed gain with the lowest risk.",
        },
      },
      {
        type: "tutor_session",
        content: {
          scenarioId: SCEN.roiSandbox,
          title: "Live Lab: Formula Sliders & Workflow Charts with Tinashe",
          intro:
            "Join Tinashe in the classroom. Tinashe puts a live interactive Formula Sandbox on the board so you can drag sliders for Hours/Week and Hourly Rate, plus switch between Bar, Line, and Donut charts.",
          style: "guided_lesson",
          required: false,
        },
      },
      {
        type: "quiz",
        content: {},
      },
    ],

    [LES.l5]: [
      {
        type: "video",
        content: {
          youtube_id: "T-D1OfcDW1M",
          title: "What is Retrieval-Augmented Generation (RAG)? (IBM Technology)",
        },
      },
      {
        type: "risk_assessment",
        content: {
          title: "Workplace AI Safety & Trust Matrix",
          rows: [
            {
              hazard: "Pasting passwords, bank details, or private client records into public AI chats",
              risk: "Critical",
              control: "Apply the Traffic-Light Rule: anonymize names/IDs (use 'Client A') or use enterprise zero-retention workspaces only.",
            },
            {
              hazard: "Hallucinated statistics, legal clauses, or fake citations in a client proposal",
              risk: "High",
              control: "Ground prompts in your own source docs (RAG) and require a 2-minute human fact-check on every number and date.",
            },
            {
              hazard: "Outdated pricing or policy answers from older training data",
              risk: "Medium",
              control: "Paste the current policy snippet directly in the prompt and instruct: 'Answer ONLY from the text provided.'",
            },
            {
              hazard: "Robotic, generic tone that erodes customer trust",
              risk: "Low",
              control: "Include 1–2 short samples of your real writing voice and always do a final human read-through.",
            },
          ],
        },
      },
      {
        type: "callout",
        content: {
          variant: "warning",
          title: "The Traffic-Light Data Rule",
          body: "GREEN (Public marketing copy, templates) → Safe anywhere. YELLOW (Internal drafts) → Strip names, emails, and exact figures first. RED (Passwords, payroll, medical/ID numbers, confidential contracts) → Never paste into consumer AI tools.",
        },
      },
      {
        type: "steps",
        content: {
          title: "The 3-Minute Human-in-the-Loop Verification Check",
          steps: [
            {
              title: "1. Verify Every Number, Date & Proper Noun",
              body: "Never assume an AI-generated statistic, quote, or link is real until you see the source.",
            },
            {
              title: "2. Ask AI to Critique Its Own Draft",
              body: "Follow up with: 'List 3 assumptions or potential weaknesses in the draft above.' It catches its own blind spots remarkably well.",
            },
            {
              title: "3. Add Your Human Signature",
              body: "Edit the opening and closing lines so the message unmistakably reflects your voice and relationship.",
            },
          ],
        },
      },
      {
        type: "resource",
        content: {
          file_name: "Google Prompting Essentials — Public Quick Guide",
          file_url: "https://ai.google.dev/gemini-api/docs/prompting-strategies",
          description: "Official public reference on structured prompting, few-shot examples, and grounding strategies.",
        },
      },
    ],

    [LES.l6]: [
      {
        type: "image",
        content: {
          url: "https://images.unsplash.com/photo-1552664730-d307ca884978?auto=format&fit=crop&w=1200&q=80",
          alt: "Team discussing a strategy roadmap on a whiteboard",
          caption: "Winning team buy-in is simple when you bring real hours saved, clear privacy rules, and a low-risk 2-week pilot.",
        },
      },
      {
        type: "discussion_prompt",
        content: {
          title: "Your #1 Workflow Upgrade This Week",
          mode: "individual",
          prompt:
            "Which single recurring task in your work or studies costs you the most energy each week — and how would you redesign it using R.C.T.F. + a 3-minute human review?",
          guidance: [
            "Name the exact weekly task and roughly how many minutes it takes today.",
            "Write down what context you would give AI (and what private details you would strip out).",
            "Define one clear metric to check after 2 weeks (e.g., hours saved or faster turnaround).",
          ],
        },
      },
      {
        type: "assignment",
        content: {
          title: "Capstone Deliverable: One-Page AI Workflow Proposal",
          estimated_minutes: 15,
          summary:
            "Draft a crisp one-page pitch you could share with your manager, co-founder, or study group proposing a 2-week AI productivity pilot.",
          deliverables: [
            "Problem Statement: The repetitive task and current hours spent per week.",
            "Reusable R.C.T.F. Prompt Template + chosen tool.",
            "ROI Estimate using MonthlySavings = HoursPerWeek × 4 × HourlyRate.",
            "Privacy & Quality Guardrails (Traffic-Light rule + human sign-off step).",
          ],
          assessment:
            "Test your pitch live with Maureen in the Executive Pitch Roleplay right below — she will score your clarity, ROI logic, and privacy readiness!",
        },
      },
      {
        type: "tutor_session",
        content: {
          scenarioId: SCEN.pitchRoleplay,
          title: "Capstone Roleplay: Pitch Your AI Workflow to Maureen",
          intro:
            "Ready to put it all together? Maureen plays a sharp Operations Director reviewing your AI pilot pitch. Speak or tap your replies, export your Markdown Study Notes at the end, and see your personalized feedback report!",
          style: "scene",
          required: false,
        },
      },
      {
        type: "quiz",
        content: {},
      },
      {
        type: "key_takeaway",
        content: {
          title: "Your 30-Day AI Productivity Playbook",
          points: [
            "Week 1: Pick ONE weekly task and lock in a reusable R.C.T.F. prompt template.",
            "Week 2: Track real minutes saved and refine with 2–3 few-shot examples.",
            "Week 3–4: Share your proven template + Traffic-Light privacy checklist with your team!",
          ],
        },
      },
    ],
  };

  for (const [lessonId, list] of Object.entries(blocksByLesson)) {
    const rows = list.map((b, idx) => ({
      lesson_id: lessonId,
      type: b.type,
      position: idx + 1,
      content: b.content,
    }));
    const { error } = await supabase.from("content_blocks").insert(rows);
    if (error) throw error;
  }
  console.log("✓ All showcase content blocks inserted across 6 lessons.");

  // 5. Upsert 3 interactive Quizzes + 9 Questions with Deep Dive explanations
  const quizzes = [
    {
      id: QUIZ.q1,
      lesson_id: LES.l2,
      title: "Module 1 Check: How LLMs Work & R.C.T.F.",
      pass_threshold: 65,
      max_attempts: 5,
      questions: [
        {
          id: "910e0000-0000-4000-8000-000000000371",
          position: 1,
          question: "Why do short, vague prompts usually produce generic, underwhelming AI outputs?",
          options: [
            "Because LLMs predict the most statistically average continuation when given minimal context or constraints.",
            "Because AI models intentionally hide their best answers unless you pay for an enterprise plan.",
            "Because LLMs can only search Wikipedia for 5-word queries.",
          ],
          correct_indices: [0],
          explanation:
            "LLMs generate tokens by predicting what most plausibly follows your input. Adding Role, Context, Task, and Format narrows the prediction space dramatically.",
        },
        {
          id: "910e0000-0000-4000-8000-000000000372",
          position: 2,
          question: "In the R.C.T.F. framework, what does the 'F' stand for?",
          options: [
            "Fact-checking — asking AI to browse social media.",
            "Format — specifying exact structure, length, tone, or layout (e.g., bullets, table, word cap).",
            "Frequency — sending the same prompt multiple times.",
          ],
          correct_indices: [1],
          explanation:
            "Specifying Format (length, bullets, table columns, tone) eliminates 80% of manual reformatting after AI replies.",
        },
        {
          id: "910e0000-0000-4000-8000-000000000373",
          position: 3,
          question: "What is 'Few-Shot Prompting'?",
          options: [
            "Limiting your prompt to fewer than 10 words.",
            "Including 2–3 real examples of the exact style or output structure you want before asking AI to generate a new one.",
            "Running the same prompt across three different browsers.",
          ],
          correct_indices: [1],
          explanation:
            "Showing 2–3 gold-standard examples lets the model mirror your tone, depth, and formatting far more reliably than adjectives alone.",
        },
      ],
    },
    {
      id: QUIZ.q2,
      lesson_id: LES.l4,
      title: "Module 2 Check: Workflows & ROI Math",
      pass_threshold: 65,
      max_attempts: 5,
      questions: [
        {
          id: "910e0000-0000-4000-8000-000000000374",
          position: 1,
          question: "Which task is the BEST candidate for your very first AI workflow?",
          options: [
            "A one-off creative brand strategy you do once every 3 years.",
            "A repetitive weekly task with a predictable structure (like client recaps or status summaries).",
            "Signing legally binding contracts with zero human review.",
          ],
          correct_indices: [1],
          explanation:
            "High-frequency, structured tasks compound time savings every single week and are easy to standardize with one reusable prompt.",
        },
        {
          id: "910e0000-0000-4000-8000-000000000375",
          position: 2,
          question: "If an AI workflow saves 3 hours/week for someone whose time is valued at $25/hour, what is the estimated monthly savings (4 weeks)?",
          options: ["$75 / month", "$150 / month", "$300 / month"],
          correct_indices: [2],
          explanation:
            "MonthlySavings = 3 hours/week × 4 weeks × $25/hour = $300/month — and 12 full hours returned to higher-impact work!",
        },
        {
          id: "910e0000-0000-4000-8000-000000000376",
          position: 3,
          question: "Why do experienced teams aim for '75% AI first draft + 25% human polish'?",
          options: [
            "It captures most of the speed gain while keeping human judgment, nuance, and accountability intact.",
            "AI tools automatically stop generating after 75 words.",
            "It avoids having to save prompt templates.",
          ],
          correct_indices: [0],
          explanation:
            "Chasing 100% hands-off automation adds complexity and error risk; pairing a fast AI first draft with a 3-minute human review delivers immediate ROI safely.",
        },
      ],
    },
    {
      id: QUIZ.q3,
      lesson_id: LES.l6,
      title: "Final Mastery Check: AI Safety, Grounding & Rollout",
      pass_threshold: 65,
      max_attempts: 5,
      questions: [
        {
          id: "910e0000-0000-4000-8000-000000000377",
          position: 1,
          question: "How does RAG (Retrieval-Augmented Generation / Grounding) reduce AI hallucinations?",
          options: [
            "It supplies verified source documents directly alongside the prompt so AI answers from trusted facts instead of guessing.",
            "It increases the AI's creativity slider to maximum.",
            "It disables spelling and grammar checks.",
          ],
          correct_indices: [0],
          explanation:
            "Grounding anchors the model to your actual policies, PDFs, or knowledge base instead of relying on fuzzy memory from training data.",
        },
        {
          id: "910e0000-0000-4000-8000-000000000378",
          position: 2,
          question: "Under the Traffic-Light Privacy Rule, what should you do before using a public AI chat on a draft client email containing private account numbers?",
          options: [
            "Paste the full record as-is so the AI has complete details.",
            "Strip out confidential names, IDs, and account numbers (replace with placeholders like 'Client A') before prompting.",
            "Email your password to the AI tool first.",
          ],
          correct_indices: [1],
          explanation:
            "Red-category sensitive identifiers should never enter public consumer AI tools; anonymizing keeps the structure helpful while protecting privacy.",
        },
        {
          id: "910e0000-0000-4000-8000-000000000379",
          position: 3,
          question: "What makes an internal AI workflow pitch easiest for leadership to approve?",
          options: [
            "Asking for a 12-month company-wide mandate before testing anything.",
            "Proposing a focused 2-week human-in-the-loop pilot with clear weekly hours saved and explicit privacy guardrails.",
            "Listing 25 trending AI buzzwords without a concrete task.",
          ],
          correct_indices: [1],
          explanation:
            "Decision-makers love low-risk, measurable 2-week pilots with clear ROI and strong privacy controls.",
        },
      ],
    },
  ];

  for (const q of quizzes) {
    const { error: qErr } = await supabase.from("quizzes").upsert(
      {
        id: q.id,
        lesson_id: q.lesson_id,
        title: q.title,
        pass_threshold: q.pass_threshold,
        max_attempts: q.max_attempts,
      },
      { onConflict: "id" },
    );
    if (qErr) throw qErr;

    const { error: delQErr } = await supabase.from("quiz_questions").delete().eq("quiz_id", q.id);
    if (delQErr) throw delQErr;

    const { error: insQErr } = await supabase.from("quiz_questions").insert(
      q.questions.map((qq) => ({
        id: qq.id,
        quiz_id: q.id,
        position: qq.position,
        question: qq.question,
        options: qq.options,
        correct_indices: qq.correct_indices,
        explanation: qq.explanation,
      })),
    );
    if (insQErr) throw insQErr;
  }
  console.log("✓ 3 quizzes with 9 questions & explanations upserted.");

  console.log("\n✅ Glory Academy Showcase Course seeded successfully!");
  console.log(`   Course Overview: /academy/glory-academy/courses/${COURSE_SLUG}`);
  console.log(`   Direct Player:   /courses/${COURSE_SLUG}/learn`);
  console.log(`   Try Scenarios:   /try/${SCEN.promptMakeover}`);
  console.log(`                    /try/${SCEN.roiSandbox}`);
  console.log(`                    /try/${SCEN.pitchRoleplay}`);
}

run().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
