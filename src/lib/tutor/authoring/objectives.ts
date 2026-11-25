import { z } from "zod";

export const MIN_OBJECTIVES = 2;
export const MAX_OBJECTIVES = 5;

export const lessonObjectiveSchema = z.object({
  id: z.string().trim().min(1).max(64),
  text: z.string().trim().min(5).max(240),
  evidence: z.string().trim().min(3).max(300),
});

export const extractedObjectivesSchema = z.object({
  objectives: z.array(lessonObjectiveSchema).min(MIN_OBJECTIVES).max(MAX_OBJECTIVES),
});

export type LessonObjective = z.infer<typeof lessonObjectiveSchema>;

/**
 * Loose JSON Schema for Gemini structured output (`responseJsonSchema`).
 * Deliberately carries NO number bounds, string lengths, or array length limits
 * so Gemini never rejects it with `400 too many states for serving`.
 * Zod (`extractedObjectivesSchema`) enforces exact bounds after parsing.
 */
export const OBJECTIVES_JSON_SCHEMA = {
  type: "object",
  properties: {
    objectives: {
      type: "array",
      description: "2 to 5 measurable learning objectives for the lesson.",
      items: {
        type: "object",
        properties: {
          id: { type: "string", description: "Short slug id like obj-1." },
          text: {
            type: "string",
            description: "Measurable objective starting with 'Learner can ...'.",
          },
          evidence: {
            type: "string",
            description: "Concrete evidence that shows the learner met this objective out loud or on the board.",
          },
        },
        required: ["id", "text", "evidence"],
      },
    },
  },
  required: ["objectives"],
} as const;

export type LessonSourceBlock = {
  id?: string;
  type: string;
  content: unknown;
};

export type QuizQuestionSource = {
  question: string;
  options?: string[];
  correct_indices?: number[];
  explanation?: string | null;
};

type Obj = Record<string, unknown>;

function asObject(v: unknown): Obj | null {
  return typeof v === "object" && v !== null && !Array.isArray(v) ? (v as Obj) : null;
}

function asObjects(v: unknown): Obj[] {
  return Array.isArray(v)
    ? (v as unknown[]).map(asObject).filter((o): o is Obj => o !== null)
    : [];
}

function plain(v: unknown): string {
  if (typeof v !== "string") return "";
  return v.replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
}

function decodeEntities(s: string): string {
  return s
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&");
}

