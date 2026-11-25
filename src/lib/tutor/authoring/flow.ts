import { z } from "zod";
import { SCENE_ARTBOARDS, type SceneArtboard } from "../rive-driver.ts";
import {
  ALL_SKILL_PACKS,
  SCENARIO_STYLES,
  type ScenarioStyle,
  type SkillPack,
} from "../scenario.ts";
import type { LessonObjective } from "./objectives.ts";
import { getAuthoringTemplate, type AuthoringTemplateId } from "./templates.ts";

export const MIN_FLOW_STEPS = 3;
export const MAX_FLOW_STEPS = 5;

export const flowStepSchema = z.object({
  id: z.string().trim().min(1).max(64),
  goal: z.string().trim().min(3).max(400),
  boardContent: z.string().trim().max(500).default(""),
  checkQuestion: z.string().trim().max(300).default(""),
  targetItems: z.array(z.string().trim().min(1).max(120)).max(8).optional(),
});

export const flowTargetItemSchema = z.object({
  text: z.string().trim().min(1).max(120),
  pron: z.string().trim().max(120).optional(),
  meaning: z.string().trim().max(240).optional(),
});

export const draftedFlowSchema = z.object({
  title: z.string().trim().min(2).max(140),
  goal: z.string().trim().min(5).max(600),
  style: z.enum(SCENARIO_STYLES),
  scene: z.enum(SCENE_ARTBOARDS),
  maxMinutes: z.number().int().min(1).max(30),
  skillPack: z.enum(ALL_SKILL_PACKS),
  steps: z.array(flowStepSchema).min(MIN_FLOW_STEPS).max(MAX_FLOW_STEPS),
  targetItems: z.array(flowTargetItemSchema).max(12),
});

export type FlowStep = z.infer<typeof flowStepSchema>;
export type FlowTargetItem = z.infer<typeof flowTargetItemSchema>;
export type DraftedFlow = z.infer<typeof draftedFlowSchema>;

/**
 * Loose JSON Schema for Gemini structured output (`responseJsonSchema`).
 * No number bounds, string lengths, or array length limits (guarded by flow.test.ts).
 */
export const FLOW_DRAFT_JSON_SCHEMA = {
  type: "object",
  properties: {
    title: { type: "string", description: "Short, engaging flow title." },
    goal: { type: "string", description: "1-2 sentence learner goal describing what they will master." },
    style: { type: "string", enum: [...SCENARIO_STYLES] },
    scene: { type: "string", enum: [...SCENE_ARTBOARDS] },
    maxMinutes: { type: "integer" },
    skillPack: { type: "string", enum: [...ALL_SKILL_PACKS] },
    steps: {
      type: "array",
      description: "3 to 5 sequential teaching/check steps.",
      items: {
        type: "object",
        properties: {
          id: { type: "string" },
          goal: { type: "string", description: "What the AI teacher teaches or checks in this step." },
          boardContent: {
            type: "string",
            description: "Short text, bullets, worked calculation, or prompt shown on the teaching board.",
          },
          checkQuestion: {
            type: "string",
            description: "The question or prompt the teacher asks the learner in this step.",
          },
          targetItems: {
            type: "array",
            items: { type: "string" },
          },
        },
        required: ["id", "goal", "boardContent", "checkQuestion"],
      },
    },
    targetItems: {
      type: "array",
      items: {
        type: "object",
        properties: {
          text: { type: "string" },
          pron: { type: "string" },
          meaning: { type: "string" },
        },
        required: ["text"],
      },
    },
  },
  required: ["title", "goal", "style", "scene", "maxMinutes", "skillPack", "steps", "targetItems"],
} as const;

const LANGUAGE_PATTERNS: { pack: SkillPack; pattern: RegExp }[] = [
  { pack: "language-zh", pattern: /\b(mandarin|chinese|pinyin|hanzi|hsk)\b/i },
  { pack: "language-es", pattern: /\b(spanish|español|espanol|dele)\b/i },
  { pack: "language-fr", pattern: /\b(french|français|francais|delf|dalf)\b/i },
  { pack: "language-bem", pattern: /\b(bemba|ichibemba|icibemba)\b/i },
  { pack: "language-ny", pattern: /\b(nyanja|chinyanja|chewa|chichewa)\b/i },
  { pack: "language-tog", pattern: /\b(tonga|chitonga)\b/i },
  { pack: "health-sim", pattern: /\b(clinical intake|patient intake|triage|nursing intake)\b/i },
];

