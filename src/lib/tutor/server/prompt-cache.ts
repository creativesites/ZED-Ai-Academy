import "server-only";
import { createContextCache } from "@/lib/ai/gemini/client";
import { createServiceClient } from "@/lib/supabase/server";
import { isSchemaUnavailableError } from "../mastery/server";
import {
  PROMPT_CACHE_EXPIRY_BUFFER_MS,
  PROMPT_CACHE_TTL_MS,
  PromptCacheRegistry,
  promptCacheKey,
  shouldCacheSystemPrompt,
} from "../prompt-cache.ts";

// Server-side Gemini Context Caching for long static tutor prompts (platform + skill pack + lesson).
// Degrades silently to inline systemInstruction whenever caching is unavailable or unsupported.
//
// P2-06: caches are shared across server instances through the `ai_prompt_caches` table (key = sha256(model +
// prefix)). `lookupSharedPromptCache` never creates anything, so the learner's turn never waits on cache
// creation; `createSharedPromptCache` runs in `after()` on the first turn and the cache is used from turn 2.
// Before the table exists the in-process registry still works per instance.

const registry = new PromptCacheRegistry(100);
const inflight = new Map<string, Promise<string | undefined>>();

type CacheRow = { provider_name: string; expires_at: string };

type LooseCacheTable = {
  from: (t: "ai_prompt_caches") => {
    select: (c: string) => {
      eq: (k: string, v: string) => {
        maybeSingle: () => Promise<{ data: CacheRow | null; error: { code?: string; message?: string } | null }>;
      };
    };
    upsert: (
      row: Record<string, unknown>,
      opts: { onConflict: string },
    ) => Promise<{ error: { code?: string; message?: string } | null }>;
  };
};

let tableMissing = false;

function db(): LooseCacheTable {
  return createServiceClient() as unknown as LooseCacheTable;
}

/** Cache handle for this prefix if one exists (this instance or the shared table). Never creates one. */
export async function lookupSharedPromptCache(model: string, prefix: string): Promise<string | undefined> {
  if (!shouldCacheSystemPrompt(prefix) || registry.isModelUnsupported(model)) return undefined;
  const key = promptCacheKey(model, prefix);
  const local = registry.get(key);
  if (local) return local;
  if (tableMissing) return undefined;
  try {
    const { data, error } = await db().from("ai_prompt_caches").select("provider_name, expires_at").eq("key", key).maybeSingle();
    if (error) {
      if (isSchemaUnavailableError(error)) tableMissing = true;
      return undefined;
    }
    if (!data) return undefined;
    const expiresAtMs = Date.parse(data.expires_at);
    if (!Number.isFinite(expiresAtMs) || Date.now() >= expiresAtMs - PROMPT_CACHE_EXPIRY_BUFFER_MS) return undefined;
    registry.set(key, data.provider_name, expiresAtMs - Date.now());
    return data.provider_name;
  } catch {
    return undefined;
  }
}

/**
 * Creates the cache for this prefix (unless one exists) and shares it through the table. Meant for `after()`.
 * Returns the handle, or undefined when caching is unsupported or fails (never throws).
 */
export async function createSharedPromptCache(model: string, prefix: string): Promise<string | undefined> {
  const existing = await lookupSharedPromptCache(model, prefix);
  if (existing) return existing;
  if (!shouldCacheSystemPrompt(prefix) || registry.isModelUnsupported(model)) return undefined;
  const key = promptCacheKey(model, prefix);
  const created = await getOrCreatePromptCache(model, prefix);
  if (created && !tableMissing) {
    const expiresAt = new Date(Date.now() + PROMPT_CACHE_TTL_MS).toISOString();
    let error: { code?: string; message?: string } | null = null;
    try {
      ({ error } = await db()
        .from("ai_prompt_caches")
        .upsert({ key, provider: "gemini", provider_name: created, model, expires_at: expiresAt }, { onConflict: "key" }));
    } catch (err) {
      error = { message: String(err) };
    }
    if (error) {
      if (isSchemaUnavailableError(error)) tableMissing = true;
      else console.warn("[tutor/cache] could not share cache handle:", error.message);
    }
  }
  return created;
}

/** Per-instance create-or-reuse (the pre-P2-06 behaviour, still used by callers that create inline). */
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
      const name = await createContextCache(model, systemInstruction, ttlSeconds);
      if (name) {
        registry.set(key, name, PROMPT_CACHE_TTL_MS);
        return name;
      }
      return undefined;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (/not supported|unsupported|404/i.test(msg)) registry.markModelUnsupported(model);
      console.warn(`[tutor/cache] context caching skipped for ${model}: ${msg.slice(0, 140)}`);
      return undefined;
    } finally {
      inflight.delete(key);
    }
  })();

  inflight.set(key, promise);
  return promise;
}