function stripHtml(v: unknown): string {
  if (typeof v !== "string") return "";
  return decodeEntities(v.replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
}

function plainList(v: unknown): string[] {
  return Array.isArray(v) ? (v as unknown[]).map(plain).filter((s) => s.length > 0) : [];
}

function renderBlockForAuthoring(block: LessonSourceBlock): string {
  const c = asObject(block.content);
  if (!c) return "";

  switch (block.type) {
    case "tutor_session":
      return "";
    case "text":
      return stripHtml(c.html);
    case "video": {
      const parts = [
        plain(c.title) ? `Video title: ${plain(c.title)}` : "",
        plain(c.description) ? `Video description: ${plain(c.description)}` : "",
        plain(c.youtube_id) ? `Video ID: ${plain(c.youtube_id)}` : "",
      ].filter(Boolean);
      return parts.join("\n");
    }
    case "glossary": {
      const terms = asObjects(c.terms)
        .map((t) => {
          const term = plain(t.term);
          const def = plain(t.definition);
          return term && def ? `- ${term}: ${def}` : term || def ? `- ${term || def}` : "";
        })
        .filter(Boolean);
      if (terms.length === 0) return "";
      const heading = plain(c.title) || "Glossary";
      return `${heading}:\n${terms.join("\n")}`;
    }
    case "learning_objectives": {
      const items = plainList(c.objectives).map((o) => `- ${o}`);
      return items.length ? `Existing objectives:\n${items.join("\n")}` : "";
    }
    case "steps": {
      const items = asObjects(c.steps)
        .map((s, i) => {
          const text = [plain(s.title), plain(s.body)].filter(Boolean).join(": ");
          return text ? `${i + 1}. ${text}` : "";
        })
        .filter(Boolean);
      if (!items.length) return "";
      return `${plain(c.title) || "Steps"}:\n${items.join("\n")}`;
    }
    case "key_takeaway": {
      const points = plainList(c.points).map((p) => `- ${p}`);
      return points.length ? `${plain(c.title) || "Key takeaways"}:\n${points.join("\n")}` : "";
    }
    case "checklist": {
      const items = plainList(c.items).map((p) => `- ${p}`);
      return items.length ? `${plain(c.title) || "Checklist"}:\n${items.join("\n")}` : "";
    }
    case "callout":
    case "expert_note": {
      const title = plain(c.title);
      const body = plain(c.body) || plain(c.note);
      return [title, body].filter(Boolean).join(": ");
    }
    case "case_study": {
      const parts = [
        plain(c.title) ? `Case study: ${plain(c.title)}` : "Case study",
        plain(c.context) ? `Context: ${plain(c.context)}` : "",
        plain(c.action) ? `Action: ${plain(c.action)}` : "",
        plain(c.result) || plain(c.outcome) ? `Result: ${plain(c.result) || plain(c.outcome)}` : "",
        stripHtml(c.body),
      ].filter(Boolean);
      return parts.length > 1 ? parts.join("\n") : "";
    }
    case "comparison_table": {
      const headers = plainList(c.headers);
      const rows = Array.isArray(c.rows) ? (c.rows as unknown[]) : [];
      const renderedRows = rows
        .map((r) => (Array.isArray(r) ? (r as unknown[]).map(plain).filter(Boolean).join(" | ") : ""))
        .filter(Boolean);
      if (!headers.length && !renderedRows.length) return "";
      return [
        plain(c.title) || "Comparison table",
        headers.length ? `Columns: ${headers.join(" | ")}` : "",
        ...renderedRows.map((r) => `- ${r}`),
      ]
        .filter(Boolean)
        .join("\n");
    }
    case "practice_exercise": {
      const parts = [
        plain(c.title) ? `Practice exercise: ${plain(c.title)}` : "Practice exercise",
        plain(c.brief),
        ...plainList(c.instructions).map((inst) => `- ${inst}`),
      ].filter(Boolean);
      return parts.length > 1 ? parts.join("\n") : "";
    }
    case "assignment": {
      const parts = [
        plain(c.title) ? `Assignment: ${plain(c.title)}` : "Assignment",
        plain(c.summary),
        ...plainList(c.deliverables).map((d) => `- ${d}`),
      ].filter(Boolean);
      return parts.length > 1 ? parts.join("\n") : "";
    }
    case "discussion_prompt": {
      const parts = [plain(c.title) || "Discussion", plain(c.prompt)].filter(Boolean);
      return parts.length > 1 ? parts.join(": ") : "";
    }
    case "ai_prompt": {
      const p = plain(c.prompt);
      return p ? `AI Prompt (${plain(c.tool) || "General"}): ${p}` : "";
    }
    case "tool_spotlight": {
      return [plain(c.name), plain(c.description)].filter(Boolean).join(": ");
    }
    case "resource": {
      return [plain(c.file_name), plain(c.description)].filter(Boolean).join(": ");
    }
    case "image":
    case "before_after": {
      const cap = plain(c.caption) || plain(c.alt);
      return cap ? `Visual: ${cap}` : "";
    }
    case "quiz": {
      const title = plain(c.title);
      const qs = asObjects(c.questions ?? c.quiz_questions)
        .map((q) => plain(q.question))
        .filter(Boolean);
      if (!title && !qs.length) return "";
      return [title ? `Quiz: ${title}` : "Quiz", ...qs.map((q) => `- ${q}`)].join("\n");
    }
    default:
      return "";
  }
}

function renderQuizQuestions(questions: readonly QuizQuestionSource[]): string {
  const valid = questions.filter((q) => typeof q.question === "string" && q.question.trim().length > 0);
  if (valid.length === 0) return "";
  const lines = valid.map((q, idx) => {
    const opts = Array.isArray(q.options) ? q.options : [];
    const correctSet = new Set(Array.isArray(q.correct_indices) ? q.correct_indices : []);
    const optLines = opts
      .map((opt, oi) => `   - ${plain(opt)}${correctSet.has(oi) ? " [correct]" : ""}`)
      .filter((s) => s.trim() !== "-");
    const expl = q.explanation ? `   Explanation: ${plain(q.explanation)}` : "";
    return [`${idx + 1}. ${plain(q.question)}`, ...optLines, expl].filter(Boolean).join("\n");
  });
  return `Quiz questions:\n${lines.join("\n")}`;
}

export function summarizeLessonMaterial(input: {
  lessonTitle?: string;
  blocks: readonly LessonSourceBlock[];
  quizQuestions?: readonly QuizQuestionSource[];
  maxChars?: number;
}): string {
  const parts: string[] = [];
  const blockTexts = (Array.isArray(input.blocks) ? input.blocks : [])
    .map(renderBlockForAuthoring)
    .filter((t) => t.length > 0);
  parts.push(...blockTexts);

  if (input.quizQuestions?.length) {
    const quizText = renderQuizQuestions(input.quizQuestions);
    if (quizText) parts.push(quizText);
  }

  let combined = parts.join("\n\n").trim();
  if (!combined && input.lessonTitle?.trim()) {
    combined = `Lesson title: ${input.lessonTitle.trim()}`;
  }

  const maxChars = input.maxChars ?? 12_000;
  if (combined.length > maxChars) {
    return `${combined.slice(0, maxChars - 16).trimEnd()}\n\n[...truncated]`;
  }
  return combined;
}

export function buildObjectivesPrompt(input: {
  courseTitle: string;
  moduleTitle?: string | null;
  lessonTitle: string;
  materialText: string;
}): { systemInstruction: string; prompt: string } {
  const systemInstruction = `You are an expert instructional designer for CS Learn.
Extract 2 to 5 clear, measurable learning objectives from the lesson material provided.
Rules:
- Every objective "text" MUST start with "Learner can " and state one concrete, observable skill or understanding from the lesson.
- Every objective "evidence" MUST state what counts as proof in a spoken or interactive check (for example: "Explains the difference between numerator and denominator and splits a kwacha bill accurately").
- Ground every objective in the actual lesson material (text, glossary, video title/description, quiz questions). Do not invent topics absent from the lesson.
- Use short slug ids like "obj-1", "obj-2", etc.
- Return ONLY valid JSON matching the schema.`;

  const material = input.materialText.trim() || `Lesson title: ${input.lessonTitle}`;
  const prompt = [
    `Course: ${input.courseTitle}`,
    input.moduleTitle ? `Module: ${input.moduleTitle}` : null,
    `Lesson: ${input.lessonTitle}`,
    "",
    "Lesson material:",
    material,
  ]
    .filter((line): line is string => line !== null)
    .join("\n");

  return { systemInstruction, prompt };
}

export type ParseObjectivesResult =
  | { ok: true; objectives: LessonObjective[] }
  | { ok: false; error: string };

function stripCodeFences(raw: string): string {
  return raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
}

export function parseExtractedObjectives(rawJson: unknown): ParseObjectivesResult {
  let value = rawJson;
  if (typeof value === "string") {
    try {
      value = JSON.parse(stripCodeFences(value));
    } catch {
      return { ok: false, error: "Model output was not valid JSON." };
    }
  }
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return { ok: false, error: "Expected an object with an objectives array." };
  }

  const rawList = (value as { objectives?: unknown }).objectives;
  if (!Array.isArray(rawList)) {
    return { ok: false, error: "Model output did not include an objectives array." };
  }

  const normalized = rawList
    .slice(0, MAX_OBJECTIVES)
    .map((item, idx) => {
      if (typeof item !== "object" || item === null) return null;
      const obj = item as Record<string, unknown>;
      const rawId = typeof obj.id === "string" && obj.id.trim() ? obj.id.trim() : `obj-${idx + 1}`;
      const id = rawId.replace(/[^a-zA-Z0-9_-]/g, "-").slice(0, 64) || `obj-${idx + 1}`;
      const text = typeof obj.text === "string" ? obj.text.trim().slice(0, 240) : "";
      const evidence = typeof obj.evidence === "string" ? obj.evidence.trim().slice(0, 300) : "";
      return { id, text, evidence };
    })
    .filter((item): item is LessonObjective => item !== null && item.text.length > 0 && item.evidence.length > 0);

  const parsed = extractedObjectivesSchema.safeParse({ objectives: normalized });
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Objectives failed validation.",
    };
  }
  return { ok: true, objectives: parsed.data.objectives };
}
