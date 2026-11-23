"use client";

import type { ClipEvent, LessonRefEvent } from "@/components/tutor/EventPlayer";
import { CONFIDENCE_LEVELS, type BoardState, type ConfidenceLevel } from "@/lib/tutor/board";
import { dispatchLessonSeek } from "@/lib/tutor/lesson-seek";
import styles from "./practice.module.css";

// The teaching surface beside the teacher (event contract v2): board content revealed step by step,
// multiple-choice and confidence checks, links back to the lesson, a video clip, and award toasts.
// Everything is HTML, so it stays crisp, translatable and readable by screen readers.

export type ChoiceState = { question: string; options: string[]; picked?: string };

type TeachingBoardProps = {
  board: BoardState | null;
  choice: ChoiceState | null;
  confidence: { prompt?: string } | null;
  lessonRefs: LessonRefEvent[];
  clip: ClipEvent | null;
  award: { title: string; detail?: string } | null;
  /** Data saver: no embedded video, a link instead. */
  lite: boolean;
  /** Inputs are disabled while the teacher is thinking or the session is ending. */
  disabled: boolean;
  onChoose: (option: string) => void;
  onConfidence: (level: ConfidenceLevel) => void;
  onDismissAward: () => void;
  onLessonRefClick?: (ref: LessonRefEvent) => void;
};

