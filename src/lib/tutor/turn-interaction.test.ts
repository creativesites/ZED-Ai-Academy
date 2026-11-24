import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { deriveTurnInteraction } from "./turn-interaction.ts";

describe("tutor/turn-interaction", () => {
  it("prioritizes explicit ask_choice events over everything else", () => {
    const res = deriveTurnInteraction({
      choice: { question: "Which message is clearer?", options: ["Message A", "Message B"] },
      confidence: { prompt: "How sure?" },
      board: { type: "show_board", kind: "bullets", title: "Tips", items: ["One", "Two"], shown: 2 },
      caption: { native: "Pick a message." },
      listenHint: null,
      turnCount: 2,
    });
    assert.equal(res.activeChoice?.source, "event");
    assert.deepEqual(res.activeChoice?.options, ["Message A", "Message B"]);
    assert.equal(res.showConfidence, false);
  });

  it("infers clickable options from board items when the teacher asks to pick without emitting ask_choice", () => {
    const res = deriveTurnInteraction({
      choice: null,
      confidence: null,
      board: {
        type: "show_board",
        kind: "bullets",
        title: "Candidate messages",
        items: ["Hey, free tomorrow?", "Hi Sarah, could we meet Tuesday at 2pm to review Q3?"],
        shown: 2,
      },
      caption: { native: "Pick the message that sounds most professional." },
      listenHint: null,
      turnCount: 2,
    });
    assert.equal(res.activeChoice?.source, "inferred");
    assert.equal(res.activeChoice?.options.length, 2);
    assert.equal(res.activeChoice?.question, "Candidate messages");
  });

  it("infers inline labelled options (A/B/C) when the teacher speaks choices without a board", () => {
    const res = deriveTurnInteraction({
      choice: null,
      confidence: null,
      board: null,
      caption: { native: "Choose the best reply: A) Send it now B) Ask for clarification first" },
      listenHint: null,
      turnCount: 1,
    });
    assert.equal(res.activeChoice?.source, "inferred");
    assert.equal(res.activeChoice?.options.length, 2);
  });

  it("sets preferTextInput when the teacher asks the learner to write or type a message", () => {
    const res = deriveTurnInteraction({
      choice: null,
      confidence: null,
      board: null,
      caption: { native: "Now try to write a short follow-up message to your client." },
      listenHint: null,
      turnCount: 3,
    });
    assert.equal(res.activeChoice, null);
    assert.equal(res.preferTextInput, true);
  });

  it("surfaces a primary Next step chip when board steps remain unrevealed", () => {
    const res = deriveTurnInteraction({
      choice: null,
      confidence: null,
      board: { type: "show_board", kind: "steps", items: ["Step 1", "Step 2", "Step 3"], shown: 1 },
      caption: { native: "Let's look at step one." },
      listenHint: null,
      turnCount: 1,
    });
    assert.equal(res.quickActions[0]?.label, "Next step →");
    assert.equal(res.quickActions[0]?.primary, true);
  });
});
