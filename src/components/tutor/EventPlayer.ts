import type { AvatarDriver, AvatarEvent } from "@/components/tutor/avatar/types";
import type { TutorEvent } from "@/lib/tutor/events";
import { cardWaitMs, scheduleVisemes, toneTimeoutMs } from "@/lib/tutor/event-timing";
import { visemeTimelineFromText } from "@/lib/tutor/visemes";

// Plays a turn of TutorEvents in order against an AvatarDriver and the UI callbacks. It never
// knows which mode (Live, Voice, Text) produced the events. Stop it with stop(); it leaves no timers.

export type CardItem = Extract<TutorEvent, { type: "show_card" }>["item"];
export type BoardEvent = Extract<TutorEvent, { type: "show_board" }>;
export type ClipEvent = Extract<TutorEvent, { type: "play_clip" }>;
export type LessonRefEvent = Extract<TutorEvent, { type: "show_lesson_ref" }>;
export type EvidenceEvent = Extract<TutorEvent, { type: "note_evidence" }>;

export interface PlayerUI {
  onCaption(text: string, romanization?: string, translation?: string): void;
  onCard(item: CardItem): void;
  onText(text: string, highlight?: string[]): void;
  onListen(expect?: string, hint?: string): void;
  onMistake(m: { said: string; correct: string; category: string }): void;
  onEnd(summary?: string): void;
  /** advance_scene (v1) and advance_step (v2). */
  onAdvance?(step: string): void;
  // v2 teaching events. Optional, so older hosts (Avatar Lab, showcase) keep working.
  onBoard?(board: BoardEvent): void;
  /** Reveal up to `index`, or the next item when undefined. */
  onReveal?(index?: number): void;
  onChoice?(question: string, options: string[]): void;
  onConfidence?(prompt?: string): void;
  onLessonRef?(ref: LessonRefEvent): void;
  onClip?(clip: ClipEvent): void;
  onEvidence?(evidence: EvidenceEvent): void;
  onScene?(scene: string): void;
  onAward?(title: string, detail?: string): void;
}

export type SaySpeechEvent = Extract<TutorEvent, { type: "say" }>;

/**
 * Plays a `say` line's audio and drives the mouth while it plays. Resolves "played" when the audio
 * finished, "stopped" when `signal` aborted, and "unavailable" when it could not start (for example
 * autoplay was blocked), in which case the player falls back to the text timeline.
 */
export type SpeakHook = (
  event: SaySpeechEvent,
  avatar: AvatarDriver,
  signal: AbortSignal,
) => Promise<SpeakOutcome>;

export type SpeakOutcome = "played" | "stopped" | "unavailable";

export interface EventPlayerOptions {
  avatar: AvatarDriver;
  ui: PlayerUI;
  /** Called before each event is played, for logs and debugging. */
  onEventStart?: (event: TutorEvent) => void;
  /** Real audio for `say` events that carry audioUrl. Without it, every line uses the text timeline. */
  speak?: SpeakHook;
}

type Pending = {
  timer: ReturnType<typeof setTimeout>;
  done: (ok: boolean) => void;
  match?: (e: AvatarEvent) => boolean;
};

export class EventPlayer {
  private readonly avatar: AvatarDriver;
  private readonly ui: PlayerUI;
  private readonly onEventStart?: (event: TutorEvent) => void;
  private readonly speak?: SpeakHook;
  private speechAbort: AbortController | null = null;
  private token = 0;
  private pending = new Set<Pending>();
  private prev: TutorEvent | undefined;
  private pointPeakSeen = false;
  private pointStartedAt = 0;

  constructor(opts: EventPlayerOptions) {
    this.avatar = opts.avatar;
    this.ui = opts.ui;
    this.onEventStart = opts.onEventStart;
    this.speak = opts.speak;
  }

  /** Plays events in order. Resolves when the turn ends, is stopped, or hits end_session. */
  async play(events: readonly TutorEvent[]): Promise<void> {
    const token = ++this.token;
    const alive = () => token === this.token;
    this.prev = undefined;
    for (const ev of events) {
      if (!alive()) return;
      this.onEventStart?.(ev);
      const keepGoing = await this.step(ev, alive);
      this.prev = ev;
      if (!keepGoing || !alive()) return;
    }
  }

  /** Cancels the running turn. Pending waits resolve as cancelled and timers are cleared. */
  stop(): void {
    this.token++;
    this.speechAbort?.abort();
    this.speechAbort = null;
    for (const entry of [...this.pending]) this.settle(entry, false);
    this.avatar.setSpeaking(false);
    this.avatar.setListening(false);
    this.avatar.setViseme(0);
    this.avatar.lookAt(0, 0);
  }

  /** Feed avatar lifecycle events in (wire this to AvatarProps.onEvent). */
  notify(e: AvatarEvent): void {
    if (e.type === "gesturePeak" && e.gesture === "point_card") this.pointPeakSeen = true;
    for (const entry of [...this.pending]) {
      if (entry.match && entry.match(e)) this.settle(entry, true);
    }
  }

  private settle(entry: Pending, ok: boolean): void {
    clearTimeout(entry.timer);
    this.pending.delete(entry);
    entry.done(ok);
  }

  /** Resolves true after `ms`, or false if stopped first. */
  private sleep(ms: number): Promise<boolean> {
    return new Promise((resolve) => {
      const entry: Pending = {
        timer: setTimeout(() => this.settle(entry, true), Math.max(0, ms)),
        done: resolve,
      };
      this.pending.add(entry);
    });
  }

