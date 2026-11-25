// TeacherVoice: the one voice of the AI teacher (P1-10). Plays the teacher's lines with the persona's
// server TTS voice (/api/tutor/tts, cached by text + voice) and drives the avatar's mouth from the audio.
// Used by the Teaching Room session (through EventPlayer), the lesson dock and the cards deck (through
// useTeacherVoice). There is deliberately no browser speechSynthesis fallback: a line without server audio
// returns "unavailable", and callers show captions with a text-timed mouth, so the teacher never speaks in
// a different, robotic voice. Browser only; the pure pieces (visemes, timing) live in src/lib/tutor.

import type { AvatarDriver } from "@/components/tutor/avatar/types";
import type { SaySpeechEvent, SpeakOutcome } from "@/components/tutor/EventPlayer";
import {
  hybridVisemeFromAudio,
  visemeAtCalibratedTime,
  visemeTimelineFromText,
} from "@/lib/tutor/visemes";
import type { VisemeValue } from "@/lib/tutor/contract.generated";
import { applyPronunciationGlossary, type PronunciationEntry } from "@/lib/tutor/pronunciation";
import { secondsToMs } from "@/lib/tutor/speaking-time";

/** How often the mouth is updated from the audio (about 40 Hz, inside the 30-60 Hz target). */
const VISEME_INTERVAL_MS = 25;
/** Audio that has not started by now (a slow first TTS render) is given up; captions carry the line. */
const AUDIO_START_TIMEOUT_MS = 8000;
/**
 * How long to wait for /api/tutor/tts. A line that is not cached yet is synthesised and uploaded first, which
 * takes about 5-10 s (measured ~9.7 s); cached lines return in well under a second. The route's own limit is
 * 30 s. Lines of a turn are prefetched in parallel, so only the first new line waits this long.
 */
const TTS_FETCH_TIMEOUT_MS = 15_000;

type AudioContextCtor = typeof AudioContext;

export class TeacherVoice {
  private ctx: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private element: HTMLAudioElement | null = null;
  private sourceNode: MediaElementAudioSourceNode | null = null;
  private playedMs = 0;
  private blockedListeners = new Set<(blocked: boolean) => void>();
  private blocked = false;
  private muted = false;
  private volume = 1;
  private playbackRate = 1;
  private language: string | null = null;
  private ttsVoice: string | null = null;
  private pronunciationGlossary: PronunciationEntry[] = [];
  private ttsCache = new Map<string, Promise<string | null>>();
  /** Set when the element was routed through a context that would not run. Plays direct from then on. */
  private analyserDisabled = false;

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

  /** The session's target language ("zh", "es", "fr" or "en"). The persona's server voice speaks it. */
  setLanguage(language: string | null | undefined): void {
    this.language = language ?? null;
  }

  /** Enables progressive server TTS via /api/tutor/tts for turns that deferred inline synthesis. */
  setTtsVoice(voice: string | null | undefined): void {
    this.ttsVoice = voice ?? null;
  }

  /** Sets optional persona pronunciation overrides applied to TTS text while captions keep real spelling. */
  setPronunciationGlossary(entries: readonly PronunciationEntry[] | null | undefined): void {
    this.pronunciationGlossary = entries ? [...entries] : [];
  }

  /** Kicks off cached/synthesized TTS fetches in parallel for all `say` lines in a turn. */
  prefetch(lines: readonly string[]): void {
    if (!this.ttsVoice || this.muted) return;
    for (const line of lines) {
      if (line.trim()) void this.resolveTtsUrl(line);
    }
  }

