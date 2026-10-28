import { test } from "node:test";
import assert from "node:assert/strict";
import {
  geminiAudioMimeType,
  LEARNER_AUDIO_TYPES,
  levelFromTimeDomain,
  MAX_RECORDING_MS,
  pickRecorderMimeType,
  shouldSendRecording,
  uploadMimeType,
} from "./recording.ts";

test("the recorder prefers webm with opus when supported", () => {
  assert.equal(pickRecorderMimeType(() => true), "audio/webm;codecs=opus");
});

test("the recorder falls back in order and then to the browser default", () => {
  const onlyOgg = (t: string) => t.startsWith("audio/ogg");
  assert.equal(pickRecorderMimeType(onlyOgg), "audio/ogg;codecs=opus");
  assert.equal(pickRecorderMimeType(() => false), "");
});

test("uploads drop the codec suffix so the API sees a plain media type", () => {
  assert.equal(uploadMimeType("audio/webm;codecs=opus"), "audio/webm");
  assert.equal(uploadMimeType(""), "audio/webm");
  assert.equal(uploadMimeType("Audio/OGG; codecs=opus"), "audio/ogg");
});

test("very short holds are not sent", () => {
  assert.equal(shouldSendRecording(120), false);
  assert.equal(shouldSendRecording(400), true);
  assert.equal(shouldSendRecording(Number.NaN), false);
  assert.equal(MAX_RECORDING_MS, 30_000);
});

test("silence reads as zero and loud speech reads near the top", () => {
  assert.equal(levelFromTimeDomain(new Uint8Array(256).fill(128)), 0);
  const loud = new Uint8Array(256).map((_, i) => (i % 2 ? 255 : 1));
  assert.ok(levelFromTimeDomain(loud) > 0.9);
  assert.equal(levelFromTimeDomain([]), 0);
  assert.ok(levelFromTimeDomain(new Uint8Array(256).fill(140)) <= 1);
});

test("pickRecorderMimeType falls back to MP4 for Safari", () => {
  assert.equal(pickRecorderMimeType((t) => t === "audio/mp4"), "audio/mp4");
});

test("LEARNER_AUDIO_TYPES accepts Safari MP4 uploads", () => {
  assert.ok(LEARNER_AUDIO_TYPES.includes("audio/mp4"));
  assert.ok(LEARNER_AUDIO_TYPES.includes("audio/webm"));
});

test("geminiAudioMimeType maps upload types to the names Gemini lists", () => {
  assert.equal(geminiAudioMimeType("audio/mp4"), "audio/m4a");
  assert.equal(geminiAudioMimeType("audio/x-m4a"), "audio/m4a");
  assert.equal(geminiAudioMimeType("audio/x-wav"), "audio/wav");
  assert.equal(geminiAudioMimeType("audio/webm;codecs=opus"), "audio/webm");
  assert.equal(geminiAudioMimeType("audio/ogg"), "audio/ogg");
});
