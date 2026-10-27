// Push-to-talk helpers for the Voice mode client. Pure, no DOM, so they are unit-testable.

/** Longest hold-to-talk clip. The API accepts at most 2 MB, which is well above this at webm/opus rates. */
export const MAX_RECORDING_MS = 30_000;
/** Shorter holds are treated as a mis-tap and not sent. */
export const MIN_RECORDING_MS = 400;

/** Preferred recorder formats, in order. The API accepts webm, ogg and wav (the codec suffix is stripped on upload). */
export const RECORDER_MIME_CANDIDATES = [
  "audio/webm;codecs=opus",
  "audio/webm",
  "audio/ogg;codecs=opus",
  "audio/ogg",
] as const;

/**
 * First candidate the browser supports. Returns "" when none match, so MediaRecorder picks its own default.
 * `isSupported` is usually `(t) => MediaRecorder.isTypeSupported(t)`.
 */
export function pickRecorderMimeType(isSupported: (mimeType: string) => boolean): string {
  for (const candidate of RECORDER_MIME_CANDIDATES) {
    if (isSupported(candidate)) return candidate;
  }
  return "";
}

/** The bare media type for the upload: "audio/webm;codecs=opus" becomes "audio/webm". */
export function uploadMimeType(recorderMime: string): string {
  const base = recorderMime.split(";")[0].trim().toLowerCase();
  return base || "audio/webm";
}

/** Whether a finished hold should be sent. */
export function shouldSendRecording(durationMs: number): boolean {
  return Number.isFinite(durationMs) && durationMs >= MIN_RECORDING_MS;
}

/**
 * Mic level from time-domain bytes (AnalyserNode.getByteTimeDomainData, centred on 128).
 * Returns 0..1 from the RMS, with a gain so ordinary speech reaches the top of the meter.
 */
export function levelFromTimeDomain(samples: ArrayLike<number>): number {
  const n = samples.length;
  if (n === 0) return 0;
  let sum = 0;
  for (let i = 0; i < n; i++) {
    const v = (Number(samples[i]) - 128) / 128;
    sum += v * v;
  }
  const rms = Math.sqrt(sum / n);
  return Math.min(1, Math.max(0, rms * 2.5));
}
