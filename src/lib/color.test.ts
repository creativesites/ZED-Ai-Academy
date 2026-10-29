import { test } from "node:test";
import assert from "node:assert/strict";
import { contrastRatio, parseHex, readableTextOn, relativeLuminance, SITE_INK } from "./color.ts";

test("parseHex accepts #rrggbb and #rgb and rejects junk", () => {
  assert.deepEqual(parseHex("#fd5523"), [253, 85, 35]);
  assert.deepEqual(parseHex("FFF"), [255, 255, 255]);
  assert.equal(parseHex("not-a-colour"), null);
  assert.equal(parseHex("#12345"), null);
});

test("relative luminance anchors: white is 1, black is 0", () => {
  assert.ok(Math.abs((relativeLuminance("#ffffff") ?? 0) - 1) < 1e-9);
  assert.ok(Math.abs(relativeLuminance("#000000") ?? 1) < 1e-9);
});

test("contrast ratio matches WCAG maximum for black on white", () => {
  const r = contrastRatio("#000000", "#ffffff");
  assert.ok(r !== null && Math.abs(r - 21) < 1e-9);
});

test("readableTextOn picks white on dark brand colours", () => {
  assert.equal(readableTextOn("#062e39"), "#ffffff");
  assert.equal(readableTextOn("#1d4ed8"), "#ffffff");
  assert.equal(readableTextOn("#000000"), "#ffffff");
});

test("readableTextOn picks the site ink on light brand colours", () => {
  assert.equal(readableTextOn("#fde047"), SITE_INK);
  assert.equal(readableTextOn("#ffffff"), SITE_INK);
  assert.equal(readableTextOn("#fd5523"), SITE_INK);
});

test("readableTextOn always returns the higher-contrast option", () => {
  for (const hex of ["#fd5523", "#10b981", "#7c3aed", "#f59e0b", "#0ea5e9", "#be123c"]) {
    const chosen = readableTextOn(hex);
    const other = chosen === "#ffffff" ? SITE_INK : "#ffffff";
    assert.ok((contrastRatio(hex, chosen) ?? 0) >= (contrastRatio(hex, other) ?? 0), hex);
  }
});

test("readableTextOn falls back to the site ink for invalid input", () => {
  assert.equal(readableTextOn("garbage"), SITE_INK);
});
