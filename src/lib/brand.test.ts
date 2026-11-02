import { test } from "node:test";
import assert from "node:assert/strict";
import { brandTokens, brandStyle, contrast, parseHex, DEFAULT_BRAND } from "./brand.ts";

const WHITE: [number, number, number] = [255, 255, 255];
const DARK: [number, number, number] = [15, 17, 23];
const rgb = (hex: string) => parseHex(hex) as [number, number, number];

// A spread of colours academies might realistically pick, including the awkward ones.
const SAMPLES = [
  "#fd5523", // platform orange
  "#16a34a", // mid green
  "#86efac", // pale green  (unreadable as text on white if used raw)
  "#bbf7d0", // very pale green
  "#facc15", // yellow
  "#fef08a", // pale yellow
  "#0ea5e9", // sky
  "#1e3a8a", // navy        (unreadable as text on a dark hero if used raw)
  "#0b132b", // near black
  "#7c3aed", // violet
  "#ffffff", // white
  "#000000", // black
];

test("parseHex handles 3/6 digit, with and without #, and rejects junk", () => {
  assert.deepEqual(parseHex("#fff"), [255, 255, 255]);
  assert.deepEqual(parseHex("FD5523"), [253, 85, 35]);
  assert.equal(parseHex("not-a-colour"), null);
  assert.equal(parseHex("#12345"), null);
  assert.equal(parseHex(""), null);
  assert.equal(parseHex(null), null);
});

test("invalid input falls back to the default brand instead of throwing", () => {
  assert.equal(brandTokens("garbage").brand, DEFAULT_BRAND);
  assert.equal(brandTokens(null).brand, DEFAULT_BRAND);
  assert.equal(brandTokens(undefined).brand, DEFAULT_BRAND);
});

const GRAY50: [number, number, number] = [249, 250, 251]; // tailwind gray-50 - a typical tinted surface

function hsl(h: number, sat: number, l: number): string {
  const a = sat * Math.min(l, 1 - l);
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    const v = l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
    return Math.round(255 * v).toString(16).padStart(2, "0");
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

function assertRoles(hex: string) {
  const t = brandTokens(hex);
  const label = `${hex} -> ${JSON.stringify(t)}`;
  // brand-ink: text on light surfaces. Targets 5.5 on white so tinted surfaces still clear AA.
  assert.ok(contrast(rgb(t.ink), WHITE) >= 5.4, `ink on white ${contrast(rgb(t.ink), WHITE).toFixed(2)} :: ${label}`);
  assert.ok(contrast(rgb(t.ink), GRAY50) >= 4.5, `ink on gray-50 ${contrast(rgb(t.ink), GRAY50).toFixed(2)} :: ${label}`);
  assert.ok(contrast(rgb(t.ink), rgb(t.soft)) >= 4.5, `ink on soft ${contrast(rgb(t.ink), rgb(t.soft)).toFixed(2)} :: ${label}`);
  // brand-ink-dark: text on dark surfaces
  assert.ok(contrast(rgb(t.inkDark), DARK) >= 5.4, `inkDark on dark ${contrast(rgb(t.inkDark), DARK).toFixed(2)} :: ${label}`);
  // brand-deep: headings on light surfaces
  assert.ok(contrast(rgb(t.deep), WHITE) >= 7, `deep on white ${contrast(rgb(t.deep), WHITE).toFixed(2)} :: ${label}`);
  // text on the brand fill meets AA for normal text - except the platform default, which deliberately keeps white
  if (t.brand !== DEFAULT_BRAND) {
    assert.ok(contrast(rgb(t.on), rgb(t.brand)) >= 4.5, `on ${t.on} over ${t.brand} = ${contrast(rgb(t.on), rgb(t.brand)).toFixed(2)}`);
  }
}

for (const hex of SAMPLES) test(`${hex}: every text role meets its contrast target`, () => assertRoles(hex));

test("property: every role holds across a sweep of hue, saturation and lightness (incl. greys)", () => {
  let n = 0;
  for (let h = 0; h < 360; h += 15) {
    for (const sat of [0, 0.35, 0.7, 1]) {
      for (const l of [0.08, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.92]) {
        assertRoles(hsl(h, sat, l));
        n++;
      }
    }
  }
  assert.ok(n > 800);
});

test("mid-luminance greys still get readable text on the fill (needs pure black, not near-black)", () => {
  for (const hex of ["#777777", "#767676", "#7a7a7a", "#808080"]) {
    assert.ok(contrast(rgb(brandTokens(hex).on), rgb(hex)) >= 4.5, hex);
  }
});

test("the platform orange keeps white button text (existing look is unchanged)", () => {
  assert.equal(brandTokens("#fd5523").on, "#ffffff");
});

test("light brand colours get dark button text, not white", () => {
  assert.notEqual(brandTokens("#facc15").on, "#ffffff");
  assert.notEqual(brandTokens("#bbf7d0").on, "#ffffff");
});

test("ink preserves the hue family rather than going grey", () => {
  const t = brandTokens("#86efac"); // pale green
  const [r, g, b] = rgb(t.ink);
  assert.ok(g > r && g > b, `expected a green-dominant ink, got ${t.ink}`);
});

test("hover differs from the base colour", () => {
  for (const hex of SAMPLES) assert.notEqual(brandTokens(hex).hover, brandTokens(hex).brand, hex);
});

test("brandStyle exposes every role plus the legacy --primary-color", () => {
  const s = brandStyle("#16a34a") as Record<string, string>;
  for (const k of ["--brand", "--brand-on", "--brand-ink", "--brand-ink-dark", "--brand-deep", "--brand-soft", "--brand-hover", "--primary-color"]) {
    assert.match(s[k], /^#[0-9a-f]{6}$/, k);
  }
  assert.equal(s["--primary-color"], s["--brand"]);
});

test("globals.css fallback values match brandTokens(DEFAULT_BRAND), so they cannot drift", async () => {
  const { readFileSync } = await import("node:fs");
  const css = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");
  const t = brandTokens(DEFAULT_BRAND);
  const expected: Record<string, string> = {
    "--brand": t.brand,
    "--brand-on": t.on,
    "--brand-ink": t.ink,
    "--brand-ink-dark": t.inkDark,
    "--brand-deep": t.deep,
    "--brand-soft": t.soft,
    "--brand-hover": t.hover,
  };
  for (const [name, value] of Object.entries(expected)) {
    assert.ok(css.includes(`${name}: ${value};`), `globals.css is missing "${name}: ${value};"`);
  }
});