export function TeachingBoard({
  board,
  choice,
  confidence,
  lessonRefs,
  clip,
  award,
  lite,
  disabled,
  onChoose,
  onConfidence,
  onDismissAward,
  onLessonRefClick,
}: TeachingBoardProps) {
  const empty = !board && !choice && !confidence && lessonRefs.length === 0 && !clip && !award;
  if (empty) return null;

  return (
    <section aria-label="Board" className="grid gap-3">
      {award && (
        <div
          role="status"
          className="flex items-center justify-between gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3"
        >
          <div>
            <div className="text-sm font-extrabold text-amber-900">{award.title}</div>
            {award.detail && <div className="text-xs text-amber-800">{award.detail}</div>}
          </div>
          <button
            type="button"
            onClick={onDismissAward}
            className="rounded-full px-3 py-1 text-xs font-bold text-amber-900 hover:bg-amber-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--focus)]"
          >
            Nice
          </button>
        </div>
      )}

      {board && <BoardContent board={board} />}

      {clip && <Clip clip={clip} lite={lite} />}

      {choice && (
        <div className={`${styles.glass} grid gap-2 rounded-[20px] p-4`}>
          <p className="font-heading text-base font-semibold leading-snug text-[var(--ink)]">{choice.question}</p>
          <div role="group" aria-label={choice.question} className="grid gap-2">
            {choice.options.map((option) => {
              const picked = choice.picked === option;
              return (
                <button
                  key={option}
                  type="button"
                  disabled={disabled || choice.picked !== undefined}
                  aria-pressed={picked}
                  onClick={() => onChoose(option)}
                  className={`min-h-11 rounded-xl border px-3.5 py-2.5 text-left text-[15px] font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus)] disabled:cursor-not-allowed ${
                    picked
                      ? "border-[#0f766e] bg-[#ecfdf5] text-[#064e3b]"
                      : "border-[var(--line-strong)] bg-white text-[var(--ink)] hover:bg-[var(--soft-hover)] disabled:opacity-60"
                  }`}
                >
                  {option}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {confidence && (
        <div className={`${styles.glass} grid gap-2 rounded-[20px] p-4`}>
          <p className="text-sm font-semibold text-[var(--ink)]">{confidence.prompt ?? "How sure do you feel?"}</p>
          <div role="group" aria-label="How sure do you feel?" className="grid grid-cols-3 gap-2">
            {CONFIDENCE_LEVELS.map((level) => (
              <button
                key={level}
                type="button"
                disabled={disabled}
                onClick={() => onConfidence(level)}
                className="min-h-11 rounded-xl border border-[var(--line-strong)] bg-white px-2 py-2 text-sm font-bold text-[var(--ink)] hover:bg-[var(--soft-hover)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus)] disabled:opacity-60"
              >
                {level}
              </button>
            ))}
          </div>
        </div>
      )}

      {lessonRefs.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {lessonRefs.map((ref, i) => (
            <button
              key={`${ref.label}-${i}`}
              type="button"
              onClick={() => {
                if (onLessonRefClick) {
                  onLessonRefClick(ref);
                } else {
                  dispatchLessonSeek(ref);
                }
              }}
              className="rounded-lg bg-[#eff6ff] px-3 py-2 text-[13px] font-bold text-[#1d4ed8] transition hover:bg-[#dbeafe] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus)]"
            >
              ↗ {ref.label}
              {ref.seconds !== undefined ? ` · ${formatSeconds(ref.seconds)}` : ""}
            </button>
          ))}
        </div>
      )}
    </section>
  );
}

function BoardContent({ board }: { board: BoardState }) {
  return (
    <div
      aria-live="polite"
      className="grid gap-2 rounded-[20px] border border-[var(--line)] bg-white/95 p-4 shadow-[0_8px_24px_rgba(15,23,42,0.06)]"
    >
      {board.title && (
        <h3 className="font-heading text-[17px] font-semibold leading-snug text-[var(--ink)]">{board.title}</h3>
      )}

      {(board.kind === "bullets" || board.kind === "steps") && board.items && (
        <ListItems items={board.items} shown={board.shown} ordered={board.kind === "steps"} />
      )}

      {board.kind === "equation" && board.text && (
        <p className="whitespace-pre-wrap font-mono text-[17px] leading-relaxed text-[var(--ink)]">{board.text}</p>
      )}

      {board.kind === "code" && board.text && (
        <pre
          aria-label={board.language ? `${board.language} code` : "Code"}
          className="overflow-x-auto rounded-xl bg-[#0f172a] p-3 font-mono text-[13px] leading-relaxed text-slate-100"
        >
          <code>{board.text}</code>
        </pre>
      )}

      {board.kind === "note" && board.text && (
        <p className="whitespace-pre-wrap text-[15px] leading-relaxed text-[var(--ink)]">{board.text}</p>
      )}

      {board.kind === "table" && board.rows && <BoardTable rows={board.rows} shown={board.shown} />}

      {/* A board of another kind that only carries items still shows them. */}
      {board.kind !== "bullets" && board.kind !== "steps" && !board.text && !board.rows && board.items && (
        <ListItems items={board.items} shown={board.shown} ordered={false} />
      )}
    </div>
  );
}

function ListItems({ items, shown, ordered }: { items: string[]; shown: number; ordered: boolean }) {
  const List = ordered ? "ol" : "ul";
  return (
    <List className={`grid gap-1.5 pl-5 text-[15px] leading-relaxed text-[var(--ink)] ${ordered ? "list-decimal" : "list-disc"}`}>
      {items.slice(0, Math.max(shown, 0)).map((item, i) => (
        <li key={i}>{item}</li>
      ))}
      {shown < items.length && (
        <li aria-hidden="true" className="list-none text-[var(--ink-faint)]">
          …
        </li>
      )}
    </List>
  );
}

function BoardTable({ rows, shown }: { rows: string[][]; shown: number }) {
  const [head, ...body] = rows;
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-left text-sm text-[var(--ink)]">
        <thead>
          <tr>
            {head.map((cell, i) => (
              <th key={i} scope="col" className="border-b border-[var(--line-strong)] px-2 py-1.5 font-bold">
                {cell}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {body.slice(0, Math.max(shown - 1, 0)).map((row, r) => (
            <tr key={r}>
              {row.map((cell, c) => (
                <td key={c} className="border-b border-[var(--line)] px-2 py-1.5">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Clip({ clip, lite }: { clip: ClipEvent; lite: boolean }) {
  const params = new URLSearchParams();
  if (clip.start !== undefined) params.set("start", String(clip.start));
  if (clip.end !== undefined) params.set("end", String(clip.end));
  const watchUrl = `https://www.youtube.com/watch?v=${clip.videoId}${clip.start ? `&t=${clip.start}s` : ""}`;
  if (lite) {
    return (
      <a
        href={watchUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="rounded-lg bg-[#fff7ed] px-3 py-2 text-[13px] font-bold text-[#7c2d12]"
      >
        ▶ {clip.caption ?? "Watch the clip"}
        {clip.start !== undefined ? ` · ${formatSeconds(clip.start)}` : ""} (uses data)
      </a>
    );
  }
  return (
    <figure className="m-0 grid gap-1.5">
      <div className="aspect-video overflow-hidden rounded-xl bg-black">
        <iframe
          title={clip.caption ?? "Lesson clip"}
          src={`https://www.youtube-nocookie.com/embed/${clip.videoId}?${params.toString()}`}
          allow="encrypted-media; picture-in-picture"
          allowFullScreen
          loading="lazy"
          className="h-full w-full"
        />
      </div>
      {clip.caption && <figcaption className="text-xs text-[var(--ink-dim)]">{clip.caption}</figcaption>}
    </figure>
  );
}

function formatSeconds(total: number): string {
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}
