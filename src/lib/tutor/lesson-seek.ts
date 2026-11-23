import type { BoardState } from "./board.ts";
import type { TutorEvent } from "./events.ts";

export type DockLessonRef = Extract<TutorEvent, { type: "show_lesson_ref" }>;

export const LESSON_SEEK_EVENT = "zai:lesson-seek";

export type LessonSeekDetail = {
  blockId?: string;
  seconds?: number;
  label?: string;
};

/**
 * Formats seconds into M:SS (e.g. 95 -> "1:35").
 */
export function formatSeekTime(seconds: number): string {
  const safe = Math.max(0, Math.floor(seconds));
  const mins = Math.floor(safe / 60);
  const secs = safe % 60;
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

/**
 * Notifies any listening VideoBlock on the lesson page to seek to `seconds`
 * and scrolls matching `data-lesson-block-id` blocks into view.
 */
export function dispatchLessonSeek(detail: LessonSeekDetail): void {
  if (typeof window === "undefined") return;
  if (detail.blockId) {
    const el = document.querySelector<HTMLElement>(
      `[data-lesson-block-id="${CSS.escape(detail.blockId)}"]`,
    );
    el?.scrollIntoView({ behavior: "smooth", block: "center" });
  }
  window.dispatchEvent(new CustomEvent<LessonSeekDetail>(LESSON_SEEK_EVENT, { detail }));
}

export type DockBoardExtraction = {
  board: BoardState | null;
  lessonRefs: DockLessonRef[];
};

/**
 * Extracts `:::board {...} :::` and `:::lesson_ref {...} :::` directives emitted
 * in an assistant message so the unified teacher dock can drive TeachingBoard & video seek.
 */
export function extractDockBoardFromText(content: string): DockBoardExtraction {
  const pattern = /:::(board|lesson_ref)\s*([\s\S]*?)\s*:::/g;
  let board: BoardState | null = null;
  const lessonRefs: DockLessonRef[] = [];

  for (const match of content.matchAll(pattern)) {
    const kind = match[1];
    let raw = match[2]?.trim() ?? "";
    raw = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(raw) as Record<string, unknown>;
    } catch {
      continue;
    }

    if (kind === "board") {
      const boardKind = parsed.kind;
      const validKind: BoardState["kind"] =
        boardKind === "bullets" ||
        boardKind === "steps" ||
        boardKind === "table" ||
        boardKind === "equation" ||
        boardKind === "code" ||
        boardKind === "note"
          ? boardKind
          : "note";
      const items = Array.isArray(parsed.items)
        ? parsed.items.filter((x): x is string => typeof x === "string" && x.trim().length > 0)
        : undefined;
      const textVal =
        typeof parsed.text === "string"
          ? parsed.text
          : typeof parsed.body === "string"
            ? parsed.body
            : undefined;
      if ((items && items.length > 0) || (textVal && textVal.trim().length > 0)) {
        board = {
          type: "show_board",
          kind: validKind,
          title: typeof parsed.title === "string" ? parsed.title : undefined,
          items,
          shown: items?.length ?? 1,
          text: textVal,
        };
      }
    } else if (kind === "lesson_ref") {
      const label = typeof parsed.label === "string" && parsed.label.trim() ? parsed.label.trim() : "Lesson reference";
      const blockId = typeof parsed.blockId === "string" && parsed.blockId.trim() ? parsed.blockId.trim() : undefined;
      const seconds =
        typeof parsed.seconds === "number" && Number.isFinite(parsed.seconds) && parsed.seconds >= 0
          ? Math.floor(parsed.seconds)
          : undefined;
      lessonRefs.push({ type: "show_lesson_ref", label, blockId, seconds });
    }
  }

  return { board, lessonRefs };
}
