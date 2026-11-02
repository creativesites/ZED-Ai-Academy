/**
 * Pure colour helpers. No imports, so they run under
 * `node --experimental-strip-types` as well as in the bundle.
 */

export const SITE_INK = "#062e39";
export const SITE_WHITE = "#ffffff";

/** Parse `#rgb` or `#rrggbb` (case-insensitive, `#` optional). Returns null when invalid. */
export function parseHex(hex: string): [number, number, number] | null {
  if (typeof hex !== "string") return null;
  let h = hex.trim().replace(/^#/, "");
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  if (!/^[0-9a-fA-F]{6}$/.test(h)) return null;
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ];
}

/** WCAG 2.x relative luminance of an sRGB colour (0 = black, 1 = white). */
export function relativeLuminance(hex: string): number | null {
  const rgb = parseHex(hex);
  if (!rgb) return null;
  const [r, g, b] = rgb.map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG contrast ratio between two colours (1 to 21). Null if either is invalid. */
export function contrastRatio(a: string, b: string): number | null {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  if (la === null || lb === null) return null;
  const [hi, lo] = la > lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

/**
 * Pick the text colour that reads best on a solid background of `bgHex`:
 * the site ink (#062e39) or white, whichever gives the higher WCAG contrast.
 * Use it for text on brand-coloured buttons and badges. Invalid input falls
 * back to the site ink.
 */
export function readableTextOn(bgHex: string): string {
  const onWhite = contrastRatio(bgHex, SITE_WHITE);
  const onInk = contrastRatio(bgHex, SITE_INK);
  if (onWhite === null || onInk === null) return SITE_INK;
  return onWhite >= onInk ? SITE_WHITE : SITE_INK;
}