  /** Resolves true when a matching avatar event arrives, false on timeout or stop. */
  private waitEvent(match: (e: AvatarEvent) => boolean, timeoutMs: number): Promise<boolean> {
    return new Promise((resolve) => {
      const entry: Pending = {
        timer: setTimeout(() => this.settle(entry, false), Math.max(0, timeoutMs)),
        done: resolve,
        match,
      };
      this.pending.add(entry);
    });
  }

  private async step(ev: TutorEvent, alive: () => boolean): Promise<boolean> {
    switch (ev.type) {
      case "say":
        return this.say(ev, alive);

      case "gesture":
        if (ev.name === "point_card") {
          this.pointPeakSeen = false;
          this.pointStartedAt = Date.now();
        }
        this.avatar.playGesture(ev.name, { toneShape: ev.toneShape, countTo: ev.countTo });
        return true;

      case "mood":
        this.avatar.setMood(ev.mood, ev.intensity);
        return true;

      case "show_card": {
        // Glance toward the flashcard on the left as the finger reaches it.
        this.avatar.lookAt(-0.52, -0.06);
        // Let the finger reach the card before it appears, but never wait longer than the cap.
        const maxWait = cardWaitMs({
          previousIsPointCard: this.prev?.type === "gesture" && this.prev.name === "point_card",
          peakSeen: this.pointPeakSeen,
          elapsedMs: Date.now() - this.pointStartedAt,
        });
        if (maxWait > 0) {
          await this.waitEvent((e) => e.type === "gesturePeak" && e.gesture === "point_card", maxWait);
        }
        if (!alive()) return false;
        this.ui.onCard(ev.item);
        return true;
      }

      case "show_text":
        this.avatar.lookAt(0.45, -0.15);
        this.ui.onText(ev.text, ev.highlight);
        return true;

      case "trace_tone": {
        this.avatar.lookAt(0, 0);
        for (const tone of ev.tones) {
          if (!alive()) return false;
          this.avatar.playGesture("trace_tone", { toneShape: tone });
          await this.waitEvent((e) => e.type === "traceEnd" && e.toneShape === tone, toneTimeoutMs(tone));
        }
        return alive();
      }

      case "listen":
        this.avatar.lookAt(0, 0);
        this.avatar.setListening(true);
        this.ui.onListen(ev.expect, ev.hint);
        return true;

      case "note_mistake":
        this.ui.onMistake({ said: ev.said, correct: ev.correct, category: ev.category });
        return true;

      case "advance_scene":
        this.ui.onAdvance?.(ev.beat);
        return true;

      case "advance_step":
        this.ui.onAdvance?.(ev.step);
        return true;

      case "show_board":
        // Glance naturally toward the Teaching Board beside the stage.
        this.avatar.lookAt(0.55, 0.08);
        this.ui.onBoard?.(ev);
        return true;

      case "reveal_step":
        this.avatar.lookAt(0.55, 0.08);
        this.ui.onReveal?.(ev.index);
        return true;

      case "ask_choice":
        this.avatar.lookAt(0, 0);
        this.avatar.setListening(true);
        this.ui.onChoice?.(ev.question, ev.options);
        return true;

      case "ask_confidence":
        this.avatar.lookAt(0, 0);
        this.avatar.setListening(true);
        this.ui.onConfidence?.(ev.prompt);
        return true;

      case "show_lesson_ref":
        this.ui.onLessonRef?.(ev);
        return true;

      case "play_clip":
        this.avatar.lookAt(0.48, 0.05);
        this.ui.onClip?.(ev);
        return true;

      case "note_evidence":
        this.ui.onEvidence?.(ev);
        return true;

      case "switch_scene":
        this.ui.onScene?.(ev.scene);
        return true;

      case "award":
        this.avatar.lookAt(0, -0.08);
        this.avatar.playGesture("celebrate");
        this.ui.onAward?.(ev.title, ev.detail);
        return true;

      case "end_session":
        this.avatar.lookAt(0, 0);
        this.ui.onEnd(ev.summary);
        return false;
    }
  }

  /**
   * Caption, then mouth shapes from text until real audio is wired. Audio playback will replace the
   * timeline; the event shape stays the same.
   */
  private async say(ev: Extract<TutorEvent, { type: "say" }>, alive: () => boolean): Promise<boolean> {
    this.avatar.lookAt(0, 0);
    this.avatar.setListening(false);
    this.avatar.setSpeaking(true);
    this.ui.onCaption(ev.text, ev.romanization, ev.translation);

    // The hook plays the line's audio, or a browser voice when the line has none.
    if (this.speak) {
      const controller = new AbortController();
      this.speechAbort = controller;
      let outcome: SpeakOutcome;
      try {
        outcome = await this.speak(ev, this.avatar, controller.signal);
      } catch {
        outcome = "unavailable";
      } finally {
        if (this.speechAbort === controller) this.speechAbort = null;
      }
      if (!alive() || outcome === "stopped") return false;
      if (outcome === "played") {
        this.avatar.setViseme(0);
        this.avatar.setSpeaking(false);
        return true;
      }
      // "unavailable": fall through to the text timeline below.
    }

    const schedule = scheduleVisemes(visemeTimelineFromText(ev.text));
    const start = Date.now();
    for (const step of schedule.steps) {
      const wait = step.atMs - (Date.now() - start);
      if (wait > 0 && !(await this.sleep(wait))) return false;
      if (!alive()) return false;
      this.avatar.setViseme(step.viseme);
    }
    const remaining = schedule.totalMs - (Date.now() - start);
    if (remaining > 0 && !(await this.sleep(remaining))) return false;
    if (!alive()) return false;
    this.avatar.setViseme(0);
    this.avatar.setSpeaking(false);
    return true;
  }
}
