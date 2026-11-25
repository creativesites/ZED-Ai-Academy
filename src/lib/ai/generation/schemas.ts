/**
 * Response JSON schemas for the course-generation routes (`/api/ai/generate-*`, review-course, branding-assistant,
 * study packs, practice scoring). Sent as `responseJsonSchema` through `aiJson`, replacing "return ONLY valid JSON"
 * prompts plus regex extraction. Pure data.
 *
 * Keep them small and flat: plain JSON Schema keywords only (type, properties, required, items, enum, description).
 * No numeric/length bounds (Gemini's schema-state limit; see the no-bounds guard in tutor/turn-schema.ts); bounds
 * stay in the prompt and in the route's own validation. Blocks with type-dependent content (lesson content, block
 * edits) are NOT schema'd: they use JSON mode and the tolerant parser instead.
 */

type Schema = Record<string, unknown>;

const str = (description?: string): Schema => (description ? { type: "string", description } : { type: "string" });
const strArray = (description?: string): Schema => ({ type: "array", items: str(), ...(description ? { description } : {}) });
const obj = (properties: Record<string, Schema>, required: string[] = Object.keys(properties)): Schema => ({
  type: "object",
  properties,
  required,
});

export const QUIZ_QUESTIONS_SCHEMA: Schema = {
  type: "array",
  items: obj({
    question: str(),
    options: strArray("Exactly 4 options"),
    correct_indices: { type: "array", items: { type: "integer" }, description: "Exactly one index, 0-3" },
    explanation: str(),
  }),
};

export const CURRICULUM_SCHEMA: Schema = obj({
  modules: {
    type: "array",
    items: obj({
      title: str("Outcome-focused module title"),
      lessons: { type: "array", items: obj({ title: str("Action-oriented lesson title") }) },
    }),
  },
});

export const PRACTICE_EXERCISE_SCHEMA: Schema = obj({
  title: str(),
  brief: str(),
  mode: { type: "string", enum: ["text_response", "file_upload", "combined"] },
  estimated_minutes: { type: "integer" },
  instructions: strArray(),
  deliverables: {
    type: "array",
    items: obj({ type: str("e.g. text or file"), label: str(), required: { type: "boolean" } }),
  },
  allowed_file_types: strArray(),
  max_files: { type: "integer" },
  rubric: { type: "array", items: obj({ criterion: str(), weight: { type: "number" } }) },
  ai_scoring_enabled: { type: "boolean" },
  instructor_review_required: { type: "boolean" },
  resubmissions_allowed: { type: "boolean" },
});

export function tutorScenarioSchema(scenes: readonly string[]): Schema {
  return obj({
    title: str("Short engaging scenario title (max 80 chars)"),
    goal: str(),
    level: str(),
    max_minutes: { type: "integer" },
    scene: { type: "string", enum: [...scenes] },
    beats: {
      type: "array",
      items: obj(
        { id: str(), goal: str(), boardContent: str(), checkQuestion: str(), targetItems: strArray() },
        ["id", "goal"],
      ),
    },
    target_items: { type: "array", items: obj({ text: str(), pron: str(), meaning: str() }, ["text"]) },
  });
}

export const COURSE_CATEGORIES = [
  "Prompt Engineering",
  "AI Tools",
  "Machine Learning",
  "AI for Business",
  "Data Science",
  "Natural Language Processing",
  "Computer Vision",
  "AI Ethics",
] as const;

export const COURSE_BLUEPRINT_SCHEMA: Schema = obj({
  title: str(),
  description: str("2 sentences max"),
  category: { type: "string", enum: [...COURSE_CATEGORIES] },
  level: { type: "string", enum: ["beginner", "intermediate", "advanced"] },
  price_type: { type: "string", enum: ["free", "one_time", "subscription_only", "both"] },
  audience: str(),
  quick_win: str(),
  capstone: str(),
  module_outline: strArray("Exactly 4 module titles"),
});

export const COURSE_REVIEW_SCHEMA: Schema = obj({
  overall_score: { type: "integer", description: "0-100" },
  summary: str(),
  strengths: strArray(),
  gaps: strArray(),
  sequencing_suggestions: strArray(),
  suggested_lessons: {
    type: "array",
    items: obj({ module_title: str(), lesson_title: str(), rationale: str() }),
  },
});

export const BRAND_KIT_SCHEMA: Schema = obj({
  primary_color: str("#HEX"),
  secondary_color: str("#HEX"),
  surface_color: str("#HEX"),
  recommended_template: {
    type: "string",
    enum: ["modern", "classic", "minimal", "dark_mode", "corporate", "creative", "tech", "elegant"],
  },
  hero_title: str(),
  hero_subtitle: str(),
  about_title: str(),
  about_text: str(),
  services: { type: "array", items: obj({ title: str(), subtitle: str(), features: strArray() }) },
  faqs: { type: "array", items: obj({ question: str(), answer: str() }) },
  cta_title: str(),
  cta_button: str(),
});

export const ENHANCED_COPY_SCHEMA: Schema = obj({ enhancedText: str() });

export const STUDY_PACK_SCHEMA: Schema = obj({
  title: str(),
  summary: str(),
  concepts: { type: "array", items: obj({ term: str(), explanation: str() }) },
  flashcards: { type: "array", items: obj({ front: str(), back: str() }) },
  quiz_questions: {
    type: "array",
    items: obj({ question: str(), options: strArray(), correct_index: { type: "integer" }, explanation: str() }),
  },
});

export const PRACTICE_SCORE_SCHEMA: Schema = obj({
  score: { type: "number", description: "0-100" },
  rubric_breakdown: {
    type: "array",
    items: obj({ criterion: str(), score: { type: "number" }, max: { type: "number" }, feedback: str() }),
  },
  feedback_summary: str(),
  strengths: strArray(),
  improvements: strArray(),
  confidence: { type: "number", description: "0-1" },
  needs_instructor_review: { type: "boolean" },
});
