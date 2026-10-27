import { test } from "node:test";
import assert from "node:assert/strict";
import { parsePcmSampleRate, pcmToWav, ttsCacheKey, ttsCachePath, TTS_DEFAULT_SAMPLE_RATE } from "./audio.ts";

test("sample rate is read from the PCM mime type, with a safe default", () => {
  assert.equal(parsePcmSampleRate("audio/L16;codec=pcm;rate=24000"), 24000);
  assert.equal(parsePcmSampleRate("audio/L16; rate=16000"), 16000);
  assert.equal(parsePcmSampleRate("audio/L16;codec=pcm"), TTS_DEFAULT_SAMPLE_RATE);
  assert.equal(parsePcmSampleRate(undefined), TTS_DEFAULT_SAMPLE_RATE);
  assert.equal(parsePcmSampleRate("audio/L16;rate=999999"), TTS_DEFAULT_SAMPLE_RATE);
});

test("pcmToWav writes a canonical 44-byte header followed by the PCM data", () => {
  const pcm = new Uint8Array([1, 0, 2, 0, 3, 0, 4, 0]); // four 16-bit mono samples
  const wav = pcmToWav(pcm, 24000);
  assert.equal(wav.length, 44 + pcm.length);
  assert.equal(wav.toString("ascii", 0, 4), "RIFF");
  assert.equal(wav.readUInt32LE(4), 36 + pcm.length);
  assert.equal(wav.toString("ascii", 8, 12), "WAVE");
  assert.equal(wav.toString("ascii", 12, 16), "fmt ");
  assert.equal(wav.readUInt32LE(16), 16);
  assert.equal(wav.readUInt16LE(20), 1); // PCM
  assert.equal(wav.readUInt16LE(22), 1); // mono
  assert.equal(wav.readUInt32LE(24), 24000);
  assert.equal(wav.readUInt32LE(28), 48000); // byte rate = 24000 * 2
  assert.equal(wav.readUInt16LE(32), 2); // block align
  assert.equal(wav.readUInt16LE(34), 16);
  assert.equal(wav.toString("ascii", 36, 40), "data");
  assert.equal(wav.readUInt32LE(40), pcm.length);
  assert.deepEqual([...wav.subarray(44)], [...pcm]);
});

test("pcmToWav does not modify its input", () => {
  const pcm = new Uint8Array([9, 9, 9, 9]);
  pcmToWav(pcm, 16000);
  assert.deepEqual([...pcm], [9, 9, 9, 9]);
});

test("cache key is a stable sha256 hex of voice and text", () => {
  const key = ttsCacheKey("Kore", "你好");
  assert.match(key, /^[0-9a-f]{64}$/);
  assert.equal(key, ttsCacheKey("Kore", "你好"));
  assert.notEqual(key, ttsCacheKey("Puck", "你好"));
  assert.notEqual(key, ttsCacheKey("Kore", "你好!"));
  assert.equal(ttsCachePath("Kore", "你好"), `${key}.wav`);
});
