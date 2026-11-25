import { test } from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_DECK_TEACHER, deckTeacherFor } from "./deck-teacher.ts";

test("deckTeacherFor: each card language gets its own teacher by preset key", () => {
  assert.equal(deckTeacherFor("en").presetKey, "tinashe");
  assert.equal(deckTeacherFor("zh").presetKey, "lin");
  assert.equal(deckTeacherFor("es").presetKey, "sofia");
  assert.equal(deckTeacherFor("fr").presetKey, "camille");
  assert.equal(deckTeacherFor("bem").presetKey, "mwila");
  assert.equal(deckTeacherFor("ny").presetKey, "banda");
  assert.equal(deckTeacherFor("tog").presetKey, "chanda");
});

test("deckTeacherFor: Tinashe uses the same voice as the seeded persona (Puck)", () => {
  assert.equal(deckTeacherFor("en").voice, "Puck");
  assert.equal(DEFAULT_DECK_TEACHER.voice, "Puck");
});

test("deckTeacherFor: unknown, empty and prototype keys fall back to the default teacher", () => {
  assert.deepEqual(deckTeacherFor("xx"), DEFAULT_DECK_TEACHER);
  assert.deepEqual(deckTeacherFor(""), DEFAULT_DECK_TEACHER);
  assert.deepEqual(deckTeacherFor(null), DEFAULT_DECK_TEACHER);
  assert.deepEqual(deckTeacherFor(undefined), DEFAULT_DECK_TEACHER);
  assert.deepEqual(deckTeacherFor("constructor"), DEFAULT_DECK_TEACHER);
  assert.deepEqual(deckTeacherFor("__proto__"), DEFAULT_DECK_TEACHER);
});

test("deckTeacherFor: language codes are matched case-insensitively and trimmed", () => {
  assert.equal(deckTeacherFor(" ZH ").presetKey, "lin");
});