export function pickSkillPackForLesson(input: {
  courseTitle?: string | null;
  category?: string | null;
  lessonTitle?: string | null;
  explicit?: string | null;
}): SkillPack {
  if (input.explicit && (ALL_SKILL_PACKS as readonly string[]).includes(input.explicit)) {
    return input.explicit as SkillPack;
  }
  const haystack = [input.courseTitle, input.category, input.lessonTitle].filter(Boolean).join(" ");
  for (const entry of LANGUAGE_PATTERNS) {
    if (entry.pattern.test(haystack)) return entry.pack;
  }
  return "general-tutor";
}

const STUDIO_CATEGORY_PATTERN = /\b(ai|prompt|coding|code|programming|software|data|tech|design|career|coaching|workshop|studio|debate|viva)\b/i;

export function defaultSceneForLesson(input: {
  templateId?: AuthoringTemplateId | string | null;
  courseTitle?: string | null;
  category?: string | null;
  personaDefaultScene?: SceneArtboard | null;
}): SceneArtboard {
  if (input.templateId) {
    const tpl = getAuthoringTemplate(input.templateId);
    if (tpl.defaultScene === "Scene_Studio") return "Scene_Studio";
  }
  if (input.personaDefaultScene && (SCENE_ARTBOARDS as readonly string[]).includes(input.personaDefaultScene)) {
    return input.personaDefaultScene;
  }
  const haystack = [input.courseTitle, input.category].filter(Boolean).join(" ");
  if (STUDIO_CATEGORY_PATTERN.test(haystack)) return "Scene_Studio";
  return "Scene_Classroom";
}

export function buildDraftFlowPrompt(input: {
  courseTitle: string;
  courseCategory?: string | null;
  courseLevel?: string | null;
  lessonTitle: string;
  objectives: readonly LessonObjective[];
  templateId: AuthoringTemplateId;
  skillPack: SkillPack;
  defaultScene: SceneArtboard;
  materialText: string;
  teacherName?: string | null;
  instructions?: string | null;
}): { systemInstruction: string; prompt: string } {
  const template = getAuthoringTemplate(input.templateId);
  const skeletonText = template.stepSkeleton
    .map((s, i) => `${i + 1}. [${s.id}] ${s.label}: ${s.hint}`)
    .join("\n");

  const systemInstruction = `You are an expert curriculum co-author for CS Learn.
Design an interactive AI Teacher flow from the lesson's learning objectives and material.
Rules:
- Return ONLY valid JSON matching the schema.
- Provide 3 to 5 steps. Each step MUST include:
  - "id": short slug id (e.g. "step-1", "meaning", "check")
  - "goal": concise instruction for what the AI teacher teaches or checks in that step
  - "boardContent": concrete bullets, steps, worked line, or prompt to display on the teaching board
  - "checkQuestion": the exact question or mini-task the teacher asks the learner in that step
- Keep "targetItems" practical (3 to 6 key concepts, terms, or phrases from the lesson).
- For non-language lessons, use "skillPack": "general-tutor" and ground examples in everyday Zambian contexts when natural (kwacha, mobile money, local businesses, markets, farming, offices).
- Stay strictly grounded in the lesson material and objectives.`;

  const objectivesBlock = input.objectives
    .map((o, i) => `${i + 1}. ${o.text} (Evidence: ${o.evidence})`)
    .join("\n");

  const prompt = [
    `Course: ${input.courseTitle}${input.courseCategory ? ` (${input.courseCategory})` : ""}`,
    input.courseLevel ? `Level: ${input.courseLevel}` : null,
    `Lesson: ${input.lessonTitle}`,
    input.teacherName ? `Teacher persona: ${input.teacherName}` : null,
    `Template: ${template.label} — ${template.tagline}`,
    `Template guidance: ${template.promptHints}`,
    `Required style: ${template.style}`,
    `Default scene: ${input.defaultScene}`,
    `Skill pack: ${input.skillPack}`,
    `Suggested maxMinutes: ${template.maxMinutes}`,
    "",
    "Template step skeleton (adapt to 3-5 steps for this lesson):",
    skeletonText,
    "",
    "Learning objectives to cover:",
    objectivesBlock,
    input.instructions?.trim() ? `\nExtra teacher instructions: ${input.instructions.trim()}` : null,
    "",
    "Lesson material:",
    input.materialText.trim() || `Lesson title: ${input.lessonTitle}`,
  ]
    .filter((line): line is string => line !== null)
    .join("\n");

  return { systemInstruction, prompt };
}

