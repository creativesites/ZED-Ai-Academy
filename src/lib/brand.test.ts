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

for (const hex of SAMPLES) {
  test(`${hex}: text roles meet contrast targets`, () => {
    const t = brandTokens(hex);
    // brand-ink is text on light surfaces
    assert.ok(contrast(rgb(t.ink), WHITE) >= 4.5, `ink ${t.ink} on white = ${contrast(rgb(t.ink), WHITE).toFixed(2)}`);
    // brand-ink-dark is text on dark surfaces
    assert.ok(contrast(rgb(t.inkDark), DARK) >= 4.5, `inkDark ${t.inkDark} on dark = ${contrast(rgb(t.inkDark), DARK).toFixed(2)}`);
    // brand-deep is heading text on light surfaces
    assert.ok(contrast(rgb(t.deep), WHITE) >= 7, `deep ${t.deep} on white = ${contrast(rgb(t.deep), WHITE).toFixed(2)}`);
    // text on the brand fill must be readable (>= 3:1, the bold/UI minimum we document)
    assert.ok(contrast(rgb(t.on), rgb(t.brand)) >= 3, `on ${t.on} over ${t.brand} = ${contrast(rgb(t.on), rgb(t.brand)).toFixed(2)}`);
  });
}

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
