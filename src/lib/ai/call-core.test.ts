import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { AiConfigError, callSpeech, callStream, callText, modelChain, type UsageEvent } from "./call-core.ts";
import type { AiErrorInfo, AiProvider, StreamChunk, TextRequest } from "./provider.ts";

/** An error the fake provider classifies by its `code`. */
class FakeError extends Error {
  readonly code: AiErrorInfo["code"];
  constructor(code: AiErrorInfo["code"]) {
    super(`fake ${code}`);
    this.code = code;
  }
}

type Script = Record<string, AiErrorInfo["code"] | "ok">;

function fakeProvider(script: Script, calls: TextRequest[] = []): AiProvider {
  const outcome = (model: string) => {
    const result = script[model] ?? "ok";
    if (result !== "ok") throw new FakeError(result);
  };
  return {
    name: "fake",
    classifyError(err) {
      return err instanceof FakeError ? { code: err.code, detail: err.message } : { code: "unknown", detail: String(err) };
    },
    async generateText(req) {
      calls.push(req);
      outcome(req.model);
      return { text: `reply from ${req.model}`, usage: { totalTokens: 42 } };
    },
    async streamText(req) {
      calls.push(req);
      outcome(req.model);
      async function* gen(): AsyncGenerator<StreamChunk> {
        yield { text: "Hel" };
        yield { text: "lo", usage: { totalTokens: 7 } };
      }
      return gen();
    },
    async synthesizeSpeech(req) {
      outcome(req.model);
      return { audio: { data: "UklGRg==", mimeType: "audio/wav" }, usage: { totalTokens: 3 } };
    },
  };
}

function clock() {
  let t = 1000;
  return () => (t += 5);
}

describe("modelChain", () => {
  it("puts the primary first and drops duplicates and blanks", () => {
    assert.deepEqual(modelChain("a", ["b", "a", " ", "c", "b"]), ["a", "b", "c"]);
    assert.deepEqual(modelChain("a"), ["a"]);
  });
});

describe("callText (adapter contract)", () => {
  it("passes the request through with the chosen model and reports usage once", async () => {
    const calls: TextRequest[] = [];
    const events: UsageEvent[] = [];
    const result = await callText(
      { provider: fakeProvider({}, calls), models: ["m1", "m2"], onUsage: (e) => void events.push(e), now: clock() },
      "quiz",
      { contents: "hi", responseJsonSchema: { type: "object" }, temperature: 0.2 },
    );
    assert.equal(result.text, "reply from m1");
    assert.equal(result.model, "m1");
    assert.equal(result.fellBack, false);
    assert.equal(calls.length, 1);
    assert.deepEqual(calls[0], { contents: "hi", responseJsonSchema: { type: "object" }, temperature: 0.2, model: "m1" });
    assert.equal(events.length, 1);
    assert.equal(events[0].task, "quiz");
    assert.equal(events[0].kind, "llm");
    assert.equal(events[0].usage.totalTokens, 42);
    assert.ok(events[0].durationMs > 0);
  });

  for (const code of ["model", "bad_request", "unavailable"] as const) {
    it(`falls back to the next model on a ${code} error`, async () => {
      const events: UsageEvent[] = [];
      const result = await callText(
        { provider: fakeProvider({ m1: code }), models: ["m1", "m2"], onUsage: (e) => void events.push(e) },
        "quiz",
        { contents: "hi" },
      );
      assert.equal(result.model, "m2");
      assert.equal(result.fellBack, true);
      assert.deepEqual(result.attempts.map((a) => [a.model, a.ok]), [["m1", false], ["m2", true]]);
      assert.equal(events[0].model, "m2");
      assert.equal(events[0].fellBack, true);
    });
  }

  for (const code of ["auth", "quota", "no_key", "unknown"] as const) {
    it(`does not try another model on a ${code} error and rethrows it unchanged`, async () => {
      const calls: TextRequest[] = [];
      const events: UsageEvent[] = [];
      await assert.rejects(
        callText({ provider: fakeProvider({ m1: code }, calls), models: ["m1", "m2"], onUsage: (e) => void events.push(e) }, "quiz", { contents: "x" }),
        (err: unknown) => err instanceof FakeError && err.code === code,
      );
      assert.equal(calls.length, 1);
      assert.equal(events.length, 0, "failed calls are not metered");
    });
  }

  it("throws the FIRST error when every model fails", async () => {
    await assert.rejects(
      callText({ provider: fakeProvider({ m1: "model", m2: "unavailable" }), models: ["m1", "m2"] }, "quiz", { contents: "x" }),
      (err: unknown) => err instanceof FakeError && err.code === "model",
    );
  });

  it("builds a per-model request when given a function (e.g. a cache only valid for the primary)", async () => {
    const calls: TextRequest[] = [];
    await callText(
      { provider: fakeProvider({ m1: "model" }, calls), models: ["m1", "m2"] },
      "tutorTurn",
      (model) => (model === "m1" ? { contents: "x", cachedContent: "cache/1" } : { contents: "x", systemInstruction: "sys" }),
    );
    assert.deepEqual(calls, [
      { contents: "x", cachedContent: "cache/1", model: "m1" },
      { contents: "x", systemInstruction: "sys", model: "m2" },
    ]);
  });

  it("refuses an empty model chain", async () => {
    await assert.rejects(callText({ provider: fakeProvider({}), models: [] }, "quiz", { contents: "x" }), AiConfigError);
  });

  it("swallows usage sink failures", async () => {
    const lines: string[] = [];
    const result = await callText(
      {
        provider: fakeProvider({}),
        models: ["m1"],
        onUsage: () => {
          throw new Error("ledger down");
        },
        log: (l) => void lines.push(l),
      },
      "quiz",
      { contents: "x" },
    );
    assert.equal(result.model, "m1");
    assert.ok(lines.some((l) => l.includes("ledger down")));
  });
});

describe("callSpeech", () => {
  it("falls back across speech models and meters as tts", async () => {
    const events: UsageEvent[] = [];
    const result = await callSpeech(
      { provider: fakeProvider({ tts1: "model" }), models: ["tts1", "tts2"], onUsage: (e) => void events.push(e) },
      "tutorTts",
      { text: "Muli bwanji", voice: "Kore" },
    );
    assert.equal(result.model, "tts2");
    assert.equal(result.audio.mimeType, "audio/wav");
    assert.equal(events[0].kind, "tts");
  });
});

describe("callStream", () => {
  it("yields every chunk and meters the final usage after the stream ends", async () => {
    const events: UsageEvent[] = [];
    const result = await callStream(
      { provider: fakeProvider({ m1: "unavailable" }), models: ["m1", "m2"], onUsage: (e) => void events.push(e) },
      "practiceStudio",
      { contents: "x" },
    );
    assert.equal(result.model, "m2");
    assert.equal(events.length, 0, "not metered before the stream is read");
    let text = "";
    for await (const chunk of result.stream) text += chunk.text;
    assert.equal(text, "Hello");
    assert.equal(events.length, 1);
    assert.equal(events[0].usage.totalTokens, 7);
  });

  it("still meters when the consumer stops early", async () => {
    const events: UsageEvent[] = [];
    const result = await callStream(
      { provider: fakeProvider({}), models: ["m1"], onUsage: (e) => void events.push(e) },
      "practiceStudio",
      { contents: "x" },
    );
    for await (const chunk of result.stream) {
      assert.equal(chunk.text, "Hel");
      break;
    }
    assert.equal(events.length, 1);
  });
});