export function buildReviseFlowPrompt(input: {
  currentFlow: DraftedFlow;
  instruction: string;
  objectives?: readonly LessonObjective[];
  lessonTitle?: string;
  materialText?: string;
}): { systemInstruction: string; prompt: string } {
  const systemInstruction = `You are revising an AI Teacher flow according to the teacher's one-line instruction.
Rules:
- Apply the teacher's instruction cleanly while keeping the rest of the flow intact and coherent.
- Keep 3 to 5 steps, each with id, goal, boardContent, and checkQuestion.
- Keep style in ${SCENARIO_STYLES.join(" | ")} and scene in ${SCENE_ARTBOARDS.join(" | ")}.
- Return ONLY the full revised JSON object matching the schema.`;

  const objectivesText =
    input.objectives && input.objectives.length > 0
      ? `\nLesson objectives:\n${input.objectives.map((o, i) => `${i + 1}. ${o.text}`).join("\n")}`
      : "";

  const materialSnippet = input.materialText?.trim()
    ? `\nLesson material reference:\n${input.materialText.trim().slice(0, 4000)}`
    : "";

  const prompt = [
    input.lessonTitle ? `Lesson: ${input.lessonTitle}` : null,
    `Teacher's instruction: "${input.instruction.trim()}"`,
    objectivesText || null,
    materialSnippet || null,
    "",
    "Current flow JSON:",
    JSON.stringify(input.currentFlow, null, 2),
  ]
    .filter((line): line is string => line !== null)
    .join("\n");

  return { systemInstruction, prompt };
}

export type ParseDraftedFlowResult =
  | { ok: true; flow: DraftedFlow }
  | { ok: false; error: string };

function stripCodeFences(raw: string): string {
  return raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
}

export function parseDraftedFlow(
  rawJson: unknown,
  defaults: {
    style?: ScenarioStyle;
    scene?: SceneArtboard;
    skillPack?: SkillPack;
    maxMinutes?: number;
  } = {},
): ParseDraftedFlowResult {
  let value = rawJson;
  if (typeof value === "string") {
    try {
      value = JSON.parse(stripCodeFences(value));
    } catch {
      return { ok: false, error: "Model output was not valid JSON." };
    }
  }
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return { ok: false, error: "Expected a flow JSON object." };
  }

  const obj = value as Record<string, unknown>;
  const rawSteps = Array.isArray(obj.steps) ? obj.steps : [];
  const steps = rawSteps
    .slice(0, MAX_FLOW_STEPS)
    .map((step, i) => {
      if (typeof step !== "object" || step === null) return null;
      const s = step as Record<string, unknown>;
      const rawId = typeof s.id === "string" && s.id.trim() ? s.id.trim() : `step-${i + 1}`;
      const id = rawId.replace(/[^a-zA-Z0-9_-]/g, "-").slice(0, 64) || `step-${i + 1}`;
      const goal = typeof s.goal === "string" ? s.goal.trim().slice(0, 400) : "";
      const boardContent = typeof s.boardContent === "string" ? s.boardContent.trim().slice(0, 500) : "";
      const checkQuestion = typeof s.checkQuestion === "string" ? s.checkQuestion.trim().slice(0, 300) : "";
      const targetItems = Array.isArray(s.targetItems)
        ? (s.targetItems as unknown[])
            .filter((x): x is string => typeof x === "string" && x.trim().length > 0)
            .map((x) => x.trim().slice(0, 120))
            .slice(0, 8)
        : undefined;
      if (!goal) return null;
      return {
        id,
        goal,
        boardContent,
        checkQuestion,
        ...(targetItems && targetItems.length > 0 ? { targetItems } : {}),
      };
    })
    .filter((s): s is FlowStep => s !== null);

  const rawItems = Array.isArray(obj.targetItems) ? obj.targetItems : [];
  const targetItems = rawItems
    .slice(0, 12)
    .map((item) => {
      if (typeof item !== "object" || item === null) return null;
      const it = item as Record<string, unknown>;
      const text = typeof it.text === "string" ? it.text.trim().slice(0, 120) : "";
      if (!text) return null;
      const pron = typeof it.pron === "string" && it.pron.trim() ? it.pron.trim().slice(0, 120) : undefined;
      const meaning = typeof it.meaning === "string" && it.meaning.trim() ? it.meaning.trim().slice(0, 240) : undefined;
      return { text, ...(pron ? { pron } : {}), ...(meaning ? { meaning } : {}) };
    })
    .filter((x): x is FlowTargetItem => x !== null);

  const style =
    typeof obj.style === "string" && (SCENARIO_STYLES as readonly string[]).includes(obj.style)
      ? (obj.style as ScenarioStyle)
      : defaults.style ?? "guided_lesson";

  const scene =
    typeof obj.scene === "string" && (SCENE_ARTBOARDS as readonly string[]).includes(obj.scene)
      ? (obj.scene as SceneArtboard)
      : defaults.scene ?? "Scene_Classroom";

  const skillPack =
    typeof obj.skillPack === "string" && (ALL_SKILL_PACKS as readonly string[]).includes(obj.skillPack)
      ? (obj.skillPack as SkillPack)
      : defaults.skillPack ?? "general-tutor";

  const rawMinutes = typeof obj.maxMinutes === "number" && Number.isFinite(obj.maxMinutes) ? obj.maxMinutes : defaults.maxMinutes ?? 7;
  const maxMinutes = Math.min(30, Math.max(1, Math.round(rawMinutes)));

  const candidate = {
    title: typeof obj.title === "string" ? obj.title.trim().slice(0, 140) : "",
    goal: typeof obj.goal === "string" ? obj.goal.trim().slice(0, 600) : "",
    style,
    scene,
    maxMinutes,
    skillPack,
    steps,
    targetItems,
  };

  const parsed = draftedFlowSchema.safeParse(candidate);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Flow failed validation.",
    };
  }
  return { ok: true, flow: parsed.data };
}

