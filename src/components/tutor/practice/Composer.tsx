"use client";

import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent, type PointerEvent } from "react";
import { Check, Keyboard, Mic, Send, Sparkles } from "lucide-react";
import { CONFIDENCE_LEVELS, type ConfidenceLevel } from "@/lib/tutor/board";
import { MAX_RECORDING_MS } from "@/lib/tutor/recording";
import type { ActiveChoice, DynamicQuickAction } from "@/lib/tutor/turn-interaction";
import styles from "./practice.module.css";

// Sticky bottom dynamic action dock: adapts automatically to the current scene state
// (multiple-choice cards, confidence check, contextual quick chips, and instant voice/text input)
// so learners never need to scroll to respond.

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
  error: string | null;
  soundBlocked: boolean;
  onEnableSound: () => void;
  teacherName: string;
  /** Dynamic turn interaction state */
  activeChoice: ActiveChoice | null;
  showConfidence: boolean;
  confidencePrompt?: string;
  preferTextInput: boolean;
  quickActions: DynamicQuickAction[];
  onChoose: (option: string) => void;
  onConfidence: (level: ConfidenceLevel) => void;
};

const CONFIDENCE_META: Record<ConfidenceLevel, { emoji: string; hint: string }> = {
  Lost: { emoji: "😕", hint: "Simplify" },
  Unsure: { emoji: "🤔", hint: "Example" },
  "Got it": { emoji: "✨", hint: "Move on" },
};

