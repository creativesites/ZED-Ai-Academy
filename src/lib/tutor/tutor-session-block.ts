import { z } from "zod";
import {
  FACE_STYLES,
  HAIR_STYLES,
  OUTFIT_STYLES,
  PROPS,
  type FaceStyle,
  type HairStyle,
  type OutfitStyle,
  type Prop,
} from "./contract.generated.ts";
import { SCENE_ARTBOARDS, type SceneArtboard } from "./rive-driver.ts";

// Content of a `tutor_session` lesson block. The teacher places it in a lesson and picks a scenario;
// the learner plays it from the lesson player. Pure: no React, no server imports, so the node tests
// and both the creator and the learner can use it.

export const TUTOR_SESSION_STYLES = ["scene", "guided_lesson", "oral_check"] as const;
export type TutorSessionStyle = (typeof TUTOR_SESSION_STYLES)[number];

export const tutorSessionBlockSchema = z.object({
  scenarioId: z.uuid(),
  style: z.enum(TUTOR_SESSION_STYLES),
  required: z.boolean(),
  title: z.string().trim().max(120).optional(),
  intro: z.string().trim().max(600).optional(),
});

export type TutorSessionBlock = z.infer<typeof tutorSessionBlockSchema>;

/** Shown to the learner (and returned by the server) when a required practice blocks lesson completion. */
export const REQUIRED_TUTOR_HINT = "Finish the required speaking practice before you complete this lesson.";

/** Returns the parsed block, or null when the stored content is missing or not valid. Never throws. */
export function parseTutorSessionBlock(content: unknown): TutorSessionBlock | null {
  const result = tutorSessionBlockSchema.safeParse(content);
  return result.success ? result.data : null;
}

/** The look of a persona as stored in ai_personas.rive_variant (same keys as the avatar PersonaLook). */
export type TutorPersonaLook = {
  skinColor: string;
  skinShadeColor: string;
  hairColor: string;
  outfitPrimary: string;
  outfitSecondary: string;
  accentColor: string;
  hairStyle: HairStyle;
  outfitStyle: OutfitStyle;
  prop: Prop;
  faceStyle: FaceStyle;
};

const HEX = /^#[0-9a-fA-F]{6}$/;

function hex(v: unknown): string | undefined {
  return typeof v === "string" && HEX.test(v) ? v : undefined;
}

function oneOf<T extends string>(v: unknown, allowed: readonly T[]): T | undefined {
  return typeof v === "string" && (allowed as readonly string[]).includes(v) ? (v as T) : undefined;
}

/**
 * Reads a persona's rive_variant into a partial look. Fields that are missing or not valid are left
 * out, so TutorSession falls back to its default for them. Returns undefined when nothing is usable.
 */
export function personaLookFromVariant(value: unknown): Partial<TutorPersonaLook> | undefined {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return undefined;
  const v = value as Record<string, unknown>;
  const look: Partial<TutorPersonaLook> = {};
  const colours = {
    skinColor: hex(v.skinColor),
    skinShadeColor: hex(v.skinShadeColor),
    hairColor: hex(v.hairColor),
    outfitPrimary: hex(v.outfitPrimary),
    outfitSecondary: hex(v.outfitSecondary),
    accentColor: hex(v.accentColor),
  };
  for (const [k, c] of Object.entries(colours)) if (c) (look as Record<string, string>)[k] = c;
  const hairStyle = oneOf(v.hairStyle, HAIR_STYLES);
  const outfitStyle = oneOf(v.outfitStyle, OUTFIT_STYLES);
  const prop = oneOf(v.prop, PROPS);
  const faceStyle = oneOf(v.faceStyle, FACE_STYLES);
  if (hairStyle) look.hairStyle = hairStyle;
  if (outfitStyle) look.outfitStyle = outfitStyle;
  if (prop) look.prop = prop;
  if (faceStyle) look.faceStyle = faceStyle;
  return Object.keys(look).length > 0 ? look : undefined;
}

/** A backdrop artboard name, or undefined when the scenario's scene is not one the Rive file has. */
export function sceneFromValue(value: unknown): SceneArtboard | undefined {
  return oneOf(value, SCENE_ARTBOARDS);
}

/** What the learner card and the creator preview need about a scenario. Built on the server. */
export type TutorScenarioView = {
  id: string;
  title: string;
  goal: string;
  style: TutorSessionStyle;
  scene: SceneArtboard | undefined;
  maxMinutes: number;
  /** Modes the scenario allows that the session overlay can use (voice and text). */
  modes: ("voice" | "text")[];
  persona: { name: string; displayName: string | null; look: Partial<TutorPersonaLook> | undefined } | null;
};

/** A practice_scenarios row joined with its persona (ai_personas), as the server reads it. */
export type TutorScenarioRow = {
  id: string;
  title: string;
  goal: string;
  style: string | null;
  scene: string | null;
  max_minutes: number | null;
  allowed_modes: string[] | null;
  ai_personas: { name: string; display_name: string | null; rive_variant: unknown } | null;
};

export function scenarioViewFromRow(row: TutorScenarioRow): TutorScenarioView {
  const style = (TUTOR_SESSION_STYLES as readonly string[]).includes(row.style ?? "")
    ? (row.style as TutorSessionStyle)
    : "scene";
  const persona = row.ai_personas;
  return {
    id: row.id,
    title: row.title,
    goal: row.goal,
    style,
    scene: sceneFromValue(row.scene),
    maxMinutes: row.max_minutes ?? 8,
    modes: overlayModes(row.allowed_modes ?? []),
    persona: persona
      ? {
          name: persona.name,
          displayName: persona.display_name,
          look: personaLookFromVariant(persona.rive_variant),
        }
      : null,
  };
}

export const TUTOR_STYLE_LABELS: Record<TutorSessionStyle, string> = {
  scene: "Practice scene",
  guided_lesson: "Guided lesson",
  oral_check: "Oral check",
};

/** Picks the modes the in-lesson overlay can offer (live is not built into it yet). */
export function overlayModes(allowed: readonly string[]): ("voice" | "text")[] {
  const modes = allowed.filter((m): m is "voice" | "text" => m === "voice" || m === "text");
  return modes.length > 0 ? modes : ["voice", "text"];
}
