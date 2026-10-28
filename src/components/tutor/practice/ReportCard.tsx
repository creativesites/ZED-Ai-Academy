"use client";

import { useRef, useState } from "react";
import type { CardItem } from "@/components/tutor/EventPlayer";
import { REPORT_SCORE_KEYS, type ReportScoreKey, type TutorReportContent } from "@/lib/tutor/report-model";
import { toneSegments } from "@/lib/tutor/romanization";
import styles from "./practice.module.css";
import { hasHan, toneClass } from "./SpeakingStage";

// The end-of-session report. Scores are guidance: gentle bars with that label, never grades.

const SCORE_LABEL: Record<ReportScoreKey, string> = {
  fluency: "Fluency",
  accuracy: "Accuracy",
  vocabulary: "Vocabulary",
  pronunciation: "Pronunciation",
  task: "Did you reach the goal?",
};

type Mistake = TutorReportContent["mistakes"][number] & { audioUrl?: string };

type ReportCardProps = {
  report: TutorReportContent;
  title: string;
  words: CardItem[];
  onPractiseAgain: () => void;
  onDone?: () => void;
};

export function ReportCard({ report, title, words, onPractiseAgain, onDone }: ReportCardProps) {
  const scores = REPORT_SCORE_KEYS.filter((key) => typeof report.scores[key] === "number");

  return (
    <article aria-labelledby="report-title" className={`${styles.glass} mx-auto grid w-full max-w-[640px] gap-5 rounded-[28px] p-5 sm:p-7`}>
      <header className="grid gap-1">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--ink-dim)]">Session report</p>
        <h1 id="report-title" className="font-heading text-2xl font-semibold leading-tight text-[var(--ink)]">
          {title}
        </h1>
      </header>

      {scores.length > 0 && (
        <section aria-labelledby="scores-heading" className="grid gap-3">
          <div className="flex items-baseline justify-between gap-3">
            <h2 id="scores-heading" className="text-sm font-semibold text-[var(--ink)]">
              How it went
            </h2>
            <span className="rounded-full border border-[var(--line)] px-2 py-0.5 text-[11px] uppercase tracking-wider text-[var(--ink-dim)]">
              Guidance only
            </span>
          </div>
          <ul className="grid gap-2.5">
            {scores.map((key) => {
              const value = report.scores[key] ?? 0;
              return (
                <li key={key} className="grid gap-1">
                  <div className="flex justify-between text-[13px] text-[var(--ink)]">
                    <span>{SCORE_LABEL[key]}</span>
                    <span className="text-[var(--ink-dim)] tabular-nums">{value}</span>
                  </div>
                  <div
                    role="meter"
                    aria-label={SCORE_LABEL[key]}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={value}
                    aria-valuetext={`${value} out of 100, guidance`}
                    className="h-2 overflow-hidden rounded-full bg-[var(--soft-hover)]"
                  >
                    <div className="h-full rounded-full bg-gradient-to-r from-[#fd5523] to-[#15805f]" style={{ width: `${value}%` }} />
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {report.strengths.length > 0 && (
        <section aria-labelledby="strengths-heading" className="grid gap-2">
          <h2 id="strengths-heading" className="text-sm font-semibold text-[var(--ink)]">
            What went well
          </h2>
          <ul className="list-disc space-y-1 pl-5 text-[15px] text-[var(--ink)]">
            {report.strengths.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ul>
        </section>
      )}

      {report.mistakes.length > 0 && (
        <section aria-labelledby="mistakes-heading" className="grid gap-2">
          <h2 id="mistakes-heading" className="text-sm font-semibold text-[var(--ink)]">
            Worth another try
          </h2>
          <ul className="grid gap-2">
            {report.mistakes.map((m, i) => (
              <MistakeRow key={`${m.said}-${i}`} mistake={m as Mistake} />
            ))}
          </ul>
        </section>
      )}

      <section aria-labelledby="next-heading" className="grid gap-1 rounded-2xl border border-[var(--line)] bg-[var(--soft)] p-4">
        <h2 id="next-heading" className="text-sm font-semibold text-[var(--accent)]">
          Next step
        </h2>
        <p className="text-[15px] leading-relaxed text-[var(--ink)]">{report.nextStep}</p>
      </section>

      {words.length > 0 && (
        <section aria-labelledby="words-heading" className="grid gap-2">
          <h2 id="words-heading" className="text-sm font-semibold text-[var(--ink)]">
            New words in your deck
          </h2>
          <ul className="flex flex-wrap gap-2">
            {words.map((w) => (
              <li key={w.text} className="rounded-2xl border border-[var(--line-strong)] bg-[var(--soft)] px-3 py-2">
                <span className={`${hasHan(w.text) ? styles.han : "font-semibold"} text-base text-[var(--ink)]`}>{w.text}</span>
                {w.pron && <span className="ml-2 text-[13px] text-[var(--ink-dim)]">{w.pron}</span>}
                {w.meaning && <span className="block text-[12px] text-[var(--ink-faint)]">{w.meaning}</span>}
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="grid gap-2 sm:grid-cols-2">
        <button
          type="button"
          onClick={onPractiseAgain}
          className={`${styles.primaryButton} rounded-2xl px-5 py-3 text-sm font-bold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus)]`}
        >
          Practise again
        </button>
        {onDone && (
          <button
            type="button"
            onClick={onDone}
            className="rounded-2xl border border-[var(--line-strong)] bg-[var(--soft)] px-5 py-3 text-sm font-semibold text-[var(--ink)] hover:bg-[var(--soft-hover)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus)]"
          >
            Done
          </button>
        )}
      </div>
    </article>
  );
}

function MistakeRow({ mistake }: { mistake: Mistake }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const han = hasHan(mistake.correct);

  const listen = () => {
    if (!mistake.audioUrl) return;
    if (!audioRef.current) audioRef.current = new Audio(mistake.audioUrl);
    const el = audioRef.current;
    el.onended = () => setPlaying(false);
    el.onerror = () => setPlaying(false);
    setPlaying(true);
    void el.play().catch(() => setPlaying(false));
  };

  return (
    <li className="grid gap-1 rounded-2xl border border-[var(--line)] bg-[var(--soft)] p-3">
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1 text-[15px] text-[var(--ink)]">
        <span className="text-[var(--ink-dim)] line-through decoration-[#e11d48]/60">{mistake.said}</span>
        <span aria-hidden="true">→</span>
        <span className={`${han ? styles.han : "font-semibold"}`}>
          {han
            ? toneSegments(mistake.correct).map((seg, i) =>
                seg.tone > 0 ? (
                  <span key={i} className={toneClass(seg.tone)}>
                    {seg.text}
                  </span>
                ) : (
                  <span key={i}>{seg.text}</span>
                ),
              )
            : mistake.correct}
        </span>
        <span className="text-[11px] uppercase tracking-wider text-[var(--ink-faint)]">{mistake.category}</span>
        {mistake.audioUrl && (
          <button
            type="button"
            onClick={listen}
            disabled={playing}
            aria-label={`Hear ${mistake.correct}`}
            className="ml-auto rounded-full border border-[var(--line-strong)] px-2.5 py-0.5 text-[12px] text-[var(--ink)] hover:bg-[var(--soft-hover)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus)] disabled:opacity-60"
          >
            {playing ? "Playing..." : "Hear it"}
          </button>
        )}
      </div>
      {mistake.note && <p className="text-[13px] text-[var(--ink-dim)]">{mistake.note}</p>}
    </li>
  );
}
