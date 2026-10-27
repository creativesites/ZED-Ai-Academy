import type { VisemeValue } from "./contract.generated.ts";

// Viseme values from docs/rive/teacher.contract.json. Kept as literals so this module has no runtime deps.
const V = {
  rest: 0,
  AA: 1,
  EH: 2,
  EE: 3,
  OH: 4,
  OO: 5,
  MBP: 6,
  FV: 7,
  CONS: 8,
} as const;

export type VisemeSegment = { viseme: VisemeValue; ms: number };

const VOWEL_MS = 100;
const CONSONANT_MS = 60;
const SPACE_MS = 80;
const PUNCT_MS = 200;
// A CJK ideograph is approximated as an open vowel, a mid vowel, then a short rest.
const HAN_AA_MS = 120;
const HAN_EH_MS = 90;
const HAN_REST_MS = 40;

function letterSegment(ch: string): VisemeSegment {
  switch (ch) {
    case "a":
      return { viseme: V.AA, ms: VOWEL_MS };
    case "e":
      return { viseme: V.EH, ms: VOWEL_MS };
    case "i":
    case "y":
      return { viseme: V.EE, ms: VOWEL_MS };
    case "o":
      return { viseme: V.OH, ms: VOWEL_MS };
    case "u":
      return { viseme: V.OO, ms: VOWEL_MS };
    case "w": // glide: OO lip shape, consonant timing
      return { viseme: V.OO, ms: CONSONANT_MS };
    case "m":
    case "b":
    case "p":
      return { viseme: V.MBP, ms: CONSONANT_MS };
    case "f":
    case "v":
      return { viseme: V.FV, ms: CONSONANT_MS };
    default:
      return { viseme: V.CONS, ms: CONSONANT_MS };
  }
}

/**
 * Maps text to a rough mouth-shape timeline. Deterministic, no audio needed.
 * Text is NFD-normalised with combining marks stripped, so ü becomes u (OO) and ñ becomes n (CONS).
 * Consecutive identical visemes are merged. Other scripts fall through to CONS per letter (no Kana/Hangul tables yet).
 */
export function visemeTimelineFromText(text: string): VisemeSegment[] {
  const normalized = text.normalize("NFD").replace(/\p{Mn}/gu, "").toLowerCase();
  const raw: VisemeSegment[] = [];

  for (const ch of normalized) {
    if (/\s/u.test(ch)) {
      raw.push({ viseme: V.rest, ms: SPACE_MS });
    } else if (/\p{Script=Han}/u.test(ch)) {
      raw.push({ viseme: V.AA, ms: HAN_AA_MS });
      raw.push({ viseme: V.EH, ms: HAN_EH_MS });
      raw.push({ viseme: V.rest, ms: HAN_REST_MS });
    } else if (/\p{P}/u.test(ch)) {
      raw.push({ viseme: V.rest, ms: PUNCT_MS });
    } else if (/\p{L}/u.test(ch)) {
      raw.push(letterSegment(ch));
    }
    // Digits, symbols and emoji produce no mouth movement.
  }

  const merged: VisemeSegment[] = [];
  for (const seg of raw) {
    const last = merged[merged.length - 1];
    if (last && last.viseme === seg.viseme) {
      last.ms += seg.ms;
    } else {
      merged.push({ viseme: seg.viseme, ms: seg.ms });
    }
  }
  return merged;
}

export const SPECTRUM_THRESHOLDS = {
  // Mean normalised magnitude (0..1) below which the mouth rests.
  silence: 0.08,
  // Near-silence ceiling after speech, where the lips close (MBP).
  mbpCeiling: 0.16,
  // Band edges in Hz.
  lowHz: 1000,
  highHz: 3000,
  // A new viseme must beat the previous one's score by more than this to replace it.
  hysteresis: 0.1,
} as const;

/**
 * Heuristic viseme from FFT magnitudes (0..255, like AnalyserNode.getByteFrequencyData).
 * Bands: low (<1 kHz), mid (1-3 kHz), high (>3 kHz). Overall level is the mean of all bins.
 * - Below the silence threshold: rest.
 * - AA: low and mid both strong. OO: low dominant, mid and high weak. OH: low with moderate mid.
 * - EE: mid dominant with weak low. EH: mid with strong low. CONS: high dominant.
 * - MBP: low level just after speech (prevViseme not rest and level below mbpCeiling).
 * Hysteresis: keep prevViseme unless the best score beats its score by more than `hysteresis`.
 * FV is not chosen by the heuristic (it needs more than band energy); it only appears from text.
 */
export function visemeFromSpectrum(
  bins: ArrayLike<number>,
  sampleRate: number,
  prevViseme?: VisemeValue,
): VisemeValue {
  if (!Number.isFinite(sampleRate) || sampleRate <= 0) {
    throw new RangeError(`visemeFromSpectrum: sampleRate must be a positive number, got ${sampleRate}`);
  }
  const n = bins.length;
  if (n === 0) return V.rest;

  const binHz = sampleRate / (2 * n);
  let lo = 0;
  let mi = 0;
  let hi = 0;
  let nLo = 0;
  let nMi = 0;
  let nHi = 0;
  let total = 0;

  for (let k = 0; k < n; k++) {
    const raw = Number(bins[k]);
    const m = Number.isFinite(raw) ? Math.min(1, Math.max(0, raw / 255)) : 0;
    total += m;
    const hz = k * binHz;
    if (hz < SPECTRUM_THRESHOLDS.lowHz) {
      lo += m;
      nLo++;
    } else if (hz <= SPECTRUM_THRESHOLDS.highHz) {
      mi += m;
      nMi++;
    } else {
      hi += m;
      nHi++;
    }
  }
  total /= n;
  if (total < SPECTRUM_THRESHOLDS.silence) return V.rest;

  lo = nLo > 0 ? lo / nLo : 0;
  mi = nMi > 0 ? mi / nMi : 0;
  hi = nHi > 0 ? hi / nHi : 0;

  const lipsClosing = prevViseme !== undefined && prevViseme !== V.rest && total < SPECTRUM_THRESHOLDS.mbpCeiling;
  const scores: [VisemeValue, number][] = [
    [V.AA, Math.min(lo, mi)],
    [V.OO, lo * (1 - mi) * (1 - hi)],
    [V.OH, lo * mi * (1 - hi)],
    [V.EE, mi * (1 - lo)],
    [V.EH, mi * lo],
    [V.CONS, hi * (1 - lo)],
    [V.MBP, lipsClosing ? 1 : 0],
  ];

  let best = scores[0];
  for (const cand of scores) {
    if (cand[1] > best[1]) best = cand;
  }

  if (prevViseme !== undefined) {
    const prevScore = scores.find(([v]) => v === prevViseme);
    if (prevScore && prevScore[1] >= best[1] - SPECTRUM_THRESHOLDS.hysteresis) {
      return prevViseme;
    }
  }
  return best[0];
}
