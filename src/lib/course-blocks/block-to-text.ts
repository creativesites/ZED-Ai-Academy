import type { ContentBlockType } from "@/types/database";

/**
 * Shared plain-text rendering of lesson content blocks.
 *
 * Used wherever lesson content has to be handed to an AI model (tutor,
 * quiz generation, practice-exercise generation, and later the voice teacher).
 *
 * The `content` shapes below were read from the creator editors in
 * `src/components/creator/blocks/*`, the quiz builder, and the defaults in
 * `src/components/creator/lesson-editor-client.tsx`. Where the learner
 * renderer (`src/components/learner/content-blocks/*`) reads different keys
 * for the same block, both spellings are accepted (e.g. case_study
 * `body`/`outcome` vs `context`/`action`/`result`).
 */

type BlockLike = { type: string; content: unknown };
type Obj = Record<string, unknown>;
type Renderer = (c: Obj) => string;

const MAX_DEPTH = 4;
const MAX_FALLBACK_STRINGS = 200;
const SEPARATOR = "\n\n";
const TRUNCATED_MARKER = "[…truncated]";

function asObject(v: unknown): Obj | null {
  return typeof v === "object" && v !== null && !Array.isArray(v) ? (v as Obj) : null;
}

function objectList(v: unknown): Obj[] {
  return Array.isArray(v)
    ? (v as unknown[]).map(asObject).filter((o): o is Obj => o !== null)
    : [];
}

/** Plain field: trims and collapses runs of spaces, keeps line breaks. */
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

/** Rich text (HTML): strips tags, decodes basic entities, collapses whitespace. */
function richText(v: unknown): string {
  if (typeof v !== "string") return "";
  return decodeEntities(v.replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
}

function plainList(v: unknown): string[] {
  return Array.isArray(v)
    ? (v as unknown[]).map(plain).filter((s) => s.length > 0)
    : [];
}

function cell(v: unknown): string {
  if (typeof v === "boolean") return v ? "Yes" : "No";
  if (typeof v === "number") return String(v);
  return plain(v);
}

function positiveNumber(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) && v > 0 ? v : null;
}

/** "Label: value", or "" when the value is empty. */
function labelled(label: string, value: string): string {
  return value ? `${label}: ${value}` : "";
}

/** "Label: title" (the title is dropped when it just repeats the label). */
function heading(label: string, title: string): string {
  if (!title || title.toLowerCase() === label.toLowerCase()) return `${label}:`;
  return `${label}: ${title}`;
}

function bullets(items: string[]): string[] {
  return items.map((item) => `- ${item}`);
}

function section(title: string, items: string[]): string[] {
  return items.length > 0 ? [`${title}:`, ...bullets(items)] : [];
}

/**
 * Heading plus body lines. Returns "" when there is neither a title nor any
 * body content, so empty blocks never leave a bare label behind.
 */
function titled(label: string, title: string, body: Array<string | string[]>): string {
  const lines = body.flat().filter((line) => line.length > 0);
  if (lines.length === 0 && !title) return "";
  return [heading(label, title), ...lines].join("\n");
}

type QuizQuestion = { question: string; options: string[]; correct: number[]; explanation: string };

/**
 * Quiz questions are not stored in content_blocks today (the block only holds
 * `quiz_id`). If a caller ever stores them inline, the QuizBuilder field names
 * are read here.
 */
function quizQuestions(c: Obj): QuizQuestion[] {
  const raw = Array.isArray(c.questions) ? c.questions : Array.isArray(c.quiz_questions) ? c.quiz_questions : [];
  return objectList(raw)
    .map((q) => ({
      question: plain(q.question),
      options: Array.isArray(q.options) ? (q.options as unknown[]).map(plain) : [],
      correct: Array.isArray(q.correct_indices)
        ? (q.correct_indices as unknown[]).filter((i): i is number => typeof i === "number")
        : [],
      explanation: plain(q.explanation),
    }))
    .filter((q) => q.question.length > 0);
}

