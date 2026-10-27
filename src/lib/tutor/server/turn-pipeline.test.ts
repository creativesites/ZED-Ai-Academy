import { test } from "node:test";
import assert from "node:assert/strict";
import {
  buildContents,
  DEBUG_RAW_OUTPUT_TYPE,
  eventsForHistory,
  MAX_TURNS,
  runTutorTurn,
  type HistoryTurn,
  type TurnGenerateRequest,
  type TurnPipelineDeps,
  type TurnPipelineInput,
} from "./turn-pipeline.ts";
import type { TutorEvent } from "../events.ts";

type Saved = { idx: number; learnerText: string | null; events: TutorEvent[]; latencyMs: number; rawOutput?: string };

function stubDeps(overrides: {
  text?: string | undefined;
  nowMs?: number;
  synthesize?: TurnPipelineDeps["synthesize"];
  generateCalls?: TurnGenerateRequest[];
}) {
  const saved: Saved[] = [];
  const generateCalls = overrides.generateCalls ?? [];
  let clock = overrides.nowMs ?? 1_000_000;
  const deps: TurnPipelineDeps = {
    now: () => {
      clock += 25; // every read advances the clock, so latency is measurable
      return clock;
    },
    generate: async (req) => {
      generateCalls.push(req);
      return { text: overrides.text, totalTokens: 120 };
    },
    synthesize: overrides.synthesize ?? (async (text) => `https://cdn.test/${text.length}.wav`),
    saveTurn: async (turn) => {
      saved.push(turn);
    },
  };
  return { deps, saved, generateCalls };
}

function input(overrides: Partial<TurnPipelineInput> = {}): TurnPipelineInput {
  return {
    sessionStartedAtMs: 1_000_000,
    maxMinutes: 8,
    idx: 1,
    learnerText: "你好",
    openingInstruction: "Open the session.",
    systemInstruction: "SYSTEM",
    voice: "Kore",
    history: [],
    fallbackLanguage: "en",
    ...overrides,
  };
}

test("invalid model JSON uses the fallback turn and stores the raw output for debugging", async () => {
  const { deps, saved } = stubDeps({ text: "{not json" });
  const result = await runTutorTurn(input(), deps);

  assert.equal(result.fallback, true);
  assert.deepEqual(result.events.map((e) => e.type), ["say", "gesture"]);
  assert.equal(result.events[1].type === "gesture" && result.events[1].name, "think");
  assert.ok(result.parseError);
  assert.equal(result.ended, false);
  assert.equal(saved.length, 1);
  assert.equal(saved[0].rawOutput, "{not json");
  assert.deepEqual(saved[0].events, result.events);
});

test("the fallback apology is spoken in the target language with an English translation", async () => {
  const zh = await runTutorTurn(input({ fallbackLanguage: "zh" }), stubDeps({ text: "{not json" }).deps);
  assert.equal(zh.events[0].type === "say" && zh.events[0].text, "不好意思，请再说一遍。");
  assert.equal(zh.events[0].type === "say" && zh.events[0].translation, "Sorry, could you say that again?");

  const es = await runTutorTurn(input({ fallbackLanguage: "es" }), stubDeps({ text: "{not json" }).deps);
  assert.equal(es.events[0].type === "say" && es.events[0].text, "Perdona, ¿puedes repetirlo?");

  const fr = await runTutorTurn(input({ fallbackLanguage: "fr" }), stubDeps({ text: "{not json" }).deps);
  assert.equal(fr.events[0].type === "say" && fr.events[0].text, "Pardon, vous pouvez répéter ?");

  const en = await runTutorTurn(input({ fallbackLanguage: "en" }), stubDeps({ text: "{not json" }).deps);
  assert.equal(en.events[0].type === "say" && en.events[0].text, "Sorry, could you say that again?");
  assert.equal(en.events[0].type === "say" && en.events[0].translation, undefined);
});

test("a model reply with only invalid events also uses the fallback", async () => {
  const text = JSON.stringify({ events: [{ type: "gesture", name: "moonwalk" }] });
  const { deps, saved } = stubDeps({ text });
  const result = await runTutorTurn(input({ fallbackLanguage: "fr" }), deps);
  assert.equal(result.fallback, true);
  assert.equal(result.dropped, 1);
  assert.equal(saved[0].rawOutput, text);
});

