import { test } from "node:test";
import assert from "node:assert/strict";
import type { TutorEvent } from "../events.ts";
import {
  MAX_TURNS,
  runTutorTurn,
  type TurnGenerateRequest,
  type TurnPipelineInput,
} from "../server/turn-pipeline.ts";
import { runTutorTurnStream, type TurnStreamChunk, type TurnStreamDeps } from "./turn-stream.ts";
import { formatSse, TURN_STREAM_EVENTS } from "./sse.ts";

type Saved = { idx: number; learnerText: string | null; events: TutorEvent[]; latencyMs: number; rawOutput?: string };

const VALID = JSON.stringify({
  events: [
    { type: "say", text: "Hello there." },
    { type: "show_board", kind: "bullets", items: ["One", "Two"] },
    { type: "say", text: "Ready?" },
  ],
});

function chunks(text: string, size: number): string[] {
  const out: string[] = [];
  for (let i = 0; i < text.length; i += size) out.push(text.slice(i, i + size));
  return out;
}

function harness(opts: {
  streamChunks?: string[];
  openError?: Error;
  breakAfter?: number;
  nonStreamText?: string;
  log?: string[];
}) {
  const saved: Saved[] = [];
  const generateCalls: TurnGenerateRequest[] = [];
  const log = opts.log ?? [];
  let clock = 1_000_000;
  const deps: TurnStreamDeps = {
    now: () => (clock += 10),
    generate: async (req) => {
      generateCalls.push(req);
      return { text: opts.nonStreamText };
    },
    generateStream: async () => {
      if (opts.openError) throw opts.openError;
      const list = opts.streamChunks ?? [];
      return (async function* (): AsyncGenerator<TurnStreamChunk> {
        for (const [i, text] of list.entries()) {
          if (opts.breakAfter !== undefined && i === opts.breakAfter) throw new Error("connection reset");
          log.push(`chunk:${i}`);
          yield { text };
        }
      })();
    },
    synthesize: async () => null,
    saveTurn: async (turn) => {
      saved.push(turn);
    },
  };
  return { deps, saved, generateCalls, log };
}

function input(overrides: Partial<TurnPipelineInput> = {}): TurnPipelineInput {
  return {
    sessionStartedAtMs: 1_000_000,
    maxMinutes: 60,
    idx: 1,
    learnerText: "What is a prompt?",
    openingInstruction: "",
    fallbackLanguage: "en",
    systemInstruction: "sys",
    voice: "Kore",
    history: [],
    ...overrides,
  };
}

test("first event reaches onEvent before the stream finishes", async () => {
  const log: string[] = [];
  const list = chunks(VALID, 8);
  const { deps, saved } = harness({ streamChunks: list, log });
  const result = await runTutorTurnStream(input(), deps, (e) => log.push(`event:${e.type}`));
  const firstEvent = log.indexOf("event:say");
  const lastChunk = log.indexOf(`chunk:${list.length - 1}`);
  assert.ok(firstEvent >= 0 && firstEvent < lastChunk, log.join(","));
  assert.equal(result.source, "stream");
  assert.equal(result.streamedCount, 3);
  assert.equal(result.events.length, 3);
  assert.equal(saved.length, 1);
  assert.deepEqual(saved[0].events, result.events);
  assert.equal(saved[0].learnerText, "What is a prompt?");
});

test("stream and non-stream produce the same result and saved turn for the same model text", async () => {
  const stream = harness({ streamChunks: chunks(VALID, 5) });
  const streamed = await runTutorTurnStream(input(), stream.deps, () => undefined);
  const plain = harness({ nonStreamText: VALID });
  const nonStreamed = await runTutorTurn(input(), plain.deps);
  assert.deepEqual(streamed.events, nonStreamed.events);
  assert.equal(streamed.ended, nonStreamed.ended);
  assert.equal(streamed.fallback, nonStreamed.fallback);
  const withoutLatency = (s: Saved) => ({ idx: s.idx, learnerText: s.learnerText, events: s.events, rawOutput: s.rawOutput });
  assert.deepEqual(stream.saved.map(withoutLatency), plain.saved.map(withoutLatency));
});

test("stream that cannot be opened falls back to the non-stream call (D-04)", async () => {
  const { deps, generateCalls, saved } = harness({ openError: new Error("stream unsupported"), nonStreamText: VALID });
  const seen: TutorEvent[] = [];
  const result = await runTutorTurnStream(input(), deps, (e) => seen.push(e));
  assert.equal(generateCalls.length, 1);
  assert.equal(result.source, "non_stream");
  assert.equal(result.streamError, "stream unsupported");
  assert.equal(seen.length, 0, "events come in the final payload, not as stream events");
  assert.equal(result.events.length, 3);
  assert.equal(saved.length, 1);
});

