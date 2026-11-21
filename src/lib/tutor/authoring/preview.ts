import { z } from "zod";
import { SCENE_ARTBOARDS } from "../rive-driver.ts";
import { SCENARIO_STYLES, SKILL_PACKS } from "../scenario.ts";
import type { PromptScenario } from "../server/prompt.ts";
import type { HistoryTurn } from "../server/turn-pipeline.ts";

export const PREVIEW_MAX_HISTORY = 24;
export const PREVIEW_MAX_LEARNER_CHARS = 1000;
export const PREVIEW_MAX_TUTOR_CHARS = 1200;
export const PREVIEW_MAX_LEARNER_TURNS = 20;

export const previewStepSchema = z.object({
  id: z.string().trim().min(1).max(64),
  goal: z.string().trim().min(1).max(400),
  boardContent: z.string().trim().max(500).optional(),
  checkQuestion: z.string().trim().max(300).optional(),
  targetItems: z.array(z.string().trim().min(1).max(120)).max(8).optional(),
});

export const previewTargetItemSchema = z.object({
  text: z.string().trim().min(1).max(120),
  pron: z.string().trim().max(120).optional(),
  meaning: z.string().trim().max(240).optional(),
});

export const previewFlowPayloadSchema = z.object({
  scenarioId: z.string().uuid().optional().nullable(),
  courseId: z.string().uuid().optional().nullable(),
  lessonId: z.string().uuid().optional().nullable(),
  companyId: z.string().min(1).optional().nullable(),
  personaId: z.string().uuid().optional().nullable(),
  title: z.string().trim().min(1).max(140),
  goal: z.string().trim().min(1).max(600),
  style: z.enum(SCENARIO_STYLES).default("guided_lesson"),
  scene: z.enum(SCENE_ARTBOARDS).optional().nullable(),
  maxMinutes: z.number().int().min(1).max(30).default(7),
  skillPack: z.enum(SKILL_PACKS).default("general-tutor"),
  level: z.string().trim().max(40).optional().nullable(),
  steps: z.array(previewStepSchema).max(10).default([]),
  targetItems: z.array(previewTargetItemSchema).max(12).default([]),
});

export type PreviewFlowPayload = z.infer<typeof previewFlowPayloadSchema>;

export const previewHistoryEntrySchema = z.object({
  role: z.enum(["tutor", "learner"]),
  text: z.string().trim().min(1).max(PREVIEW_MAX_TUTOR_CHARS),
});

export type PreviewHistoryEntry = z.infer<typeof previewHistoryEntrySchema>;

export const previewTurnJsonSchema = z.object({
  flow: previewFlowPayloadSchema,
  history: z.array(previewHistoryEntrySchema).max(PREVIEW_MAX_HISTORY).default([]),
  text: z.string().trim().max(PREVIEW_MAX_LEARNER_CHARS).optional(),
  elapsedMs: z.number().min(0).max(60 * 60_000).default(0),
});

export const previewReportJsonSchema = z.object({
  flow: previewFlowPayloadSchema,
  history: z.array(previewHistoryEntrySchema).max(PREVIEW_MAX_HISTORY).default([]),
});

/** Formats a drafted flow (including boardContent and checkQuestion) into PromptScenario beats. */
export function toPromptScenarioFromDraft(flow: PreviewFlowPayload): PromptScenario {
  return {
    title: flow.title,
    goal: flow.goal,
    beats: flow.steps.map((s) => {
      const parts = [s.goal];
      if (s.boardContent?.trim()) parts.push(`Board: ${s.boardContent.trim()}`);
      if (s.checkQuestion?.trim()) parts.push(`Check: ${s.checkQuestion.trim()}`);
      return { id: s.id, goal: parts.join(" | ") };
    }),
    targetItems: flow.targetItems,
    level: flow.level ?? null,
    roleNotes:
      "This is a teacher preview session ('Test as student'). Teach naturally just as you would with an enrolled learner.",
    maxMinutes: flow.maxMinutes,
  };
}

/** Converts flat client history entries into HistoryTurn rows for buildContents / buildTranscript. */
export function previewHistoryToTurns(history: readonly PreviewHistoryEntry[]): HistoryTurn[] {
  const turns: HistoryTurn[] = [];
  let pendingLearner: string | null = null;
  let idx = 0;

  for (const entry of history) {
    if (entry.role === "learner") {
      if (pendingLearner !== null) {
        turns.push({ idx: idx++, learner_text: pendingLearner, events: [] });
      }
      pendingLearner = entry.text;
    } else {
      turns.push({
        idx: idx++,
        learner_text: pendingLearner,
        events: [{ type: "say", text: entry.text }],
      });
      pendingLearner = null;
    }
  }
  if (pendingLearner !== null) {
    turns.push({ idx: idx++, learner_text: pendingLearner, events: [] });
  }
  return turns;
}

export function previewLimitReason(input: {
  history: readonly PreviewHistoryEntry[];
  learnerTurn: boolean;
  elapsedMs: number;
  maxMinutes: number;
}): "time_box" | "turn_limit" | null {
  if (input.elapsedMs >= input.maxMinutes * 60_000) return "time_box";
  const learnerCount = input.history.filter((h) => h.role === "learner").length + (input.learnerTurn ? 1 : 0);
  if (learnerCount > PREVIEW_MAX_LEARNER_TURNS) return "turn_limit";
  return null;
}
