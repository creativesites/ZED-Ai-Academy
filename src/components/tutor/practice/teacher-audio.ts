// Plays the teacher's `say` audio and drives the avatar's mouth from it. Browser only; the pure
// pieces (viseme mapping, timing) live in src/lib/tutor. One instance is shared by a session.

import type { AvatarDriver } from "@/components/tutor/avatar/types";
import type { SaySpeechEvent, SpeakOutcome } from "@/components/tutor/EventPlayer";
import { visemeFromSpectrum } from "@/lib/tutor/visemes";
import type { VisemeValue } from "@/lib/tutor/contract.generated";
import { secondsToMs } from "@/lib/tutor/speaking-time";

/** How often the mouth is updated from the audio (about 40 Hz, inside the 30-60 Hz target). */
const VISEME_INTERVAL_MS = 25;
/** Without WebAudio there is no spectrum. The mouth cycles open and closed instead. */
const FALLBACK_CYCLE: readonly VisemeValue[] = [1, 0, 2, 0, 4, 0];
const FALLBACK_STEP_MS = 110;

type AudioContextCtor = typeof AudioContext;

export class TeacherAudio {
  private ctx: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private element: HTMLAudioElement | null = null;
  private sourceNode: MediaElementAudioSourceNode | null = null;
  private playedMs = 0;
  private blockedListeners = new Set<(blocked: boolean) => void>();
  private blocked = false;

  /**
   * Call from a user gesture (a tap or key press). Creates and resumes the AudioContext so later
   * playback is allowed. Safe to call many times.
   */
  unlock(): void {
    try {
      if (!this.ctx) {
        const Ctor: AudioContextCtor | undefined =
          typeof window !== "undefined"
            ? window.AudioContext ?? (window as unknown as { webkitAudioContext?: AudioContextCtor }).webkitAudioContext
            : undefined;
        if (Ctor) this.ctx = new Ctor();
      }
      void this.ctx?.resume().catch(() => undefined);
      this.ensureElement();
    } catch {
      // No audio: the session still runs with captions and the fallback mouth.
    }
  }

  /** Total duration, in milliseconds, of the teacher audio that has finished playing. */
  getPlayedMs(): number {
    return this.playedMs;
  }

  /** True after the browser refused to start audio. The UI can offer a "tap to hear" button. */
  isBlocked(): boolean {
    return this.blocked;
  }

  /** Call after the learner taps "tap to hear", once unlock() has run. The next line plays with audio. */
  clearBlocked(): void {
    this.setBlocked(false);
  }

  onBlockedChange(listener: (blocked: boolean) => void): () => void {
    this.blockedListeners.add(listener);
    return () => this.blockedListeners.delete(listener);
  }

  /** Stops anything playing. The EventPlayer also aborts the running line through its signal. */
  stopPlayback(): void {
    this.element?.pause();
  }

  /** The SpeakHook for EventPlayer. Resolves when the line ends, is aborted, or cannot start. */
  readonly speak = (event: SaySpeechEvent, avatar: AvatarDriver, signal: AbortSignal): Promise<SpeakOutcome> => {
    const url = event.audioUrl;
    const el = this.ensureElement();
    if (!url || !el) return Promise.resolve("unavailable");
    if (signal.aborted) return Promise.resolve("stopped");

    return new Promise<SpeakOutcome>((resolve) => {
      let started = false;
      let settled = false;
      let prevViseme: VisemeValue | undefined;
      let tick = 0;

      const cleanup = () => {
        clearInterval(intervalId);
        el.removeEventListener("playing", onPlaying);
        el.removeEventListener("ended", onEnded);
        el.removeEventListener("error", onError);
        signal.removeEventListener("abort", onAbort);
      };
      const finish = (outcome: SpeakOutcome) => {
        if (settled) return;
        settled = true;
        cleanup();
        el.pause();
        resolve(outcome);
      };
      const onPlaying = () => {
        started = true;
        this.setBlocked(false);
      };
      const onEnded = () => {
        this.playedMs += secondsToMs(el.duration);
        finish("played");
      };
      const onError = () => finish(started ? "played" : "unavailable");
      const onAbort = () => finish("stopped");

      el.addEventListener("playing", onPlaying);
      el.addEventListener("ended", onEnded);
      el.addEventListener("error", onError);
      signal.addEventListener("abort", onAbort);

      // Mouth: spectrum from the analyser when WebAudio is up, otherwise a simple open and close cycle.
      const intervalId = setInterval(() => {
        tick++;
        if (this.analyser && this.ctx) {
          const bins = new Uint8Array(this.analyser.frequencyBinCount);
          this.analyser.getByteFrequencyData(bins);
          prevViseme = visemeFromSpectrum(bins, this.ctx.sampleRate, prevViseme);
          avatar.setViseme(prevViseme);
        } else if (started) {
          const idx = Math.floor((tick * VISEME_INTERVAL_MS) / FALLBACK_STEP_MS) % FALLBACK_CYCLE.length;
          avatar.setViseme(FALLBACK_CYCLE[idx]);
        }
      }, VISEME_INTERVAL_MS);

      el.src = url;
      this.connectAnalyser(el);
      const playing = el.play();
      if (playing && typeof playing.catch === "function") {
        playing.catch((err: unknown) => {
          if (err instanceof DOMException && err.name === "NotAllowedError") this.setBlocked(true);
          finish("unavailable");
        });
      }
    });
  };

  private ensureElement(): HTMLAudioElement | null {
    if (this.element) return this.element;
    if (typeof Audio === "undefined") return null;
    const el = new Audio();
    el.preload = "auto";
    el.crossOrigin = "anonymous";
    this.element = el;
    return el;
  }

  /** Routes the element through the analyser once. createMediaElementSource may only be called once per element. */
  private connectAnalyser(el: HTMLAudioElement): void {
    if (!this.ctx) return;
    try {
      if (!this.sourceNode) {
        this.sourceNode = this.ctx.createMediaElementSource(el);
        this.analyser = this.ctx.createAnalyser();
        this.analyser.fftSize = 512;
        this.sourceNode.connect(this.analyser);
        this.analyser.connect(this.ctx.destination);
      }
    } catch {
      this.analyser = null;
    }
  }

  private setBlocked(next: boolean): void {
    if (this.blocked === next) return;
    this.blocked = next;
    for (const listener of this.blockedListeners) listener(next);
  }
}
