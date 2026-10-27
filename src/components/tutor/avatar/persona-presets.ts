import presets from "../../../../design/rive/presets.json";
import { FACE_STYLES, HAIR_STYLES, OUTFIT_STYLES, PROPS } from "@/lib/tutor/contract.generated";
import type { PersonaLook } from "./types";

// The five characters for the Avatar Lab and tests. The values come from design/rive/presets.json, the
// Rive agent's file, which is imported directly so there is one copy. Each value is checked against the
// contract enums when this module loads, so a bad preset fails loudly rather than rendering wrong.

type RawPreset = Record<string, string> & { name: string };

const RAW = presets as unknown as Record<string, RawPreset>;

function pick<T extends string>(value: string, allowed: readonly T[], field: string, key: string): T {
  if ((allowed as readonly string[]).includes(value)) return value as T;
  throw new Error(`persona preset ${key}: ${field} "${value}" is not a contract value`);
}

function lookFrom(key: string): PersonaLook {
  const p = RAW[key];
  if (!p) throw new Error(`persona preset ${key} is missing from design/rive/presets.json`);
  return {
    skinColor: p.skinColor,
    skinShadeColor: p.skinShadeColor,
    hairColor: p.hairColor,
    outfitPrimary: p.outfitPrimary,
    outfitSecondary: p.outfitSecondary,
    accentColor: p.accentColor,
    hairStyle: pick(p.hairStyle, HAIR_STYLES, "hairStyle", key),
    outfitStyle: pick(p.outfitStyle, OUTFIT_STYLES, "outfitStyle", key),
    prop: pick(p.prop, PROPS, "prop", key),
    faceStyle: pick(p.faceStyle, FACE_STYLES, "faceStyle", key),
  };
}

export type PersonaPresetKey = "lin" | "sofia" | "camille" | "tendai" | "tinashe";

export const PERSONA_PRESETS: ReadonlyArray<{ key: PersonaPresetKey; label: string; look: PersonaLook }> = (
  ["lin", "sofia", "camille", "tendai", "tinashe"] as const
).map((key) => ({ key, label: RAW[key]?.name ?? key, look: lookFrom(key) }));