test("the fallback speech still gets TTS audio", async () => {
  const { deps } = stubDeps({ text: "{not json" });
  const result = await runTutorTurn(input({ fallbackLanguage: "zh" }), deps);
  assert.ok(result.events[0].type === "say" && result.events[0].audioUrl?.startsWith("https://cdn.test/"));
});

test("valid model events are not replaced by the fallback and store no raw output", async () => {
  const text = JSON.stringify({ events: [{ type: "say", text: "Good." }] });
  const { deps, saved } = stubDeps({ text });
  const result = await runTutorTurn(input(), deps);
  assert.equal(result.fallback, false);
  assert.equal(saved[0].rawOutput, undefined);
});

test("a missing model reply is stored with the fallback turn and no raw output", async () => {
  const { deps, saved } = stubDeps({ text: undefined });
  const result = await runTutorTurn(input(), deps);
  assert.equal(result.parseError, "empty model response");
  assert.equal(result.fallback, true);
  assert.equal(saved.length, 1);
  assert.equal(saved[0].idx, 1);
  assert.equal(saved[0].learnerText, "你好");
  assert.deepEqual(saved[0].events.map((e) => e.type), ["say", "gesture"]);
  assert.equal(saved[0].rawOutput, undefined);
});

test("invalid individual events are dropped and counted, valid ones are kept", async () => {
  const text = JSON.stringify({
    events: [
      { type: "say", text: "Good. Try again." },
      { type: "gesture", name: "moonwalk" },
      { type: "mood", mood: "happy" },
    ],
  });
  const { deps, saved } = stubDeps({ text });
  const result = await runTutorTurn(input(), deps);
  assert.equal(result.dropped, 1);
  assert.deepEqual(
    result.events.map((e) => e.type),
    ["say", "mood"],
  );
  assert.deepEqual(saved[0].events.map((e) => e.type), ["say", "mood"]);
});

test("say events get audioUrl from the TTS dependency and use the persona voice", async () => {
  const voices: string[] = [];
  const text = JSON.stringify({
    events: [
      { type: "say", text: "你好！" },
      { type: "gesture", name: "wave" },
      { type: "say", text: "欢迎。" },
    ],
  });
  const { deps, saved } = stubDeps({
    text,
    synthesize: async (line, voice) => {
      voices.push(voice);
      return `https://cdn.test/tts/${encodeURIComponent(line)}.wav`;
    },
  });
  const result = await runTutorTurn(input(), deps);

  assert.deepEqual(voices, ["Kore", "Kore"]);
  const sayEvents = result.events.filter((e) => e.type === "say");
  assert.equal(sayEvents.length, 2);
  for (const event of sayEvents) {
    assert.ok(event.type === "say" && event.audioUrl?.startsWith("https://cdn.test/tts/"));
  }
  assert.equal(
    (result.events[0] as { audioUrl?: string }).audioUrl,
    `https://cdn.test/tts/${encodeURIComponent("你好！")}.wav`,
  );
  assert.equal(result.events[1].type, "gesture");
  assert.deepEqual(saved[0].events, result.events);
});

test("a TTS failure leaves the line as text and does not fail the turn", async () => {
  const text = JSON.stringify({ events: [{ type: "say", text: "Hola." }] });
  const { deps, saved } = stubDeps({
    text,
    synthesize: async () => {
      throw new Error("tts down");
    },
  });
  const result = await runTutorTurn(input(), deps);
  assert.equal(result.events.length, 1);
  assert.equal(result.events[0].type === "say" && result.events[0].audioUrl, undefined);
  assert.equal(saved.length, 1);
});

test("the time box ends the session with an end_session event and no model call", async () => {
  const generateCalls: TurnGenerateRequest[] = [];
  const { deps, saved } = stubDeps({ text: "{\"events\":[]}", generateCalls, nowMs: 1_000_000 + 8 * 60_000 + 1 });
  const result = await runTutorTurn(input(), deps);

  assert.equal(generateCalls.length, 0);
  assert.equal(result.ended, true);
  assert.equal(result.endReason, "time_box");
  assert.deepEqual(result.events.map((e) => e.type), ["end_session"]);
  assert.equal(saved.length, 1);
  assert.deepEqual(saved[0].events, result.events);
});

