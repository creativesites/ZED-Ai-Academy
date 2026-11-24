"use client";

import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent, type PointerEvent } from "react";
import { Volume2, VolumeX } from "lucide-react";
import { MAX_RECORDING_MS } from "@/lib/tutor/recording";
import styles from "./practice.module.css";

// Bottom controls: status line, mode switch, hold-to-talk (pointer and Space), text box, end button.
// Everything here is presentational. TutorSession decides what the learner may do right now.

export type InputMode = "voice" | "text";

type ComposerProps = {
  mode: InputMode;
  modes: InputMode[];
  onModeChange: (mode: InputMode) => void;
  status: string;
  canTalk: boolean;
  canType: boolean;
  micBlocked: boolean;
  recording: boolean;
  level: number;
  elapsedMs: number;
  listenHint: { expect?: string; hint?: string } | null;
  lastSaid: string | null;
  onHoldStart: () => void;
  onHoldEnd: () => void;
  onSendText: (text: string) => void;
  onEnd: () => void;
  ending: boolean;
  error: string | null;
  soundBlocked: boolean;
  onEnableSound: () => void;
  muted: boolean;
  onToggleMute: () => void;
  teacherName: string;
  /** Optional 3D / 2D avatar toggle for learners. */
  avatarMode?: "rive" | "three";
  onToggleAvatarMode?: () => void;
};

const QUICK_PROMPTS = [
  { label: "Next step →", text: "Continue to the next step." },
  { label: "Explain simpler", text: "Can you explain that in simpler words?" },
  { label: "Give an example", text: "Can you give me a practical example?" },
  { label: "Quiz me", text: "Ask me a quick multiple-choice question to check my understanding." },
  { label: "Got it!", text: "Got it, I understand!" },
] as const;

const MODE_LABEL: Record<InputMode, string> = { voice: "Voice", text: "Tap / Type" };

