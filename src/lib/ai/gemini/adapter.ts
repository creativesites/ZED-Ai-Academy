/**
 * Gemini implementation of the provider interfaces in `../provider.ts`.
 *
 * Pure mapping between our provider-neutral requests and the @google/genai request/response shapes. The SDK
 * client is injected (see `client.ts`), so this file does not import @google/genai and is unit-tested with a fake
 * client (`adapter.test.ts`). SDK enum values are written as their string values ("AUDIO", "MINIMAL", ...), which
 * is what the SDK sends on the wire (checked against @google/genai 1.52.0).
 */

import { describeGeminiError } from "../../tutor/gemini-errors.ts";
import type {
  AiContent,
  AiProvider,
  AiThinking,
  AiUsage,
  SpeechRequest,
  SpeechResult,
  StreamChunk,
  TextRequest,
  TextResult,
} from "../provider.ts";

/** The subset of a Gemini `GenerateContentResponse` the adapter reads. */
export type GeminiResponseLike = {
  text?: string;
  usageMetadata?: {
    totalTokenCount?: number;
    promptTokenCount?: number;
    candidatesTokenCount?: number;
    cachedContentTokenCount?: number;
  };
  candidates?: { content?: { parts?: { inlineData?: { data?: string; mimeType?: string } }[] } }[];
};

export type GeminiGenerateParams = {
  model: string;
  contents: string | AiContent[];
  config: Record<string, unknown>;
};

/** The subset of the `GoogleGenAI` client the adapter calls. */
export type GeminiClientLike = {
  models: {
    generateContent(params: GeminiGenerateParams): Promise<GeminiResponseLike>;
    generateContentStream(params: GeminiGenerateParams): Promise<AsyncIterable<GeminiResponseLike>>;
  };
};

const THINKING_LEVEL: Record<AiThinking, string> = {
  minimal: "MINIMAL",
  low: "LOW",
  medium: "MEDIUM",
  high: "HIGH",
};

/**
 * Thinking controls for a model. Gemini 3.x takes a thinking level; 2.5 Flash only supports switching thinking off
 * (budget 0) for `minimal`; other models get nothing (provider default).
 */
export function geminiThinkingConfig(model: string, thinking: AiThinking | undefined): Record<string, unknown> {
  if (!thinking) return {};
  if (/^gemini-3/.test(model)) return { thinkingConfig: { thinkingLevel: THINKING_LEVEL[thinking] } };
  if (thinking === "minimal" && /^gemini-2\.5-flash/.test(model)) return { thinkingConfig: { thinkingBudget: 0 } };
  return {};
}

/** Builds the SDK `generateContent` parameters for a text request. Exported for tests. */
export function toGeminiParams(req: TextRequest): GeminiGenerateParams {
  const config: Record<string, unknown> = {};
  // A context cache already holds the system instruction; Gemini rejects both together.
  if (req.cachedContent) config.cachedContent = req.cachedContent;
  else if (req.systemInstruction) config.systemInstruction = req.systemInstruction;
  if (req.responseJsonSchema) {
    config.responseMimeType = "application/json";
    config.responseJsonSchema = req.responseJsonSchema;
  } else if (req.json) {
    config.responseMimeType = "application/json";
  }
  if (req.temperature !== undefined) config.temperature = req.temperature;
  Object.assign(config, geminiThinkingConfig(req.model, req.thinking));
  if (req.maxOutputTokens !== undefined) config.maxOutputTokens = req.maxOutputTokens;
  if (req.webSearch) config.tools = [{ googleSearch: {} }];
  return { model: req.model, contents: req.contents, config };
}

export function usageFromGemini(response: GeminiResponseLike | undefined): AiUsage {
  const meta = response?.usageMetadata;
  if (!meta) return {};
  return {
    totalTokens: meta.totalTokenCount,
    inputTokens: meta.promptTokenCount,
    outputTokens: meta.candidatesTokenCount,
    cachedTokens: meta.cachedContentTokenCount,
  };
}

async function* streamChunks(stream: AsyncIterable<GeminiResponseLike>): AsyncGenerator<StreamChunk> {
  for await (const chunk of stream) {
    const usage = chunk.usageMetadata ? usageFromGemini(chunk) : undefined;
    yield { text: chunk.text ?? "", ...(usage ? { usage } : {}) };
  }
}

export function createGeminiProvider(client: GeminiClientLike): AiProvider {
  return {
    name: "gemini",

    classifyError: describeGeminiError,

    async generateText(req: TextRequest): Promise<TextResult> {
      const response = await client.models.generateContent(toGeminiParams(req));
      return { text: response.text ?? "", usage: usageFromGemini(response) };
    },

    async streamText(req: TextRequest): Promise<AsyncIterable<StreamChunk>> {
      const stream = await client.models.generateContentStream(toGeminiParams(req));
      return streamChunks(stream);
    },

    async synthesizeSpeech(req: SpeechRequest): Promise<SpeechResult> {
      const response = await client.models.generateContent({
        model: req.model,
        contents: [{ role: "user", parts: [{ text: req.text }] }],
        config: {
          responseModalities: ["AUDIO"],
          speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: req.voice } } },
        },
      });
      const inline = response.candidates?.[0]?.content?.parts?.find((p) => p.inlineData?.data)?.inlineData;
      if (!inline?.data) throw new Error(`TTS returned no audio (${req.model})`);
      return { audio: { data: inline.data, mimeType: inline.mimeType ?? "" }, usage: usageFromGemini(response) };
    },
  };
}