test("open failure that also fails non-stream rethrows (route answers 502)", async () => {
  const { deps } = harness({ openError: new Error("quota") });
  deps.generate = async () => {
    throw new Error("quota");
  };
  await assert.rejects(runTutorTurnStream(input(), deps, () => undefined), /quota/);
});

test("mid-stream break after events keeps the streamed events", async () => {
  const text = VALID;
  const cut = text.indexOf("},") + 2; // after the first event
  const { deps, generateCalls, saved } = harness({ streamChunks: [text.slice(0, cut), text.slice(cut)], breakAfter: 1 });
  const result = await runTutorTurnStream(input(), deps, () => undefined);
  assert.equal(generateCalls.length, 0);
  assert.equal(result.source, "stream_partial");
  assert.deepEqual(result.events, [{ type: "say", text: "Hello there." }]);
  assert.equal(result.fallback, false);
  assert.equal(saved[0].events.length, 1);
});

test("mid-stream break before any event uses the non-stream call", async () => {
  const { deps, generateCalls } = harness({ streamChunks: ['{"events":[{"type":', "x"], breakAfter: 1, nonStreamText: VALID });
  const result = await runTutorTurnStream(input(), deps, () => undefined);
  assert.equal(generateCalls.length, 1);
  assert.equal(result.source, "non_stream");
  assert.equal(result.events.length, 3);
});

test("malformed tail falls back to the full-text parse, then to streamed events", async () => {
  // Full text is not valid JSON; streamed first event is kept.
  const malformed = '{"events":[{"type":"say","text":"Kept."},{"type":"say","text":"lost';
  const { deps, saved } = harness({ streamChunks: chunks(malformed, 7) });
  const result = await runTutorTurnStream(input(), deps, () => undefined);
  assert.equal(result.source, "stream_partial");
  assert.equal(result.parseError, "turn is not valid JSON");
  assert.deepEqual(result.events, [{ type: "say", text: "Kept." }]);
  assert.equal(saved[0].rawOutput, undefined);
});

test("a stream that breaks after the full JSON arrived is re-parsed from the full text", async () => {
  const { deps, generateCalls } = harness({ streamChunks: [VALID, "tail"], breakAfter: 1 });
  const result = await runTutorTurnStream(input(), deps, () => undefined);
  assert.equal(generateCalls.length, 0);
  assert.equal(result.source, "stream_reparsed");
  assert.equal(result.streamError, "connection reset");
  assert.equal(result.events.length, 3);
});

test("duplicate events key: the scanner follows the first array (zero events → fallback apology)", async () => {
  const text = '{"events":[],"events":[{"type":"say","text":"second"}]}';
  const { deps } = harness({ streamChunks: chunks(text, 4) });
  const result = await runTutorTurnStream(input(), deps, () => undefined);
  assert.equal(result.fallback, true);
});

test("no usable output at all gives the fallback apology and keeps the raw text", async () => {
  const { deps, saved } = harness({ streamChunks: ["Sorry, I can't"] });
  const result = await runTutorTurnStream(input(), deps, () => undefined);
  assert.equal(result.fallback, true);
  assert.equal(result.events[0].type, "say");
  assert.equal(saved[0].rawOutput, "Sorry, I can't");
});

test("turn limit ends the session without a model call and emits end_session, matching runTutorTurn", async () => {
  const { deps, generateCalls, saved } = harness({ streamChunks: [VALID] });
  const seen: TutorEvent[] = [];
  const result = await runTutorTurnStream(input({ idx: MAX_TURNS }), deps, (e) => seen.push(e));
  assert.equal(generateCalls.length, 0);
  assert.equal(result.ended, true);
  assert.equal(result.endReason, "turn_limit");
  assert.equal(seen[0].type, "end_session");
  const plain = harness({});
  const nonStreamed = await runTutorTurn(input({ idx: MAX_TURNS }), plain.deps);
  assert.deepEqual(result.events, nonStreamed.events);
  assert.deepEqual(saved[0].events, plain.saved[0].events);

  const timeBox = await runTutorTurnStream(input({ sessionStartedAtMs: 0, maxMinutes: 1 }), harness({}).deps, () => undefined);
  const plainTimeBox = await runTutorTurn(input({ sessionStartedAtMs: 0, maxMinutes: 1 }), harness({}).deps);
  assert.deepEqual(timeBox.events, plainTimeBox.events);
});

test("model end_session marks the turn ended", async () => {
  const text = JSON.stringify({ events: [{ type: "say", text: "Bye." }, { type: "end_session", summary: "Done" }] });
  const { deps } = harness({ streamChunks: chunks(text, 9) });
  const result = await runTutorTurnStream(input(), deps, () => undefined);
  assert.equal(result.ended, true);
  assert.equal(result.endReason, "model_end");
});

