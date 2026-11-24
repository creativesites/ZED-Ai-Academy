"use client";

import { BookmarkCheck, BookmarkPlus, RotateCcw, Sparkles, X } from "lucide-react";
import type { SaySpeechEvent } from "@/components/tutor/EventPlayer";

export type TranscriptEntry =
  | {
      id: string;
      role: "teacher";
      text: string;
      roman?: string;
      translation?: string;
      sayEvent?: SaySpeechEvent;
    }
  | {
      id: string;
      role: "learner";
      text: string;
    }
  | {
      id: string;
      role: "note";
      title?: string;
      text: string;
    };

type TranscriptDrawerProps = {
  open: boolean;
  onClose: () => void;
  teacherName: string;
  entries: TranscriptEntry[];
  savedKeys: ReadonlySet<string>;
  onSaveItem: (item: { key: string; term: string; pron?: string; meaning: string }) => void;
  onReplayEvent?: (ev: SaySpeechEvent, slow?: boolean) => void;
};

/**
 * Slide-over session transcript & universal Study Notes drawer.
 * Works for ANY subject (concepts, formulas, definitions, code tips, or language phrases):
 * tap Bookmark on any teacher line or board takeaway to save it to your SM-2 Study Deck.
 */
export function TranscriptDrawer({
  open,
  onClose,
  teacherName,
  entries,
  savedKeys,
  onSaveItem,
  onReplayEvent,
}: TranscriptDrawerProps) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-slate-950/35 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      aria-label="Session transcript and study notes"
      onClick={onClose}
    >
      <aside
        className="flex h-full w-full max-w-md flex-col bg-[#fffaf6] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex shrink-0 items-center justify-between gap-2 border-b border-slate-200 bg-white px-4 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
          <div>
            <h2 className="flex items-center gap-1.5 text-sm font-extrabold text-[#062e39]">
              <Sparkles className="h-4 w-4 text-[#fd5523]" aria-hidden="true" />
              Transcript &amp; Study Notes
            </h2>
            <p className="text-[11px] text-slate-500">
              Tap the bookmark on any explanation, tip, or phrase to save it to your Study Deck.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close transcript drawer"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 hover:bg-slate-100"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </header>

        <div className="min-h-0 flex-1 space-y-2.5 overflow-y-auto p-3 sm:p-4">
          {entries.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-white/80 p-8 text-center text-xs text-slate-400">
              Your session transcript and saved takeaways will appear here as you go.
            </div>
          ) : (
            entries.map((entry) => {
              if (entry.role === "learner") {
                return (
                  <div key={entry.id} className="flex justify-end">
                    <div className="max-w-[85%] rounded-2xl rounded-tr-sm bg-[#062e39] px-3.5 py-2.5 text-xs leading-relaxed text-white shadow-xs">
                      <p className="mb-0.5 text-[10px] font-bold uppercase tracking-wider text-teal-200">
                        You
                      </p>
                      <p>{entry.text}</p>
                    </div>
                  </div>
                );
              }

              if (entry.role === "note") {
                const isSaved = savedKeys.has(entry.id);
                return (
                  <div
                    key={entry.id}
                    className="rounded-2xl border border-amber-200/80 bg-amber-50/70 p-3 text-xs text-[#062e39]"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-[10px] font-extrabold uppercase tracking-wider text-amber-800">
                          {entry.title ?? "Board takeaway"}
                        </p>
                        <p className="mt-1 whitespace-pre-wrap leading-relaxed">{entry.text}</p>
                      </div>
                      <button
                        type="button"
                        disabled={isSaved}
                        onClick={() =>
                          onSaveItem({
                            key: entry.id,
                            term: (entry.title ?? entry.text).slice(0, 150),
                            meaning: entry.text.slice(0, 230),
                          })
                        }
                        title={isSaved ? "Saved to Study Deck" : "Save to Study Deck"}
                        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border transition ${
                          isSaved
                            ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                            : "border-amber-200 bg-white text-amber-800 hover:bg-amber-100"
                        }`}
                      >
                        {isSaved ? (
                          <BookmarkCheck className="h-3.5 w-3.5" aria-hidden="true" />
                        ) : (
                          <BookmarkPlus className="h-3.5 w-3.5" aria-hidden="true" />
                        )}
                      </button>
                    </div>
                  </div>
                );
              }

              const isSaved = savedKeys.has(entry.id);
              return (
                <div
                  key={entry.id}
                  className="rounded-2xl rounded-tl-sm border border-slate-200/90 bg-white p-3 text-xs text-[#062e39] shadow-xs"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="text-[10px] font-extrabold uppercase tracking-wider text-[#fd5523]">
                        {teacherName}
                      </p>
                      <p className="mt-0.5 text-[13px] font-medium leading-snug">{entry.text}</p>
                      {entry.roman && (
                        <p className="mt-0.5 text-[11px] text-slate-600">{entry.roman}</p>
                      )}
                      {entry.translation && (
                        <p className="mt-0.5 text-[11px] italic text-slate-500">
                          {entry.translation}
                        </p>
                      )}
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      {entry.sayEvent && onReplayEvent && (
                        <button
                          type="button"
                          onClick={() => onReplayEvent(entry.sayEvent!, false)}
                          title="Replay this line"
                          aria-label="Replay this line"
                          className="flex h-7 w-7 items-center justify-center rounded-full border border-slate-200 bg-slate-50 text-slate-600 hover:bg-[#fff2e9] hover:text-[#fd5523]"
                        >
                          <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
                        </button>
                      )}
                      <button
                        type="button"
                        disabled={isSaved}
                        onClick={() =>
                          onSaveItem({
                            key: entry.id,
                            term: entry.text.slice(0, 150),
                            pron: entry.roman?.slice(0, 150),
                            meaning: (entry.translation || `From ${teacherName}`).slice(0, 230),
                          })
                        }
                        title={isSaved ? "Saved to Study Deck" : "Save to Study Deck"}
                        aria-label={isSaved ? "Saved to Study Deck" : "Save to Study Deck"}
                        className={`flex h-7 w-7 items-center justify-center rounded-full border transition ${
                          isSaved
                            ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                            : "border-slate-200 bg-slate-50 text-slate-600 hover:border-[#fd5523]/40 hover:bg-[#fff2e9] hover:text-[#fd5523]"
                        }`}
                      >
                        {isSaved ? (
                          <BookmarkCheck className="h-3.5 w-3.5" aria-hidden="true" />
                        ) : (
                          <BookmarkPlus className="h-3.5 w-3.5" aria-hidden="true" />
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </aside>
    </div>
  );
}
