import { test } from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_TTS_VOICE, normalizeTtsVoice, TtsRateLimiter } from "./tts-guard.ts";

test("normalizeTtsVoice allows valid Gemini prebuilt voices and falls back safely", () => {
  assert.equal(normalizeTtsVoice("Aoede"), "Aoede");
  assert.equal(normalizeTtsVoice(" Puck "), "Puck");
  assert.equal(normalizeTtsVoice("UnknownVoice123"), DEFAULT_TTS_VOICE);
  assert.equal(normalizeTtsVoice(""), DEFAULT_TTS_VOICE);
  assert.equal(normalizeTtsVoice(null), DEFAULT_TTS_VOICE);
});

test("TtsRateLimiter enforces sliding window per user and recovers after window passes", () => {
  const limiter = new TtsRateLimiter({ limit: 2, windowMs: 10_000 });
  assert.deepEqual(limiter.check("u1", 1000), { allowed: true, remaining: 1 });
  assert.deepEqual(limiter.check("u1", 2000), { allowed: true, remaining: 0 });

  const blocked = limiter.check("u1", 3000);
  assert.equal(blocked.allowed, false);
  if (!blocked.allowed) assert.equal(blocked.retryAfterSec, 8);

  // Separate user is unaffected
  assert.deepEqual(limiter.check("u2", 3000), { allowed: true, remaining: 1 });

  // After first timestamp ages out (> 11000ms), u1 can synthesize again
  assert.deepEqual(limiter.check("u1", 11_001), { allowed: true, remaining: 0 });
});
