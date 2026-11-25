import { test } from "node:test";
import assert from "node:assert/strict";
import { createTurnStreamParser } from "./stream-events.ts";
import { parseTutorTurn, MAX_EVENTS_PER_TURN } from "../events.ts";

/** Feeds `text` in chunks of `size` (or at the given cut points) and returns per-chunk emissions. */
function feed(text: string, cuts: number | number[]) {
  const parser = createTurnStreamParser();
  const points = typeof cuts === "number" ? range(cuts, text.length, cuts) : cuts;
  const emitted: unknown[][] = [];
  let last = 0;
  for (const p of [...points, text.length]) {
    if (p <= last) continue;
    emitted.push(parser.push(text.slice(last, p)));
    last = p;
  }
  return { parser, emitted, all: emitted.flat() };
}

function range(start: number, end: number, step: number): number[] {
  const out: number[] = [];
  for (let i = start; i < end; i += step) out.push(i);
  return out;
}

const TURN = JSON.stringify({
  events: [
    { type: "say", text: 'He said "hello" \\ then left. Café ☕ 你好' },
    { type: "show_board", kind: "steps", title: "Steps", items: ["One {brace}", "Two [bracket]"] },
    { type: "ask_choice", question: "Pick one", options: ["A", "B"] },
    { type: "show_lesson_ref", label: "Video", seconds: 95 },
  ],
});

test("every chunk size yields the same events as the non-stream parse", () => {
  const expected = parseTutorTurn(TURN);
  assert.ok(expected.ok);
  for (const size of [1, 2, 3, 7, 16, 64, TURN.length]) {
    const { parser, all } = feed(TURN, size);
    const result = parser.result();
    assert.equal(result.complete, true, `size ${size}`);
    assert.deepEqual(all, expected.events, `size ${size}`);
    assert.deepEqual(result.events, expected.events);
    assert.equal(result.dropped, 0);
  }
});

test("an event is emitted as soon as its object closes, before the turn ends", () => {
  const firstEnd = TURN.indexOf("},") + 1; // end of the first say object
  const { emitted } = feed(TURN, [firstEnd, firstEnd + 5]);
  assert.equal(emitted[0].length, 1);
  assert.equal((emitted[0][0] as { type: string }).type, "say");
});

test("split mid-string and mid-escape keeps the string intact", () => {
  const text = '{"events":[{"type":"say","text":"a \\"quoted\\" word and \\u00e9 and \\\\"}]}';
  const escapeAt = text.indexOf("\\\"");
  const unicodeAt = text.indexOf("\\u00e9") + 3;
  const { parser, all } = feed(text, [escapeAt + 1, unicodeAt, text.length - 3]);
  assert.equal(parser.result().complete, true);
  assert.deepEqual(all, [{ type: "say", text: 'a "quoted" word and é and \\' }]);
});

test("braces and brackets inside strings do not confuse nesting", () => {
  const text = '{"events":[{"type":"say","text":"} ] { [ , :"},{"type":"gesture","name":"nod"}]}';
  const { parser, all } = feed(text, 1);
  assert.equal(parser.result().complete, true);
  assert.equal(all.length, 2);
});

test("nested objects and arrays inside an event", () => {
  const text = JSON.stringify({
    events: [{ type: "show_board", kind: "table", rows: [["h1", "h2"], ["a", "b"]] }],
  });
  const { parser, all } = feed(text, 5);
  assert.equal(parser.result().complete, true);
  assert.equal(all.length, 1);
});

test("invalid events and non-object elements are dropped and counted like parseTutorTurn", () => {
  const text = '{"events":[{"type":"say","text":""},"stray",42,{"type":"nope"},{"type":"say","text":"ok"},[1]]}';
  const expected = parseTutorTurn(text);
  assert.ok(expected.ok);
  const { parser, all } = feed(text, 4);
  const result = parser.result();
  assert.equal(result.complete, true);
  assert.deepEqual(all, expected.events);
  assert.equal(result.dropped, expected.dropped);
});

test("caps events at MAX_EVENTS_PER_TURN", () => {
  const many = Array.from({ length: MAX_EVENTS_PER_TURN + 3 }, (_, i) => ({ type: "say", text: `line ${i}` }));
  const text = JSON.stringify({ events: many });
  const { parser, all } = feed(text, 11);
  assert.equal(all.length, MAX_EVENTS_PER_TURN);
  assert.equal(parser.result().dropped, 3);
});

test("other root keys before or after events are ignored, including an events-like string", () => {
  const text = '{"learnerText":"my \\"events\\": [ ]","events":[{"type":"say","text":"hi"}],"extra":{"events":[1]}}';
  const { parser, all } = feed(text, 3);
  assert.equal(parser.result().complete, true);
  assert.deepEqual(all, [{ type: "say", text: "hi" }]);
});

test("a fence or prose before the root object is skipped", () => {
  const text = '```json\n{"events":[{"type":"say","text":"hi"}]}\n```';
  const { parser, all } = feed(text, 6);
  assert.equal(parser.result().complete, true);
  assert.equal(all.length, 1);
});

test("malformed tail: events before it are kept, the parse is incomplete", () => {
  const text = '{"events":[{"type":"say","text":"first"},{"type":"say","text":"cut off';
  const { parser, all } = feed(text, 9);
  const result = parser.result();
  assert.equal(result.complete, false);
  assert.deepEqual(all, [{ type: "say", text: "first" }]);
  // The non-stream parse of the same text fails, so the caller keeps the streamed events.
  assert.equal(parseTutorTurn(text).ok, false);
});

test("unbalanced closer stops scanning and reports an error", () => {
  const text = '{"events":[{"type":"say","text":"a"}}],{"type":"say","text":"b"}]}';
  const { parser, all } = feed(text, 5);
  const result = parser.result();
  assert.equal(result.complete, false);
  assert.ok(result.error);
  assert.equal(all.length, 1);
});

test("a root without an events array is not complete", () => {
  for (const text of ['{"events":null}', '{"other":[{"type":"say","text":"x"}]}', "[]", "not json"]) {
    const { parser, all } = feed(text, 2);
    assert.equal(parser.result().complete, false, text);
    assert.equal(all.length, 0, text);
  }
});

test("empty and non-string chunks are ignored", () => {
  const parser = createTurnStreamParser();
  assert.deepEqual(parser.push(""), []);
  assert.deepEqual(parser.push(undefined as unknown as string), []);
  parser.push('{"events":[]}');
  assert.equal(parser.result().complete, true);
  assert.equal(parser.result().events.length, 0);
});
