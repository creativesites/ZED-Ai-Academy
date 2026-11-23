import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { extractDockBoardFromText, formatSeekTime } from "./lesson-seek.ts";

describe("tutor/lesson-seek", () => {
  it("formats seek timestamps as M:SS", () => {
    assert.equal(formatSeekTime(0), "0:00");
    assert.equal(formatSeekTime(65), "1:05");
    assert.equal(formatSeekTime(185.9), "3:05");
  });

  it("extracts board and lesson_ref directives from streamed dock text", () => {
    const sample = [
      "Look at how this step works:",
      ':::board {"title":"Key Check","kind":"steps","items":["Find a common unit","Compare numerators"]}:::',
      "You can also rewatch the walkthrough here:",
      ':::lesson_ref {"label":"Fraction walkthrough","blockId":"block-vid-1","seconds":95}:::',
    ].join("\n\n");

    const extracted = extractDockBoardFromText(sample);
    assert.ok(extracted.board);
    assert.equal(extracted.board.kind, "steps");
    assert.equal(extracted.board.items?.length, 2);
    assert.equal(extracted.board.shown, 2);
    assert.equal(extracted.lessonRefs.length, 1);
    assert.equal(extracted.lessonRefs[0].blockId, "block-vid-1");
    assert.equal(extracted.lessonRefs[0].seconds, 95);
  });
});
