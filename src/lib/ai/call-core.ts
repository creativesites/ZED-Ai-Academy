/**
 * The provider-neutral core of `aiCall`: walk the model chain, classify errors, time the call and report usage.
 * Pure (provider, clock, logger and usage sink are injected) so the contract is unit-tested with a fake provider.
 * `call.ts` wires it to the Gemini provider, `models.ts` and the usage ledger.
 */

import {
  isRetryableOnAnotherModel,
  type AiErrorInfo,
  type AiProvider,
  type AiUsage,
  type SpeechRequest,
  type SpeechResult,
  type StreamChunk,
  type TextRequest,
  type TextResult,
} from "./provider.ts";

export type UsageKind = "llm" | "tts" | "transcribe";

/** One finished model call, reported to the usage sink (the ledger in production). */
export type UsageEvent = {
  task: string;
  model: string;
  kind: UsageKind;
  usage: AiUsage;
  durationMs: number;
  fellBack: boolean;
};

export type AttemptLog = { model: string; ok: boolean; error?: AiErrorInfo; durationMs: number };

export type AiCallDeps = {
  provider: AiProvider;
  /** Models to try in order (primary first). */
  models: readonly string[];
  /** Called once per successful call. Failures in the sink are swallowed: metering must not break a request. */
  onUsage?: (event: UsageEvent) => void | Promise<void>;
  now?: () => number;
  log?: (line: string) => void;
};

export type CallMeta = {
  model: string;
  /** True when a model other than the primary answered. */
  fellBack: boolean;
  durationMs: number;
  attempts: AttemptLog[];
};

export type TextCallResult = TextResult & CallMeta;
export type SpeechCallResult = SpeechResult & CallMeta;
export type StreamCallResult = CallMeta & {
  /** Chunks of the reply. Usage is reported to the sink once the stream has been fully consumed. */
  stream: AsyncIterable<StreamChunk>;
};

/** Primary first, then fallbacks, without duplicates or blanks. */
export function modelChain(primary: string, fallbacks: readonly string[] = []): string[] {
  const out: string[] = [];
  for (const model of [primary, ...fallbacks]) {
    const trimmed = model?.trim();
    if (trimmed && !out.includes(trimmed)) out.push(trimmed);
  }
  return out;
}

/** Thrown when there is no model to call at all (misconfiguration). Provider errors are rethrown unchanged. */
export class AiConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AiConfigError";
  }
}

async function safeReport(deps: AiCallDeps, event: UsageEvent): Promise<void> {
  if (!deps.onUsage) return;
  try {
    await deps.onUsage(event);
  } catch (err) {
    deps.log?.(`[ai] usage sink failed for ${event.task}: ${err instanceof Error ? err.message : String(err)}`);
  }
}

/**
 * Calls `run` with each model in the chain until one succeeds. Stops early when the error says another model
 * would fail the same way (auth, quota, unknown). Throws the FIRST model's error, unchanged, so callers can keep
 * classifying it (e.g. `describeGeminiError`).
 */
export async function withFallback<T>(
  deps: AiCallDeps,
  task: string,
  run: (model: string) => Promise<T>,
): Promise<{ value: T } & CallMeta> {
  if (deps.models.length === 0) throw new AiConfigError(`No model configured for AI task "${task}".`);
  const now = deps.now ?? Date.now;
  const started = now();
  const attempts: AttemptLog[] = [];
  let firstError: unknown;

  for (const [index, model] of deps.models.entries()) {
    const attemptStart = now();
    try {
      const value = await run(model);
      attempts.push({ model, ok: true, durationMs: now() - attemptStart });
      return { value, model, fellBack: index > 0, durationMs: now() - started, attempts };
    } catch (err) {
      const info = deps.provider.classifyError(err);
      attempts.push({ model, ok: false, error: info, durationMs: now() - attemptStart });
      deps.log?.(
        `[ai] ${task}: ${deps.provider.name} ${model} failed (${info.code}${info.status ? ` ${info.status}` : ""}): ${info.detail}`,
      );
      if (firstError === undefined) firstError = err;
      if (!isRetryableOnAnotherModel(info)) break;
    }
  }
  throw firstError;
}

/** A request for every model in the chain, or one built per model (e.g. a context cache only valid for one). */
export type TextRequestInput = Omit<TextRequest, "model"> | ((model: string) => Omit<TextRequest, "model">);

function requestFor(input: TextRequestInput, model: string): TextRequest {
  return { ...(typeof input === "function" ? input(model) : input), model };
}

export async function callText(
  deps: AiCallDeps,
  task: string,
  request: TextRequestInput,
  kind: UsageKind = "llm",
): Promise<TextCallResult> {
  const result = await withFallback(deps, task, (model) => deps.provider.generateText(requestFor(request, model)));
  const { value, ...meta } = result;
  await safeReport(deps, { task, model: meta.model, kind, usage: value.usage, durationMs: meta.durationMs, fellBack: meta.fellBack });
  return { ...value, ...meta };
}

export async function callSpeech(
  deps: AiCallDeps,
  task: string,
  request: Omit<SpeechRequest, "model">,
): Promise<SpeechCallResult> {
  const result = await withFallback(deps, task, (model) => deps.provider.synthesizeSpeech({ ...request, model }));
  const { value, ...meta } = result;
  await safeReport(deps, { task, model: meta.model, kind: "tts", usage: value.usage, durationMs: meta.durationMs, fellBack: meta.fellBack });
  return { ...value, ...meta };
}

/**
 * Streaming text. Fallback applies only to opening the stream (errors before the first chunk); an error mid-stream
 * is rethrown to the consumer. Usage (the last chunk that carries it) is reported once the stream ends.
 */
export async function callStream(
  deps: AiCallDeps,
  task: string,
  request: TextRequestInput,
): Promise<StreamCallResult> {
  const now = deps.now ?? Date.now;
  const result = await withFallback(deps, task, (model) => deps.provider.streamText(requestFor(request, model)));
  const { value: source, ...meta } = result;
  const started = now() - meta.durationMs;

  async function* metered(): AsyncGenerator<StreamChunk> {
    let usage: AiUsage = {};
    let completed = false;
    try {
      for await (const chunk of source) {
        if (chunk.usage) usage = chunk.usage;
        yield chunk;
      }
      completed = true;
    } finally {
      // Report even when the consumer stops early: the tokens were still spent.
      await safeReport(deps, {
        task,
        model: meta.model,
        kind: "llm",
        usage,
        durationMs: now() - started,
        fellBack: meta.fellBack,
      });
      if (!completed) deps.log?.(`[ai] ${task}: stream ended early`);
    }
  }

  return { ...meta, stream: metered() };
}
