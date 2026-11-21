// Seeds AI Teacher test content into one academy (default: glory-academy).
//   node --env-file=.env.local scripts/seed-glory-teacher.mjs [company-slug]
//
// Upserts fixed ids, so running it again updates the rows instead of duplicating them:
//   2 ai_personas         Tinashe (Scene_Classroom) and Mwila (Scene_Studio), general teachers
//   3 practice_scenarios  general-tutor flows, published, visibility tenant_library (Teacher's Room)
//   1 course              "AI Teacher Test Drive", free and published, 1 module, 3 lessons
//   6 content_blocks      per lesson: a short text intro and the tutor_session block
//   tutor_settings        Teacher's Room on, voice and text (Live is not available yet)
//
// Uses the service role key, so run it only from a trusted machine. Needs NEXT_PUBLIC_SUPABASE_URL and
// SUPABASE_SERVICE_ROLE_KEY. Data only: no schema changes.
import { createClient } from "@supabase/supabase-js";

const slug = process.argv[2] ?? "glory-academy";
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) throw new Error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (use --env-file=.env.local).");
const db = createClient(url, key, { auth: { persistSession: false } });

// Fixed ids. The last block of the uuid encodes the row kind (persona 0xx, scenario 1xx, course 2xx...).
const ID = {
  tinashe: "910e0000-0000-4000-8000-000000000001",
  mwila: "910e0000-0000-4000-8000-000000000002",
  fractions: "910e0000-0000-4000-8000-000000000101",
  prompts: "910e0000-0000-4000-8000-000000000102",
  oralCheck: "910e0000-0000-4000-8000-000000000103",
  course: "910e0000-0000-4000-8000-000000000201",
  module: "910e0000-0000-4000-8000-000000000301",
  lessons: ["910e0000-0000-4000-8000-000000000401", "910e0000-0000-4000-8000-000000000402", "910e0000-0000-4000-8000-000000000403"],
};

async function must(label, promise) {
  const { data, error } = await promise;
  if (error) throw new Error(`${label}: ${error.message}`);
  return data;
}

const company = await must(
  "company",
  db.from("companies").select("id, admin_id, name").eq("slug", slug).single(),
);
console.log(`Seeding AI Teacher content into ${company.name} (${company.id})`);

await must(
  "tutor_settings",
  db.from("tutor_settings").upsert(
    { company_id: company.id, practice_room_enabled: true, allowed_modes: ["voice", "text"], free_practice_minutes_per_month: 120 },
    { onConflict: "company_id" },
  ),
);

await must(
  "ai_personas",
  db.from("ai_personas").upsert([
    {
      id: ID.tinashe,
      company_id: company.id,
      name: "Tinashe",
      display_name: "Tinashe",
      languages: ["en"],
      rive_variant: {
        skinColor: "#6B4430", skinShadeColor: "#4E2F20", hairColor: "#16110E", outfitPrimary: "#2F5D8C",
        outfitSecondary: "#F3F6FA", accentColor: "#F2A541", hairStyle: "short", outfitStyle: "blazer", prop: "none", faceStyle: "tinashe",
      },
      voice: { provider: "gemini", voiceName: "Puck" },
      personality_prompt:
        "You are Tinashe, a warm, clear teacher for adult learners in Zambia. Teach one idea at a time, use everyday Zambian examples (kwacha, minibus fares, market stalls), put the key points on the board, check understanding with a quick question, and praise real effort.",
      default_scene: "Scene_Classroom",
      is_active: true,
    },
    {
      id: ID.mwila,
      company_id: company.id,
      name: "Mwila",
      display_name: "Mwila",
      languages: ["en"],
      rive_variant: {
        skinColor: "#7A4B33", skinShadeColor: "#5A3523", hairColor: "#1A1310", outfitPrimary: "#7C3AED",
        outfitSecondary: "#FAF7FF", accentColor: "#22B07D", hairStyle: "curly", outfitStyle: "cardigan", prop: "none", faceStyle: "sofia",
      },
      voice: { provider: "gemini", voiceName: "Kore" },
      personality_prompt:
        "You are Mwila, a friendly AI-skills coach for busy professionals. Show, don't lecture: give a small example, let the learner try, then improve it together. Keep the language plain and the tone upbeat.",
      default_scene: "Scene_Studio",
      is_active: true,
    },
  ]),
);

const common = {
  company_id: company.id,
  course_id: null,
  lesson_id: null,
  skill_pack: "general-tutor",
  exam_task: null,
  max_minutes: 8,
  allowed_modes: ["voice", "text"],
  visibility: "tenant_library",
  status: "published",
  created_by: company.admin_id,
};

