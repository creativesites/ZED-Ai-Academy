import { test } from "node:test";
import assert from "node:assert/strict";
import { GESTURES } from "./contract.generated.ts";
import {
  CORE_EVENT_TYPES,
  eventTypesForPack,
  liveToolDeclarations,
  parseTutorTurn,
  tutorEventSchema,
  MAX_EVENTS_PER_TURN,
} from "./events.ts";

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
  "show_board",
  "reveal_step",
  "ask_choice",
  "ask_confidence",
  "show_lesson_ref",
  "play_clip",
  "note_evidence",
  "advance_step",
  "switch_scene",
  "award",
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

test("v2 teaching events parse", () => {
  const result = parseTutorTurn({
    events: [
      { type: "show_board", kind: "bullets", title: "Three checks", items: ["Facts", "Numbers", "Tone"], revealed: 1 },
      { type: "reveal_step" },
      { type: "reveal_step", index: 2 },
      { type: "show_board", kind: "equation", text: "Profit = Sales - Costs" },
      { type: "show_board", kind: "table", rows: [["Check", "Catches"], ["Numbers", "Wrong price"]] },
      { type: "ask_choice", question: "Which check?", options: ["Facts", "Numbers", "Tone"] },
      { type: "ask_confidence" },
      { type: "show_lesson_ref", label: "The three checks", seconds: 134 },
      { type: "play_clip", videoId: "dQw4w9WgXcQ", start: 10, end: 40 },
      { type: "note_evidence", objective: "Apply the three checks", result: "misconception", detail: "chose tone" },
      { type: "advance_step", step: "practice" },
      { type: "switch_scene", scene: "Scene_Clinic" },
    ],
  });
  assert.ok(result.ok);
  assert.equal(result.dropped, 0);
  assert.equal(result.events.length, 12);
});

test("invalid v2 events are dropped, not fatal", () => {
  const result = parseTutorTurn({
    events: [
      { type: "show_board", kind: "bullets" }, // no content
      { type: "show_board", kind: "poster", items: ["x"] }, // unknown kind
      { type: "ask_choice", question: "Pick", options: ["only one"] },
      { type: "play_clip", videoId: "not-a-youtube-id!" },
      { type: "note_evidence", objective: "x", result: "great" },
      { type: "award", title: "Objective mastered" },
    ],
  });
  assert.ok(result.ok);
  assert.equal(result.events.length, 1);
  assert.equal(result.dropped, 5);
});

test("v1 events still parse after v2 (stored sessions replay)", () => {
  const result = parseTutorTurn({
    events: [
      { type: "note_mistake", said: "a", correct: "b", category: "grammar" },
      { type: "advance_scene", beat: "order" },
    ],
  });
  assert.ok(result.ok);
  assert.equal(result.events.length, 2);
});

test("language-only events are taught to language packs only", () => {
  const general = eventTypesForPack("general-tutor");
  assert.equal(general.includes("show_card"), false);
  assert.equal(general.includes("trace_tone"), false);
  assert.equal(general.includes("note_mistake"), false);
  assert.ok(general.includes("show_board"));
  assert.deepEqual(general, [...CORE_EVENT_TYPES]);

  const zh = eventTypesForPack("language-zh");
  for (const t of ["show_card", "trace_tone", "note_mistake", "show_board"]) assert.ok(zh.includes(t as never), t);

  const liveGeneral = liveToolDeclarations("general-tutor").map((d) => d.name as string);
  assert.equal(liveGeneral.includes("trace_tone"), false);
  assert.equal(liveGeneral.includes("advance_scene"), false);
  assert.ok(liveGeneral.includes("ask_choice"));
});
