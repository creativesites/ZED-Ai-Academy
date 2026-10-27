// Speaking-time totals for POST /api/tutor/sessions/[id]/complete. Pure, no React.
// The learner's time is the recorded duration of each push-to-talk clip. The teacher's time is the
// summed duration of the audio lines that played. Totals are whole milliseconds and never exceed
// the server's limit, so a long session cannot make /complete fail validation.

export const MAX_SPEAKING_MS = 6 * 60 * 60_000;

export type SpeakingTotals = { learnerSpeakingMs: number; teacherSpeakingMs: number };

function clampMs(ms: number): number {
  if (!Number.isFinite(ms) || ms <= 0) return 0;
  return Math.min(MAX_SPEAKING_MS, Math.round(ms));
}

export class SpeakingTimeAccumulator {
  private learner = 0;
  private teacher = 0;

  /** Adds a learner clip's duration. Ignores NaN, negative and infinite values. */
  addLearnerMs(ms: number): void {
    this.learner = clampMs(this.learner + clampMs(ms));
  }

  /** Adds the duration of one teacher audio line that actually played. */
  addTeacherMs(ms: number): void {
    this.teacher = clampMs(this.teacher + clampMs(ms));
  }

  totals(): SpeakingTotals {
    return { learnerSpeakingMs: this.learner, teacherSpeakingMs: this.teacher };
  }
}

/** Seconds from a media duration in seconds (for example HTMLAudioElement.duration) to milliseconds. */
export function secondsToMs(seconds: number): number {
  return Number.isFinite(seconds) && seconds > 0 ? seconds * 1000 : 0;
}
