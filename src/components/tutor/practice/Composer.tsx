"use client";

import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent, type PointerEvent } from "react";
import { Camera, Check, ClipboardPaste, Keyboard, ListOrdered, Mic, MicOff, Pause, Play, Radio, RotateCcw, Send, Sparkles, Volume2, X } from "lucide-react";
import { CONFIDENCE_LEVELS, type ConfidenceLevel } from "@/lib/tutor/board";
import { MAX_IMAGE_BYTES, MAX_RECORDING_MS } from "@/lib/tutor/recording";
import type { ResponseMatchResult } from "@/lib/tutor/response-match";
import type {
  ActiveChoice,
  ActiveFillBlank,
  ActiveOrderChallenge,
  DynamicQuickAction,
} from "@/lib/tutor/turn-interaction";
import styles from "./practice.module.css";

// Sticky bottom dynamic action dock: adapts automatically to the current scene state
// (multiple-choice cards, tap-to-order sequence builder, fill-in-the-blank, confidence check,
// target-vs-response match feedback, contextual quick chips, Hold-to-Talk, Hands-Free VAD, and instant text)
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
  responseMatch?: ResponseMatchResult | null;
  onHoldStart: () => void;
  onHoldEnd: () => void;
  onSendText: (text: string) => void;
  /** Optional multimodal photo/screenshot work-checking upload handler. */
  onSendImage?: (file: File, caption?: string) => void;
  error: string | null;
  soundBlocked: boolean;
  onEnableSound: () => void;
  teacherName: string;
  /** Hands-Free auto-VAD voice mode */
  handsFree?: boolean;
  handsFreeListening?: boolean;
  handsFreeSpeechDetected?: boolean;
  onToggleHandsFree?: () => void;
  onCommitHandsFreeNow?: () => void;
  /** Bidirectional Gemini Live real-time audio mode */
  liveActive?: boolean;
  liveMicOn?: boolean;
  onToggleLiveMic?: () => void;
  /** Side-by-side learner recording playback ("Hear yourself vs. teacher") */
  lastLearnerAudioUrl?: string | null;
  canReplayTeacher?: boolean;
  onReplayTeacher?: () => void;
  /** Dynamic turn interaction state */
  activeChoice: ActiveChoice | null;
  activeOrderChallenge: ActiveOrderChallenge | null;
  activeFillBlank: ActiveFillBlank | null;
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
    responseMatch,
    onHoldStart,
    onHoldEnd,
    onSendText,
    onSendImage,
    error,
    soundBlocked,
    onEnableSound,
    teacherName,
    handsFree = false,
    handsFreeListening = false,
    handsFreeSpeechDetected = false,
    onToggleHandsFree,
    onCommitHandsFreeNow,
    liveActive = false,
    liveMicOn = false,
    onToggleLiveMic,
    lastLearnerAudioUrl = null,
    canReplayTeacher = false,
    onReplayTeacher,
    activeChoice,
    activeOrderChallenge,
    activeFillBlank,
    showConfidence,
    confidencePrompt,
    preferTextInput,
    quickActions,
    onChoose,
    onConfidence,
  } = props;

  const holdRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const learnerAudioRef = useRef<HTMLAudioElement | null>(null);
  const spaceDown = useRef(false);
  const [draft, setDraft] = useState("");
  const [playingSelf, setPlayingSelf] = useState(false);
  const [pasteWorkOpen, setPasteWorkOpen] = useState(false);
  const [pasteDraft, setPasteDraft] = useState("");
  const [pendingImage, setPendingImage] = useState<{ file: File; previewUrl: string } | null>(null);
  const [imageCaption, setImageCaption] = useState("");
  const [imageError, setImageError] = useState<string | null>(null);
  const [showCustomInputForChallenge, setShowCustomInputForChallenge] = useState(false);

  useEffect(() => {
    return () => {
      if (pendingImage) URL.revokeObjectURL(pendingImage.previewUrl);
    };
  }, [pendingImage]);

  const handleImagePick = (file: File | null | undefined) => {
    setImageError(null);
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setImageError("Please choose a JPG, PNG, or WebP photo/screenshot.");
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      setImageError("Image is over 3 MB. Try a cropped screenshot or smaller photo.");
      return;
    }
    if (pendingImage) URL.revokeObjectURL(pendingImage.previewUrl);
    setPendingImage({ file, previewUrl: URL.createObjectURL(file) });
  };

  const clearPendingImage = () => {
    if (pendingImage) URL.revokeObjectURL(pendingImage.previewUrl);
    setPendingImage(null);
    setImageCaption("");
    setImageError(null);
    if (imageInputRef.current) imageInputRef.current.value = "";
  };

  useEffect(() => {
    return () => {
      learnerAudioRef.current?.pause();
      learnerAudioRef.current = null;
    };
  }, []);

  const playSelfRecording = () => {
    if (!lastLearnerAudioUrl) return;
    if (playingSelf && learnerAudioRef.current) {
      learnerAudioRef.current.pause();
      setPlayingSelf(false);
      return;
    }
    if (!learnerAudioRef.current) learnerAudioRef.current = new Audio();
    const el = learnerAudioRef.current;
    el.src = lastLearnerAudioUrl;
    el.onended = () => setPlayingSelf(false);
    el.onerror = () => setPlayingSelf(false);
    setPlayingSelf(true);
    void el.play().catch(() => setPlayingSelf(false));
  };

  // Tap-to-order tile builder state
  const [orderedIndices, setOrderedIndices] = useState<number[]>([]);
  const orderKey = activeOrderChallenge?.items.join("|") ?? "";
  useEffect(() => {
    setOrderedIndices([]);
  }, [orderKey]);

  // Reset custom input toggle whenever a new structured challenge arrives
  useEffect(() => {
    setShowCustomInputForChallenge(false);
  }, [activeChoice?.question, orderKey, activeFillBlank?.template]);

  // If the teacher specifically asks the learner to type/write a message, switch to text automatically.
  useEffect(() => {
    if (preferTextInput && mode === "voice" && !handsFree) {
      onModeChange("text");
    }
  }, [preferTextInput, mode, handsFree, onModeChange]);

  // Space holds to talk when no text field has focus, so keyboard users are not trapped.
  useEffect(() => {
    if (mode !== "voice" || handsFree) return;
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
  }, [mode, handsFree, onHoldStart, onHoldEnd]);

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

  const toggleOrderTile = (idx: number) => {
    if (!canType) return;
    setOrderedIndices((prev) =>
      prev.includes(idx) ? prev.filter((i) => i !== idx) : [...prev, idx],
    );
  };

  const submitOrder = () => {
    if (!activeOrderChallenge || !canType || orderedIndices.length === 0) return;
    const sequence = orderedIndices
      .map((idx, pos) => `${pos + 1}. ${activeOrderChallenge.items[idx]}`)
      .join(" → ");
    onSendText(`My order: ${sequence}`);
    setOrderedIndices([]);
  };

  const voiceAllowed = modes.includes("voice") && !micBlocked;
  const textAllowed = modes.includes("text");
  const effectiveMode: InputMode = mode === "voice" && voiceAllowed ? "voice" : "text";
  const seconds = Math.max(0, Math.ceil((MAX_RECORDING_MS - elapsedMs) / 1000));
  const bars = [0.35, 0.65, 1, 0.65, 0.35];

  const hasStructuredChallenge = Boolean(activeChoice || activeOrderChallenge || showConfidence);
  const showPrimaryInputBar = !hasStructuredChallenge || showCustomInputForChallenge;

  return (
    <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-2">
      {/* Compact status & hint strip */}
      <div className="flex items-center justify-between gap-2 text-xs leading-snug">
        <div aria-live="polite" className="min-w-0 flex-1 truncate text-[var(--ink)]">
          <span className="font-semibold">{status}</span>
          {listenHint?.expect && !activeChoice && !activeOrderChallenge && (
            <span className="ml-1.5 font-medium text-[var(--accent)]">
              Target: “{listenHint.expect}”
            </span>
          )}
          {!listenHint?.expect && listenHint?.hint && !activeChoice && !activeOrderChallenge && (
            <span className="ml-1.5 text-[var(--ink-dim)]">· {listenHint.hint}</span>
          )}
        </div>
        {lastSaid && !responseMatch && (
          <div className="flex shrink-0 items-center gap-1.5">
            <span className="hidden max-w-[180px] truncate text-[11px] text-[var(--ink-dim)] sm:inline">
              You: “{lastSaid}”
            </span>
            {lastLearnerAudioUrl && (
              <button
                type="button"
                onClick={playSelfRecording}
                title="Hear your own recording"
                className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[10px] font-bold text-slate-600 transition hover:border-brand/40 hover:text-brand-text"
              >
                <Play className="h-2.5 w-2.5 fill-current" aria-hidden="true" />
                {playingSelf ? "Stop" : "You"}
              </button>
            )}
          </div>
        )}
      </div>

      {/* Universal Target-vs-Response visual match feedback (works for key terms, formulas, & languages) */}
      {responseMatch && responseMatch.tokens.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200/80 bg-slate-50/90 px-2.5 py-1.5 text-[11px]">
          <div className="flex flex-wrap items-center gap-1">
            <span className="font-bold text-slate-500">Match:</span>
            {responseMatch.tokens.map((tok, i) => (
              <span
                key={`${tok.text}-${i}`}
                className={`rounded px-1.5 py-0.5 font-semibold ${
                  tok.matched
                    ? "bg-emerald-100 text-emerald-800"
                    : "bg-amber-100 text-amber-800 underline decoration-amber-400 decoration-dotted"
                }`}
              >
                {tok.text}
              </span>
            ))}
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            {lastLearnerAudioUrl && (
              <button
                type="button"
                onClick={playSelfRecording}
                title="Compare your recording"
                className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[10px] font-bold text-slate-700 hover:border-brand/40 hover:text-brand-text"
              >
                <Play className="h-2.5 w-2.5 fill-current" aria-hidden="true" />
                {playingSelf ? "Stop" : "Hear yourself"}
              </button>
            )}
            {canReplayTeacher && onReplayTeacher && lastLearnerAudioUrl && (
              <button
                type="button"
                onClick={onReplayTeacher}
                title="Hear teacher's model"
                className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-800 hover:bg-emerald-100"
              >
                <Volume2 className="h-2.5 w-2.5" aria-hidden="true" />
                Model
              </button>
            )}
            <span
              className={`rounded-full px-2 py-0.5 text-[10px] font-extrabold ${
                responseMatch.score >= 80
                  ? "bg-emerald-100 text-emerald-800"
                  : "bg-amber-100 text-amber-800"
              }`}
            >
              {responseMatch.score}%
            </span>
          </div>
        </div>
      )}

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
            <p className="inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider text-brand-text">
              <Sparkles className="h-3 w-3" aria-hidden="true" />
              {activeChoice.question}
            </p>
            <button
              type="button"
              onClick={() => setShowCustomInputForChallenge((v) => !v)}
              className="text-[11px] font-semibold text-[var(--ink-dim)] underline-offset-2 hover:text-[var(--ink)] hover:underline"
            >
              {showCustomInputForChallenge ? "Hide reply box" : "Type or speak instead"}
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
                      : "border-[var(--line-strong)] bg-white text-[var(--ink)] hover:border-brand/60 hover:bg-brand-soft disabled:opacity-55"
                  }`}
                >
                  <span
                    className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-extrabold ${
                      picked
                        ? "bg-[#0f766e] text-white"
                        : "bg-brand-tint text-brand-text"
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

      {/* 2. Interactive Tap-to-Order Sequence Challenge (works for workflows, steps, algorithms, & sentences) */}
      {activeOrderChallenge && (
        <div className="grid gap-1.5">
          <div className="flex items-center justify-between gap-2">
            <p className="inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider text-brand-text">
              <ListOrdered className="h-3.5 w-3.5" aria-hidden="true" />
              {activeOrderChallenge.prompt}
            </p>
            <div className="flex items-center gap-2">
              {orderedIndices.length > 0 && (
                <button
                  type="button"
                  onClick={() => setOrderedIndices([])}
                  className="inline-flex items-center gap-0.5 text-[11px] font-semibold text-[var(--ink-dim)] hover:text-[var(--ink)]"
                >
                  <RotateCcw className="h-3 w-3" /> Reset
                </button>
              )}
              <button
                type="button"
                onClick={() => setShowCustomInputForChallenge((v) => !v)}
                className="text-[11px] font-semibold text-[var(--ink-dim)] hover:text-[var(--ink)] hover:underline"
              >
                {showCustomInputForChallenge ? "Hide reply box" : "Type instead"}
              </button>
            </div>
          </div>
          <div className="grid max-h-[26dvh] gap-1.5 overflow-y-auto sm:grid-cols-2">
            {activeOrderChallenge.items.map((item, idx) => {
              const orderPos = orderedIndices.indexOf(idx);
              const selected = orderPos !== -1;
              return (
                <button
                  key={`${idx}-${item}`}
                  type="button"
                  disabled={!canType}
                  onClick={() => toggleOrderTile(idx)}
                  className={`flex min-h-9 items-center gap-2 rounded-xl border px-3 py-1.5 text-left text-xs font-semibold transition ${
                    selected
                      ? "border-[#0f766e] bg-[#ecfdf5] text-[#064e3b]"
                      : "border-[var(--line-strong)] bg-white text-[var(--ink)] hover:border-brand/50 hover:bg-brand-soft"
                  }`}
                >
                  <span
                    className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-extrabold ${
                      selected
                        ? "bg-[#0f766e] text-white"
                        : "bg-slate-100 text-slate-500"
                    }`}
                  >
                    {selected ? orderPos + 1 : "•"}
                  </span>
                  <span className="line-clamp-2 leading-snug">{item}</span>
                </button>
              );
            })}
          </div>
          <button
            type="button"
            disabled={!canType || orderedIndices.length < activeOrderChallenge.items.length}
            onClick={submitOrder}
            className={`${styles.primaryButton} h-9 rounded-xl px-4 text-xs font-bold transition disabled:opacity-45`}
          >
            {orderedIndices.length < activeOrderChallenge.items.length
              ? `Tap ${activeOrderChallenge.items.length - orderedIndices.length} more in order`
              : "Submit sequence →"}
          </button>
        </div>
      )}

      {/* 3. Interactive Fill-in-the-Blank Prompt + Optional Word Bank */}
      {activeFillBlank && (
        <div className="grid gap-1.5 rounded-xl border border-amber-200/80 bg-amber-50/70 px-3 py-2">
          <p className="text-[11px] font-bold uppercase tracking-wider text-amber-800">
            Fill in the blank
          </p>
          <p className="text-xs font-medium leading-snug text-ink sm:text-[13px]">
            {activeFillBlank.template}
          </p>
          {activeFillBlank.wordBank.length > 0 && (
            <div className="flex flex-wrap gap-1.5 pt-0.5">
              {activeFillBlank.wordBank.map((word) => (
                <button
                  key={word}
                  type="button"
                  disabled={!canType}
                  onClick={() => onSendText(word)}
                  className="rounded-full border border-amber-300 bg-white px-2.5 py-1 text-xs font-bold text-ink shadow-xs transition hover:border-brand hover:bg-brand-tint hover:text-brand-text disabled:opacity-45"
                >
                  {word}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 4. Dynamic Confidence Check */}
      {showConfidence && (
        <div className="grid gap-1.5">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-bold text-[var(--ink)]">
              {confidencePrompt ?? "How confident do you feel?"}
            </p>
            <button
              type="button"
              onClick={() => setShowCustomInputForChallenge((v) => !v)}
              className="text-[11px] font-semibold text-[var(--ink-dim)] hover:text-[var(--ink)] hover:underline"
            >
              {showCustomInputForChallenge ? "Hide reply box" : "Type instead"}
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
                  className="flex flex-col items-center justify-center rounded-xl border border-[var(--line-strong)] bg-white px-2 py-2 text-center transition hover:border-brand/60 hover:bg-brand-soft focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus)] disabled:opacity-55"
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

      {/* Paste / Share Your Own Work multi-line box (code, email draft, paragraph, math attempt) */}
      {pasteWorkOpen && (
        <div className="grid gap-1.5 rounded-2xl border border-slate-200 bg-slate-50/90 p-2.5">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-bold text-ink">
              Paste your draft, code, or problem for {teacherName} to review
            </span>
            <button
              type="button"
              onClick={() => setPasteWorkOpen(false)}
              aria-label="Close paste work box"
              className="rounded-full p-1 text-slate-400 hover:bg-slate-200 hover:text-slate-700"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
          <textarea
            rows={3}
            value={pasteDraft}
            onChange={(e) => setPasteDraft(e.target.value)}
            maxLength={950}
            placeholder="Paste an email draft, code snippet, formula attempt, or notes..."
            className="w-full resize-none rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-ink placeholder:text-slate-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand"
          />
          <div className="flex justify-end gap-1.5">
            <button
              type="button"
              onClick={() => setPasteWorkOpen(false)}
              className="rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-semibold text-slate-600 hover:bg-slate-100"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={!canType || !pasteDraft.trim()}
              onClick={() => {
                const text = pasteDraft.trim();
                if (!text) return;
                setPasteDraft("");
                setPasteWorkOpen(false);
                onSendText(`Please review my work:\n${text}`);
              }}
              className={`${styles.primaryButton} rounded-full px-3.5 py-1 text-[11px] font-bold disabled:opacity-45`}
            >
              Send for review →
            </button>
          </div>
        </div>
      )}

      {/* Multimodal Photo / Screenshot Work Review Box */}
      {imageError && (
        <p role="alert" className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs text-amber-800">
          {imageError}
        </p>
      )}
      {pendingImage && onSendImage && (
        <div className="flex flex-wrap items-center gap-2.5 rounded-2xl border border-brand/30 bg-surface p-2.5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={pendingImage.previewUrl}
            alt="Uploaded work preview"
            className="h-14 w-14 shrink-0 rounded-xl border border-slate-200 object-cover"
          />
          <div className="min-w-0 flex-1 space-y-1">
            <input
              type="text"
              value={imageCaption}
              onChange={(e) => setImageCaption(e.target.value)}
              maxLength={300}
              placeholder="Optional note (e.g. Check step 2 of my calculation)"
              className="h-8 w-full rounded-lg border border-slate-200 bg-white px-2.5 text-xs text-ink placeholder:text-slate-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand"
            />
            <div className="flex items-center justify-end gap-1.5">
              <button
                type="button"
                onClick={clearPendingImage}
                className="rounded-full border border-slate-200 bg-white px-2.5 py-0.5 text-[11px] font-semibold text-slate-600 hover:bg-slate-100"
              >
                Remove
              </button>
              <button
                type="button"
                disabled={!canType}
                onClick={() => {
                  const file = pendingImage.file;
                  const note = imageCaption.trim() || undefined;
                  clearPendingImage();
                  onSendImage(file, note);
                }}
                className={`${styles.primaryButton} rounded-full px-3 py-0.5 text-[11px] font-bold disabled:opacity-45`}
              >
                Send photo for review →
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 5. Dynamic Contextual Quick Actions (single-row scroll on mobile, never needs page scroll) */}
      {!hasStructuredChallenge && !activeFillBlank && (
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
                  ? "border-brand/40 bg-brand-tint text-brand-hover hover:bg-[#ffe5d4]"
                  : "border-[var(--line-strong)] bg-white/95 text-[var(--ink)] hover:border-brand/50 hover:bg-brand-soft hover:text-brand-text"
              }`}
            >
              {q.label}
            </button>
          ))}
          {onSendImage && (
            <>
              <input
                ref={imageInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={(e) => handleImagePick(e.target.files?.[0])}
              />
              <button
                type="button"
                disabled={!canType}
                onClick={() => imageInputRef.current?.click()}
                className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full border border-dashed border-slate-300 bg-white/90 px-2.5 py-1.5 text-xs font-semibold text-slate-600 transition hover:border-brand/60 hover:bg-brand-soft hover:text-brand-text disabled:opacity-45"
              >
                <Camera className="h-3 w-3" aria-hidden="true" />
                Show work
              </button>
            </>
          )}
          <button
            type="button"
            disabled={!canType}
            onClick={() => setPasteWorkOpen((o) => !o)}
            className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full border border-dashed border-slate-300 bg-white/90 px-2.5 py-1.5 text-xs font-semibold text-slate-600 transition hover:border-brand/60 hover:bg-brand-soft hover:text-brand-text disabled:opacity-45"
          >
            <ClipboardPaste className="h-3 w-3" aria-hidden="true" />
            Paste work
          </button>
        </div>
      )}

      {/* 6. Unified Primary Input Bar (Gemini Live + Hold-to-Talk + Hands-Free Auto-VAD + 1-tap Keyboard/Mic) */}
      {showPrimaryInputBar && (
        liveActive && effectiveMode === "voice" ? (
          <div className="flex items-center gap-1.5 sm:gap-2">
            <button
              type="button"
              onClick={onToggleLiveMic}
              aria-pressed={liveMicOn}
              className={`flex h-11 min-w-0 flex-1 items-center justify-between gap-2 rounded-full border px-4 text-xs font-bold transition sm:h-12 sm:text-sm ${
                liveMicOn
                  ? "border-emerald-300 bg-emerald-50/95 text-emerald-900 shadow-xs"
                  : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
              }`}
            >
              <div className="flex min-w-0 items-center gap-2">
                <span
                  className={`inline-block h-2.5 w-2.5 shrink-0 rounded-full ${
                    liveMicOn ? "animate-pulse bg-emerald-600" : "bg-slate-400"
                  }`}
                  aria-hidden="true"
                />
                {liveMicOn ? (
                  <Mic className="h-4 w-4 shrink-0 text-emerald-700" aria-hidden="true" />
                ) : (
                  <MicOff className="h-4 w-4 shrink-0 text-slate-500" aria-hidden="true" />
                )}
                <span className="truncate">
                  {liveMicOn ? "Live mic open — speak or interrupt anytime" : "Live mic paused — tap to talk"}
                </span>
              </div>
              {liveMicOn && (
                <span className="flex h-4 items-center gap-0.5" aria-hidden="true">
                  {bars.map((base, i) => (
                    <i
                      key={i}
                      className="block w-1 rounded-full bg-emerald-600 transition-[height] duration-100"
                      style={{ height: `${Math.max(4, Math.round(16 * base * Math.max(0.18, level)))}px` }}
                    />
                  ))}
                </span>
              )}
            </button>
            {textAllowed && (
              <button
                type="button"
                onClick={() => {
                  onModeChange("text");
                  setTimeout(() => inputRef.current?.focus(), 40);
                }}
                title="Type a message in this live session"
                aria-label="Switch to typing"
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-[var(--line-strong)] bg-white text-[var(--ink)] shadow-xs transition hover:bg-[var(--soft-hover)] sm:h-12 sm:w-12"
              >
                <Keyboard className="h-4 w-4" aria-hidden="true" />
              </button>
            )}
          </div>
        ) : handsFree && voiceAllowed ? (
          <div className="flex items-center gap-2">
            <div className="flex h-11 min-w-0 flex-1 items-center justify-between gap-2 rounded-full border border-emerald-300 bg-emerald-50/90 px-4 text-xs font-bold text-emerald-900 sm:h-12 sm:text-sm">
              <div className="flex min-w-0 items-center gap-2">
                <span
                  className={`inline-block h-2.5 w-2.5 shrink-0 rounded-full ${
                    handsFreeListening
                      ? handsFreeSpeechDetected
                        ? "animate-ping bg-brand"
                        : "animate-pulse bg-emerald-600"
                      : "bg-slate-400"
                  }`}
                  aria-hidden="true"
                />
                <span className="truncate">
                  {handsFreeListening
                    ? handsFreeSpeechDetected
                      ? `Capturing speech (${seconds}s)… pause to send`
                      : "Hands-free listening… speak naturally"
                    : "Hands-free ready — waiting for teacher"}
                </span>
              </div>
              {handsFreeListening && handsFreeSpeechDetected && onCommitHandsFreeNow && (
                <button
                  type="button"
                  onClick={onCommitHandsFreeNow}
                  className="shrink-0 rounded-full bg-emerald-700 px-2.5 py-1 text-[11px] font-bold text-white hover:bg-emerald-800"
                >
                  Send now
                </button>
              )}
            </div>
            {onToggleHandsFree && (
              <button
                type="button"
                onClick={onToggleHandsFree}
                title="Turn off hands-free mode"
                aria-label="Turn off hands-free mode"
                className="flex h-11 shrink-0 items-center gap-1 rounded-full border border-rose-200 bg-rose-50 px-3 text-xs font-bold text-rose-700 transition hover:bg-rose-100 sm:h-12"
              >
                <Pause className="h-3.5 w-3.5" aria-hidden="true" />
                <span className="hidden sm:inline">Stop</span>
              </button>
            )}
          </div>
        ) : effectiveMode === "voice" ? (
          <div className="flex items-center gap-1.5 sm:gap-2">
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
              className={`${styles.holdButton} ${styles.primaryButton} flex h-11 min-w-0 flex-1 items-center justify-center gap-2 rounded-full px-3.5 text-sm font-bold shadow-[0_10px_24px_rgba(7,91,235,0.26)] transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus)] disabled:opacity-50 data-[active=true]:bg-[#ff7a8a] data-[active=true]:text-[#2a0b10] sm:h-12 sm:gap-2.5 sm:px-4 sm:text-[15px]`}
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
                  ? `Release (${seconds}s)`
                  : canTalk
                    ? "Hold to talk"
                    : "Wait for turn"}
              </span>
            </button>
            {onToggleHandsFree && (
              <button
                type="button"
                onClick={onToggleHandsFree}
                title="Hands-free auto-listening mode"
                aria-label="Enable hands-free auto-listening mode"
                className="flex h-11 shrink-0 items-center gap-1 rounded-full border border-[var(--line-strong)] bg-white px-3 text-xs font-bold text-[var(--ink)] shadow-xs transition hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-800 sm:h-12"
              >
                <Radio className="h-4 w-4 text-emerald-600" aria-hidden="true" />
                <span className="hidden sm:inline">Auto</span>
              </button>
            )}
            {textAllowed && (
              <button
                type="button"
                onClick={() => {
                  onModeChange("text");
                  setTimeout(() => inputRef.current?.focus(), 40);
                }}
                title="Switch to typing"
                aria-label="Switch to typing"
                className="flex h-11 shrink-0 items-center gap-1 rounded-full border border-[var(--line-strong)] bg-white px-3 text-xs font-bold text-[var(--ink)] shadow-xs transition hover:bg-[var(--soft-hover)] sm:h-12 sm:px-3.5"
              >
                <Keyboard className="h-4 w-4 text-brand-text" aria-hidden="true" />
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
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-[var(--line-strong)] bg-white text-[var(--ink)] shadow-xs transition hover:border-brand/50 hover:bg-brand-soft hover:text-brand-text"
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
              placeholder={
                activeFillBlank
                  ? "Type the missing word or phrase..."
                  : canType
                    ? "Type your reply..."
                    : "Wait for the teacher..."
              }
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
