/**
 * Validation of parsed generation replies. Pure; each function keeps the acceptance rule its route used before the
 * move to `aiJson` (same or stricter), so route behaviour is unchanged for well-formed replies.
 */

export type GeneratedQuestion = {
  question: string;
  options: string[];
  correct_indices: number[];
  explanation: string;
};

/** Quiz questions: an array where every item has a question, exactly 4 options and at least one correct index. */
export function validQuizQuestions(data: unknown): GeneratedQuestion[] | null {
  if (!Array.isArray(data)) return null;
  const valid = data.every(
    (q) =>
      typeof q === "object" &&
      q !== null &&
      typeof (q as GeneratedQuestion).question === "string" &&
      Array.isArray((q as GeneratedQuestion).options) &&
      (q as GeneratedQuestion).options.length === 4 &&
      Array.isArray((q as GeneratedQuestion).correct_indices) &&
      (q as GeneratedQuestion).correct_indices.length > 0,
  );
  return valid ? (data as GeneratedQuestion[]) : null;
}

/** Curriculum: an object with a non-empty `modules` array. */
export function validCurriculum(data: unknown): { modules: unknown[] } | null {
  const modules = (data as { modules?: unknown } | null)?.modules;
  return Array.isArray(modules) && modules.length > 0 ? (data as { modules: unknown[] }) : null;
}

/** Lesson content: a non-empty `blocks` array. */
export function validLessonBlocks(data: unknown): unknown[] | null {
  const blocks = (data as { blocks?: unknown } | null)?.blocks;
  return Array.isArray(blocks) && blocks.length > 0 ? blocks : null;
}

export type CourseBlueprint = {
  title: string;
  description: string;
  category: string;
  level: string;
  price_type: string;
  audience: string;
  quick_win: string;
  capstone: string;
  module_outline: string[];
};

/** Course blueprint: every field present and non-empty, `module_outline` an array. */
export function validCourseBlueprint(data: unknown): CourseBlueprint | null {
  const b = data as Partial<CourseBlueprint> | null;
  if (
    !b ||
    !b.title ||
    !b.description ||
    !b.category ||
    !b.level ||
    !b.price_type ||
    !b.audience ||
    !b.quick_win ||
    !b.capstone ||
    !Array.isArray(b.module_outline)
  ) {
    return null;
  }
  return b as CourseBlueprint;
}

export type GeneratedTutorScenario = {
  title: string;
  goal: string;
  level: string;
  max_minutes: number;
  scene: string;
  beats: unknown[];
  target_items: unknown[];
};

/** Tutor scenario draft with defaults for anything missing; the scene must be a known artboard. */
export function normalizeTutorScenario(
  parsed: Record<string, unknown>,
  opts: { level: string; scenes: readonly string[]; defaultScene?: string },
): GeneratedTutorScenario {
  const scene =
    typeof parsed.scene === "string" && opts.scenes.includes(parsed.scene)
      ? parsed.scene
      : (opts.defaultScene ?? "Scene_TeaHouse");
  return {
    title: typeof parsed.title === "string" ? parsed.title : "Speaking practice",
    goal: typeof parsed.goal === "string" ? parsed.goal : "Practise the key concepts from this lesson out loud.",
    level: typeof parsed.level === "string" ? parsed.level : opts.level,
    max_minutes:
      typeof parsed.max_minutes === "number" ? Math.min(30, Math.max(2, Math.round(parsed.max_minutes))) : 6,
    scene,
    beats: Array.isArray(parsed.beats) ? parsed.beats : [],
    target_items: Array.isArray(parsed.target_items) ? parsed.target_items : [],
  };
}

/** Number of quiz questions to ask for: the client's value clamped to 1–10 (default 3). */
export function quizQuestionCount(raw: unknown): number {
  const n = typeof raw === "number" ? raw : Number(raw);
  if (!Number.isFinite(n)) return 3;
  return Math.min(10, Math.max(1, Math.round(n)));
}
