import type { TutorEvent } from "./events.ts";

// Pure board state for the teaching surface (event contract v2). Used by the session UI; tested with node:test.

export type BoardEvent = Extract<TutorEvent, { type: "show_board" }>;
export type BoardState = BoardEvent & { shown: number };

export const CONFIDENCE_LEVELS = ["Lost", "Unsure", "Got it"] as const;
export type ConfidenceLevel = (typeof CONFIDENCE_LEVELS)[number];

/** Learner reply text sent as a turn when they pick an option. The prompt teaches the model this form. */
export function choiceReply(option: string): string {
  return `I choose: ${option}`;
}

/** Number of revealable parts of a board: list items, table rows (header included), or 1 for text. */
export function boardLength(board: BoardEvent): number {
  if (board.items?.length) return board.items.length;
  if (board.rows?.length) return board.rows.length;
  return 1;
}

/** A new board's state: `revealed` items visible when given, otherwise all of them. */
export function boardFromEvent(board: BoardEvent): BoardState {
  const total = boardLength(board);
  const shown = board.revealed === undefined ? total : Math.min(board.revealed, total);
  return { ...board, shown };
}

/** After reveal_step: show up to index (inclusive) or one more. Never hides, never passes the end. */
export function revealBoard(board: BoardState, index?: number): BoardState {
  const total = boardLength(board);
  const target = index === undefined ? board.shown + 1 : index + 1;
  return { ...board, shown: Math.max(board.shown, Math.min(total, target)) };
}
