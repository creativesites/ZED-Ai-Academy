"use client";

import { Copy, Loader2, Square, Volume2 } from "lucide-react";
import { toast } from "sonner";
import type { TutorEvent } from "@/lib/tutor/events";
import { CONFIDENCE_LEVELS, type ConfidenceLevel } from "@/lib/tutor/board";
import { dispatchLessonSeek, formatSeekTime } from "@/lib/tutor/lesson-seek";
import { askEvidenceSummary, askSpokenText, type AskBoardState } from "@/lib/tutor/runtime/ask";
import { MessageContent } from "../chat-components/MessageContent";
import type { AskMessage } from "./use-ask-runtime";

// Renders an Ask conversation from contract events (P1-06). The pinned board (show_board, lesson refs, clips,
// awards) is drawn by TeachingBoard in the dock; this draws the messages: teacher lines, jump chips, inline
// questions (ask_choice / ask_confidence) and the "Recorded: x of y correct" line for the teacher's checks.

export function AskThread({
  messages,
  boardState,
  busy,
  speakingIdx,
  onListen,
  onChoose,
  onConfidence,
}: {
  messages: AskMessage[];
  boardState: AskBoardState;
  busy: boolean;
  speakingIdx: number | null;
  onListen: (text: string, idx: number) => void;
  onChoose: (option: string) => void;
  onConfidence: (level: ConfidenceLevel) => void;
}) {
  return (
    <>
      {messages.map((msg, i) =>
        msg.role === "user" ? (
          <div key={msg.key} className="flex flex-row-reverse gap-2.5">
            <div className="max-w-[95%] whitespace-pre-wrap rounded-[1.8rem] rounded-tr-sm bg-[#fd5523] px-4 py-4 text-sm leading-relaxed text-white shadow-sm">
              {msg.text}
            </div>
          </div>
        ) : (
          <div key={msg.key} className="flex flex-row gap-2.5">
            <div className="max-w-[95%] rounded-[1.8rem] rounded-tl-sm border border-slate-100 bg-white px-4 py-4 text-sm leading-relaxed text-slate-700 shadow-sm">
              <AssistantBody
                events={msg.events}
                index={i}
                pending={msg.pending === true}
                failed={msg.failed}
                boardState={boardState}
                busy={busy}
                speaking={speakingIdx === i}
                onListen={onListen}
                onChoose={onChoose}
                onConfidence={onConfidence}
              />
            </div>
          </div>
        ),
      )}
    </>
  );
}

function AssistantBody({
  events,
  index,
  pending,
  failed,
  boardState,
  busy,
  speaking,
  onListen,
  onChoose,
  onConfidence,
}: {
  events: TutorEvent[];
  index: number;
  pending: boolean;
  failed?: string;
  boardState: AskBoardState;
  busy: boolean;
  speaking: boolean;
  onListen: (text: string, idx: number) => void;
  onChoose: (option: string) => void;
  onConfidence: (level: ConfidenceLevel) => void;
}) {
  const visible = events.filter((e) => VISIBLE_TYPES.has(e.type));
  const spoken = askSpokenText(events);
  const evidence = pending ? null : askEvidenceSummary(events);

  if (visible.length === 0 && pending) {
    return (
      <span className="flex items-center gap-2 text-current opacity-60">
        <Loader2 className="h-4 w-4 animate-spin" />
        Thinking…
      </span>
    );
  }

  return (
    <div className="space-y-3">
      {visible.map((ev, j) => (
        <EventView
          key={j}
          event={ev}
          index={index}
          boardState={boardState}
          busy={busy}
          onChoose={onChoose}
          onConfidence={onConfidence}
        />
      ))}
      {pending && (
        <span className="flex items-center gap-2 text-xs opacity-60">
          <Loader2 className="h-3 w-3 animate-spin" />
        </span>
      )}
      {failed && <p className="text-xs font-semibold text-rose-600">{failed}</p>}
      {evidence && (
        <details className="text-[11px] text-slate-500">
          <summary className="cursor-pointer select-none">{evidence.line} · why?</summary>
          <ul className="mt-1 list-disc space-y-0.5 pl-4">
            {evidence.details.map((d, k) => (
              <li key={k}>
                {d.objective}: {d.result}
                {d.detail ? ` (${d.detail})` : ""}
              </li>
            ))}
          </ul>
          <p className="mt-1">Your teacher&apos;s judgement; it updates your review plan.</p>
        </details>
      )}
      {!pending && spoken && (
        <div className="mt-1 flex flex-wrap items-center gap-3 border-t border-slate-100 pt-3">
          <button
            type="button"
            onClick={() => onListen(spoken, index)}
            className={`flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider transition-colors ${
              speaking ? "text-[#0f766e]" : "text-slate-400 hover:text-[#0f766e]"
            }`}
          >
            {speaking ? <Square className="h-3 w-3 fill-current" /> : <Volume2 className="h-3 w-3" />}
            {speaking ? "Stop" : "Listen"}
          </button>
          <button
            type="button"
            onClick={() => {
              void navigator.clipboard.writeText(spoken);
              toast.success("Copied reply");
            }}
            className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400 transition-colors hover:text-blue-600"
          >
            <Copy className="h-3 w-3" />
            Copy
          </button>
        </div>
      )}
    </div>
  );
}

