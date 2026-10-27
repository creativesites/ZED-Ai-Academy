import { z } from "zod";

// Mirrors the `practice_scenarios` table in docs/LANGUAGE_IMPLEMENTATION_PLAN.md §3.
// Top-level fields are snake_case to match the table; nested beat fields are camelCase.

export const SESSION_ORIGINS = ["lesson", "assignment", "practice", "ask", "placement"] as const;
export type SessionOrigin = (typeof SESSION_ORIGINS)[number];

export const SKILL_PACKS = ["language-zh", "language-es", "language-fr", "health-sim", "general-tutor"] as const;
export type SkillPack = (typeof SKILL_PACKS)[number];

export const MODES = ["live", "voice", "text"] as const;
export type Mode = (typeof MODES)[number];

export const SCENARIO_VISIBILITIES = ["course", "tenant_library", "platform"] as const;
export type ScenarioVisibility = (typeof SCENARIO_VISIBILITIES)[number];

export const SCENARIO_STYLES = ["scene", "guided_lesson", "oral_check"] as const;
export type ScenarioStyle = (typeof SCENARIO_STYLES)[number];

const nonEmpty = z.string().min(1);

export const scenarioBeatSchema = z.object({
  id: nonEmpty,
  goal: nonEmpty,
  targetItems: z.array(nonEmpty).optional(),
});

export const scenarioTargetItemSchema = z.object({
  text: nonEmpty,
  pron: z.string().optional(),
  meaning: z.string().optional(),
});

export const scenarioSchema = z.object({
  skill_pack: z.enum(SKILL_PACKS),
  persona_id: nonEmpty,
  title: nonEmpty,
  goal: nonEmpty,
  beats: z.array(scenarioBeatSchema),
  target_items: z.array(scenarioTargetItemSchema),
  level: nonEmpty.optional(),
  exam_task: nonEmpty.optional(),
  max_minutes: z.number().int().min(1).max(30),
  allowed_modes: z
    .array(z.enum(MODES))
    .min(1)
    .refine((modes) => new Set(modes).size === modes.length, { message: "allowed_modes must not repeat" }),
  scene: nonEmpty.optional(),
  visibility: z.enum(SCENARIO_VISIBILITIES),
  style: z.enum(SCENARIO_STYLES),
});

export type ScenarioBeat = z.infer<typeof scenarioBeatSchema>;
export type ScenarioTargetItem = z.infer<typeof scenarioTargetItemSchema>;
export type Scenario = z.infer<typeof scenarioSchema>;
