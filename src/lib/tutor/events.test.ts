import { test } from "node:test";
import assert from "node:assert/strict";
import { GESTURES } from "./contract.generated.ts";
import { liveToolDeclarations, parseTutorTurn, tutorEventSchema, MAX_EVENTS_PER_TURN } from "./events.ts";

const ALL_EVENT_TYPES = [
  "say",
  "gesture",
  "mood",
  "show_card",
  "show_text",
  "trace_tone",
  "listen",
  "note_mistake",
  "advance_scene",
  "end_session",
];

test("parseTutorTurn accepts a valid turn with every event kind", () => {
  const turn = {
    events: [
      { type: "say", text: "你好", romanization: "nǐ hǎo", translation: "hello" },
      { type: "gesture", name: "wave" },
      { type: "gesture", name: "trace_tone", toneShape: "t3" },
      { type: "gesture", name: "count", countTo: 3 },
      { type: "mood", mood: "happy", intensity: 80 },
      { type: "show_card", item: { text: "茶", pron: "chá", meaning: "tea", vocabId: "v1" } },
      { type: "show_text", text: "谢谢", highlight: ["谢"] },
      { type: "trace_tone", tones: ["t2", "t4"], labels: ["xié", "xiè"] },
      { type: "listen", expect: "你好", hint: "say hello" },
      { type: "note_mistake", said: "ma", correct: "mǎ", category: "tone" },
      { type: "advance_scene", beat: "order" },
      { type: "end_session", summary: "Well done" },
    ],
  };
  const result = parseTutorTurn(turn);
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.events.length, 12);
  assert.equal(result.dropped, 0);
});

test("parseTutorTurn drops an invalid event and keeps the rest", () => {
  const result = parseTutorTurn({
    events: [
      { type: "gesture", name: "wave" },
      { type: "gesture", name: "backflip" },
      { type: "mood", mood: "happy" },
    ],
  });
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.deepEqual(
    result.events.map((e) => e.type),
    ["gesture", "mood"],
  );
  assert.equal(result.dropped, 1);
});

test("parseTutorTurn drops events beyond the per-turn cap", () => {
  const events = Array.from({ length: MAX_EVENTS_PER_TURN + 3 }, () => ({ type: "listen" }));
  const result = parseTutorTurn({ events });
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.events.length, MAX_EVENTS_PER_TURN);
  assert.equal(result.dropped, 3);
});

test("parseTutorTurn parses a JSON string turn", () => {
  const result = parseTutorTurn('{"events":[{"type":"end_session"}]}');
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.events[0].type, "end_session");
});

test("parseTutorTurn rejects garbage input without throwing", () => {
  const inputs: [string, unknown][] = [
    ["undefined", undefined],
    ["null", null],
    ["number", 42],
    ["non-JSON string", "not json {"],
    ["array", []],
    ["empty object", {}],
    ["events as string", { events: "nope" }],
    ["events as null", { events: null }],
    ["null-prototype object", Object.create(null)],
  ];
  for (const [label, input] of inputs) {
    const result = parseTutorTurn(input);
    assert.equal(result.ok, false, `expected rejection for ${label}`);
  }
});

test("parseTutorTurn treats a hostile getter as an error rather than throwing", () => {
  const hostile = {
    get events(): never {
      throw new Error("boom");
    },
  };
  const result = parseTutorTurn(hostile);
  assert.equal(result.ok, false);
});

test("tutorEventSchema rejects out-of-range values", () => {
  assert.equal(tutorEventSchema.safeParse({ type: "gesture", name: "wave", countTo: 9 }).success, false);
  assert.equal(tutorEventSchema.safeParse({ type: "mood", mood: "happy", intensity: 101 }).success, false);
  assert.equal(tutorEventSchema.safeParse({ type: "trace_tone", tones: [] }).success, false);
  assert.equal(tutorEventSchema.safeParse({ type: "trace_tone", tones: ["t1", "t1", "t1", "t1", "t1"] }).success, false);
});

test("every liveToolDeclaration name is a valid event type, and say is excluded", () => {
  const names: string[] = liveToolDeclarations().map((d) => d.name);
  assert.equal(names.includes("say"), false);
  for (const name of names) {
    assert.ok(ALL_EVENT_TYPES.includes(name), `unknown event type ${name}`);
  }
  // Every non-say event type has a declaration.
  for (const type of ALL_EVENT_TYPES.filter((t) => t !== "say")) {
    assert.ok(names.includes(type), `missing declaration for ${type}`);
  }
  assert.equal(new Set(names).size, names.length);
});

test("liveToolDeclarations use the generated gesture enum and object parameters", () => {
  const gesture = liveToolDeclarations().find((d) => d.name === "gesture");
  assert.ok(gesture);
  assert.equal(gesture.parameters.type, "object");
  assert.deepEqual(gesture.parameters.properties.name.enum, [...GESTURES]);
  assert.deepEqual(gesture.parameters.required, ["name"]);
});
