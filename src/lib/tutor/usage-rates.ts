import type { TutorUsageKind } from "../../types/database.ts";

// ESTIMATED unit prices in USD for ai_usage_ledger.est_cost_usd. These are rough planning numbers,
// not invoices. Check the current Gemini pricing page and edit here. Units per kind:
//   llm, tts, transcribe: tokens
//   live_audio_in, live_audio_out: seconds
//   image: images
export const USAGE_RATES_USD_PER_UNIT: Record<TutorUsageKind, number> = {
  llm: 0.5 / 1_000_000,
  tts: 10 / 1_000_000,
  transcribe: 1 / 1_000_000,
  live_audio_in: 0.0001,
  live_audio_out: 0.0004,
  image: 0.04,
};

/** Estimated cost for `units` of `kind`, rounded to the ledger's 5 decimal places. */
export function estimateCostUsd(kind: TutorUsageKind, units: number): number {
  if (!Number.isFinite(units) || units <= 0) return 0;
  return Math.round(units * USAGE_RATES_USD_PER_UNIT[kind] * 1e5) / 1e5;
}
