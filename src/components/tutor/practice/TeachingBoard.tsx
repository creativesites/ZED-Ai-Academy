"use client";

import { useState } from "react";
import { ArrowDown, BarChart3, BookmarkCheck, BookmarkPlus, GitBranch, Scale, Terminal } from "lucide-react";
import type { ClipEvent, LessonRefEvent } from "@/components/tutor/EventPlayer";
import { CONFIDENCE_LEVELS, type BoardState, type ConfidenceLevel } from "@/lib/tutor/board";
import { parseChartData, parseCompareData, parseDiagramNodes } from "@/lib/tutor/board-visuals";
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
  /** Optional universal Study Deck bookmarking for board takeaways/concepts. */
  savedKeys?: ReadonlySet<string>;
  onSaveTakeaway?: (item: { key: string; term: string; meaning: string }) => void;
  /** Called when the learner taps an interactive diagram node, chart bar, compare card, or code line. */
  onInteract?: (prompt: string) => void;
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
  savedKeys,
  onSaveTakeaway,
  onInteract,
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

      {board && (
        <BoardContent
          board={board}
          disabled={disabled}
          savedKeys={savedKeys}
          onSaveTakeaway={onSaveTakeaway}
          onInteract={onInteract}
        />
      )}

      {clip && <Clip clip={clip} lite={lite} />}

      {choice && (
        <div className={`${styles.glass} grid gap-2 rounded-2xl p-3 sm:rounded-[20px] sm:p-4`}>
          <p className="font-heading text-sm font-semibold leading-snug text-[var(--ink)] sm:text-base">{choice.question}</p>
          <div role="group" aria-label={choice.question} className="grid gap-1.5 sm:gap-2">
            {choice.options.map((option) => {
              const picked = choice.picked === option;
              return (
                <button
                  key={option}
                  type="button"
                  disabled={disabled || choice.picked !== undefined}
                  aria-pressed={picked}
                  onClick={() => onChoose(option)}
                  className={`min-h-10 rounded-xl border px-3 py-2 text-left text-xs font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus)] disabled:cursor-not-allowed sm:min-h-11 sm:px-3.5 sm:py-2.5 sm:text-sm ${
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

function BoardContent({
  board,
  disabled,
  savedKeys,
  onSaveTakeaway,
  onInteract,
}: {
  board: BoardState;
  disabled: boolean;
  savedKeys?: ReadonlySet<string>;
  onSaveTakeaway?: (item: { key: string; term: string; meaning: string }) => void;
  onInteract?: (prompt: string) => void;
}) {
  const [selectedCodeLine, setSelectedCodeLine] = useState<number | null>(null);
  const boardSummary =
    board.text?.trim() ||
    board.items?.slice(0, Math.max(board.shown, 1)).join(" · ") ||
    board.rows?.slice(0, Math.max(board.shown, 2)).map((r) => r.join(": ")).join(" | ") ||
    "";
  const saveKey = `board:${board.title ?? board.kind}:${boardSummary.slice(0, 60)}`;
  const isSaved = Boolean(savedKeys?.has(saveKey));

  const chartData = board.kind === "chart" ? parseChartData(board) : [];
  const diagramNodes = board.kind === "diagram" ? parseDiagramNodes(board) : [];
  const compareData = board.kind === "compare" ? parseCompareData(board) : null;

  return (
    <div
      aria-live="polite"
      className="grid gap-2 rounded-2xl border border-[var(--line)] bg-white/95 p-3 shadow-[0_8px_24px_rgba(15,23,42,0.06)] sm:rounded-[20px] sm:p-4"
    >
      <div className="flex items-start justify-between gap-2">
        {board.title ? (
          <h3 className="flex items-center gap-1.5 font-heading text-sm font-semibold leading-snug text-[var(--ink)] sm:text-base">
            {board.kind === "chart" && <BarChart3 className="h-4 w-4 text-[#fd5523]" aria-hidden="true" />}
            {board.kind === "diagram" && <GitBranch className="h-4 w-4 text-[#fd5523]" aria-hidden="true" />}
            {board.kind === "compare" && <Scale className="h-4 w-4 text-[#fd5523]" aria-hidden="true" />}
            {board.kind === "code" && <Terminal className="h-4 w-4 text-[#fd5523]" aria-hidden="true" />}
            {board.title}
          </h3>
        ) : (
          <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--ink-faint)]">
            Teaching Board
          </span>
        )}
        {onSaveTakeaway && boardSummary && (
          <button
            type="button"
            disabled={isSaved}
            onClick={() =>
              onSaveTakeaway({
                key: saveKey,
                term: (board.title || boardSummary).slice(0, 150),
                meaning: boardSummary.slice(0, 230),
              })
            }
            title={isSaved ? "Saved to Study Deck" : "Save board note to Study Deck"}
            className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold transition ${
              isSaved
                ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                : "border-[var(--line-strong)] bg-[var(--soft)] text-[var(--ink-dim)] hover:border-[#fd5523]/40 hover:bg-[#fff2e9] hover:text-[#fd5523]"
            }`}
          >
            {isSaved ? (
              <>
                <BookmarkCheck className="h-3 w-3" aria-hidden="true" />
                Saved
              </>
            ) : (
              <>
                <BookmarkPlus className="h-3 w-3" aria-hidden="true" />
                Save note
              </>
            )}
          </button>
        )}
      </div>

      {(board.kind === "bullets" || board.kind === "steps") && board.items && (
        <ListItems items={board.items} shown={board.shown} ordered={board.kind === "steps"} />
      )}

      {board.kind === "equation" && board.text && (
        <div className="rounded-xl border border-amber-200/70 bg-[#fffaf4] px-3 py-2.5 text-center">
          <p className="whitespace-pre-wrap font-mono text-sm font-bold leading-relaxed text-[var(--ink)] sm:text-base">
            {board.text}
          </p>
          {onInteract && (
            <button
              type="button"
              disabled={disabled}
              onClick={() => onInteract("Walk me through this formula step by step with concrete numbers.")}
              className="mt-2 rounded-full border border-amber-300 bg-white px-2.5 py-0.5 text-[11px] font-bold text-amber-900 transition hover:bg-amber-50 disabled:opacity-50"
            >
              Walk through with numbers →
            </button>
          )}
        </div>
      )}

      {board.kind === "code" && board.text && (
        <div className="space-y-1.5">
          <div
            aria-label={board.language ? `${board.language} code` : "Code"}
            className="overflow-x-auto rounded-xl bg-[#0f172a] p-2 font-mono text-xs leading-relaxed text-slate-100 sm:p-3 sm:text-[13px]"
          >
            {board.text.split("\n").map((line, i) => {
              const lineNum = i + 1;
              const isSelected = selectedCodeLine === lineNum;
              return (
                <button
                  key={lineNum}
                  type="button"
                  disabled={!onInteract || disabled}
                  onClick={() => setSelectedCodeLine(isSelected ? null : lineNum)}
                  className={`flex w-full items-start gap-2.5 rounded px-1.5 py-0.5 text-left transition ${
                    isSelected
                      ? "bg-[#fd5523]/25 text-white ring-1 ring-[#fd5523]/60"
                      : onInteract
                        ? "hover:bg-white/10"
                        : ""
                  }`}
                >
                  <span className="w-5 shrink-0 select-none text-right text-[10px] text-slate-500">
                    {lineNum}
                  </span>
                  <code className="whitespace-pre">{line || " "}</code>
                </button>
              );
            })}
          </div>
          {onInteract && (
            <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500">
              <span>{selectedCodeLine ? `Line ${selectedCodeLine} selected` : "Tap any line to discuss or spot a bug"}</span>
              {selectedCodeLine && (
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    disabled={disabled}
                    onClick={() => {
                      const lineText = board.text?.split("\n")[selectedCodeLine - 1]?.trim() ?? "";
                      onInteract(`I'm looking at line ${selectedCodeLine}: "${lineText}"`);
                      setSelectedCodeLine(null);
                    }}
                    className="rounded-full bg-[#fd5523] px-2.5 py-1 text-[11px] font-bold text-white hover:bg-[#ea4817] disabled:opacity-50"
                  >
                    Select line {selectedCodeLine}
                  </button>
                  <button
                    type="button"
                    disabled={disabled}
                    onClick={() => {
                      onInteract(`Can you explain line ${selectedCodeLine}?`);
                      setSelectedCodeLine(null);
                    }}
                    className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-bold text-[#062e39] hover:bg-slate-50 disabled:opacity-50"
                  >
                    Explain line
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {board.kind === "diagram" && diagramNodes.length > 0 && (
        <div className="space-y-1">
          {diagramNodes.map((node, i) => (
            <div key={`${node.index}-${node.label}`} className="flex flex-col items-center">
              <button
                type="button"
                disabled={!onInteract || disabled}
                onClick={() => onInteract?.(`Can you explain this step: "${node.label}"?`)}
                className="flex w-full items-center gap-2.5 rounded-xl border border-slate-200 bg-gradient-to-r from-[#fffaf6] to-white px-3 py-2 text-left text-xs font-semibold text-[#062e39] shadow-xs transition hover:border-[#fd5523]/60 hover:bg-[#fff2e9]/60 disabled:cursor-default sm:text-sm"
              >
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#fd5523] text-[10px] font-extrabold text-white">
                  {i + 1}
                </span>
                <span className="flex-1 leading-snug">{node.label}</span>
              </button>
              {i < diagramNodes.length - 1 && (
                <ArrowDown className="my-0.5 h-3.5 w-3.5 text-slate-400" aria-hidden="true" />
              )}
            </div>
          ))}
          {onInteract && (
            <p className="pt-0.5 text-center text-[10px] font-medium text-slate-400">
              Tap any node to ask the teacher to zoom in on it
            </p>
          )}
        </div>
      )}

      {board.kind === "chart" && chartData.length > 0 && (
        <div className="space-y-2">
          {chartData.map((bar, i) => (
            <button
              key={`${bar.label}-${i}`}
              type="button"
              disabled={!onInteract || disabled}
              onClick={() => onInteract?.(`Explain "${bar.label}" (${bar.displayValue}) on this chart.`)}
              className="group block w-full space-y-1 rounded-xl p-1.5 text-left transition hover:bg-slate-50 disabled:cursor-default"
            >
              <div className="flex items-center justify-between gap-2 text-xs">
                <span className="font-semibold text-[#062e39] group-hover:text-[#fd5523]">{bar.label}</span>
                <span className="font-mono font-bold text-slate-600">{bar.displayValue}</span>
              </div>
              <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-[#fd5523] to-[#f59e0b] transition-[width] duration-500"
                  style={{ width: `${bar.pct}%` }}
                />
              </div>
            </button>
          ))}
        </div>
      )}

      {board.kind === "compare" && compareData && (
        <div className="grid gap-2">
          <div className="grid grid-cols-2 gap-2 text-[10px] font-extrabold uppercase tracking-wider">
            <span className="rounded-lg bg-slate-100 px-2.5 py-1 text-slate-600">{compareData.leftHeader}</span>
            <span className="rounded-lg bg-emerald-50 px-2.5 py-1 text-emerald-800">{compareData.rightHeader}</span>
          </div>
          {compareData.rows.map((pair, i) => (
            <div key={i} className="grid grid-cols-2 gap-2 text-xs leading-snug">
              <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-2.5 text-slate-700">
                {pair.left}
              </div>
              <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-2.5 font-medium text-[#062e39]">
                {pair.right}
              </div>
            </div>
          ))}
        </div>
      )}

      {board.kind === "note" && board.text && (
        <p className="whitespace-pre-wrap text-xs leading-relaxed text-[var(--ink)] sm:text-sm">{board.text}</p>
      )}

      {board.kind === "table" && board.rows && <BoardTable rows={board.rows} shown={board.shown} />}

      {/* Graceful fallback if a new board kind didn't parse into specialized visual data */}
      {board.kind !== "bullets" &&
        board.kind !== "steps" &&
        !(board.kind === "diagram" && diagramNodes.length > 0) &&
        !(board.kind === "chart" && chartData.length > 0) &&
        !(board.kind === "compare" && compareData) &&
        !board.text &&
        !board.rows &&
        board.items && <ListItems items={board.items} shown={board.shown} ordered={false} />}
    </div>
  );
}

function ListItems({ items, shown, ordered }: { items: string[]; shown: number; ordered: boolean }) {
  const List = ordered ? "ol" : "ul";
  return (
    <List className={`grid gap-1 pl-4 text-xs leading-relaxed text-[var(--ink)] sm:gap-1.5 sm:pl-5 sm:text-sm ${ordered ? "list-decimal" : "list-disc"}`}>
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
