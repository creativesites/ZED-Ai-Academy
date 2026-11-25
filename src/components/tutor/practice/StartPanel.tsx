"use client";

import { Clock, Mic, MicOff, MessageSquare, Sparkles } from "lucide-react";
import type { MicPermission } from "./api";
import styles from "./practice.module.css";

// The screen before a session: who you will practise with, the goal, the time box, the mode and a
// mic check. Start is a user gesture, so it also unlocks teacher audio.

export type StartInfo = {
  teacherName: string;
  title: string;
  goal: string;
  maxMinutes: number;
  modes: Array<"voice" | "text">;
};

type StartPanelProps = {
  info: StartInfo | null;
  micPermission: MicPermission;
  starting: boolean;
  error: string | null;
  onStart: () => void;
  compact?: boolean;
  /** Data saver (Lite). The choice is shown and can be changed before the stage loads. */
  lite?: boolean;
  onLiteChange?: (next: boolean) => void;
};

const MIC_LABEL: Record<MicPermission, string> = {
  granted: "Mic ready",
  prompt: "Mic asks on talk",
  denied: "Mic off · Type mode",
};

export function StartPanel({
  info,
  micPermission,
  starting,
  error,
  onStart,
  compact = false,
  lite = false,
  onLiteChange,
}: StartPanelProps) {
  const voiceAvailable = !info || info.modes.includes("voice");
  const startMode: "voice" | "text" =
    voiceAvailable && micPermission !== "denied" ? "voice" : "text";

  return (
    <section
      aria-labelledby="start-title"
      className={`${styles.glass} mx-auto grid w-full max-w-[500px] gap-3 rounded-2xl p-4 sm:gap-4 sm:rounded-[26px] ${compact ? "sm:p-5" : "sm:p-6"}`}
    >
      <div className="grid gap-0.5">
        <p className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-[0.14em] text-[#fd5523] sm:text-[11px]">
          <Sparkles className="h-3 w-3" aria-hidden="true" />
          AI Teacher
        </p>
        <h1
          id="start-title"
          className="font-heading text-lg font-bold leading-snug text-[var(--ink)] sm:text-2xl"
        >
          {info ? info.title : "AI Teacher session"}
        </h1>
        {info && (
          <p className="text-xs font-medium text-[var(--ink-dim)] sm:text-sm">
            With {info.teacherName}
          </p>
        )}
      </div>

      {info?.goal && (
        <div className="grid gap-1 rounded-xl border border-[var(--line)] bg-[var(--soft)] px-3 py-2.5 sm:rounded-2xl sm:p-3.5">
          <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--ink-faint)]">
            Goal
          </p>
          <p className="text-[13px] leading-snug text-[var(--ink)] sm:text-sm sm:leading-relaxed">
            {info.goal}
          </p>
        </div>
      )}

      <dl className="grid grid-cols-3 gap-1.5 text-xs text-[var(--ink-dim)] sm:gap-2">
        <div className="rounded-xl border border-[var(--line)] bg-[var(--soft)] px-2.5 py-2 sm:p-2.5">
          <dt className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-[var(--ink-faint)]">
            {startMode === "voice" ? (
              <Mic className="h-3 w-3 shrink-0" aria-hidden="true" />
            ) : (
              <MessageSquare className="h-3 w-3 shrink-0" aria-hidden="true" />
            )}
            Mode
          </dt>
          <dd className="mt-0.5 truncate text-xs font-bold text-[var(--accent)] sm:text-[13px]">
            {startMode === "voice" ? "Voice & Tap" : "Tap / Type"}
          </dd>
        </div>

        <div className="rounded-xl border border-[var(--line)] bg-[var(--soft)] px-2.5 py-2 sm:p-2.5">
          <dt className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-[var(--ink-faint)]">
            <Clock className="h-3 w-3 shrink-0" aria-hidden="true" />
            Time
          </dt>
          <dd className="mt-0.5 truncate text-xs font-bold text-[var(--ink)] sm:text-[13px]">
            {info ? `${info.maxMinutes} min` : "Up to 8m"}
          </dd>
        </div>

        <div className="rounded-xl border border-[var(--line)] bg-[var(--soft)] px-2.5 py-2 sm:p-2.5">
          <dt className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-[var(--ink-faint)]">
            {micPermission === "denied" ? (
              <MicOff className="h-3 w-3 shrink-0" aria-hidden="true" />
            ) : (
              <Mic className="h-3 w-3 shrink-0" aria-hidden="true" />
            )}
            Mic
          </dt>
          <dd className="mt-0.5 truncate text-[11px] font-semibold text-[var(--ink)] sm:text-xs">
            {MIC_LABEL[micPermission]}
          </dd>
        </div>
      </dl>

      <p className="text-[11px] leading-snug text-[var(--ink-dim)]">
        {lite
          ? "Switch between Voice, Tap, or Type anytime."
          : "Switch between Voice, Tap, or Type anytime. You can also toggle 2D/3D teacher view."}
      </p>

      {onLiteChange && (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-[var(--line)] bg-[var(--soft)] px-3 py-1.5 sm:rounded-2xl">
          <p className="text-[11px] leading-snug text-[var(--ink-dim)] sm:text-xs">
            {lite
              ? "Data saver on: a light teacher drawing and no scene. The voice still plays."
              : "Data saver off: animated teacher and scene."}
          </p>
          <button
            type="button"
            onClick={() => onLiteChange(!lite)}
            aria-pressed={lite}
            className="min-h-11 shrink-0 rounded-lg px-2 text-xs font-semibold text-[var(--accent)] underline-offset-4 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--focus)]"
          >
            {lite ? "Turn off" : "Save data"}
          </button>
        </div>
      )}

      {error && (
        <p
          role="alert"
          className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 sm:text-sm"
        >
          {error}
        </p>
      )}

      <button
        type="button"
        onClick={onStart}
        disabled={starting}
        aria-busy={starting}
        className={`${styles.primaryButton} rounded-xl px-4 py-3 text-sm font-bold shadow-[0_10px_24px_rgba(253,85,35,0.26)] transition-transform hover:-translate-y-0.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus)] disabled:opacity-60 disabled:hover:translate-y-0 sm:rounded-2xl sm:py-3.5 sm:text-[15px]`}
      >
        {starting
          ? "Connecting to your teacher..."
          : error
            ? "Try again"
            : "Start session"}
      </button>
    </section>
  );
}
