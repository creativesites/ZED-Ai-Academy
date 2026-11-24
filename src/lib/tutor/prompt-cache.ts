import { createHash } from "node:crypto";

// Pure helpers for Gemini Context Caching of static tutor system prompts (platform + skill pack + lesson).
// Keeps caching threshold, stable keying, TTL safety margins, and per-model unsupported circuit-breaking
// testable without touching the network.

/** Minimum system prompt length (~1,200+ tokens) before creating an explicit Gemini context cache. */
export const MIN_CACHE_PROMPT_CHARS = 4_800;
/** Default cache TTL (15 minutes). */
export const PROMPT_CACHE_TTL_MS = 15 * 60_000;
/** Stop reusing a cached handle 60 s before server-side expiry so turns never hit 404 expired cache. */
export const PROMPT_CACHE_EXPIRY_BUFFER_MS = 60_000;

export function shouldCacheSystemPrompt(
  systemInstruction: string,
  minChars = MIN_CACHE_PROMPT_CHARS,
): boolean {
  return systemInstruction.length >= minChars;
}

export function promptCacheKey(model: string, systemInstruction: string): string {
  return createHash("sha256").update(`${model}\0${systemInstruction}`).digest("hex");
}

type CacheEntry = {
  cacheName: string;
  expiresAtMs: number;
};

/**
 * Bounded in-memory registry mapping `sha256(model + prompt)` -> Gemini `cachedContents/...` name.
 * Also remembers models that reject explicit caching so subsequent turns skip the extra call.
 */
export class PromptCacheRegistry {
  private readonly entries = new Map<string, CacheEntry>();
  private readonly unsupportedModels = new Set<string>();
  private readonly maxEntries: number;

  constructor(maxEntries = 100) {
    this.maxEntries = maxEntries;
  }

  isModelUnsupported(model: string): boolean {
    return this.unsupportedModels.has(model);
  }

  markModelUnsupported(model: string): void {
    this.unsupportedModels.add(model);
  }

  get(key: string, nowMs = Date.now()): string | undefined {
    const entry = this.entries.get(key);
    if (!entry) return undefined;
    if (nowMs >= entry.expiresAtMs - PROMPT_CACHE_EXPIRY_BUFFER_MS) {
      this.entries.delete(key);
      return undefined;
    }
    return entry.cacheName;
  }

  set(key: string, cacheName: string, ttlMs = PROMPT_CACHE_TTL_MS, nowMs = Date.now()): void {
    if (this.entries.size >= this.maxEntries) {
      const oldestKey = this.entries.keys().next().value;
      if (oldestKey) this.entries.delete(oldestKey);
    }
    this.entries.set(key, {
      cacheName,
      expiresAtMs: nowMs + ttlMs,
    });
  }

  delete(key: string): void {
    this.entries.delete(key);
  }
}
