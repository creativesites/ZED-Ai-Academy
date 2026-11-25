import { test } from "node:test";
import assert from "node:assert/strict";
import {
  applyPronunciationGlossary,
  formatPronunciationGlossary,
  parsePronunciationGlossary,
} from "./pronunciation.ts";

test("parsePronunciationGlossary parses text lines and arrays cleanly", () => {
  const entries = parsePronunciationGlossary("ZRA = Z R A\nKwacha -> Kwah-chah\n# comment\nMaureen: Maw-reen");
  assert.deepEqual(entries, [
    { term: "ZRA", spoken: "Z R A" },
    { term: "Kwacha", spoken: "Kwah-chah" },
    { term: "Maureen", spoken: "Maw-reen" },
  ]);
  assert.equal(formatPronunciationGlossary(entries), "ZRA = Z R A\nKwacha = Kwah-chah\nMaureen = Maw-reen");
});

test("applyPronunciationGlossary replaces whole words case-insensitively without mangling substrings", () => {
  const glossary = [
    { term: "ZRA", spoken: "Z R A" },
    { term: "Kwacha", spoken: "Kwah-chah" },
    { term: "NAPSA", spoken: "Nap-sah" },
  ];
  const input = "File your ZRA and napsa returns in kwacha today (not ZRAX).";
  assert.equal(
    applyPronunciationGlossary(input, glossary),
    "File your Z R A and Nap-sah returns in Kwah-chah today (not ZRAX).",
  );
});