test("a throwing onEvent consumer does not lose the turn", async () => {
  const { deps, saved } = harness({ streamChunks: chunks(VALID, 10) });
  const result = await runTutorTurnStream(input(), deps, () => {
    throw new Error("controller closed");
  });
  assert.equal(result.events.length, 3);
  assert.equal(saved.length, 1);
});

test("audio turn: transcript comes from the full JSON text", async () => {
  const text = JSON.stringify({ learnerText: "  hello teacher ", events: [{ type: "say", text: "Hi!" }] });
  const { deps, saved } = harness({ streamChunks: chunks(text, 6) });
  const result = await runTutorTurnStream(
    input({ learnerText: null, learnerAudio: { bytes: Buffer.from([1]), mimeType: "audio/webm" } }),
    deps,
    () => undefined,
  );
  assert.equal(result.learnerText, "hello teacher");
  assert.equal(saved[0].learnerText, "hello teacher");
});

test("say lines get synthesized audio urls after streaming", async () => {
  const { deps } = harness({ streamChunks: [VALID] });
  deps.synthesize = async (text) => `https://audio/${encodeURIComponent(text)}`;
  const seen: TutorEvent[] = [];
  const result = await runTutorTurnStream(input(), deps, (e) => seen.push(e));
  const say = result.events[0] as Extract<TutorEvent, { type: "say" }>;
  assert.ok(say.audioUrl?.startsWith("https://audio/"));
  // Streamed events carry no audio; the final payload does.
  assert.equal((seen[0] as { audioUrl?: string }).audioUrl, undefined);
});

// ---- P2-04 × P1-05: answer keys never reach an SSE frame; stream and non-stream store the same turn ----

const V3_TURN = JSON.stringify({
  events: [
    { type: "say", text: "Quick check." },
    { type: "ask_choice", question: "Capital of Zambia?", options: ["Ndola", "Lusaka"], answer: ["Lusaka"], objective: "obj-1" },
    { type: "ask_order", prompt: "Order", items: ["plan", "build", "ship"] },
    { type: "ask_numeric", prompt: "g?", value: 9.81, tolerance: 0.05 },
  ],
});

test("a streamed v3 turn never emits an answer key in any SSE frame (events and done)", async () => {
  const frames: string[] = [];
  const { deps, saved } = harness({ streamChunks: chunks(V3_TURN, 7) });
  const result = await runTutorTurnStream(input({ idx: 4 }), deps, (e) => frames.push(formatSse(TURN_STREAM_EVENTS.event, e)));
  frames.push(formatSse(TURN_STREAM_EVENTS.done, { events: result.events }));
  assert.equal(result.source, "stream");
  assert.equal(frames.length, 5);
  for (const f of frames) assert.doesNotMatch(f, /"answer"|"value"|"tolerance"/, f);
  // The shown order of ask_order is never the key's order, in the stream or the final events.
  assert.ok(!frames.some((f) => f.includes('"items":["plan","build","ship"]')));
  assert.match(frames[1], /"checkId":"t4-0"/);
  assert.equal(result.checks?.length, 3);
  const row = saved[0] as Saved & { checks?: unknown[] };
  assert.equal(row.checks?.length, 3, "keys go to storage as held checks");
  assert.doesNotMatch(JSON.stringify(row.events), /"answer"|"value"/);
});

test("stream and non-stream store identical turns and held checks for the same model reply", async () => {
  const streamH = harness({ streamChunks: chunks(V3_TURN, 11) });
  const streamed = await runTutorTurnStream(input({ idx: 2 }), streamH.deps, () => undefined);
  const plainH = harness({ nonStreamText: V3_TURN });
  const plain = await runTutorTurn(input({ idx: 2 }), plainH.deps);
  const norm = (t: Saved) => ({ ...t, latencyMs: 0 });
  assert.deepEqual(norm(streamH.saved[0]), norm(plainH.saved[0]));
  assert.equal((streamH.saved[0] as { checks?: unknown[] }).checks?.length, 3);
  assert.deepEqual(streamed.events, plain.events);
  assert.deepEqual(streamed.checks, plain.checks);
});

test("the streamed request carries the runtime context (prelude first, teacher note last)", async () => {
  const requests: TurnGenerateRequest[] = [];
  const { deps } = harness({ streamChunks: [VALID] });
  const wrapped: TurnStreamDeps = {
    ...deps,
    generateStream: async (req) => {
      requests.push(req);
      return deps.generateStream(req);
    },
  };
  await runTutorTurnStream(
    input({ context: { prelude: "BRIEF", teacherNote: "Suggested next move: check." } }),
    wrapped,
    () => undefined,
  );
  const contents = requests[0].contents;
  assert.equal(contents[0].parts[0].text, "BRIEF");
  assert.match(contents.at(-1)!.parts.at(-1)!.text, /\[Teacher note[\s\S]*Suggested next move: check\./);
});