const RENDERERS: Record<ContentBlockType, Renderer> = {
  video: (c) => labelled("Video", plain(c.title)),

  text: (c) => richText(c.html),

  quiz: (c) => {
    const title = plain(c.title);
    const questions = quizQuestions(c);
    if (questions.length === 0) return title ? `Quiz: ${title}` : "Quiz";
    return titled(
      "Quiz",
      title,
      questions.map((q, i) => {
        const lines = [`${i + 1}. ${q.question}`];
        q.options.forEach((opt, idx) => {
          lines.push(`   ${idx + 1}) ${opt}${q.correct.includes(idx) ? " (correct)" : ""}`);
        });
        if (q.explanation) lines.push(`   Explanation: ${q.explanation}`);
        return lines.join("\n");
      })
    );
  },

  resource: (c) => titled("Resource", plain(c.file_name), [plain(c.description)]),

  image: (c) => labelled("Image", plain(c.caption) || plain(c.alt)),

  callout: (c) => {
    const variant = plain(c.variant);
    return titled(variant ? `Callout (${variant})` : "Callout", plain(c.title), [plain(c.body)]);
  },

  tool_spotlight: (c) => titled("Tool", plain(c.name), [plain(c.description)]),

  before_after: (c) => labelled("Before/after image", plain(c.caption)),

  ai_prompt: (c) => {
    const prompt = plain(c.prompt);
    if (!prompt) return "";
    const tool = plain(c.tool);
    return titled(tool ? `AI prompt (${tool})` : "AI prompt", plain(c.label), [prompt]);
  },

  steps: (c) => {
    const items = objectList(c.steps)
      .map((s) => [plain(s.title), plain(s.body)].filter((p) => p.length > 0).join(": "))
      .filter((s) => s.length > 0)
      .map((s, i) => `${i + 1}. ${s}`);
    return titled("Steps", plain(c.title), [items]);
  },

  checklist: (c) => titled("Checklist", plain(c.title), [bullets(plainList(c.items))]),

  key_takeaway: (c) => titled("Key takeaways", plain(c.title), [bullets(plainList(c.points))]),

  expert_note: (c) =>
    titled("Expert note", plain(c.title), [
      labelled("Author", plain(c.author)),
      plain(c.body) || plain(c.note),
    ]),

  comparison_table: (c) => {
    const headers = Array.isArray(c.headers) ? (c.headers as unknown[]).map(plain) : [];
    const rows: string[] = [];
    const rawRows = Array.isArray(c.rows) ? (c.rows as unknown[]) : [];
    for (const row of rawRows) {
      let label = "";
      let cells: string[];
      if (Array.isArray(row)) {
        cells = (row as unknown[]).map(cell);
        // Generator shape: a row label followed by one value per header.
        if (headers.length > 0 && cells.length === headers.length + 1) {
          label = cells[0];
          cells = cells.slice(1);
        }
      } else {
        const obj = asObject(row);
        if (!obj) continue;
        label = plain(obj.label);
        cells = Array.isArray(obj.values) ? (obj.values as unknown[]).map(cell) : [];
      }
      const pairs = cells
        .map((value, i) => (value ? `${headers[i] || `Column ${i + 1}`}: ${value}` : ""))
        .filter((p) => p.length > 0);
      if (pairs.length === 0) continue;
      rows.push(`${label ? `${label} — ` : ""}${pairs.join(" | ")}`);
    }
    return titled("Comparison table", plain(c.title), [bullets(rows)]);
  },

  case_study: (c) => {
    const result = plain(c.result);
    return titled("Case study", plain(c.title), [
      labelled("Details", richText(c.body)),
      labelled("Context", plain(c.context)),
      labelled("Action", plain(c.action)),
      labelled(result ? "Result" : "Outcome", result || plain(c.outcome)),
    ]);
  },

  meeting: (c) => labelled("Live session", plain(c.title)),

  practice_exercise: (c) => {
    const minutes = positiveNumber(c.estimated_minutes);
    const deliverables = objectList(c.deliverables)
      .map((d) => {
        const label = plain(d.label) || plain(d.type);
        return label && d.required === false ? `${label} (optional)` : label;
      })
      .filter((d) => d.length > 0);
    const rubric = objectList(c.rubric)
      .map((r) => {
        const criterion = plain(r.criterion);
        const weight = typeof r.weight === "number" ? r.weight : null;
        if (!criterion) return "";
        return weight !== null ? `${criterion} (weight ${weight})` : criterion;
      })
      .filter((r) => r.length > 0);
    return titled("Practice exercise", plain(c.title), [
      plain(c.brief),
      labelled("Estimated time", minutes ? `${minutes} minutes` : ""),
      section("Instructions", plainList(c.instructions)),
      section("Deliverables", deliverables),
      section("Rubric", rubric),
    ]);
  },

  learning_objectives: (c) =>
    titled("Learning objectives", plain(c.title), [bullets(plainList(c.objectives))]),

  glossary: (c) => {
    const terms = objectList(c.terms)
      .map((t) => {
        const term = plain(t.term);
        const definition = plain(t.definition);
        return term && definition ? `${term}: ${definition}` : term || definition;
      })
      .filter((t) => t.length > 0);
    return titled("Glossary", plain(c.title), [bullets(terms)]);
  },

  discussion_prompt: (c) =>
    titled("Discussion prompt", plain(c.title), [
      plain(c.prompt),
      section("Guidance", plainList(c.guidance)),
      labelled("Mode", plain(c.mode)),
    ]),

  assignment: (c) => {
    const minutes = positiveNumber(c.estimated_minutes);
    return titled("Assignment", plain(c.title), [
      plain(c.summary),
      section("Deliverables", plainList(c.deliverables)),
      labelled("Assessment", plain(c.assessment)),
      labelled("Estimated time", minutes ? `${minutes} minutes` : ""),
    ]);
  },

  risk_assessment: (c) => {
    const rows = objectList(c.rows)
      .map((r) =>
        [
          labelled("Hazard", plain(r.hazard)),
          labelled("Risk", plain(r.risk)),
          labelled("Control", plain(r.control)),
        ]
          .filter((p) => p.length > 0)
          .join(" | ")
      )
      .filter((r) => r.length > 0);
    return titled("Risk assessment", plain(c.title), [bullets(rows)]);
  },

  // The scenario (goal, beats) lives in practice_scenarios and is not in the block, so the text uses the
  // teacher's title, then the intro, so the lesson-grounded tutor knows the practice exists.
  tutor_session: (c) => {
    const label = plain(c.title) || plain(c.intro).split("\n")[0] || "practice scene set by the teacher";
    return `Speaking practice with the AI tutor: ${label}`;
  },
};

