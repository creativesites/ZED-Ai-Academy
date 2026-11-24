import { test } from "node:test";
import assert from "node:assert/strict";
import {
  MIN_CACHE_PROMPT_CHARS,
  PROMPT_CACHE_EXPIRY_BUFFER_MS,
  PromptCacheRegistry,
  promptCacheKey,
  shouldCacheSystemPrompt,
} from "./prompt-cache.ts";

test("shouldCacheSystemPrompt only caches large prompts above threshold", () => {
  assert.equal(shouldCacheSystemPrompt("short prompt"), false);
  assert.equal(shouldCacheSystemPrompt("x".repeat(MIN_CACHE_PROMPT_CHARS)), true);
});

test("promptCacheKey changes when model or system instruction changes", () => {
  const a = promptCacheKey("gemini-3.8-flash", "prompt A");
  const b = promptCacheKey("gemini-3.8-flash", "prompt B");
  const c = promptCacheKey("gemini-2.5-flash", "prompt A");
  assert.notEqual(a, b);
  assert.notEqual(a, c);
  assert.equal(a.length, 64);
});

test("PromptCacheRegistry returns live entries, evicts near-expiry entries, and tracks unsupported models", () => {
  const reg = new PromptCacheRegistry(2);
  reg.set("k1", "cachedContents/1", 120_000, 1_000);
  assert.equal(reg.get("k1", 30_000), "cachedContents/1");
  // Within the 60s expiry buffer (121_000 - 60_000 = 61_000) -> expired
  assert.equal(reg.get("k1", 121_000 - PROMPT_CACHE_EXPIRY_BUFFER_MS), undefined);

  reg.set("a", "cachedContents/a", 300_000, 1_000);
  reg.set("b", "cachedContents/b", 300_000, 1_000);
  reg.set("c", "cachedContents/c", 300_000, 1_000);
  assert.equal(reg.get("a", 2_000), undefined, "oldest evicted when maxEntries reached");
  assert.equal(reg.get("c", 2_000), "cachedContents/c");

  assert.equal(reg.isModelUnsupported("m1"), false);
  reg.markModelUnsupported("m1");
  assert.equal(reg.isModelUnsupported("m1"), true);
});
