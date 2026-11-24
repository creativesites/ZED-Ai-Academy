import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { compareResponseToTarget } from "./response-match.ts";

describe("tutor/response-match", () => {
  it("scores exact matches at 100 and suggests easy", () => {
    const res = compareResponseToTarget(
      "Compound interest grows on principal and interest",
      "Compound interest grows on principal and interest.",
    );
    assert.equal(res.score, 100);
    assert.equal(res.suggestedQuality, "easy");
    assert.ok(res.tokens.every((t) => t.matched));
  });

  it("ignores accents/case and marks missed words accurately", () => {
    const res = compareResponseToTarget("hola como", "Hola, ¿cómo estás?");
    assert.equal(res.score, 67);
    assert.equal(res.suggestedQuality, "hard");
    assert.deepEqual(
      res.tokens.map((t) => t.matched),
      [true, true, false],
    );
  });

  it("handles CJK characters without spaces", () => {
    const res = compareResponseToTarget("你好", "你好吗");
    assert.equal(res.score, 67);
    assert.equal(res.tokens.length, 3);
    assert.equal(res.tokens[2]?.matched, false);
  });

  it("returns 0 and suggests again for empty input", () => {
    const res = compareResponseToTarget("", "Return on investment");
    assert.equal(res.score, 0);
    assert.equal(res.suggestedQuality, "again");
  });
});
