import { test } from "node:test";
import assert from "node:assert/strict";
import { pinyinToneOf, toneSegments } from "./romanization.ts";

test("each pinyin tone mark maps to its tone number", () => {
  assert.equal(pinyinToneOf("mā"), 1);
  assert.equal(pinyinToneOf("má"), 2);
  assert.equal(pinyinToneOf("mǎ"), 3);
  assert.equal(pinyinToneOf("mà"), 4);
});

test("a syllable without a mark is neutral (tone 0)", () => {
  assert.equal(pinyinToneOf("ma"), 0);
  assert.equal(pinyinToneOf("le"), 0);
});

test("decomposed marks give the same tone as precomposed ones", () => {
  assert.equal(pinyinToneOf("lǎo".normalize("NFD")), 3);
});

function syllables(roman: string): Array<[string, number]> {
  return toneSegments(roman)
    .filter((s) => s.text.trim().length > 0 && /\p{L}/u.test(s.text))
    .map((s) => [s.text, s.tone]);
}

test("a multi-syllable word gets one tone per syllable", () => {
  assert.deepEqual(syllables("Lǎoshī"), [
    ["Lǎo", 3],
    ["shī", 1],
  ]);
  assert.deepEqual(syllables("Zhōngguó"), [
    ["Zhōng", 1],
    ["guó", 2],
  ]);
  assert.deepEqual(syllables("Shànghǎi"), [
    ["Shàng", 4],
    ["hǎi", 3],
  ]);
  assert.deepEqual(syllables("Běijīng"), [
    ["Běi", 3],
    ["jīng", 1],
  ]);
});

test("toneSegments keeps the text intact and separators are neutral", () => {
  const line = "Nǐ hǎo!  Lǎoshī, hěn gāoxìng.";
  const segments = toneSegments(line);
  assert.equal(segments.map((s) => s.text).join(""), line);
  for (const s of segments) {
    if (!/\p{L}/u.test(s.text)) assert.equal(s.tone, 0);
  }
});

test("decomposed input keeps its text and tones", () => {
  const line = "hǎo lǎoshī";
  const segments = toneSegments(line.normalize("NFD"));
  assert.equal(segments.map((s) => s.text).join(""), line.normalize("NFD"));
  assert.deepEqual(
    segments.filter((s) => s.tone > 0).map((s) => s.tone),
    [3, 3, 1],
  );
});

test("empty input gives no segments", () => {
  assert.deepEqual(toneSegments(""), []);
  assert.deepEqual(toneSegments("  "), [{ text: "  ", tone: 0 }]);
});