export type FlowDiffEntry = {
  kind: "meta" | "step_added" | "step_removed" | "step_updated" | "step_reordered" | "items";
  label: string;
};

/** Summarizes what changed between two DraftedFlow snapshots for the UI diff/undo banner. */
export function computeFlowDiff(before: DraftedFlow, after: DraftedFlow): FlowDiffEntry[] {
  const changes: FlowDiffEntry[] = [];

  if (before.title !== after.title) {
    changes.push({ kind: "meta", label: `Title updated to "${after.title}"` });
  }
  if (before.goal !== after.goal) {
    changes.push({ kind: "meta", label: "Learner goal updated" });
  }
  if (before.style !== after.style) {
    changes.push({ kind: "meta", label: `Style changed (${before.style} -> ${after.style})` });
  }
  if (before.scene !== after.scene) {
    changes.push({ kind: "meta", label: `Scene changed (${before.scene} -> ${after.scene})` });
  }
  if (before.maxMinutes !== after.maxMinutes) {
    changes.push({ kind: "meta", label: `Duration changed (${before.maxMinutes}m -> ${after.maxMinutes}m)` });
  }

  const beforeById = new Map(before.steps.map((s, idx) => [s.id, { step: s, idx }]));
  const afterIds = new Set(after.steps.map((s) => s.id));

  after.steps.forEach((step, idx) => {
    const prev = beforeById.get(step.id);
    if (!prev) {
      changes.push({ kind: "step_added", label: `Step ${idx + 1} added: ${step.goal.slice(0, 60)}` });
      return;
    }
    const fields: string[] = [];
    if (prev.step.goal !== step.goal) fields.push("goal");
    if (prev.step.boardContent !== step.boardContent) fields.push("board");
    if (prev.step.checkQuestion !== step.checkQuestion) fields.push("check question");
    if (fields.length > 0) {
      changes.push({ kind: "step_updated", label: `Step ${idx + 1} updated (${fields.join(", ")})` });
    }
    if (prev.idx !== idx) {
      changes.push({ kind: "step_reordered", label: `Step "${step.id}" moved (${prev.idx + 1} -> ${idx + 1})` });
    }
  });

  before.steps.forEach((step, idx) => {
    if (!afterIds.has(step.id)) {
      changes.push({ kind: "step_removed", label: `Step ${idx + 1} removed (${step.id})` });
    }
  });

  if (JSON.stringify(before.targetItems) !== JSON.stringify(after.targetItems)) {
    changes.push({
      kind: "items",
      label: `Target items updated (${before.targetItems.length} -> ${after.targetItems.length})`,
    });
  }

  return changes;
}

/** Converts authoring steps into DB `practice_scenarios.beats` payloads. */
export function toScenarioBeatsPayload(steps: ReadonlyArray<FlowStep>) {
  return steps.map((s) => ({
    id: s.id,
    goal: s.goal,
    ...(s.targetItems?.length ? { targetItems: s.targetItems } : {}),
    ...(s.boardContent ? { boardContent: s.boardContent } : {}),
    ...(s.checkQuestion ? { checkQuestion: s.checkQuestion } : {}),
  }));
}