export function Composer(props: ComposerProps) {
  const {
    mode,
    modes,
    onModeChange,
    status,
    canTalk,
    canType,
    micBlocked,
    recording,
    level,
    elapsedMs,
    listenHint,
    lastSaid,
    onHoldStart,
    onHoldEnd,
    onSendText,
    onEnd,
    ending,
    error,
    soundBlocked,
    onEnableSound,
    muted,
    onToggleMute,
    teacherName,
    avatarMode,
    onToggleAvatarMode,
  } = props;

  const holdRef = useRef<HTMLButtonElement>(null);
  const spaceDown = useRef(false);
  const [draft, setDraft] = useState("");

  // Space holds to talk when no text field has focus, so keyboard users are not trapped.
  useEffect(() => {
    if (mode !== "voice") return;
    const isEditable = (el: Element | null) =>
      !!el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || (el as HTMLElement).isContentEditable);
    const down = (e: globalThis.KeyboardEvent) => {
      if (e.code !== "Space" || e.repeat || isEditable(document.activeElement)) return;
      if (document.activeElement instanceof HTMLButtonElement && document.activeElement !== holdRef.current) return;
      e.preventDefault();
      if (spaceDown.current) return;
      spaceDown.current = true;
      onHoldStart();
    };
    const up = (e: globalThis.KeyboardEvent) => {
      if (e.code !== "Space" || !spaceDown.current) return;
      e.preventDefault();
      spaceDown.current = false;
      onHoldEnd();
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      if (spaceDown.current) {
        spaceDown.current = false;
        onHoldEnd();
      }
    };
  }, [mode, onHoldStart, onHoldEnd]);

  const onPointerDown = (e: PointerEvent<HTMLButtonElement>) => {
    if (!canTalk) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture?.(e.pointerId);
    onHoldStart();
  };
  const onPointerUp = (e: PointerEvent<HTMLButtonElement>) => {
    if (e.currentTarget.hasPointerCapture?.(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
    onHoldEnd();
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const text = draft.trim();
    if (!text || !canType) return;
    setDraft("");
    onSendText(text);
  };

  const onInputKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Escape") setDraft("");
  };

  const seconds = Math.max(0, Math.ceil((MAX_RECORDING_MS - elapsedMs) / 1000));
  const bars = [0.3, 0.6, 1, 0.6, 0.3];

  return (
    <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-2.5 sm:gap-3">
      <div className="flex min-w-0 flex-wrap items-center justify-between gap-1.5 sm:gap-2">
        <div role="tablist" aria-label="Practice mode" className={`${styles.glass} inline-flex rounded-full p-0.5 sm:p-1`}>
          {modes.map((m) => (
            <button
              key={m}
              type="button"
              role="tab"
              aria-selected={mode === m}
              onClick={() => onModeChange(m)}
              disabled={m === "voice" && micBlocked}
              className={`${mode === m ? styles.accentButton : "text-[var(--ink-dim)]"} rounded-full px-3 py-1 text-xs font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus)] disabled:opacity-50 sm:px-3.5 sm:py-1.5 sm:text-[13px]`}
            >
              {MODE_LABEL[m]}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1.5 sm:gap-2">
          {onToggleAvatarMode && avatarMode && (
            <button
              type="button"
              onClick={onToggleAvatarMode}
              title="Switch between 3D WebGL and 2D Rive teacher"
              className="rounded-full border border-[var(--line-strong)] bg-[var(--soft)] px-2.5 py-1 text-[11px] font-bold text-[var(--ink)] hover:bg-[var(--soft-hover)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus)] sm:px-3 sm:py-1.5 sm:text-xs"
            >
              {avatarMode === "three" ? "3D On" : "3D"}
            </button>
          )}
          <button
            type="button"
            onClick={onToggleMute}
            aria-pressed={muted}
            aria-label={muted ? `Turn ${teacherName}'s voice on` : `Mute ${teacherName}`}
            className="inline-flex items-center gap-1 rounded-full border border-[var(--line-strong)] bg-[var(--soft)] px-2.5 py-1 text-xs font-semibold text-[var(--ink)] hover:bg-[var(--soft-hover)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus)] sm:gap-1.5 sm:px-3 sm:py-1.5 sm:text-[13px]"
          >
            {muted ? <VolumeX className="h-3.5 w-3.5 sm:h-4 sm:w-4" aria-hidden="true" /> : <Volume2 className="h-3.5 w-3.5 sm:h-4 sm:w-4" aria-hidden="true" />}
            <span className="hidden sm:inline">{muted ? "Sound off" : "Sound on"}</span>
          </button>
          <button
            type="button"
            onClick={onEnd}
            disabled={ending}
            className="rounded-full border border-[var(--line-strong)] bg-[var(--soft)] px-3 py-1 text-xs font-semibold text-[var(--ink)] hover:bg-[var(--soft-hover)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus)] disabled:opacity-50 sm:px-4 sm:py-1.5 sm:text-[13px]"
          >
            {ending ? "Ending..." : "End"}
          </button>
        </div>
      </div>

      <div aria-live="polite" className="min-h-[1.25rem] text-xs leading-snug text-[var(--ink)] sm:text-sm">
        <span className="font-semibold">{status}</span>
        {listenHint && (
          <span className="ml-1.5 text-[var(--accent)]">
            {listenHint.expect ? `Try “${listenHint.expect}”` : null}
            {listenHint.expect && listenHint.hint ? " · " : null}
            {listenHint.hint ?? null}
          </span>
        )}
        {lastSaid && <span className="block text-[11px] text-[var(--ink-dim)] sm:text-xs">You said: “{lastSaid}”</span>}
      </div>

      {error && (
        <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 sm:text-sm">
          {error}
        </p>
      )}

      {soundBlocked && (
        <button
          type="button"
          onClick={onEnableSound}
          className="rounded-xl border border-[var(--line-strong)] bg-[var(--soft-hover)] px-3 py-2 text-left text-xs text-[var(--ink)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus)] sm:text-sm"
        >
          Sound is blocked. Tap to hear {teacherName}.
        </button>
      )}

      {/* Dynamic one-tap walkthrough & coaching chips — single scrollable row on mobile */}
      <div
        className="flex flex-nowrap items-center gap-1.5 overflow-x-auto pb-0.5 [scrollbar-width:none] sm:flex-wrap sm:overflow-visible"
        aria-label="Quick teacher actions"
      >
        {QUICK_PROMPTS.map((q) => (
          <button
            key={q.label}
            type="button"
            disabled={!canType}
            onClick={() => onSendText(q.text)}
            className="shrink-0 whitespace-nowrap rounded-full border border-[var(--line-strong)] bg-white/90 px-2.5 py-1 text-[11px] font-semibold text-[var(--ink)] shadow-xs transition hover:border-[#fd5523]/50 hover:bg-[#fff6ee] hover:text-[#fd5523] disabled:opacity-45 sm:px-3 sm:py-1.5 sm:text-xs"
          >
            {q.label}
          </button>
        ))}
      </div>

      {mode === "voice" ? (
        <div className="grid justify-items-center gap-1.5 sm:gap-2">
          <button
            ref={holdRef}
            type="button"
            data-active={recording}
            aria-pressed={recording}
            aria-keyshortcuts="Space"
            disabled={!canTalk && !recording}
            onPointerDown={onPointerDown}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
            onLostPointerCapture={() => recording && onHoldEnd()}
            onContextMenu={(e) => e.preventDefault()}
            className={`${styles.holdButton} ${styles.primaryButton} flex w-full max-w-[420px] items-center justify-center gap-2.5 rounded-full px-4 py-3 text-sm font-bold shadow-[0_12px_26px_rgba(253,85,35,0.26)] transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus)] disabled:opacity-50 data-[active=true]:bg-[#ff7a8a] data-[active=true]:text-[#2a0b10] sm:gap-3 sm:px-5 sm:py-3.5 sm:text-base`}
          >
            <span className={`${styles.micDot} inline-block h-6 w-6 flex-none rounded-full sm:h-7 sm:w-7`} aria-hidden="true" />
            <span className="flex h-6 items-center gap-1 sm:h-7" aria-hidden="true">
              {bars.map((base, i) => (
                <i
                  key={i}
                  className="block w-1 rounded-full bg-current transition-[height] duration-100"
                  style={{ height: recording ? `${Math.max(5, Math.round(22 * base * Math.max(0.15, level)))}px` : "5px" }}
                />
              ))}
            </span>
            <span className="truncate">
              {micBlocked
                ? "Microphone blocked"
                : recording
                  ? `Release to send (${seconds}s)`
                  : canTalk
                    ? "Hold to talk"
                    : "Wait for your turn"}
            </span>
          </button>
          <p className="text-[11px] text-[var(--ink-dim)]">Hold to talk or press Space (up to 30s).</p>
        </div>
      ) : (
        <form onSubmit={submit} className="flex w-full min-w-0 items-center gap-1.5 sm:gap-2">
          <label htmlFor="tutor-text-input" className="sr-only">
            Your reply
          </label>
          <input
            id="tutor-text-input"
            type="text"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={onInputKey}
            maxLength={1000}
            disabled={!canType}
            autoComplete="off"
            placeholder={canType ? "Type your reply" : "Wait for the teacher"}
            className={`${styles.glass} w-full min-w-0 flex-1 rounded-xl px-3 py-2 text-sm text-[var(--ink)] placeholder:text-[var(--ink-faint)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus)] disabled:opacity-50 sm:rounded-2xl sm:px-4 sm:py-3 sm:text-[15px]`}
          />
          <button
            type="submit"
            disabled={!canType || draft.trim().length === 0}
            className={`${styles.primaryButton} shrink-0 rounded-xl px-4 py-2 text-xs font-bold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus)] disabled:opacity-50 sm:rounded-2xl sm:px-5 sm:py-3 sm:text-sm`}
          >
            Send
          </button>
        </form>
      )}
    </div>
  );
}
