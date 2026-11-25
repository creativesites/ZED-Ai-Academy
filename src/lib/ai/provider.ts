/**
 * Provider-neutral model interfaces (architecture §3.6, D-02).
 *
 * Call sites never talk to an SDK: they go through `aiCall` (`call.ts`), which picks the model chain for a task and
 * calls a provider implementing these interfaces. Gemini is the only provider today (`gemini/adapter.ts`). Adding
 * another provider for a text task means implementing `TextModel`/`StreamModel` and routing the task to it.
 * Gemini Live (realtime voice) is deliberately not abstracted: it stays Gemini-specific (`gemini/live.ts`).
 *
 * Pure types only: no SDK import, safe for unit tests.
 */

export type AiPart = { text: string } | { inlineData: { data: string; mimeType: string } };

export type AiContent = { role: "user" | "model"; parts: AiPart[] };

/**
 * How much the model should think. Providers map this to their own controls; `undefined` keeps the provider's
 * default. Gemini: 3.x → thinkingLevel; 2.5 Flash → `minimal` disables the thinking budget.
 */
export type AiThinking = "minimal" | "low" | "medium" | "high";

export type TextRequest = {
  model: string;
  /** A plain prompt (one user turn) or a full conversation. */
  contents: string | AiContent[];
  systemInstruction?: string;
  /** Structured output: the reply must match this JSON schema (implies JSON mode). */
  responseJsonSchema?: Record<string, unknown>;
  /** JSON mode without a schema (legacy generation routes). Ignored when `responseJsonSchema` is set. */
  json?: boolean;
  temperature?: number;
  maxOutputTokens?: number;
  thinking?: AiThinking;
  /** Provider-side context cache id. Only valid for the model it was created for. */
  cachedContent?: string;
  /** Let the model ground its answer with web search, when the provider supports it. */
  webSearch?: boolean;
};

export type AiUsage = {
  totalTokens?: number;
  inputTokens?: number;
  outputTokens?: number;
  cachedTokens?: number;
};

export type TextResult = { text: string; usage: AiUsage };

export type StreamChunk = { text: string; usage?: AiUsage };

export type SpeechRequest = { model: string; text: string; voice: string };

/** Audio as returned by the provider: base64 data plus its mime type (raw PCM or a container). */
export type SpeechResult = { audio: { data: string; mimeType: string }; usage: AiUsage };

export type AiErrorCode = "no_key" | "auth" | "model" | "quota" | "bad_request" | "unavailable" | "unknown";

export type AiErrorInfo = { code: AiErrorCode; status?: number; detail: string };

export interface TextModel {
  generateText(req: TextRequest): Promise<TextResult>;
}

export interface StreamModel {
  streamText(req: TextRequest): Promise<AsyncIterable<StreamChunk>>;
}

export interface SpeechModel {
  synthesizeSpeech(req: SpeechRequest): Promise<SpeechResult>;
}

export interface AiProvider extends TextModel, StreamModel, SpeechModel {
  readonly name: string;
  /** Classify a provider error so `aiCall` can decide whether another model is worth trying. */
  classifyError(err: unknown): AiErrorInfo;
}

/** True when another model may succeed where this one failed (the key and quota are fine). */
export function isRetryableOnAnotherModel(info: AiErrorInfo): boolean {
  return info.code === "model" || info.code === "bad_request" || info.code === "unavailable";
}