const VISIBLE_TYPES = new Set<TutorEvent["type"]>([
  "say",
  "show_text",
  "show_lesson_ref",
  "ask_choice",
  "ask_confidence",
  "show_board",
  "award",
  "end_session",
]);

function EventView({
  event,
  index,
  boardState,
  busy,
  onChoose,
  onConfidence,
}: {
  event: TutorEvent;
  index: number;
  boardState: AskBoardState;
  busy: boolean;
  onChoose: (option: string) => void;
  onConfidence: (level: ConfidenceLevel) => void;
}) {
  switch (event.type) {
    case "say":
    case "show_text":
      return <MessageContent content={event.text} />;

    case "show_lesson_ref":
      return (
        <button
          type="button"
          onClick={() => dispatchLessonSeek(event)}
          className="inline-flex items-center gap-1.5 rounded-xl bg-[#eff6ff] px-3 py-1.5 text-xs font-bold text-[#1d4ed8] transition hover:bg-[#dbeafe]"
        >
          ↗ {event.label}
          {event.seconds !== undefined ? ` · ${formatSeekTime(event.seconds)}` : ""}
        </button>
      );

    case "ask_choice": {
      const open = boardState.openChoice?.messageIndex === index && boardState.openChoice.question === event.question;
      const picked = boardState.picked[`${index}:${event.question}`];
      return (
        <div className="grid gap-2 rounded-2xl border border-slate-200 bg-slate-50 p-3">
          <p className="text-sm font-semibold text-[#062e39]">{event.question}</p>
          <div role="group" aria-label={event.question} className="grid gap-1.5">
            {event.options.map((option) => (
              <button
                key={option}
                type="button"
                disabled={!open || busy}
                aria-pressed={picked === option}
                onClick={() => onChoose(option)}
                className={`min-h-10 rounded-xl border px-3 py-2 text-left text-xs font-semibold transition disabled:cursor-not-allowed ${
                  picked === option
                    ? "border-[#0f766e] bg-[#ecfdf5] text-[#064e3b]"
                    : "border-slate-200 bg-white text-slate-700 hover:bg-slate-100 disabled:opacity-60"
                }`}
              >
                {option}
              </button>
            ))}
          </div>
        </div>
      );
    }

    case "ask_confidence": {
      const open = boardState.openConfidence?.messageIndex === index;
      if (!open) return null;
      return (
        <div className="grid gap-2">
          <p className="text-xs font-semibold text-slate-600">{event.prompt ?? "How sure do you feel?"}</p>
          <div role="group" aria-label="How sure do you feel?" className="grid grid-cols-3 gap-2">
            {CONFIDENCE_LEVELS.map((level) => (
              <button
                key={level}
                type="button"
                disabled={busy}
                onClick={() => onConfidence(level)}
                className="min-h-10 rounded-xl border border-slate-200 bg-white px-2 py-2 text-xs font-bold text-slate-700 hover:bg-slate-100 disabled:opacity-60"
              >
                {level}
              </button>
            ))}
          </div>
        </div>
      );
    }

    case "show_board":
      return (
        <p className="text-[11px] font-semibold uppercase tracking-wider text-[#0f766e]">
          On the board{event.title ? `: ${event.title}` : ""}
        </p>
      );

    case "award":
      return (
        <p role="status" className="text-xs font-bold text-amber-700">
          {event.title}
          {event.detail ? ` · ${event.detail}` : ""}
        </p>
      );

    case "end_session":
      return (
        <p className="text-[11px] text-slate-500">
          This conversation has reached its limit. Your next question starts a new one.
        </p>
      );

    default:
      return null;
  }
}
