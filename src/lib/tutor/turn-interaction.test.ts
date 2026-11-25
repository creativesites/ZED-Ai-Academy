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

  it("activates tap-to-order challenge when the teacher asks to arrange board steps", () => {
    const res = deriveTurnInteraction({
      choice: null,
      confidence: null,
      board: {
        type: "show_board",
        kind: "steps",
        title: "Customer discovery flow",
        items: ["Propose solution", "Ask open questions", "Summarize pain points"],
        shown: 3,
      },
      caption: { native: "Put these steps in the right order." },
      listenHint: null,
      turnCount: 2,
    });
    assert.equal(res.activeChoice, null);
    assert.equal(res.activeOrderChallenge?.items.length, 3);
    assert.equal(res.activeOrderChallenge?.prompt, "Customer discovery flow");
  });

  it("activates fill-in-the-blank challenge when a blank marker is shown", () => {
    const res = deriveTurnInteraction({
      choice: null,
      confidence: null,
      board: {
        type: "show_board",
        kind: "bullets",
        items: ["revenue", "margin", "churn"],
        shown: 3,
      },
      whiteboard: "Gross profit divided by total sales gives you gross ___.",
      caption: { native: "Fill in the blank using one of the metrics." },
      listenHint: null,
      turnCount: 3,
    });
    assert.ok(res.activeFillBlank);
    assert.equal(res.activeFillBlank?.wordBank.length, 3);
    assert.equal(res.preferTextInput, true);
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

describe("tutor/turn-interaction v3 (P2-04)", () => {
  const board = { type: "show_board" as const, kind: "bullets" as const, title: "Steps", items: ["One", "Two"], shown: 2 };
  const base = { choice: null, confidence: null, board, caption: { native: "Pick one and put these in order." }, listenHint: null, turnCount: 3 };

  it("v3 sessions never infer controls from speech or the board", () => {
    const res = deriveTurnInteraction({ ...base, inferFromContext: false });
    assert.equal(res.activeChoice, null);
    assert.equal(res.activeOrderChallenge, null);
    assert.equal(res.activeFillBlank, null);
    // Old turns and clients still infer.
    assert.equal(deriveTurnInteraction(base).activeChoice?.source, "inferred");
  });

  it("answerable events drive the controls and carry the server checkId", () => {
    const order = deriveTurnInteraction({
      ...base,
      inferFromContext: false,
      check: { type: "ask_order", prompt: "Order", items: ["b", "a", "c"], checkId: "t3-1" },
    });
    assert.deepEqual(order.activeOrderChallenge, { prompt: "Order", items: ["b", "a", "c"], checkId: "t3-1" });
    const fill = deriveTurnInteraction({
      ...base,
      check: { type: "ask_fill", prompt: "Plants use ___.", options: ["light", "sound"], checkId: "t3-2" },
    });
    assert.equal(fill.activeFillBlank?.checkId, "t3-2");
    assert.deepEqual(fill.activeFillBlank?.wordBank, ["light", "sound"]);
    assert.equal(fill.preferTextInput, true);
    const num = deriveTurnInteraction({ ...base, check: { type: "ask_numeric", prompt: "g?", unit: "m/s²", checkId: "t3-3" } });
    assert.deepEqual(num.activeNumeric, { prompt: "g?", unit: "m/s²", checkId: "t3-3" });
    assert.equal(num.activeChoice, null);
    const choice = deriveTurnInteraction({ ...base, check: { type: "ask_choice", question: "q", options: ["x", "y"], checkId: "t3-0" } });
    assert.equal(choice.activeChoice?.checkId, "t3-0");
  });

  it("Live ask_order (no checkId, items in key order) is never shown in the key's order", () => {
    for (const items of [["a", "b"], ["a", "b", "c"], ["a", "b", "c", "d"]]) {
      const res = deriveTurnInteraction({ ...base, check: { type: "ask_order", prompt: "Order", items } });
      assert.notDeepEqual(res.activeOrderChallenge?.items, items);
      assert.deepEqual([...(res.activeOrderChallenge?.items ?? [])].sort(), [...items].sort());
    }
  });
});