await must(
  "practice_scenarios",
  db.from("practice_scenarios").upsert([
    {
      ...common,
      id: ID.fractions,
      persona_id: ID.tinashe,
      title: "Fractions with Tinashe",
      goal: "Understand what a fraction means, compare two fractions and use one in a real situation.",
      style: "guided_lesson",
      scene: "Scene_Classroom",
      level: "Beginner",
      beats: [
        { id: "meaning", goal: "Explain that a fraction is part of a whole (top = parts taken, bottom = equal parts). Put it on the board.", targetItems: ["numerator", "denominator"] },
        { id: "compare", goal: "Compare 1/2 and 1/4 with a nshima or pizza example. Ask a multiple-choice question.", targetItems: ["1/2 is bigger than 1/4"] },
        { id: "apply", goal: "Apply it: a K100 bill shared by 4 friends. The learner works out each share out loud.", targetItems: ["K25 each"] },
      ],
      target_items: [
        { text: "numerator", meaning: "the top number: how many parts you take" },
        { text: "denominator", meaning: "the bottom number: how many equal parts there are" },
        { text: "equal parts", meaning: "pieces of the same size" },
      ],
    },
    {
      ...common,
      id: ID.prompts,
      persona_id: ID.mwila,
      title: "Write a better AI prompt",
      goal: "Turn a vague request into a clear AI prompt with a role, the task, context and the format you want.",
      style: "guided_lesson",
      scene: "Scene_Studio",
      level: "Beginner",
      beats: [
        { id: "parts", goal: "Show the four parts of a good prompt on the board as steps: role, task, context, format.", targetItems: ["role", "task", "context", "format"] },
        { id: "fix", goal: "Show a weak prompt ('write an email'). Ask the learner which part is missing first (multiple choice).", targetItems: ["context"] },
        { id: "try", goal: "The learner rewrites the prompt for their own job. Give one improvement, then award them.", targetItems: [] },
      ],
      target_items: [
        { text: "role", meaning: "who the AI should act as" },
        { text: "context", meaning: "the background the AI needs" },
        { text: "format", meaning: "the shape of the answer: list, table, email" },
      ],
    },
    {
      ...common,
      id: ID.oralCheck,
      persona_id: ID.tinashe,
      title: "Oral check: what is AI?",
      goal: "Explain in your own words what AI is, give one example from daily life and one limit to watch for.",
      style: "oral_check",
      scene: "Scene_Classroom",
      level: "Beginner",
      max_minutes: 5,
      beats: [
        { id: "define", goal: "Ask the learner to explain what AI is in one or two sentences. Note the evidence.", targetItems: [] },
        { id: "example", goal: "Ask for one everyday example (phone keyboard, mobile money fraud alerts, maps).", targetItems: [] },
        { id: "limit", goal: "Ask for one limit (it can be confidently wrong). Ask how confident they feel, then summarise.", targetItems: [] },
      ],
      target_items: [],
    },
  ]),
);

await must(
  "courses",
  db.from("courses").upsert({
    id: ID.course,
    slug: "ai-teacher-test-drive",
    title: "AI Teacher Test Drive",
    description:
      "Three short lessons with an AI teacher who talks, writes on the board, asks questions and gives you a report: fractions with Tinashe, better AI prompts with Mwila, and a spoken check on what AI is.",
    category: "AI Skills",
    level: "beginner",
    instructor_id: company.admin_id,
    company_id: company.id,
    status: "published",
    price_type: "free",
    price_amount: 0,
    is_featured: false,
  }),
);

await must("modules", db.from("modules").upsert({ id: ID.module, course_id: ID.course, title: "Meet your AI teacher", position: 1 }));

const lessons = [
  {
    title: "Fractions, explained out loud",
    intro: "<p>Tinashe will explain fractions on the board, ask you a quick question and give you a real kwacha problem. Answer by voice or by typing.</p>",
    scenarioId: ID.fractions,
    blockTitle: "Lesson with Tinashe",
    blockIntro: "Watch the board, answer the questions and work out the bill out loud.",
  },
  {
    title: "Write a better AI prompt",
    intro: "<p>Mwila coaches you through the four parts of a good prompt, then you rewrite one for your own work.</p>",
    scenarioId: ID.prompts,
    blockTitle: "Prompt clinic with Mwila",
    blockIntro: "Pick the missing part, then write your own prompt. Mwila will improve it with you.",
  },
  {
    title: "Spoken check: what is AI?",
    intro: "<p>A short spoken check. Explain AI in your own words; Tinashe notes what you got right and what to review.</p>",
    scenarioId: ID.oralCheck,
    blockTitle: "Oral check with Tinashe",
    blockIntro: "Speak naturally. There are no trick questions, and you get a short report at the end.",
  },
];

await must(
  "lessons",
  db.from("lessons").upsert(
    lessons.map((l, i) => ({ id: ID.lessons[i], module_id: ID.module, title: l.title, position: i + 1, is_preview: i === 0 })),
  ),
);

await must(
  "content_blocks",
  db.from("content_blocks").upsert(
    lessons.flatMap((l, i) => [
      { id: `910e0000-0000-4000-8000-0000000005${i + 1}1`, lesson_id: ID.lessons[i], type: "text", position: 1, content: { html: l.intro } },
      {
        id: `910e0000-0000-4000-8000-0000000005${i + 1}2`,
        lesson_id: ID.lessons[i],
        type: "tutor_session",
        position: 2,
        content: { scenarioId: l.scenarioId, style: "scene", required: false, title: l.blockTitle, intro: l.blockIntro },
      },
    ]),
  ),
);

// The flows stay unlinked (course_id null): a library flow opens from the Teacher's Room without
// enrolling, and lessons in the same academy can still embed it (see entitlements.ts).
console.log("Done: 2 teachers, 3 flows, course /courses/ai-teacher-test-drive (3 lessons).");
