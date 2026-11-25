import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  createGeminiProvider,
  geminiThinkingConfig,
  toGeminiParams,
  type GeminiClientLike,
  type GeminiGenerateParams,
  type GeminiResponseLike,
} from "./adapter.ts";

function fakeClient(response: GeminiResponseLike, seen: GeminiGenerateParams[] = []): GeminiClientLike {
  return {
    models: {
      async generateContent(params) {
        seen.push(params);
        return response;
      },
      async generateContentStream(params) {
        seen.push(params);
        async function* gen() {
          yield { text: "a" } as GeminiResponseLike;
          yield { text: "b", usageMetadata: { totalTokenCount: 9 } } as GeminiResponseLike;
        }
        return gen();
      },
    },
  };
}

describe("geminiThinkingConfig", () => {
  it("maps thinking to a level on Gemini 3.x", () => {
    assert.deepEqual(geminiThinkingConfig("gemini-3.8-flash", "minimal"), { thinkingConfig: { thinkingLevel: "MINIMAL" } });
    assert.deepEqual(geminiThinkingConfig("gemini-3.5-flash-lite", "low"), { thinkingConfig: { thinkingLevel: "LOW" } });
  });
  it("turns thinking off on 2.5 Flash only for minimal", () => {
    assert.deepEqual(geminiThinkingConfig("gemini-2.5-flash", "minimal"), { thinkingConfig: { thinkingBudget: 0 } });
    assert.deepEqual(geminiThinkingConfig("gemini-2.5-flash", "low"), {});
  });
  it("adds nothing when no thinking is requested", () => {
    assert.deepEqual(geminiThinkingConfig("gemini-3.8-flash", undefined), {});
  });
});

describe("toGeminiParams", () => {
  it("maps a structured JSON request", () => {
    const schema = { type: "object", properties: { a: { type: "string" } } };
    assert.deepEqual(
      toGeminiParams({
        model: "gemini-3.8-flash",
        contents: "prompt",
        systemInstruction: "sys",
        responseJsonSchema: schema,
        temperature: 0.4,
        thinking: "low",
        maxOutputTokens: 8192,
      }),
      {
        model: "gemini-3.8-flash",
        contents: "prompt",
        config: {
          systemInstruction: "sys",
          responseMimeType: "application/json",
          responseJsonSchema: schema,
          temperature: 0.4,
          thinkingConfig: { thinkingLevel: "LOW" },
          maxOutputTokens: 8192,
        },
      },
    );
  });

  it("uses the context cache instead of the system instruction when given", () => {
    const params = toGeminiParams({ model: "m", contents: [], systemInstruction: "sys", cachedContent: "cachedContents/1" });
    assert.equal(params.config.cachedContent, "cachedContents/1");
    assert.equal(params.config.systemInstruction, undefined);
  });

  it("supports legacy JSON mode without a schema, and plain text", () => {
    assert.deepEqual(toGeminiParams({ model: "m", contents: "p", json: true }).config, { responseMimeType: "application/json" });
    assert.deepEqual(toGeminiParams({ model: "m", contents: "p" }).config, {});
  });

  it("adds Google Search grounding on request", () => {
    assert.deepEqual(toGeminiParams({ model: "m", contents: "p", webSearch: true }).config.tools, [{ googleSearch: {} }]);
  });
});

describe("createGeminiProvider", () => {
  it("returns text and usage from generateContent", async () => {
    const seen: GeminiGenerateParams[] = [];
    const provider = createGeminiProvider(
      fakeClient({ text: '{"ok":true}', usageMetadata: { totalTokenCount: 12, promptTokenCount: 10, candidatesTokenCount: 2 } }, seen),
    );
    const result = await provider.generateText({ model: "gemini-3.8-flash", contents: "x", json: true });
    assert.equal(result.text, '{"ok":true}');
    assert.deepEqual(result.usage, { totalTokens: 12, inputTokens: 10, outputTokens: 2, cachedTokens: undefined });
    assert.equal(seen[0].model, "gemini-3.8-flash");
  });

  it("treats a missing text as an empty string", async () => {
    const provider = createGeminiProvider(fakeClient({}));
    const result = await provider.generateText({ model: "m", contents: "x" });
    assert.equal(result.text, "");
    assert.deepEqual(result.usage, {});
  });

  it("streams chunks with usage on the last one", async () => {
    const provider = createGeminiProvider(fakeClient({}));
    const chunks = [];
    for await (const chunk of await provider.streamText({ model: "m", contents: "x" })) chunks.push(chunk);
    assert.deepEqual(chunks, [{ text: "a" }, { text: "b", usage: { totalTokens: 9, inputTokens: undefined, outputTokens: undefined, cachedTokens: undefined } }]);
  });

  it("requests audio for speech and returns the inline audio", async () => {
    const seen: GeminiGenerateParams[] = [];
    const provider = createGeminiProvider(
      fakeClient(
        { candidates: [{ content: { parts: [{}, { inlineData: { data: "AAAA", mimeType: "audio/L16;rate=24000" } }] } }] },
        seen,
      ),
    );
    const result = await provider.synthesizeSpeech({ model: "tts", text: "Hello", voice: "Kore" });
    assert.deepEqual(result.audio, { data: "AAAA", mimeType: "audio/L16;rate=24000" });
    assert.deepEqual(seen[0].config, {
      responseModalities: ["AUDIO"],
      speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: "Kore" } } },
    });
  });

  it("throws when speech has no audio", async () => {
    const provider = createGeminiProvider(fakeClient({ candidates: [] }));
    await assert.rejects(provider.synthesizeSpeech({ model: "tts", text: "x", voice: "Kore" }), /no audio/);
  });

  it("classifies Gemini errors for the fallback policy", () => {
    const provider = createGeminiProvider(fakeClient({}));
    assert.equal(provider.classifyError(Object.assign(new Error("not found"), { status: 404 })).code, "model");
    assert.equal(provider.classifyError(Object.assign(new Error("RESOURCE_EXHAUSTED"), { status: 429 })).code, "quota");
  });
});
