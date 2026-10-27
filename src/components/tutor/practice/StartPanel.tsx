"use client";

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
};

const MIC_TEXT: Record<MicPermission, string> = {
  granted: "Microphone: ready",
  prompt: "Microphone: your browser will ask when you first talk",
  denied: "Microphone: blocked in this browser. You can practise by typing.",
};

export function StartPanel({ info, micPermission, starting, error, onStart }: StartPanelProps) {
  const voiceAvailable = !info || info.modes.includes("voice");
  const startMode: "voice" | "text" = voiceAvailable && micPermission !== "denied" ? "voice" : "text";

  return (
    <section aria-labelledby="start-title" className={`${styles.glass} mx-auto grid w-full max-w-[560px] gap-4 rounded-[28px] p-5 sm:p-7`}>
      <div className="grid gap-1">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--ink-dim)]">Practice Room</p>
        <h1 id="start-title" className="font-heading text-2xl font-semibold leading-tight text-[var(--ink)]">
          {info ? info.title : "Practice session"}
        </h1>
        {info && <p className="text-sm text-[var(--ink-dim)]">With {info.teacherName}</p>}
      </div>

      {info?.goal && (
        <div className="grid gap-1 rounded-2xl border border-[var(--line)] bg-[var(--soft)] p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--ink-faint)]">Goal</p>
          <p className="text-[15px] leading-relaxed text-[var(--ink)]">{info.goal}</p>
        </div>
      )}

      <dl className="grid gap-2 text-sm text-[var(--ink-dim)] sm:grid-cols-3">
        <div className="rounded-2xl border border-[var(--line)] bg-[var(--soft)] p-3">
          <dt className="text-xs uppercase tracking-[0.12em] text-[var(--ink-faint)]">Mode</dt>
          <dd className="mt-0.5 font-semibold text-[var(--accent)]">{startMode === "voice" ? "Voice" : "Text"}</dd>
        </div>
        <div className="rounded-2xl border border-[var(--line)] bg-[var(--soft)] p-3">
          <dt className="text-xs uppercase tracking-[0.12em] text-[var(--ink-faint)]">Time box</dt>
          <dd className="mt-0.5 font-semibold text-[var(--ink)]">{info ? `${info.maxMinutes} min` : "Up to 8 min"}</dd>
        </div>
        <div className="rounded-2xl border border-[var(--line)] bg-[var(--soft)] p-3">
          <dt className="text-xs uppercase tracking-[0.12em] text-[var(--ink-faint)]">Mic check</dt>
          <dd className="mt-0.5 text-[13px] text-[var(--ink)]">{MIC_TEXT[micPermission]}</dd>
        </div>
      </dl>

      <p className="text-xs text-[var(--ink-dim)]">
        Live conversation is coming soon. This session runs in {startMode === "voice" ? "Voice" : "Text"} mode.
      </p>

      {error && (
        <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      <button
        type="button"
        onClick={onStart}
        disabled={starting}
        aria-busy={starting}
        className={`${styles.primaryButton} rounded-2xl px-5 py-3.5 text-base font-bold shadow-[0_14px_30px_rgba(253,85,35,0.28)] transition-transform hover:-translate-y-0.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus)] disabled:opacity-60 disabled:hover:translate-y-0`}
      >
        {starting ? "Connecting to your teacher..." : error ? "Try again" : "Start session"}
      </button>
    </section>
  );
}
