"use client";

import { useMemo, useState } from "react";
import { ArrowDown, BarChart3, BookmarkCheck, BookmarkPlus, Check, Copy, GitBranch, PieChart, Scale, SlidersHorizontal, Terminal, TrendingUp } from "lucide-react";
import type { ClipEvent, LessonRefEvent } from "@/components/tutor/EventPlayer";
import { CONFIDENCE_LEVELS, type BoardState, type ConfidenceLevel } from "@/lib/tutor/board";
import {
  formatEquationDisplay,
  parseChartData,
  parseCompareData,
  parseDiagramNodes,
  tokenizeCodeLine,
  type ChartDatum,
  type CodeTokenKind,
} from "@/lib/tutor/board-visuals";
import { evaluateFormulaExpression, parseInteractiveFormula, type InteractiveFormula } from "@/lib/tutor/formula-sandbox";
import { dispatchLessonSeek } from "@/lib/tutor/lesson-seek";
import styles from "./practice.module.css";
import { BRAND_COLORS } from "@/lib/brand";

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

const CODE_TOKEN_CLASS: Record<CodeTokenKind, string> = {
  plain: "text-slate-100",
  keyword: "font-semibold text-sky-300",
  string: "text-emerald-300",
  comment: "italic text-slate-400",
  number: "text-amber-300",
};

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
  const [copiedText, setCopiedText] = useState(false);

  const handleCopy = (text: string) => {
    void navigator.clipboard?.writeText(text);
    setCopiedText(true);
    setTimeout(() => setCopiedText(false), 1800);
  };
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
            {board.kind === "chart" && <BarChart3 className="h-4 w-4 text-brand-text" aria-hidden="true" />}
            {board.kind === "diagram" && <GitBranch className="h-4 w-4 text-brand-text" aria-hidden="true" />}
            {board.kind === "compare" && <Scale className="h-4 w-4 text-brand-text" aria-hidden="true" />}
            {board.kind === "code" && <Terminal className="h-4 w-4 text-brand-text" aria-hidden="true" />}
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
                : "border-[var(--line-strong)] bg-[var(--soft)] text-[var(--ink-dim)] hover:border-brand/40 hover:bg-brand-tint hover:text-brand-text"
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
        <div className="space-y-2.5 rounded-xl border border-amber-200/70 bg-[#fffaf4] px-3 py-3 text-center">
          <p className="whitespace-pre-wrap font-serif text-base font-bold tracking-wide leading-relaxed text-[var(--ink)] sm:text-lg">
            {formatEquationDisplay(board.text)}
          </p>
          <FormulaSandboxWidget
            equationText={board.text}
            disabled={disabled}
            onInteract={onInteract}
          />
          <div className="flex flex-wrap items-center justify-center gap-2">
            {onInteract && (
              <button
                type="button"
                disabled={disabled}
                onClick={() => onInteract("Walk me through this formula step by step with concrete numbers.")}
                className="rounded-full border border-amber-300 bg-white px-2.5 py-0.5 text-[11px] font-bold text-amber-900 transition hover:bg-amber-50 disabled:opacity-50"
              >
                Walk through with numbers →
              </button>
            )}
            <button
              type="button"
              onClick={() => handleCopy(board.text!)}
              className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-white/80 px-2.5 py-0.5 text-[11px] font-semibold text-amber-800 transition hover:bg-white"
            >
              {copiedText ? <Check className="h-3 w-3 text-emerald-600" /> : <Copy className="h-3 w-3" />}
              {copiedText ? "Copied" : "Copy"}
            </button>
          </div>
        </div>
      )}

      {board.kind === "code" && board.text && (
        <div className="space-y-1.5">
          <div className="overflow-hidden rounded-xl bg-[#0f172a]">
            <div className="flex items-center justify-between border-b border-slate-800 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">
              <span>{board.language || "code"}</span>
              <button
                type="button"
                onClick={() => handleCopy(board.text!)}
                className="inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-bold text-slate-300 transition hover:bg-white/10 hover:text-white"
              >
                {copiedText ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
                {copiedText ? "Copied" : "Copy"}
              </button>
            </div>
            <div
              aria-label={board.language ? `${board.language} code` : "Code"}
              className="overflow-x-auto p-2 font-mono text-xs leading-relaxed text-slate-100 sm:p-3 sm:text-[13px]"
            >
              {board.text.split("\n").map((line, i) => {
                const lineNum = i + 1;
                const isSelected = selectedCodeLine === lineNum;
                const tokens = tokenizeCodeLine(line);
                return (
                  <button
                    key={lineNum}
                    type="button"
                    disabled={!onInteract || disabled}
                    onClick={() => setSelectedCodeLine(isSelected ? null : lineNum)}
                    className={`flex w-full items-start gap-2.5 rounded px-1.5 py-0.5 text-left transition ${
                      isSelected
                        ? "bg-brand/25 text-white ring-1 ring-brand/60"
                        : onInteract
                          ? "hover:bg-white/10"
                          : ""
                    }`}
                  >
                    <span className="w-5 shrink-0 select-none text-right text-[10px] text-slate-500">
                      {lineNum}
                    </span>
                    <code className="whitespace-pre">
                      {tokens.map((tok, ti) => (
                        <span key={ti} className={CODE_TOKEN_CLASS[tok.kind]}>
                          {tok.text}
                        </span>
                      ))}
                    </code>
                  </button>
                );
              })}
            </div>
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
                    className="rounded-full bg-brand px-2.5 py-1 text-[11px] font-bold text-white hover:bg-brand-hover disabled:opacity-50"
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
                    className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-bold text-ink hover:bg-slate-50 disabled:opacity-50"
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
                className="flex w-full items-center gap-2.5 rounded-xl border border-slate-200 bg-gradient-to-r from-surface to-white px-3 py-2 text-left text-xs font-semibold text-ink shadow-xs transition hover:border-brand/60 hover:bg-brand-tint/60 disabled:cursor-default sm:text-sm"
              >
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand text-[10px] font-extrabold text-white">
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
        <InteractiveChartWidget
          data={chartData}
          disabled={disabled}
          onInteract={onInteract}
        />
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
              <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-2.5 font-medium text-ink">
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

function FormulaSandboxWidget({
  equationText,
  disabled,
  onInteract,
}: {
  equationText: string;
  disabled: boolean;
  onInteract?: (prompt: string) => void;
}) {
  const formula = useMemo<InteractiveFormula | null>(
    () => parseInteractiveFormula(equationText),
    [equationText],
  );
  const [open, setOpen] = useState(false);
  const [values, setValues] = useState<Record<string, number>>(() =>
    formula ? Object.fromEntries(formula.variables.map((v) => [v.name, v.defaultValue])) : {},
  );

  if (!formula) return null;

  const activeValues = Object.fromEntries(
    formula.variables.map((v) => [v.name, values[v.name] ?? v.defaultValue]),
  );
  const result = evaluateFormulaExpression(formula.expression, activeValues);
  const formattedResult =
    result === null
      ? "—"
      : Math.abs(result) >= 100
        ? result.toFixed(1).replace(/\.0$/, "")
        : result.toFixed(2).replace(/\.?0+$/, "");

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-full border border-brand/30 bg-brand-tint px-3 py-1 text-[11px] font-bold text-brand-hover transition hover:bg-[#ffe5d4]"
      >
        <SlidersHorizontal className="h-3 w-3" aria-hidden="true" />
        Try interactive sliders
      </button>
    );
  }

  return (
    <div className="space-y-2.5 rounded-xl border border-amber-200 bg-white p-3 text-left shadow-xs">
      <div className="flex items-center justify-between gap-2">
        <span className="inline-flex items-center gap-1 text-[10px] font-extrabold uppercase tracking-wider text-amber-800">
          <SlidersHorizontal className="h-3 w-3" aria-hidden="true" />
          Live Formula Sandbox
        </span>
        <span className="rounded-lg bg-emerald-50 px-2.5 py-0.5 font-mono text-xs font-extrabold text-emerald-800">
          {formula.outputName} = {formattedResult}
        </span>
      </div>
      <div className="space-y-2">
        {formula.variables.map((v) => {
          const val = activeValues[v.name];
          return (
            <label key={v.name} className="block space-y-0.5 text-xs">
              <div className="flex items-center justify-between font-semibold text-ink">
                <span>{v.name}</span>
                <span className="font-mono text-brand-text">{val}</span>
              </div>
              <input
                type="range"
                min={v.min}
                max={v.max}
                step={v.step}
                value={val}
                onChange={(e) =>
                  setValues((prev) => ({ ...prev, [v.name]: Number(e.target.value) }))
                }
                className="h-1.5 w-full cursor-pointer accent-brand"
              />
            </label>
          );
        })}
      </div>
      {onInteract && result !== null && (
        <button
          type="button"
          disabled={disabled}
          onClick={() => {
            const summary = formula.variables
              .map((v) => `${v.name}=${activeValues[v.name]}`)
              .join(", ");
            onInteract(
              `In the sandbox with ${summary}, I got ${formula.outputName} = ${formattedResult}. What does this result tell us?`,
            );
          }}
          className="w-full rounded-lg bg-ink px-3 py-1.5 text-[11px] font-bold text-white transition hover:bg-ink-hover disabled:opacity-50"
        >
          Ask teacher about this case →
        </button>
      )}
    </div>
  );
}

const CHART_COLORS = [BRAND_COLORS.royalBlue, BRAND_COLORS.electricBlue, BRAND_COLORS.purple, BRAND_COLORS.orange, "#15805f", BRAND_COLORS.magenta];

function InteractiveChartWidget({
  data,
  disabled,
  onInteract,
}: {
  data: ChartDatum[];
  disabled: boolean;
  onInteract?: (prompt: string) => void;
}) {
  const [view, setView] = useState<"bar" | "line" | "donut">("bar");

  const totalAbs = Math.max(
    data.reduce((s, d) => s + Math.abs(d.value), 0),
    1,
  );

  return (
    <div className="space-y-2">
      {/* Compact view switcher */}
      <div className="flex items-center justify-end gap-1">
        {(
          [
            { id: "bar", label: "Bar", Icon: BarChart3 },
            { id: "line", label: "Line", Icon: TrendingUp },
            { id: "donut", label: "Donut", Icon: PieChart },
          ] as const
        ).map(({ id, label, Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => setView(id)}
            className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold transition ${
              view === id
                ? "bg-ink text-white"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            <Icon className="h-3 w-3" aria-hidden="true" />
            {label}
          </button>
        ))}
      </div>

      {view === "bar" && (
        <div className="space-y-1.5">
          {data.map((bar, i) => (
            <button
              key={`${bar.label}-${i}`}
              type="button"
              disabled={!onInteract || disabled}
              onClick={() => onInteract?.(`Explain "${bar.label}" (${bar.displayValue}) on this chart.`)}
              className="group block w-full space-y-1 rounded-xl p-1.5 text-left transition hover:bg-slate-50 disabled:cursor-default"
            >
              <div className="flex items-center justify-between gap-2 text-xs">
                <span className="font-semibold text-ink group-hover:text-brand-text">{bar.label}</span>
                <span className="font-mono font-bold text-slate-600">{bar.displayValue}</span>
              </div>
              <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full transition-[width] duration-500"
                  style={{
                    width: `${bar.pct}%`,
                    backgroundColor: CHART_COLORS[i % CHART_COLORS.length],
                  }}
                />
              </div>
            </button>
          ))}
        </div>
      )}

      {view === "line" && (
        <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-3">
          <svg viewBox="0 0 280 120" className="h-32 w-full overflow-visible" role="img" aria-label="Line chart">
            <line x1="16" y1="100" x2="264" y2="100" stroke="#cbd5e1" strokeWidth="1" />
            {data.length > 1 && (
              <polyline
                fill="none"
                stroke={BRAND_COLORS.royalBlue}
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                points={data
                  .map((d, i) => {
                    const x = 24 + (i * 232) / Math.max(1, data.length - 1);
                    const y = 96 - (d.pct / 100) * 76;
                    return `${x},${y}`;
                  })
                  .join(" ")}
              />
            )}
            {data.map((d, i) => {
              const x = data.length === 1 ? 140 : 24 + (i * 232) / Math.max(1, data.length - 1);
              const y = 96 - (d.pct / 100) * 76;
              return (
                <g key={`${d.label}-${i}`}>
                  <circle cx={x} cy={y} r="4.5" fill={BRAND_COLORS.navy} stroke="#ffffff" strokeWidth="1.5" />
                  <text x={x} y={y - 9} textAnchor="middle" fontSize="9" fontWeight="700" fill={BRAND_COLORS.navy}>
                    {d.displayValue}
                  </text>
                  <text x={x} y={114} textAnchor="middle" fontSize="9" fill="#64748b">
                    {d.label.slice(0, 10)}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>
      )}

      {view === "donut" && (
        <div className="flex flex-wrap items-center justify-center gap-4 rounded-xl border border-slate-100 bg-slate-50/70 p-3">
          <svg viewBox="0 0 100 100" className="h-28 w-28 -rotate-90" role="img" aria-label="Donut chart">
            {(() => {
              let offset = 0;
              const circ = 2 * Math.PI * 36;
              return data.map((d, i) => {
                const frac = Math.abs(d.value) / totalAbs;
                const dash = frac * circ;
                const el = (
                  <circle
                    key={`${d.label}-${i}`}
                    cx="50"
                    cy="50"
                    r="36"
                    fill="none"
                    stroke={CHART_COLORS[i % CHART_COLORS.length]}
                    strokeWidth="14"
                    strokeDasharray={`${dash} ${circ - dash}`}
                    strokeDashoffset={-offset}
                  />
                );
                offset += dash;
                return el;
              });
            })()}
          </svg>
          <ul className="space-y-1 text-xs">
            {data.map((d, i) => {
              const share = Math.round((Math.abs(d.value) / totalAbs) * 100);
              return (
                <li key={`${d.label}-${i}`} className="flex items-center gap-2">
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }}
                  />
                  <span className="font-semibold text-ink">{d.label}</span>
                  <span className="font-mono text-slate-500">
                    {d.displayValue} ({share}%)
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
