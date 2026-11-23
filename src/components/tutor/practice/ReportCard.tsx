"use client";

import { useRef, useState } from "react";
import { CheckCircle2, CircleDot, RotateCcw, Sparkles } from "lucide-react";
import Link from "next/link";
import type { CardItem } from "@/components/tutor/EventPlayer";
import {
  REPORT_SCORE_KEYS,
  type ReportObjectiveOutcome,
  type ReportScoreKey,
  type TutorReportContent,
} from "@/lib/tutor/report-model";
import { toneSegments } from "@/lib/tutor/romanization";
import { saveSessionWordsToDeck } from "@/actions/tutor-learner";
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
  onPractiseObjective?: (objectiveText: string) => void;
  onStartSprint?: () => void;
  onDone?: () => void;
};

const OBJECTIVE_STATUS_STYLE: Record<
  ReportObjectiveOutcome["status"],
  { label: string; badgeClass: string; Icon: typeof CheckCircle2 }
> = {
  met: {
    label: "Met",
    badgeClass: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
    Icon: CheckCircle2,
  },
  partial: {
    label: "Partial",
    badgeClass: "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300",
    Icon: CircleDot,
  },
  review: {
    label: "To review",
    badgeClass: "border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-300",
    Icon: RotateCcw,
  },
};

export function ReportCard({
  report,
  title,
  words,
  onPractiseAgain,
  onPractiseObjective,
  onStartSprint,
  onDone,
}: ReportCardProps) {
  const scores = REPORT_SCORE_KEYS.filter((key) => typeof report.scores[key] === "number");
  const objectives = report.objectives ?? [];
  const metCount = objectives.filter((o) => o.status === "met").length;
  const partialCount = objectives.filter((o) => o.status === "partial").length;
  const reviewCount = objectives.filter((o) => o.status === "review").length;
  const hasWeakObjectives = partialCount + reviewCount > 0;
  const [deckState, setDeckState] = useState<"idle" | "saving" | "saved" | "error">("idle");

  async function handleSaveToDeck() {
    if (words.length === 0 || deckState === "saving" || deckState === "saved") return;
    setDeckState("saving");
    try {
      const lang = words.some((w) => hasHan(w.text)) ? "zh" : "en";
      await saveSessionWordsToDeck(
        words.map((w) => ({ text: w.text, pron: w.pron, meaning: w.meaning })),
        lang,
      );
      setDeckState("saved");
    } catch {
      setDeckState("error");
    }
  }

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

      {objectives.length > 0 && (
        <section aria-labelledby="objectives-heading" className="grid gap-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 id="objectives-heading" className="text-sm font-semibold text-[var(--ink)]">
              Objectives & evidence
            </h2>
            <div className="flex flex-wrap items-center gap-1.5 text-[11px] font-semibold">
              {metCount > 0 && (
                <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-0.5 text-emerald-700 dark:text-emerald-300">
                  {metCount} met
                </span>
              )}
              {partialCount > 0 && (
                <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-0.5 text-amber-700 dark:text-amber-300">
                  {partialCount} partial
                </span>
              )}
              {reviewCount > 0 && (
                <span className="rounded-full border border-rose-500/30 bg-rose-500/10 px-2.5 py-0.5 text-rose-700 dark:text-rose-300">
                  {reviewCount} to review
                </span>
              )}
            </div>
          </div>
          <ul className="grid gap-2.5">
            {objectives.map((obj) => {
              const meta = OBJECTIVE_STATUS_STYLE[obj.status];
              const StatusIcon = meta.Icon;
              return (
                <li
                  key={obj.objectiveKey}
                  className="grid gap-2 rounded-2xl border border-[var(--line)] bg-[var(--soft)] p-3.5"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="text-[14px] font-semibold text-[var(--ink)]">{obj.objectiveText}</p>
                    </div>
                    <div className="flex shrink-0 items-center gap-1.5">
                      {typeof obj.masteryLevel === "number" && (
                        <span className="rounded-full border border-[var(--line)] px-2 py-0.5 text-[11px] font-medium text-[var(--ink-dim)]">
                          Level {obj.masteryLevel}/3
                        </span>
                      )}
                      <span
                        className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${meta.badgeClass}`}
                      >
                        <StatusIcon className="h-3.5 w-3.5" aria-hidden="true" />
                        {meta.label}
                      </span>
                    </div>
                  </div>
                  <p className="text-[13px] leading-relaxed text-[var(--ink-dim)]">{obj.evidence}</p>
                  {obj.nextStep && obj.status !== "met" && (
                    <p className="text-[12px] text-[var(--ink-dim)]">
                      <span className="font-semibold text-[var(--ink)]">Next:</span> {obj.nextStep}
                    </p>
                  )}
                  {onPractiseObjective && obj.status !== "met" && (
                    <div className="pt-0.5">
                      <button
                        type="button"
                        onClick={() => onPractiseObjective(obj.objectiveText)}
                        className="inline-flex items-center gap-1.5 rounded-full border border-[var(--line-strong)] bg-[var(--card)] px-3 py-1.5 text-xs font-semibold text-[var(--ink)] transition hover:bg-[var(--soft-hover)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus)]"
                      >
                        <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
                        Practise this
                      </button>
                    </div>
                  )}
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
          <div className="flex flex-wrap items-center gap-3 pt-1">
            <button
              type="button"
              onClick={handleSaveToDeck}
              disabled={deckState === "saving" || deckState === "saved"}
              className="rounded-xl border border-[var(--line-strong)] bg-[var(--soft)] px-3.5 py-2 text-xs font-semibold text-[var(--ink)] hover:bg-[var(--soft-hover)] disabled:opacity-60"
            >
              {deckState === "saving"
                ? "Saving to deck..."
                : deckState === "saved"
                  ? "Saved to your vocabulary deck"
                  : deckState === "error"
                    ? "Sign in to save to deck"
                    : `Save ${words.length} ${words.length === 1 ? "word" : "words"} to deck`}
            </button>
            {deckState === "saved" && (
              <Link
                href="/practice/deck"
                className="text-xs font-semibold text-[var(--accent)] underline underline-offset-4"
              >
                Review deck →
              </Link>
            )}
          </div>
        </section>
      )}

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onPractiseAgain}
          className={`${styles.primaryButton} flex-1 rounded-2xl px-5 py-3 text-sm font-bold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus)]`}
        >
          Practise again
        </button>
        {hasWeakObjectives && onStartSprint && (
          <button
            type="button"
            onClick={onStartSprint}
            className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-2xl border border-[var(--line-strong)] bg-[var(--soft)] px-5 py-3 text-sm font-semibold text-[var(--ink)] hover:bg-[var(--soft-hover)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus)]"
          >
            <Sparkles className="h-4 w-4 text-[var(--accent)]" aria-hidden="true" />
            5-min revision sprint
          </button>
        )}
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
