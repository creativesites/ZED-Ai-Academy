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
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#c7b6dd]">Practice Room</p>
        <h1 id="start-title" className="font-heading text-2xl font-semibold leading-tight text-[#f5ecff]">
          {info ? info.title : "Practice session"}
        </h1>
        {info && <p className="text-sm text-[#c7b6dd]">With {info.teacherName}</p>}
      </div>

      {info?.goal && (
        <div className="grid gap-1 rounded-2xl border border-white/10 bg-white/5 p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#8f7aa8]">Goal</p>
          <p className="text-[15px] leading-relaxed text-[#f5ecff]">{info.goal}</p>
        </div>
      )}

      <dl className="grid gap-2 text-sm text-[#c7b6dd] sm:grid-cols-3">
        <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
          <dt className="text-xs uppercase tracking-[0.12em] text-[#8f7aa8]">Mode</dt>
          <dd className="mt-0.5 font-semibold text-[#7ee0c3]">{startMode === "voice" ? "Voice" : "Text"}</dd>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
          <dt className="text-xs uppercase tracking-[0.12em] text-[#8f7aa8]">Time box</dt>
          <dd className="mt-0.5 font-semibold text-[#f5ecff]">{info ? `${info.maxMinutes} min` : "Up to 8 min"}</dd>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
          <dt className="text-xs uppercase tracking-[0.12em] text-[#8f7aa8]">Mic check</dt>
          <dd className="mt-0.5 text-[13px] text-[#f5ecff]">{MIC_TEXT[micPermission]}</dd>
        </div>
      </dl>

      <p className="text-xs text-[#c7b6dd]">
        Live conversation is coming soon. This session runs in {startMode === "voice" ? "Voice" : "Text"} mode.
      </p>

      {error && (
        <p role="alert" className="rounded-xl border border-red-300/30 bg-red-500/15 px-3 py-2 text-sm text-red-100">
          {error}
        </p>
      )}

      <button
        type="button"
        onClick={onStart}
        disabled={starting}
        aria-busy={starting}
        className={`${styles.primaryButton} rounded-2xl px-5 py-3.5 text-base font-bold shadow-lg shadow-black/20 transition-transform hover:-translate-y-0.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#ffb867] disabled:opacity-60 disabled:hover:translate-y-0`}
      >
        {starting ? "Connecting to your teacher..." : error ? "Try again" : "Start session"}
      </button>
    </section>
  );
}
