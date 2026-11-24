// Lightweight synthesized WebAudio sound effects for AI Teacher sessions.
// Zero external audio files, zero latency, and always respects mute + volume.

type AudioContextCtor = typeof AudioContext;

let sharedCtx: AudioContext | null = null;

function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!sharedCtx) {
    const Ctor: AudioContextCtor | undefined =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: AudioContextCtor }).webkitAudioContext;
    if (!Ctor) return null;
    try {
      sharedCtx = new Ctor();
    } catch {
      return null;
    }
  }
  if (sharedCtx.state === "suspended") {
    void sharedCtx.resume().catch(() => undefined);
  }
  return sharedCtx;
}

function playTone(
  ctx: AudioContext,
  freq: number,
  startOffsetSec: number,
  durationSec: number,
  gainPeak: number,
  type: OscillatorType = "sine",
) {
  const now = ctx.currentTime + startOffsetSec;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, now);

  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(Math.max(0.001, gainPeak), now + 0.015);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + durationSec);

  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(now);
  osc.stop(now + durationSec + 0.02);
}

export type SoundFxOpts = { muted: boolean; volume: number };

/** Soft marimba-like tap chime when picking a choice or submitting an interactive challenge. */
export function playChoiceChime({ muted, volume }: SoundFxOpts): void {
  if (muted || volume <= 0) return;
  const ctx = getCtx();
  if (!ctx) return;
  const g = 0.08 * volume;
  playTone(ctx, 587.33, 0, 0.14, g, "triangle"); // D5
  playTone(ctx, 880, 0.06, 0.18, g * 0.9, "sine"); // A5
}

/** Gentle crystalline tick when advancing to a new step or saving a study card. */
export function playStepTick({ muted, volume }: SoundFxOpts): void {
  if (muted || volume <= 0) return;
  const ctx = getCtx();
  if (!ctx) return;
  playTone(ctx, 740, 0, 0.12, 0.06 * volume, "sine");
}

/** Warm, uplifting 3-note triad arpeggio when earning an award badge. */
export function playAwardFanfare({ muted, volume }: SoundFxOpts): void {
  if (muted || volume <= 0) return;
  const ctx = getCtx();
  if (!ctx) return;
  const g = 0.1 * volume;
  playTone(ctx, 523.25, 0, 0.22, g, "triangle"); // C5
  playTone(ctx, 659.25, 0.08, 0.24, g, "triangle"); // E5
  playTone(ctx, 783.99, 0.16, 0.34, g, "triangle"); // G5
  playTone(ctx, 1046.5, 0.25, 0.42, g * 0.9, "sine"); // C6
}

/** Subtle listening-ready blip when Hands-Free mic opens. */
export function playMicReadyBlip({ muted, volume }: SoundFxOpts): void {
  if (muted || volume <= 0) return;
  const ctx = getCtx();
  if (!ctx) return;
  playTone(ctx, 493.88, 0, 0.09, 0.045 * volume, "sine");
}
