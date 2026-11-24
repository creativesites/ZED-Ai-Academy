import { test } from "node:test";
import assert from "node:assert/strict";
import {
  hybridVisemeFromAudio,
  visemeAtCalibratedTime,
  visemeFromSpectrum,
  visemeTimelineFromText,
} from "./visemes.ts";

test("Chinese 你好 maps each ideograph to AA, EH, rest", () => {
  assert.deepEqual(visemeTimelineFromText("你好"), [
    { viseme: 1, ms: 120 },
    { viseme: 2, ms: 90 },
    { viseme: 0, ms: 40 },
    { viseme: 1, ms: 120 },
    { viseme: 2, ms: 90 },
    { viseme: 0, ms: 40 },
  ]);
});

test("Spanish Hola maps letters to CONS, OH, CONS, AA", () => {
  assert.deepEqual(visemeTimelineFromText("Hola"), [
    { viseme: 8, ms: 60 },
    { viseme: 4, ms: 100 },
    { viseme: 8, ms: 60 },
    { viseme: 1, ms: 100 },
  ]);
});

test("empty string gives an empty timeline", () => {
  assert.deepEqual(visemeTimelineFromText(""), []);
});

test("diacritics are stripped, so ü maps to OO and ñ to CONS", () => {
  assert.deepEqual(visemeTimelineFromText("ü"), [{ viseme: 5, ms: 100 }]);
  assert.deepEqual(visemeTimelineFromText("ñ"), [{ viseme: 8, ms: 60 }]);
});

test("consecutive identical visemes are merged and spaces and punctuation rest", () => {
  // "m" (MBP) then "b" (MBP) merge into one segment.
  assert.deepEqual(visemeTimelineFromText("mb"), [{ viseme: 6, ms: 120 }]);
  // Space (80 ms) followed by "." (200 ms) merge into one rest segment.
  assert.deepEqual(visemeTimelineFromText(" ."), [{ viseme: 0, ms: 280 }]);
  // CJK full stop is punctuation.
  assert.deepEqual(visemeTimelineFromText("。"), [{ viseme: 0, ms: 200 }]);
});

test("visemeFromSpectrum returns rest for silence", () => {
  const silent = new Uint8Array(128);
  assert.equal(visemeFromSpectrum(silent, 48000), 0);
  assert.equal(visemeFromSpectrum(silent, 48000, 1), 0, "silence beats hysteresis");
  assert.equal(visemeFromSpectrum([], 48000), 0);
});

// Spectra use 1024 bins at 48 kHz (bin width ~23.4 Hz): low < 1 kHz is bins 0-42,
// mid 1-3 kHz is bins 43-128, high > 3 kHz is bins 129-1023. The silence threshold is a mean over all bins,
// so the fixtures need broad energy to get past it.
const BINS = 1024;
const LOW_END = 43;
const MID_END = 129;

test("visemeFromSpectrum picks CONS for high-band energy", () => {
  const bins = new Uint8Array(BINS);
  bins.fill(200, MID_END);
  assert.equal(visemeFromSpectrum(bins, 48000), 8);
});

test("visemeFromSpectrum picks OO for low-dominant energy", () => {
  const bins = new Uint8Array(BINS);
  bins.fill(255, 0, LOW_END);
  bins.fill(40, LOW_END, MID_END);
  bins.fill(10, MID_END);
  assert.equal(visemeFromSpectrum(bins, 48000), 5);
});

test("visemeFromSpectrum keeps the previous viseme when the scores are close", () => {
  // Low and mid strong, high moderate: AA scores 0.9, EH 0.81, OH 0.65. EH is within the hysteresis margin.
  const bins = new Uint8Array(BINS);
  bins.fill(230, 0, MID_END);
  bins.fill(51, MID_END);
  assert.equal(visemeFromSpectrum(bins, 48000), 1, "AA wins without history");
  assert.equal(visemeFromSpectrum(bins, 48000, 2), 2, "EH is kept when it is close to AA");
  assert.equal(visemeFromSpectrum(bins, 48000, 4), 1, "OH is too far behind, so the new choice wins");
});

test("visemeFromSpectrum rejects a non-positive sample rate", () => {
  assert.throws(() => visemeFromSpectrum([100], 0), RangeError);
});

test("visemeAtCalibratedTime scales phonetic timeline to actual audio duration", () => {
  // "Hola": CONS(60), OH(100), CONS(60), AA(100) => total 320 ms
  const timeline = visemeTimelineFromText("Hola");
  // Suppose real TTS audio is 640 ms (2x slower). At 200 ms elapsed -> 100 ms in timeline -> OH (4).
  assert.equal(visemeAtCalibratedTime(timeline, 200, 640), 4);
  // At 560 ms elapsed -> 280 ms in timeline -> AA (1).
  assert.equal(visemeAtCalibratedTime(timeline, 560, 640), 1);
  // Past end -> rest (0).
  assert.equal(visemeAtCalibratedTime(timeline, 700, 640), 0);
});

test("hybridVisemeFromAudio gates pauses to rest and prefers calibrated phonemes during active speech", () => {
  // "fa": FV(60), AA(100) => total 160 ms. FV can only come from phonetic lookup, not FFT spectrum.
  const timeline = visemeTimelineFromText("fa");
  const silent = new Uint8Array(BINS);
  assert.equal(
    hybridVisemeFromAudio({
      timeline,
      elapsedMs: 20,
      durationMs: 160,
      bins: silent,
      sampleRate: 48000,
    }),
    0,
    "real audio silence forces mouth to rest even mid-phoneme",
  );

  const active = new Uint8Array(BINS);
  active.fill(180);
  assert.equal(
    hybridVisemeFromAudio({
      timeline,
      elapsedMs: 20,
      durationMs: 160,
      bins: active,
      sampleRate: 48000,
    }),
    7,
    "active speech uses crisp phonetic FV viseme",
  );
  assert.equal(
    hybridVisemeFromAudio({
      timeline,
      elapsedMs: 100,
      durationMs: 160,
      bins: active,
      sampleRate: 48000,
    }),
    1,
    "active speech advances to AA viseme",
  );
});