const OPTION_LETTERS = ["A", "B", "C", "D", "E", "F"] as const;

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
    error,
    soundBlocked,
    onEnableSound,
    teacherName,
    activeChoice,
    showConfidence,
    confidencePrompt,
    preferTextInput,
    quickActions,
    onChoose,
    onConfidence,
  } = props;

  const holdRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const spaceDown = useRef(false);
  const [draft, setDraft] = useState("");
  const [showCustomInputForChoice, setShowCustomInputForChoice] = useState(false);

  // Reset custom input toggle whenever a new choice arrives
  useEffect(() => {
    setShowCustomInputForChoice(false);
  }, [activeChoice?.question]);

  // If the teacher specifically asks the learner to type/write a message, switch to text automatically.
  useEffect(() => {
    if (preferTextInput && mode === "voice") {
      onModeChange("text");
    }
  }, [preferTextInput, mode, onModeChange]);

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

  const voiceAllowed = modes.includes("voice") && !micBlocked;
  const textAllowed = modes.includes("text");
  const effectiveMode: InputMode = mode === "voice" && voiceAllowed ? "voice" : "text";
  const seconds = Math.max(0, Math.ceil((MAX_RECORDING_MS - elapsedMs) / 1000));
  const bars = [0.35, 0.65, 1, 0.65, 0.35];

  const showPrimaryInputBar = (!activeChoice && !showConfidence) || showCustomInputForChoice;

  return (
    <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-2">
      {/* Compact status & hint strip */}
      <div className="flex items-center justify-between gap-2 text-xs leading-snug">
        <div aria-live="polite" className="min-w-0 flex-1 truncate text-[var(--ink)]">
          <span className="font-semibold">{status}</span>
          {listenHint?.expect && !activeChoice && (
            <span className="ml-1.5 font-medium text-[var(--accent)]">
              Try “{listenHint.expect}”
            </span>
          )}
          {!listenHint?.expect && listenHint?.hint && !activeChoice && (
            <span className="ml-1.5 text-[var(--ink-dim)]">· {listenHint.hint}</span>
          )}
        </div>
        {lastSaid && (
          <span className="hidden max-w-[40%] shrink-0 truncate text-[11px] text-[var(--ink-dim)] sm:inline">
            You: “{lastSaid}”
          </span>
        )}
      </div>

      {error && (
        <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-3 py-1.5 text-xs text-red-700">
          {error}
        </p>
      )}

      {soundBlocked && (
        <button
          type="button"
          onClick={onEnableSound}
          className="rounded-xl border border-[var(--line-strong)] bg-[var(--soft-hover)] px-3 py-1.5 text-left text-xs font-semibold text-[var(--ink)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus)]"
        >
          Sound is blocked by your browser — tap here to hear {teacherName}.
        </button>
      )}

      {/* 1. Dynamic Choice Options (from ask_choice OR smart-inferred from board/prompt) */}
      {activeChoice && (
        <div className="grid gap-1.5">
          <div className="flex items-center justify-between gap-2">
            <p className="inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider text-[#fd5523]">
              <Sparkles className="h-3 w-3" aria-hidden="true" />
              {activeChoice.question}
            </p>
            <button
              type="button"
              onClick={() => setShowCustomInputForChoice((v) => !v)}
              className="text-[11px] font-semibold text-[var(--ink-dim)] underline-offset-2 hover:text-[var(--ink)] hover:underline"
            >
              {showCustomInputForChoice ? "Hide reply box" : "Type or speak instead"}
            </button>
          </div>
          <div
            role="group"
            aria-label={activeChoice.question}
            className="grid max-h-[30dvh] gap-1.5 overflow-y-auto sm:grid-cols-2"
          >
            {activeChoice.options.map((option, idx) => {
              const picked = activeChoice.picked === option;
              const letter = OPTION_LETTERS[idx] ?? String(idx + 1);
              return (
                <button
                  key={`${letter}-${option}`}
                  type="button"
                  disabled={!canType || activeChoice.picked !== undefined}
                  aria-pressed={picked}
                  onClick={() => onChoose(option)}
                  className={`flex min-h-10 items-center gap-2.5 rounded-xl border px-3 py-2 text-left text-xs font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus)] disabled:cursor-not-allowed sm:text-[13px] ${
                    picked
                      ? "border-[#0f766e] bg-[#ecfdf5] text-[#064e3b] shadow-xs"
                      : "border-[var(--line-strong)] bg-white text-[var(--ink)] hover:border-[#fd5523]/60 hover:bg-[#fff6ee] disabled:opacity-55"
                  }`}
                >
                  <span
                    className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-extrabold ${
                      picked
                        ? "bg-[#0f766e] text-white"
                        : "bg-[#fff2e9] text-[#fd5523]"
                    }`}
                  >
                    {picked ? <Check className="h-3 w-3" /> : letter}
                  </span>
                  <span className="line-clamp-2 leading-snug">{option}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* 2. Dynamic Confidence Check */}
      {showConfidence && (
        <div className="grid gap-1.5">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-bold text-[var(--ink)]">
              {confidencePrompt ?? "How confident do you feel?"}
            </p>
            <button
              type="button"
              onClick={() => setShowCustomInputForChoice((v) => !v)}
              className="text-[11px] font-semibold text-[var(--ink-dim)] hover:text-[var(--ink)] hover:underline"
            >
              {showCustomInputForChoice ? "Hide reply box" : "Type instead"}
            </button>
          </div>
          <div role="group" aria-label="How sure do you feel?" className="grid grid-cols-3 gap-1.5">
            {CONFIDENCE_LEVELS.map((lvl) => {
              const meta = CONFIDENCE_META[lvl];
              return (
                <button
                  key={lvl}
                  type="button"
                  disabled={!canType}
                  onClick={() => onConfidence(lvl)}
                  className="flex flex-col items-center justify-center rounded-xl border border-[var(--line-strong)] bg-white px-2 py-2 text-center transition hover:border-[#fd5523]/60 hover:bg-[#fff6ee] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--focus)] disabled:opacity-55"
                >
                  <span className="text-base leading-none" aria-hidden="true">
                    {meta.emoji}
                  </span>
                  <span className="mt-1 text-xs font-bold text-[var(--ink)]">{lvl}</span>
                  <span className="text-[10px] text-[var(--ink-dim)]">{meta.hint}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* 3. Dynamic Contextual Quick Actions (single-row scroll on mobile, never needs page scroll) */}
      {!activeChoice && !showConfidence && (
        <div
          className="flex flex-nowrap items-center gap-1.5 overflow-x-auto pb-0.5 [scrollbar-width:none] sm:flex-wrap sm:overflow-visible"
          aria-label="Quick teacher actions"
        >
          {quickActions.map((q) => (
            <button
              key={q.label}
              type="button"
              disabled={!canType}
              onClick={() => onSendText(q.text)}
              className={`shrink-0 whitespace-nowrap rounded-full border px-3 py-1.5 text-xs font-semibold shadow-xs transition disabled:opacity-45 ${
                q.primary
                  ? "border-[#fd5523]/40 bg-[#fff2e9] text-[#c83a10] hover:bg-[#ffe5d4]"
                  : "border-[var(--line-strong)] bg-white/95 text-[var(--ink)] hover:border-[#fd5523]/50 hover:bg-[#fff6ee] hover:text-[#fd5523]"
              }`}
            >
              {q.label}
            </button>
          ))}
        </div>
      )}

      {/* 4. Unified Primary Input Bar (Hold-to-Talk + 1-tap Keyboard, or Text Input + 1-tap Mic) */}
      {showPrimaryInputBar && (
        effectiveMode === "voice" ? (
          <div className="flex items-center gap-2">
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
              className={`${styles.holdButton} ${styles.primaryButton} flex h-11 min-w-0 flex-1 items-center justify-center gap-2.5 rounded-full px-4 text-sm font-bold shadow-[0_10px_24px_rgba(253,85,35,0.26)] transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus)] disabled:opacity-50 data-[active=true]:bg-[#ff7a8a] data-[active=true]:text-[#2a0b10] sm:h-12 sm:text-[15px]`}
            >
              <span className={`${styles.micDot} inline-block h-5 w-5 flex-none rounded-full sm:h-6 sm:w-6`} aria-hidden="true" />
              <span className="flex h-5 items-center gap-0.5 sm:gap-1" aria-hidden="true">
                {bars.map((base, i) => (
                  <i
                    key={i}
                    className="block w-1 rounded-full bg-current transition-[height] duration-100"
                    style={{ height: recording ? `${Math.max(4, Math.round(20 * base * Math.max(0.15, level)))}px` : "4px" }}
                  />
                ))}
              </span>
              <span className="truncate">
                {recording
                  ? `Release to send (${seconds}s)`
                  : canTalk
                    ? "Hold to talk"
                    : "Wait for your turn"}
              </span>
            </button>
            {textAllowed && (
              <button
                type="button"
                onClick={() => {
                  onModeChange("text");
                  setTimeout(() => inputRef.current?.focus(), 40);
                }}
                title="Switch to typing"
                aria-label="Switch to typing"
                className="flex h-11 shrink-0 items-center gap-1.5 rounded-full border border-[var(--line-strong)] bg-white px-3.5 text-xs font-bold text-[var(--ink)] shadow-xs transition hover:bg-[var(--soft-hover)] sm:h-12"
              >
                <Keyboard className="h-4 w-4 text-[#fd5523]" aria-hidden="true" />
                <span className="hidden sm:inline">Type</span>
              </button>
            )}
          </div>
        ) : (
          <form onSubmit={submit} className="flex w-full min-w-0 items-center gap-1.5 sm:gap-2">
            {voiceAllowed && (
              <button
                type="button"
                onClick={() => onModeChange("voice")}
                title="Switch to voice"
                aria-label="Switch to voice"
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-[var(--line-strong)] bg-white text-[var(--ink)] shadow-xs transition hover:border-[#fd5523]/50 hover:bg-[#fff6ee] hover:text-[#fd5523]"
              >
                <Mic className="h-4 w-4" aria-hidden="true" />
              </button>
            )}
            <label htmlFor="tutor-text-input" className="sr-only">
              Your reply
            </label>
            <input
              ref={inputRef}
              id="tutor-text-input"
              type="text"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={onInputKey}
              maxLength={1000}
              disabled={!canType}
              autoComplete="off"
              placeholder={canType ? "Type your reply..." : "Wait for the teacher..."}
              className="h-11 w-full min-w-0 flex-1 rounded-full border border-[var(--line-strong)] bg-white px-4 text-sm text-[var(--ink)] placeholder:text-[var(--ink-faint)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus)] disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={!canType || draft.trim().length === 0}
              aria-label="Send reply"
              className={`${styles.primaryButton} flex h-11 shrink-0 items-center gap-1.5 rounded-full px-4 text-xs font-bold shadow-xs focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus)] disabled:opacity-45 sm:px-5 sm:text-sm`}
            >
              <Send className="h-3.5 w-3.5" aria-hidden="true" />
              <span className="hidden sm:inline">Send</span>
            </button>
          </form>
        )
      )}
    </div>
  );
}
