import "server-only";
import { geminiProvider } from "@/lib/ai/gemini/client";
import { fallbacksFor, modelFor, type AiTask } from "@/lib/ai/models";
import {
  callSpeech,
  callStream,
  callText,
  modelChain,
  type AiCallDeps,
  type SpeechCallResult,
  type StreamCallResult,
  type TextCallResult,
  type TextRequestInput,
  type UsageEvent,
} from "./call-core.ts";
import { parseModelJson, type JsonShape } from "./json.ts";
import type { AiProvider, SpeechRequest, TextRequest } from "./provider.ts";

/**
 * `aiCall` — the single choke point for model calls (architecture §3.6, §8.2).
 *
 * Applies, for every call: the task's model + fallback chain (`models.ts`), the provider (Gemini today), error
 * classification, timing, and metering into `ai_usage_ledger` via `recordUsage`.
 *
 * Metering is explicit: pass the tenant/user to bill, or `{ by: "caller" }` when the caller already writes a richer
 * ledger row itself (tutor session turns, TTS cache misses) so the call is not counted twice.
 */
export type AiMeter =
  | { companyId: string; userId: string | null; sessionId?: string | null }
  | { by: "caller"; reason: string };

export type AiCallOptions = {
  meter: AiMeter;
  /** Override the model chain (primary first). Defaults to `modelFor(task)` + `fallbacksFor(task)`. */
  models?: readonly string[];
  provider?: AiProvider;
};

function depsFor(task: AiTask, opts: AiCallOptions): AiCallDeps {
  const meter = opts.meter;
  return {
    provider: opts.provider ?? geminiProvider,
    models: opts.models ?? modelChain(modelFor(task), fallbacksFor(task)),
    log: (line) => console.warn(line),
    onUsage: "by" in meter ? undefined : (event) => writeUsage(meter, event),
  };
}

async function writeUsage(
  meter: { companyId: string; userId: string | null; sessionId?: string | null },
  event: UsageEvent,
): Promise<void> {
  // Loaded lazily so routes that never meter (the public demo) do not pull in the Supabase client.
  const { recordUsage } = await import("@/lib/tutor/server/usage");
  await recordUsage({
    companyId: meter.companyId,
    userId: meter.userId,
    sessionId: meter.sessionId ?? null,
    model: event.model,
    kind: event.kind,
    units: event.usage.totalTokens ?? 0,
    unit: "tokens",
  });
}

/** Text generation (plain or structured JSON) for a task. */
export function aiCall(task: AiTask, input: TextRequestInput, opts: AiCallOptions): Promise<TextCallResult> {
  return callText(depsFor(task, opts), task, input);
}

/** Speech synthesis for a task (`tutorTts`). */
export function aiSpeech(
  task: AiTask,
  input: Omit<SpeechRequest, "model">,
  opts: AiCallOptions,
): Promise<SpeechCallResult> {
  return callSpeech(depsFor(task, opts), task, input);
}

/** Streaming text for a task. Usage is metered when the stream ends. */
export function aiStream(
  task: AiTask,
  input: TextRequestInput,
  opts: AiCallOptions,
): Promise<StreamCallResult> {
  return callStream(depsFor(task, opts), task, input);
}

/**
 * Structured JSON generation: sends `responseJsonSchema` and parses the reply (tolerating fences or prose around
 * the JSON for models that ignore the schema). Throws `AiJsonError` when no JSON of the expected shape is found.
 */
export async function aiJson(
  task: AiTask,
  input: Omit<TextRequest, "model" | "json"> & { responseJsonSchema: Record<string, unknown> },
  opts: AiCallOptions & { shape?: JsonShape },
): Promise<TextCallResult & { data: unknown }> {
  const result = await aiCall(task, input, opts);
  return { ...result, data: parseModelJson(result.text, opts.shape ?? "object") };
}
