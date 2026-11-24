// Pure Voice Activity Detection (VAD) state machine for Hands-Free voice mode.
// Tracks mic energy levels (0..1) over time and signals when a complete utterance has ended.

export type VadConfig = {
  /** Mic level (0..1) considered active speech. */
  speechThreshold: number;
  /** Mic level (0..1) below which audio counts as silence. */
  silenceThreshold: number;
  /** Minimum ms of speech energy before an utterance is considered started. */
  minSpeechMs: number;
  /** Continuous ms of silence after speech before auto-submitting. */
  silenceHoldMs: number;
};

export const DEFAULT_VAD_CONFIG: VadConfig = {
  speechThreshold: 0.085,
  silenceThreshold: 0.055,
  minSpeechMs: 180,
  silenceHoldMs: 1350,
};

export type VadStatus = "waiting" | "speaking" | "commit";

export class VadTracker {
  private readonly cfg: VadConfig;
  private speechStartedAt: number | null = null;
  private speechConfirmed = false;
  private silenceStartedAt: number | null = null;

  constructor(config: Partial<VadConfig> = {}) {
    this.cfg = { ...DEFAULT_VAD_CONFIG, ...config };
  }

  reset(): void {
    this.speechStartedAt = null;
    this.speechConfirmed = false;
    this.silenceStartedAt = null;
  }

  get hasDetectedSpeech(): boolean {
    return this.speechConfirmed;
  }

  /**
   * Feed a new mic level sample (0..1) at timestamp `nowMs`.
   * Returns `"waiting"` while silent before speech, `"speaking"` while capturing,
   * or `"commit"` once the learner pauses long enough after speaking.
   */
  update(level: number, nowMs: number): VadStatus {
    const safeLevel = Number.isFinite(level) ? Math.max(0, level) : 0;

    if (!this.speechConfirmed) {
      if (safeLevel >= this.cfg.speechThreshold) {
        if (this.speechStartedAt === null) {
          this.speechStartedAt = nowMs;
        }
        if (nowMs - this.speechStartedAt >= this.cfg.minSpeechMs) {
          this.speechConfirmed = true;
          this.silenceStartedAt = null;
          return "speaking";
        }
      } else if (safeLevel < this.cfg.silenceThreshold) {
        this.speechStartedAt = null;
      }
      return "waiting";
    }

    // Speech already started: watch for sustained silence to commit the utterance.
    if (safeLevel >= this.cfg.silenceThreshold) {
      this.silenceStartedAt = null;
      return "speaking";
    }

    if (this.silenceStartedAt === null) {
      this.silenceStartedAt = nowMs;
      return "speaking";
    }

    if (nowMs - this.silenceStartedAt >= this.cfg.silenceHoldMs) {
      return "commit";
    }

    return "speaking";
  }
}