const RENDERER_BY_TYPE = new Map<string, Renderer>(Object.entries(RENDERERS));

function collectStrings(v: unknown, depth: number, out: string[]): string[] {
  if (depth > MAX_DEPTH || out.length >= MAX_FALLBACK_STRINGS) return out;
  if (typeof v === "string") {
    const s = richText(v);
    if (s) out.push(s);
  } else if (Array.isArray(v)) {
    for (const item of v as unknown[]) collectStrings(item, depth + 1, out);
  } else {
    const obj = asObject(v);
    if (obj) {
      for (const value of Object.values(obj)) collectStrings(value, depth + 1, out);
    }
  }
  return out;
}

/** Unknown block types: list whatever strings the content holds. */
function fallbackText(type: string, content: unknown): string {
  const strings = collectStrings(content, 0, []);
  if (strings.length === 0) return "";
  const raw = type ? type.replace(/_/g, " ") : "Block";
  const label = raw.charAt(0).toUpperCase() + raw.slice(1);
  return titled(label, "", [bullets(strings)]);
}

/**
 * Plain-text rendering of one content block for AI context. Never throws;
 * returns "" when the block has nothing useful to say.
 */
export function blockToText(block: BlockLike): string {
  try {
    const type = typeof block?.type === "string" ? block.type : "";
    const renderer = RENDERER_BY_TYPE.get(type);
    if (renderer) {
      const obj = asObject(block.content);
      return obj ? renderer(obj) : "";
    }
    return fallbackText(type, block?.content);
  } catch {
    return "";
  }
}

/**
 * Joins the text of every block (blank line between blocks, empty blocks
 * skipped). With `maxChars`, keeps whole blocks in order until the next one
 * would not fit, then appends "[…truncated]". Only if the first block alone
 * exceeds the limit is it cut mid-block.
 */
export function blocksToText(
  blocks: { type: string; content: unknown }[],
  opts?: { maxChars?: number }
): string {
  const texts = (Array.isArray(blocks) ? blocks : [])
    .map((b) => blockToText(b))
    .filter((t) => t.length > 0);
  const full = texts.join(SEPARATOR);

  const maxChars = opts?.maxChars;
  if (maxChars === undefined || !Number.isFinite(maxChars) || maxChars <= 0 || full.length <= maxChars) {
    return full;
  }

  const budget = maxChars - SEPARATOR.length - TRUNCATED_MARKER.length;
  let kept = "";
  for (const text of texts) {
    const next = kept ? `${kept}${SEPARATOR}${text}` : text;
    if (next.length > budget) break;
    kept = next;
  }
  if (!kept) {
    kept = texts[0].slice(0, Math.max(budget, 0)).trimEnd();
    return kept ? `${kept}${SEPARATOR}${TRUNCATED_MARKER}` : TRUNCATED_MARKER;
  }
  return `${kept}${SEPARATOR}${TRUNCATED_MARKER}`;
}