  private resolveTtsUrl(text: string): Promise<string | null> {
    const voice = this.ttsVoice;
    if (!voice) return Promise.resolve(null);
    const spokenText = applyPronunciationGlossary(text, this.pronunciationGlossary);
    const key = `${voice}::${spokenText}`;
    const existing = this.ttsCache.get(key);
    if (existing) return existing;

    const promise = (async () => {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), TTS_FETCH_TIMEOUT_MS);
      try {
        const res = await fetch("/api/tutor/tts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "same-origin",
          body: JSON.stringify({ text: spokenText, voice }),
          signal: controller.signal,
        });
        if (!res.ok) return null;
        const data = (await res.json().catch(() => null)) as { url?: unknown } | null;
        return typeof data?.url === "string" && data.url ? data.url : null;
      } catch {
        return null;
      } finally {
        clearTimeout(timer);
      }
    })();

    // Cap cache size to keep memory bounded across long sessions
    if (this.ttsCache.size > 40) this.ttsCache.clear();
    this.ttsCache.set(key, promise);
    // A failed or timed-out fetch is not remembered, so the line is retried the next time it is spoken.
    void promise.then((url) => {
      if (!url && this.ttsCache.get(key) === promise) this.ttsCache.delete(key);
    });
    return promise;
  }

  isMuted(): boolean {
    return this.muted;
  }

  /** Mute stops the current line. Muted lines fall back to captions with a moving mouth. */
  setMuted(next: boolean): void {
    this.muted = next;
    if (this.element) this.element.muted = next;
    if (next) this.stopPlayback();
  }

  /** Sets output volume (0..1). Live-updates the active audio element when playing. */
  setVolume(next: number): void {
    const clamped = Math.max(0, Math.min(1, Number.isFinite(next) ? next : 1));
    this.volume = clamped;
    if (this.element) this.element.volume = clamped;
  }

  getVolume(): number {
    return this.volume;
  }

  /** Sets teacher speech speed multiplier (0.75..1.35). */
  setPlaybackRate(rate: number): void {
    const clamped = Math.max(0.75, Math.min(1.35, Number.isFinite(rate) ? rate : 1));
    this.playbackRate = clamped;
    if (this.element) this.element.playbackRate = clamped;
  }

  getPlaybackRate(): number {
    return this.playbackRate;
  }

  /** Stops anything playing. The EventPlayer also aborts the running line through its signal. */
  stopPlayback(): void {
    this.element?.pause();
  }

  /**
   * The SpeakHook for EventPlayer. Resolves when the line ends, is aborted, or cannot start. Plays the
   * line's audio when it has some, else the persona voice from /api/tutor/tts. "unavailable" when neither
   * plays: the caller then shows the caption with a text-timed mouth (no browser voice).
   */
  readonly speak = async (event: SaySpeechEvent, avatar: AvatarDriver, signal: AbortSignal): Promise<SpeakOutcome> => {
    if (this.muted) return "unavailable";
    if (signal.aborted) return "stopped";
    let audioUrl = event.audioUrl;
    if (!audioUrl && this.ttsVoice) {
      audioUrl = (await this.resolveTtsUrl(event.text)) ?? undefined;
      if (signal.aborted) return "stopped";
    }
    if (!audioUrl) return "unavailable";
    // Blocked by autoplay reports "unavailable" with isBlocked() set; the UI shows "tap to hear".
    return this.playAudio(audioUrl, event.text, avatar, signal);
  };

  private async playAudio(url: string, text: string, avatar: AvatarDriver, signal: AbortSignal): Promise<SpeakOutcome> {
    await this.ensureAudible();
    if (signal.aborted) return "stopped";
    const el = this.ensureElement();
    if (!el) return "unavailable";

    const phoneticTimeline = visemeTimelineFromText(text);

    return new Promise<SpeakOutcome>((resolve) => {
      let started = false;
      let settled = false;
      let prevViseme: VisemeValue | undefined;
      let startedAt = performance.now();

      const cleanup = () => {
        clearInterval(intervalId);
        clearTimeout(startTimer);
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
        avatar.setViseme(0);
        resolve(outcome);
      };
      const onPlaying = () => {
        started = true;
        startedAt = performance.now();
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

      // Mouth: hybrid duration-calibrated phonetic + live WebAudio amplitude gating for crisp lip-sync.
      const intervalId = setInterval(() => {
        const elapsed =
          Number.isFinite(el.currentTime) && el.currentTime > 0
            ? el.currentTime * 1000
            : performance.now() - startedAt;
        const durationMs =
          Number.isFinite(el.duration) && el.duration > 0 ? el.duration * 1000 : undefined;

        if (this.analyser && this.ctx) {
          const bins = new Uint8Array(this.analyser.frequencyBinCount);
          this.analyser.getByteFrequencyData(bins);
          prevViseme = hybridVisemeFromAudio({
            timeline: phoneticTimeline,
            elapsedMs: elapsed,
            durationMs,
            bins,
            sampleRate: this.ctx.sampleRate,
            prevViseme,
          });
          avatar.setViseme(prevViseme);
        } else if (started) {
          avatar.setViseme(visemeAtCalibratedTime(phoneticTimeline, elapsed, durationMs));
        }
      }, VISEME_INTERVAL_MS);

      const startTimer = setTimeout(() => {
        if (!started) finish("unavailable");
      }, AUDIO_START_TIMEOUT_MS);

      el.src = url;
      el.volume = this.volume;
      el.muted = this.muted;
      el.playbackRate = this.playbackRate;
      this.connectAnalyser(el);
      const playing = el.play();
      if (playing && typeof playing.catch === "function") {
        playing.catch((err: unknown) => {
          if (err instanceof DOMException && err.name === "NotAllowedError") this.setBlocked(true);
          finish("unavailable");
        });
      }
    });
  }

  /**
   * The element is routed through the AudioContext for lip-sync. A context that is not running mutes
   * it, so resume first; if it still will not run, swap in a fresh element that plays directly.
   */
  private async ensureAudible(): Promise<void> {
    const ctx = this.ctx;
    if (!ctx || ctx.state === "running") return;
    await Promise.race([ctx.resume().catch(() => undefined), new Promise((resolve) => setTimeout(resolve, 300))]);
    if ((ctx.state as AudioContextState) === "running" || !this.sourceNode) return;
    this.analyserDisabled = true;
    this.sourceNode = null;
    this.analyser = null;
    this.element = null;
  }

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
    // Routing an element through a suspended AudioContext mutes it, and the routing is permanent.
    // So only connect once the context is running; until then the element plays directly.
    if (!this.ctx || this.ctx.state !== "running" || this.analyserDisabled) return;
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
