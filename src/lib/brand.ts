/**
 * Tenant brand colour -> a set of CSS custom properties that are SAFE to use
 * for text, fills and tints, whatever colour the academy picks.
 *
 * Why this exists: a raw brand colour can't be used everywhere. A light green
 * is unreadable as text on white, a dark navy is unreadable as text on a dark
 * hero, and white text on yellow is unreadable on a button. Instead of
 * sprinkling the raw colour around, templates use these roles:
 *
 *   --brand           the raw colour. Fills, borders, glows, decorative bits.
 *   --brand-on        text/icons that sit ON a --brand fill (white or near-black).
 *   --brand-ink       the brand as TEXT on a light background (>= 4.5:1 vs white).
 *   --brand-ink-dark  the brand as TEXT on a dark background (>= 4.5:1 vs #0f1117).
 *   --brand-deep      a very dark brand shade for headings on light backgrounds.
 *   --brand-soft      a pale tint for chips and active backgrounds.
 *   --brand-hover     hover state of --brand.
 *
 * Tailwind exposes them as bg-brand, text-brand-on, text-brand-ink, ... (see
 * the @theme block in globals.css).
 */

import type { CSSProperties } from "react";

export const DEFAULT_BRAND = "#fd5523";

const WHITE: RGB = [255, 255, 255];
const DARK_SURFACE: RGB = [15, 17, 23]; // #0f1117 - the darkest surface templates use
const NEAR_BLACK: RGB = [11, 18, 32]; // text colour used on light brand fills

type RGB = [number, number, number];

/** Parse #rgb / #rrggbb (with or without the #). Returns null when invalid. */
export function parseHex(input: string | null | undefined): RGB | null {
  if (!input) return null;
  let h = input.trim().replace(/^#/, "");
  if (/^[0-9a-f]{3}$/i.test(h)) h = h.split("").map((c) => c + c).join("");
  if (!/^[0-9a-f]{6}$/i.test(h)) return null;
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

export function toHex([r, g, b]: RGB): string {
  const c = (n: number) => Math.round(Math.min(255, Math.max(0, n))).toString(16).padStart(2, "0");
  return `#${c(r)}${c(g)}${c(b)}`;
}

/** WCAG relative luminance. */
export function luminance([r, g, b]: RGB): number {
  const lin = (v: number) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

/** WCAG contrast ratio, 1..21. */
export function contrast(a: RGB, b: RGB): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

function mix(a: RGB, b: RGB, t: number): RGB {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}

/**
 * Move `color` toward `target` in small steps until it reaches `min` contrast
 * against `against`. Keeps the hue, so the result still reads as "the brand".
 */
function shiftUntil(color: RGB, target: RGB, against: RGB, min: number): RGB {
  if (contrast(color, against) >= min) return color;
  for (let i = 1; i <= 100; i++) {
    const c = mix(color, target, i / 100);
    if (contrast(c, against) >= min) return c;
  }
  return target;
}

/**
 * Minimum contrast for text drawn ON a brand fill. 3:1 is the WCAG minimum for
 * large/bold text and UI components, which is what our buttons and badges are
 * (bold, uppercase). Below it we switch to near-black.
 */
const ON_BRAND_MIN = 3;

export type BrandTokens = {
  brand: string;
  on: string;
  ink: string;
  inkDark: string;
  deep: string;
  soft: string;
  hover: string;
};

export function brandTokens(input: string | null | undefined): BrandTokens {
  const rgb = parseHex(input) ?? (parseHex(DEFAULT_BRAND) as RGB);

  // Text on the brand fill: white if it clears 3:1, otherwise near-black.
  const on = contrast(rgb, WHITE) >= ON_BRAND_MIN ? WHITE : NEAR_BLACK;

  // Brand as text. On light surfaces darken it; on dark surfaces lighten it.
  const ink = shiftUntil(rgb, [0, 0, 0], WHITE, 4.5);
  const inkDark = shiftUntil(rgb, WHITE, DARK_SURFACE, 4.5);

  // Very dark shade for headings (>= 8:1 on white), still tinted by the brand.
  const deep = shiftUntil(mix(rgb, [0, 0, 0], 0.55), [0, 0, 0], WHITE, 8);

  const soft = mix(rgb, WHITE, 0.9);

  // Hover: darken, but if the colour is already very dark, lighten instead.
  const hover = luminance(rgb) < 0.05 ? mix(rgb, WHITE, 0.18) : mix(rgb, [0, 0, 0], 0.12);

  return {
    brand: toHex(rgb),
    on: toHex(on),
    ink: toHex(ink),
    inkDark: toHex(inkDark),
    deep: toHex(deep),
    soft: toHex(soft),
    hover: toHex(hover),
  };
}

/**
 * Inline style that scopes the brand to a subtree. Also sets the legacy
 * --primary-color so existing `var(--primary-color)` usages keep working.
 */
export function brandStyle(input: string | null | undefined): CSSProperties {
  const t = brandTokens(input);
  return {
    "--brand": t.brand,
    "--brand-on": t.on,
    "--brand-ink": t.ink,
    "--brand-ink-dark": t.inkDark,
    "--brand-deep": t.deep,
    "--brand-soft": t.soft,
    "--brand-hover": t.hover,
    "--primary-color": t.brand,
  } as CSSProperties;
}
