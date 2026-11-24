import "server-only";
import { gemini } from "@/lib/ai/gemini";
import {
  PROMPT_CACHE_TTL_MS,
  PromptCacheRegistry,
  promptCacheKey,
  shouldCacheSystemPrompt,
} from "../prompt-cache.ts";

// Server-side Gemini Context Caching for long static tutor prompts (platform + skill pack + lesson).
// Degrades silently to inline systemInstruction whenever caching is unavailable or unsupported.

const registry = new PromptCacheRegistry(100);
const inflight = new Map<string, Promise<string | undefined>>();

export async function getOrCreatePromptCache(
  model: string,
  systemInstruction: string,
): Promise<string | undefined> {
  if (!shouldCacheSystemPrompt(systemInstruction)) return undefined;
  if (registry.isModelUnsupported(model)) return undefined;

  const key = promptCacheKey(model, systemInstruction);
  const existing = registry.get(key);
  if (existing) return existing;

  const pending = inflight.get(key);
  if (pending) return pending;

  const promise = (async () => {
    try {
      const ttlSeconds = Math.round(PROMPT_CACHE_TTL_MS / 1000);
      const created = await gemini.caches.create({
        model,
        config: {
          systemInstruction,
          ttl: `${ttlSeconds}s`,
        },
      });
      if (created?.name) {
        registry.set(key, created.name, PROMPT_CACHE_TTL_MS);
        return created.name;
      }
      return undefined;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (/not supported|unsupported|404|400|minimum|too small/i.test(msg)) {
        if (/not supported|unsupported|404/i.test(msg)) {
          registry.markModelUnsupported(model);
        }
      }
      console.warn(`[tutor/cache] context caching skipped for ${model}: ${msg.slice(0, 140)}`);
      return undefined;
    } finally {
      inflight.delete(key);
    }
  })();

  inflight.set(key, promise);
  return promise;
}
