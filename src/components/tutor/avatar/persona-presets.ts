import presets from "../../../../design/rive/presets.json";
import { FACE_STYLES, HAIR_STYLES, OUTFIT_STYLES, PROPS } from "@/lib/tutor/contract.generated";
import type { PersonaLook } from "./types";
import { BRAND_COLORS } from "@/lib/brand";

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
export type ScalePersonaPresetKey = "mwila" | "banda" | "amina" | "chanda";
export type AnyPersonaPresetKey = PersonaPresetKey | ScalePersonaPresetKey;

export const PERSONA_PRESETS: ReadonlyArray<{ key: PersonaPresetKey; label: string; look: PersonaLook }> = (
  ["lin", "sofia", "camille", "tendai", "tinashe"] as const
).map((key) => ({ key, label: RAW[key]?.name ?? key, look: lookFrom(key) }));

export const SCALE_PERSONA_PRESETS: ReadonlyArray<{
  key: ScalePersonaPresetKey;
  label: string;
  look: PersonaLook;
}> = [
  {
    key: "mwila",
    label: "Mwila",
    look: {
      skinColor: "#6B3E26",
      skinShadeColor: "#4E2B19",
      hairColor: "#14100E",
      outfitPrimary: "#0F766E",
      outfitSecondary: "#F0FDF4",
      accentColor: "#F59E0B",
      hairStyle: "braids",
      outfitStyle: "cardigan",
      prop: "clipboard",
      faceStyle: "tinashe",
    },
  },
  {
    key: "banda",
    label: "Banda",
    look: {
      skinColor: "#4E2E1D",
      skinShadeColor: "#361D11",
      hairColor: "#111111",
      outfitPrimary: "#1E3A5F",
      outfitSecondary: "#F8FAFC",
      accentColor: BRAND_COLORS.royalBlue,
      hairStyle: "short",
      outfitStyle: "blazer",
      prop: "book",
      faceStyle: "tendai",
    },
  },
  {
    key: "amina",
    label: "Amina",
    look: {
      skinColor: "#7F4D32",
      skinShadeColor: "#5C3520",
      hairColor: "#1B1310",
      outfitPrimary: "#7C3AED",
      outfitSecondary: "#FAF5FF",
      accentColor: "#FBBF24",
      hairStyle: "bun",
      outfitStyle: "blouse_stripe",
      prop: "tea_cup",
      faceStyle: "sofia",
    },
  },
  {
    key: "chanda",
    label: "Chanda",
    look: {
      skinColor: "#5A3623",
      skinShadeColor: "#3E2315",
      hairColor: "#14100E",
      outfitPrimary: "#B45309",
      outfitSecondary: "#FFFBEB",
      accentColor: BRAND_COLORS.navy,
      hairStyle: "curly",
      outfitStyle: "cardigan",
      prop: "book",
      faceStyle: "camille",
    },
  },
];

export const ALL_PERSONA_PRESETS: ReadonlyArray<{
  key: AnyPersonaPresetKey;
  label: string;
  look: PersonaLook;
}> = [...PERSONA_PRESETS, ...SCALE_PERSONA_PRESETS];
