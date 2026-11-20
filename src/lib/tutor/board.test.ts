import { test } from "node:test";
import assert from "node:assert/strict";
import { boardFromEvent, choiceReply, revealBoard } from "./board.ts";

test("a board shows every item unless revealed is set", () => {
  assert.equal(boardFromEvent({ type: "show_board", kind: "bullets", items: ["a", "b", "c"] }).shown, 3);
  assert.equal(boardFromEvent({ type: "show_board", kind: "bullets", items: ["a", "b", "c"], revealed: 1 }).shown, 1);
  assert.equal(boardFromEvent({ type: "show_board", kind: "bullets", items: ["a"], revealed: 5 }).shown, 1);
  assert.equal(boardFromEvent({ type: "show_board", kind: "note", text: "hi" }).shown, 1);
});

test("reveal_step shows the next item, or up to an index, and never goes back or past the end", () => {
  const b = boardFromEvent({ type: "show_board", kind: "steps", items: ["a", "b", "c", "d"], revealed: 0 });
  const one = revealBoard(b);
  assert.equal(one.shown, 1);
  assert.equal(revealBoard(one, 2).shown, 3);
  assert.equal(revealBoard(revealBoard(one, 2), 0).shown, 3, "never hides");
  assert.equal(revealBoard(revealBoard(one, 9)).shown, 4, "capped at the end");
});

test("choice replies use the form the prompt teaches", () => {
  assert.equal(choiceReply("Numbers"), "I choose: Numbers");
});