test("the time box is inclusive at exactly max minutes", async () => {
  const { deps } = stubDeps({ text: "{\"events\":[]}", nowMs: 1_000_000 + 8 * 60_000 });
  // The clock advances 25ms per read before the check, so the box is already reached.
  const result = await runTutorTurn(input(), deps);
  assert.equal(result.endReason, "time_box");
});

test("the turn limit ends the session without a model call", async () => {
  const generateCalls: TurnGenerateRequest[] = [];
  const { deps } = stubDeps({ text: "{\"events\":[]}", generateCalls });
  const result = await runTutorTurn(input({ idx: MAX_TURNS }), deps);
  assert.equal(generateCalls.length, 0);
  assert.equal(result.endReason, "turn_limit");
  assert.equal(result.ended, true);
});

test("an end_session event from the model ends the session", async () => {
  const text = JSON.stringify({ events: [{ type: "say", text: "Well done." }, { type: "end_session", summary: "Good." }] });
  const { deps } = stubDeps({ text });
  const result = await runTutorTurn(input(), deps);
  assert.equal(result.ended, true);
  assert.equal(result.endReason, "model_end");
});

test("the opening turn sends the opening instruction and no learner text", async () => {
  const generateCalls: TurnGenerateRequest[] = [];
  const { deps, saved } = stubDeps({
    text: JSON.stringify({ events: [{ type: "say", text: "Hello!" }] }),
    generateCalls,
  });
  await runTutorTurn(input({ idx: 0, learnerText: null, history: [] }), deps);

  const last = generateCalls[0].contents[generateCalls[0].contents.length - 1];
  assert.equal(last.role, "user");
  assert.equal(last.parts[0].text, "Open the session.");
  assert.equal(saved[0].learnerText, null);
});

test("latency is measured around the model call", async () => {
  const { deps } = stubDeps({ text: "{\"events\":[]}" });
  const result = await runTutorTurn(input(), deps);
  assert.ok(result.latencyMs > 0);
});

test("buildContents alternates roles, strips audio URLs and ends with the learner's words", () => {
  const history: HistoryTurn[] = [
    { idx: 0, learner_text: null, events: [{ type: "say", text: "Hi", audioUrl: "https://cdn/x.wav" }] },
    { idx: 1, learner_text: "你好", events: [{ type: "say", text: "Good" }] },
  ];
  const contents = buildContents(history, "谢谢", "Open.");
  assert.deepEqual(
    contents.map((c) => c.role),
    ["user", "model", "user", "model", "user"],
  );
  assert.equal(contents[0].parts[0].text, "(session opening)");
  assert.equal(contents[1].parts[0].text, JSON.stringify({ events: [{ type: "say", text: "Hi" }] }));
  assert.equal(contents[2].parts[0].text, "Learner: 你好");
  assert.equal(contents[4].parts[0].text, "Learner: 谢谢");
});

test("buildContents sorts history by idx and merges an empty current message into the opening instruction", () => {
  const contents = buildContents(
    [
      { idx: 1, learner_text: "b", events: [] },
      { idx: 0, learner_text: "a", events: [] },
    ],
    null,
    "Open.",
  );
  assert.equal(contents[0].parts[0].text, "Learner: a");
  assert.equal(contents[contents.length - 1].parts[0].text, "Open.");
});

test("eventsForHistory tolerates non-array stored events", () => {
  assert.deepEqual(eventsForHistory(null), []);
  assert.deepEqual(eventsForHistory({ oops: true }), []);
});

test("eventsForHistory drops the debug raw-output entry so the model never sees it", () => {
  const stored = [
    { type: "say", text: "Sorry.", audioUrl: "https://cdn/x.wav" },
    { type: DEBUG_RAW_OUTPUT_TYPE, raw: "{not json" },
  ];
  assert.deepEqual(eventsForHistory(stored), [{ type: "say", text: "Sorry." }]);
});
