// Plays the teacher's `say` audio and drives the avatar's mouth from it. Browser only; the pure
// pieces (viseme mapping, timing, voice choice) live in src/lib/tutor. One instance is shared by a
// session. Lines with no audio (the scripted demo before its voice is cached, or a failed TTS call)
// are read by the browser's own speech synthesis, so the teacher is never silent.

import type { AvatarDriver } from "@/components/tutor/avatar/types";
import type { SaySpeechEvent, SpeakOutcome } from "@/components/tutor/EventPlayer";
import { visemeFromSpectrum } from "@/lib/tutor/visemes";
import type { VisemeValue } from "@/lib/tutor/contract.generated";
import { secondsToMs } from "@/lib/tutor/speaking-time";
import { pickVoice, speechLangFor } from "@/lib/tutor/speech-lang";

/** How often the mouth is updated from the audio (about 40 Hz, inside the 30-60 Hz target). */
const VISEME_INTERVAL_MS = 25;
/** Without WebAudio there is no spectrum. The mouth cycles open and closed instead. */
const FALLBACK_CYCLE: readonly VisemeValue[] = [1, 0, 2, 0, 4, 0];
const FALLBACK_STEP_MS = 110;
/** Browser speech can fail to fire `end`. Give up after the line's rough length plus this margin. */
const SYNTH_WATCHDOG_MARGIN_MS = 4000;
const SYNTH_MS_PER_CHAR = 120;
/** Audio that has not started by now (a slow first TTS render) gives way to the browser voice. */
const AUDIO_START_TIMEOUT_MS = 8000;

type AudioContextCtor = typeof AudioContext;

export class TeacherAudio {
  private ctx: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private element: HTMLAudioElement | null = null;
  private sourceNode: MediaElementAudioSourceNode | null = null;
  private playedMs = 0;
  private blockedListeners = new Set<(blocked: boolean) => void>();
  private blocked = false;
  private muted = false;
  private language: string | null = null;
  private synthPrimed = false;

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
      this.primeSynthesis();
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

  /** The session's target language ("zh", "es", "fr" or "en"). Used to pick the browser voice. */
  setLanguage(language: string | null | undefined): void {
    this.language = language ?? null;
  }

  isMuted(): boolean {
    return this.muted;
  }

  /** Mute stops the current line. Muted lines fall back to captions with a moving mouth. */
  setMuted(next: boolean): void {
    this.muted = next;
    if (next) this.stopPlayback();
  }

  /** Stops anything playing. The EventPlayer also aborts the running line through its signal. */
  stopPlayback(): void {
    this.element?.pause();
    if (typeof window !== "undefined" && window.speechSynthesis) window.speechSynthesis.cancel();
  }

  /**
   * The SpeakHook for EventPlayer. Resolves when the line ends, is aborted, or cannot start. Plays
   * the line's audio when it has some, and falls back to the browser voice when it has none or the
   * audio fails to load.
   */
  readonly speak = async (event: SaySpeechEvent, avatar: AvatarDriver, signal: AbortSignal): Promise<SpeakOutcome> => {
    if (this.muted) return "unavailable";
    if (signal.aborted) return "stopped";
    if (event.audioUrl) {
      const outcome = await this.playAudio(event.audioUrl, avatar, signal);
      // Blocked by autoplay: the browser voice would be blocked too. The UI shows "tap to hear".
      if (outcome !== "unavailable" || this.blocked) return outcome;
    }
    return this.synthesize(event.text, avatar, signal);
  };

  private playAudio(url: string, avatar: AvatarDriver, signal: AbortSignal): Promise<SpeakOutcome> {
    const el = this.ensureElement();
    if (!el) return Promise.resolve("unavailable");

    return new Promise<SpeakOutcome>((resolve) => {
      let started = false;
      let settled = false;
      let prevViseme: VisemeValue | undefined;
      let tick = 0;

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

      const startTimer = setTimeout(() => {
        if (!started) finish("unavailable");
      }, AUDIO_START_TIMEOUT_MS);

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
  }

  /** Reads the line with the browser's speech synthesis. "unavailable" when the browser has none. */
  private synthesize(text: string, avatar: AvatarDriver, signal: AbortSignal): Promise<SpeakOutcome> {
    const synth = typeof window !== "undefined" ? window.speechSynthesis : undefined;
    if (!synth || typeof SpeechSynthesisUtterance === "undefined") return Promise.resolve("unavailable");

    const lang = speechLangFor(text, this.language);
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = lang;
    const voice = pickVoice(synth.getVoices(), lang);
    try {
      if (voice) utterance.voice = voice;
    } catch {
      // Some browsers reject a voice from an older list. utterance.lang still picks one.
    }
    // A touch slower than default: learners are listening to a new language.
    utterance.rate = lang === "en-GB" ? 1 : 0.9;

    return new Promise<SpeakOutcome>((resolve) => {
      let settled = false;
      let started = false;
      let tick = 0;
      const startedAt = performance.now();

      const finish = (outcome: SpeakOutcome) => {
        if (settled) return;
        settled = true;
        clearInterval(intervalId);
        clearTimeout(watchdog);
        signal.removeEventListener("abort", onAbort);
        utterance.onstart = null;
        utterance.onend = null;
        utterance.onerror = null;
        if (outcome === "stopped") synth.cancel();
        if (started) this.playedMs += Math.round(performance.now() - startedAt);
        resolve(outcome);
      };
      const onAbort = () => finish("stopped");

      utterance.onstart = () => {
        started = true;
      };
      utterance.onend = () => finish("played");
      utterance.onerror = (e) => {
        if (e.error === "not-allowed") this.setBlocked(true);
        // "interrupted" and "canceled" come from our own cancel(): the line was stopped.
        finish(e.error === "interrupted" || e.error === "canceled" ? "stopped" : started ? "played" : "unavailable");
      };
      signal.addEventListener("abort", onAbort);

      // No audio stream to analyse, so the mouth cycles open and closed while the voice speaks.
      const intervalId = setInterval(() => {
        if (!started) return;
        tick++;
        const idx = Math.floor((tick * VISEME_INTERVAL_MS) / FALLBACK_STEP_MS) % FALLBACK_CYCLE.length;
        avatar.setViseme(FALLBACK_CYCLE[idx]);
      }, VISEME_INTERVAL_MS);
      const watchdog = setTimeout(
        () => finish(started ? "played" : "unavailable"),
        text.length * SYNTH_MS_PER_CHAR + SYNTH_WATCHDOG_MARGIN_MS,
      );

      // Chrome can leave the queue paused after a tab switch; resume before speaking.
      synth.cancel();
      synth.resume();
      synth.speak(utterance);
    });
  }

  /**
   * iOS Safari only allows speech that starts inside a user gesture. Speaking a silent, empty line
   * during the Start tap unlocks it for the rest of the session. Also starts loading the voice list.
   */
  private primeSynthesis(): void {
    const synth = typeof window !== "undefined" ? window.speechSynthesis : undefined;
    if (!synth || this.synthPrimed || typeof SpeechSynthesisUtterance === "undefined") return;
    this.synthPrimed = true;
    synth.getVoices();
    const silent = new SpeechSynthesisUtterance(" ");
    silent.volume = 0;
    synth.speak(silent);
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
    if (!this.ctx || this.ctx.state !== "running") return;
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
