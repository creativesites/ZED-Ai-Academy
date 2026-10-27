import { TONE_TRACE } from "./contract.generated.ts";
import type { ToneShape, VisemeValue } from "./contract.generated.ts";
import type { VisemeSegment } from "./visemes.ts";

// Pure scheduling helpers for the avatar EventPlayer. No React, no DOM, no timers.

/** Where the point_card gesture reaches the card, measured from gesture start. */
export const POINT_CARD_PEAK_MS = 700;
/** Longest a show_card waits for a point_card peak before showing the card anyway. */
export const CARD_WAIT_MAX_MS = 800;
/** Extra allowance on top of a tone's duration: approach and hold phases of trace_tone. */
export const TRACE_TIMEOUT_SLACK_MS = 1200;

export type CardWaitInput = {
  /** True when the event immediately before show_card was a point_card gesture. */
  previousIsPointCard: boolean;
  /** True when a gesturePeak for point_card has already been received. */
  peakSeen: boolean;
  /** Time since the point_card gesture started. */
  elapsedMs: number;
};

/**
 * How long show_card may wait for the teacher's finger to reach the card.
 * Returns 0 when there is nothing to wait for.
 */
export function cardWaitMs(input: CardWaitInput): number {
  if (!input.previousIsPointCard || input.peakSeen) return 0;
  const remaining = POINT_CARD_PEAK_MS - Math.max(0, input.elapsedMs);
  return Math.min(CARD_WAIT_MAX_MS, Math.max(0, remaining));
}

export function toneDurationMs(tone: ToneShape): number {
  return TONE_TRACE.durationMs[tone];
}

/** Upper bound for waiting on a traceEnd before the player gives up and moves on. */
export function toneTimeoutMs(tone: ToneShape): number {
  return toneDurationMs(tone) + TRACE_TIMEOUT_SLACK_MS;
}

export type VisemeStep = { atMs: number; viseme: VisemeValue };
export type VisemeSchedule = { steps: VisemeStep[]; totalMs: number };

/**
 * Turns viseme segments (duration-based) into start-time steps. Zero-length segments are dropped,
 * and a step is only emitted when the viseme actually changes.
 */
export function scheduleVisemes(segments: readonly VisemeSegment[]): VisemeSchedule {
  const steps: VisemeStep[] = [];
  let at = 0;
  for (const seg of segments) {
    if (seg.ms <= 0) continue;
    const last = steps[steps.length - 1];
    if (!last || last.viseme !== seg.viseme) {
      steps.push({ atMs: at, viseme: seg.viseme });
    }
    at += seg.ms;
  }
  return { steps, totalMs: at };
}

/** The viseme in force at `elapsedMs`. Rest (0) before the first step and after the end. */
export function visemeAt(schedule: VisemeSchedule, elapsedMs: number): VisemeValue {
  if (elapsedMs < 0 || elapsedMs >= schedule.totalMs) return 0;
  let current: VisemeValue = 0;
  for (const step of schedule.steps) {
    if (step.atMs > elapsedMs) break;
    current = step.viseme;
  }
  return current;
}

export function sayDurationMs(segments: readonly VisemeSegment[]): number {
  return segments.reduce((sum, seg) => sum + Math.max(0, seg.ms), 0);
}
