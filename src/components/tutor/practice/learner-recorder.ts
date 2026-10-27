// Hold-to-talk recorder for the Voice mode: MediaRecorder with a live level meter. Browser only.
// Pure rules (format choice, 30 s cap, minimum length, level maths) live in src/lib/tutor/recording.ts.

import { levelFromTimeDomain, MAX_RECORDING_MS, pickRecorderMimeType } from "@/lib/tutor/recording";

export type RecorderErrorKind = "denied" | "unavailable" | "failed";

export class RecorderError extends Error {
  constructor(readonly kind: RecorderErrorKind, message: string) {
    super(message);
    this.name = "RecorderError";
  }
}

export type RecordingResult = { blob: Blob; mimeType: string; durationMs: number; capped: boolean };

export class LearnerRecorder {
  private stream: MediaStream | null = null;
  private recorder: MediaRecorder | null = null;
  private chunks: Blob[] = [];
  private startedAt = 0;
  private ctx: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private frame = 0;
  private capTimer: ReturnType<typeof setTimeout> | undefined;
  private capped = false;
  private stopping: Promise<RecordingResult | null> | null = null;
  private resolveStop: ((value: RecordingResult | null) => void) | null = null;

  /** Called about every animation frame while recording, with the mic level 0..1. */
  onLevel?: (level: number) => void;
  /** Called once when the 30 second cap ends a recording. The caller should then call stop(). */
  onCap?: () => void;

  get isRecording(): boolean {
    return this.recorder !== null && this.recorder.state === "recording";
  }

  /** Asks for the mic and starts recording. Throws RecorderError with a kind the UI can explain. */
  async start(): Promise<void> {
    if (this.isRecording) return;
    if (typeof MediaRecorder === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      throw new RecorderError("unavailable", "This browser cannot record audio.");
    }

    try {
      this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (err) {
      const name = err instanceof DOMException ? err.name : "";
      if (name === "NotAllowedError" || name === "SecurityError") {
        throw new RecorderError("denied", "Microphone access was blocked.");
      }
      if (name === "NotFoundError" || name === "OverconstrainedError") {
        throw new RecorderError("unavailable", "No microphone was found.");
      }
      throw new RecorderError("failed", "The microphone could not be started.");
    }

    const mimeType = pickRecorderMimeType((t) => MediaRecorder.isTypeSupported(t));
    try {
      this.recorder = mimeType ? new MediaRecorder(this.stream, { mimeType }) : new MediaRecorder(this.stream);
    } catch {
      this.releaseStream();
      throw new RecorderError("failed", "The microphone could not be started.");
    }

    this.chunks = [];
    this.capped = false;
    this.recorder.addEventListener("dataavailable", (e: BlobEvent) => {
      if (e.data && e.data.size > 0) this.chunks.push(e.data);
    });
    this.recorder.addEventListener("stop", () => this.finish());

    this.startLevelMeter(this.stream);
    this.startedAt = performance.now();
    this.recorder.start(250);
    this.capTimer = setTimeout(() => {
      this.capped = true;
      this.onCap?.();
    }, MAX_RECORDING_MS);
  }

  /** Stops and resolves the clip, or null when nothing was recording. Safe to call twice. */
  stop(): Promise<RecordingResult | null> {
    if (this.stopping) return this.stopping;
    if (!this.recorder || this.recorder.state === "inactive") return Promise.resolve(null);

    this.stopping = new Promise<RecordingResult | null>((resolve) => {
      this.resolveStop = resolve;
    });
    clearTimeout(this.capTimer);
    this.recorder.stop();
    return this.stopping;
  }

  /** Stops and discards the clip. Used when the page leaves or the session ends. */
  cancel(): void {
    clearTimeout(this.capTimer);
    if (this.recorder && this.recorder.state !== "inactive") {
      this.recorder.addEventListener("stop", () => this.finish(true), { once: true });
      this.recorder.stop();
    } else {
      this.finish(true);
    }
  }

  private finish(discard = false): void {
    const durationMs = performance.now() - this.startedAt;
    const mimeType = this.recorder?.mimeType || "audio/webm";
    const blob = new Blob(this.chunks, { type: mimeType });
    const resolve = this.resolveStop;
    const result: RecordingResult | null =
      discard || blob.size === 0 ? null : { blob, mimeType, durationMs: Math.round(durationMs), capped: this.capped };

    this.stopLevelMeter();
    this.releaseStream();
    this.recorder = null;
    this.chunks = [];
    this.stopping = null;
    this.resolveStop = null;
    resolve?.(result);
  }

  private startLevelMeter(stream: MediaStream): void {
    try {
      const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return;
      this.ctx = new Ctor();
      const source = this.ctx.createMediaStreamSource(stream);
      this.analyser = this.ctx.createAnalyser();
      this.analyser.fftSize = 512;
      source.connect(this.analyser);
      const buf = new Uint8Array(this.analyser.fftSize);
      const loop = () => {
        if (!this.analyser) return;
        this.analyser.getByteTimeDomainData(buf);
        this.onLevel?.(levelFromTimeDomain(buf));
        this.frame = requestAnimationFrame(loop);
      };
      this.frame = requestAnimationFrame(loop);
    } catch {
      // No meter: recording still works, the mic pill just shows no bars.
    }
  }

  private stopLevelMeter(): void {
    cancelAnimationFrame(this.frame);
    this.analyser = null;
    void this.ctx?.close().catch(() => undefined);
    this.ctx = null;
  }

  private releaseStream(): void {
    this.stream?.getTracks().forEach((track) => track.stop());
    this.stream = null;
  }
}
