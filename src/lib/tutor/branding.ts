import type { TutorPersonaLook } from "./tutor-session-block.ts";

const HEX_PATTERN = /^#([0-9a-fA-F]{6}|[0-9a-fA-F]{3})$/;

/**
 * Normalizes a 3- or 6-digit hex color string into #RRGGBB uppercase, or null if invalid.
 */
export function normalizeHexColor(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  const match = HEX_PATTERN.exec(trimmed);
  if (!match) return null;
  const raw = match[1];
  if (raw.length === 3) {
    return `#${raw[0]}${raw[0]}${raw[1]}${raw[1]}${raw[2]}${raw[2]}`.toUpperCase();
  }
  return `#${raw.toUpperCase()}`;
}

/**
 * Mixes two #RRGGBB colors cleanly (weight in [0, 1] toward `target`).
 */
export function mixHex(baseHex: string, targetHex: string, weight: number): string {
  const b = normalizeHexColor(baseHex) ?? "#062E39";
  const t = normalizeHexColor(targetHex) ?? "#FFFFFF";
  const w = Math.max(0, Math.min(1, weight));
  const parse = (hex: string, start: number) => parseInt(hex.slice(start, start + 2), 16);
  const channel = (start: number) =>
    Math.round(parse(b, start) * (1 - w) + parse(t, start) * w)
      .toString(16)
      .padStart(2, "0");
  return `#${channel(1)}${channel(3)}${channel(5)}`.toUpperCase();
}

/**
 * Applies an academy's primary brand color (plus optional accent color) onto
 * a teacher's outfit/trim/accent without changing skin or hair identity.
 */
export function applyBrandColorsToLook<T extends Partial<TutorPersonaLook>>(
  look: T,
  branding: { primaryColor?: string | null; accentColor?: string | null },
): T {
  const primary = normalizeHexColor(branding.primaryColor);
  if (!primary) return look;
  const accent = normalizeHexColor(branding.accentColor) ?? mixHex(primary, "#FFFFFF", 0.25);
  const trim = mixHex(primary, "#FFFFFF", 0.88);
  return {
    ...look,
    outfitPrimary: primary,
    outfitSecondary: trim,
    accentColor: accent,
  };
}

/**
 * Merges a tenant-wide brand look override onto a teacher's base look when no
 * custom outfit override is desired.
 */
export function mergeBrandLook(
  baseLook: Partial<TutorPersonaLook> | undefined,
  brandLook: Partial<TutorPersonaLook> | undefined,
): Partial<TutorPersonaLook> | undefined {
  if (!baseLook && !brandLook) return undefined;
  return {
    ...(baseLook ?? {}),
    ...(brandLook ?? {}),
  };
}
