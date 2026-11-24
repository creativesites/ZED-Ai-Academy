import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildOpeningWithWarmup, pickWarmupSuggestion } from "./warmup.ts";

describe("tutor/warmup", () => {
  it("returns null and leaves base instruction untouched when learner has no memory", () => {
    const empty = { recentMistakes: [], memoryNotes: [] };
    assert.equal(pickWarmupSuggestion(empty), null);
    assert.equal(buildOpeningWithWarmup("Open the session.", empty), "Open the session.");
  });

  it("picks the most recent mistake first and enriches the opening instruction", () => {
    const src = {
      recentMistakes: [{ said: "profit is revenue", correct: "profit is revenue minus costs", category: "concept" }],
      memoryNotes: ["Prefers concrete examples"],
    };
    const sug = pickWarmupSuggestion(src);
    assert.ok(sug);
    assert.match(sug.label, /concept/);
    assert.match(sug.detail, /profit is revenue minus costs/);

    const opening = buildOpeningWithWarmup("Greet the learner.", src);
    assert.match(opening, /Greet the learner\./);
    assert.match(opening, /warm-up callback/);
    assert.match(opening, /profit is revenue minus costs/);
  });

  it("falls back to memory notes when there are no recent mistakes", () => {
    const src = {
      recentMistakes: [],
      memoryNotes: ["Strong at explaining trade-offs clearly"],
    };
    const sug = pickWarmupSuggestion(src);
    assert.ok(sug);
    assert.equal(sug.label, "From your last session");
    assert.equal(sug.detail, "Strong at explaining trade-offs clearly");
  });
});
