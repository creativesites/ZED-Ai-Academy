import type { BoardState } from "./board.ts";
import type { TutorEvent } from "./contract/index.ts";

// Interactive controls for the current teacher turn. Contract v3 turns (P2-04) drive them from answerable events
// (ask_choice / ask_order / ask_fill / ask_numeric, each with a server `checkId` when the server holds the key);
// the regex inference below only runs for older turns and clients (`inferFromContext`, default on).

export type ActiveChoice = {
  question: string;
  options: string[];
  picked?: string;
  source: "event" | "inferred";
  /** Server-held check (v3): the answer is sent as { interaction: { id, value } } and graded server-side. */
  checkId?: string;
};

export type ActiveOrderChallenge = {
  prompt: string;
  items: string[];
  checkId?: string;
};

export type ActiveFillBlank = {
  template: string;
  wordBank: string[];
  checkId?: string;
};

export type ActiveNumeric = {
  prompt: string;
  unit?: string;
  checkId?: string;
};

/** Answerable v3 events as the browser receives them (keys already stripped by the server). */
export type AnswerableClientEvent = Extract<TutorEvent, { type: "ask_choice" | "ask_order" | "ask_fill" | "ask_numeric" }>;

export type DynamicQuickAction = {
  label: string;
  text: string;
  primary?: boolean;
};

export type TurnInteractionInput = {
  choice: { question: string; options: string[]; picked?: string } | null;
  confidence: { prompt?: string } | null;
  board: BoardState | null;
  whiteboard?: string | null;
  caption: { native: string; roman?: string; translation?: string } | null;
  listenHint: { expect?: string; hint?: string } | null;
  turnCount: number;
  /** Latest answerable event of this turn (v3). Takes precedence over everything inferred. */
  check?: AnswerableClientEvent | null;
  /** false for contract v3 sessions: controls come from events only, never from regex inference. Default true. */
  inferFromContext?: boolean;
};

export type TurnInteractionState = {
  activeChoice: ActiveChoice | null;
  activeOrderChallenge: ActiveOrderChallenge | null;
  activeFillBlank: ActiveFillBlank | null;
  activeNumeric: ActiveNumeric | null;
  showConfidence: boolean;
  preferTextInput: boolean;
  quickActions: DynamicQuickAction[];
};

const PICK_PROMPT_RE =
  /\b(pick|choose|select|decide which|which (one|message|option|answer|reply|sentence|phrase|approach|response)|tap (one|an option))\b/i;

const ORDER_PROMPT_RE =
  /\b(put .* in (?:the )?(?:right |correct )?order|arrange|sequence|order these|rank these|sort these)\b/i;

const FILL_BLANK_RE = /(?:_{3,}|\[blank\]|\[\s*\]|\(blank\))/i;

const TYPE_PROMPT_RE =
  /\b(type|write|draft|compose|reply with a message|send a message|fill in the blank)\b/i;

function extractInlineOptions(text: string): string[] {
  // Matches patterns like "A) ... B) ..." or "1) ... 2) ..."
  const letterMatches = [...text.matchAll(/(?:^|[\s;,.])([A-D])[):.]\s+(.+?)(?=(?:[\s;,.][A-D][):.]\s)|$)/g)];
  if (letterMatches.length >= 2 && letterMatches.length <= 4) {
    const cleaned = letterMatches
      .map((m) => `${m[1]}) ${m[2].trim().replace(/[.,;]+$/, "")}`)
      .filter((s) => s.length >= 4 && s.length <= 120);
    if (cleaned.length >= 2) return cleaned;
  }

  const numMatches = [...text.matchAll(/(?:^|[\s;,.])([1-4])[):.]\s+(.+?)(?=(?:[\s;,.][1-4][):.]\s)|$)/g)];
  if (numMatches.length >= 2 && numMatches.length <= 4) {
    const cleaned = numMatches
      .map((m) => `${m[1]}. ${m[2].trim().replace(/[.,;]+$/, "")}`)
      .filter((s) => s.length >= 4 && s.length <= 120);
    if (cleaned.length >= 2) return cleaned;
  }

  return [];
}

function inferOrderChallenge(
  board: BoardState | null,
  spokenText: string,
): ActiveOrderChallenge | null {
  if (!spokenText || !ORDER_PROMPT_RE.test(spokenText)) return null;
  if (!board?.items || board.items.length < 2) return null;
  const visible = board.items.slice(0, Math.max(board.shown, 2)).slice(0, 6);
  if (visible.length < 2) return null;
  return {
    prompt: board.title || "Tap items in the right order",
    items: visible,
  };
}

function inferFillBlank(
  board: BoardState | null,
  whiteboard: string | null | undefined,
  caption: { native: string; roman?: string; translation?: string } | null,
): ActiveFillBlank | null {
  const candidates = [whiteboard, board?.text, caption?.native].filter(
    (s): s is string => typeof s === "string" && FILL_BLANK_RE.test(s),
  );
  if (candidates.length === 0) return null;
  const template = candidates[0].trim();
  const wordBank =
    board?.items && board.items.length >= 2
      ? board.items.slice(0, Math.max(board.shown, 2)).slice(0, 6)
      : [];
  return { template, wordBank };
}

function inferChoiceFromContext(
  board: BoardState | null,
  caption: { native: string; roman?: string; translation?: string } | null,
): ActiveChoice | null {
  const spokenText = [caption?.native, caption?.translation].filter(Boolean).join(" ").trim();
  if (!spokenText || !PICK_PROMPT_RE.test(spokenText)) return null;

  // 1. Visible board items (bullets/steps)
  if (board?.items && board.items.length >= 2) {
    const visible = board.items.slice(0, Math.max(board.shown, 2)).slice(0, 6);
    if (visible.length >= 2) {
      return {
        question: board.title || "Pick an option",
        options: visible,
        source: "inferred",
      };
    }
  }

  // 2. Visible board table rows (skip header row)
  if (board?.rows && board.rows.length >= 3) {
    const body = board.rows.slice(1, Math.max(board.shown, 3)).slice(0, 5);
    const options = body
      .map((row) => row.filter(Boolean).join(" — ").trim())
      .filter(Boolean);
    if (options.length >= 2) {
      return {
        question: board.title || "Pick an option",
        options,
        source: "inferred",
      };
    }
  }

  // 3. Inline labelled options in the teacher's speech (e.g. "A) ... B) ...")
  const inline = extractInlineOptions(spokenText);
  if (inline.length >= 2) {
    return {
      question: "Pick your answer",
      options: inline,
      source: "inferred",
    };
  }

  return null;
}

function hasUnrevealedBoard(board: BoardState | null): boolean {
  if (!board) return false;
  if (board.items && board.shown < board.items.length) return true;
  if (board.rows && board.shown < board.rows.length) return true;
  return false;
}

/**
 * Computes the dynamic interactive UI state for the current teacher turn so the learner
 * always sees appropriate, thumb-friendly controls without scrolling or getting stuck.
 */
export function deriveTurnInteraction(input: TurnInteractionInput): TurnInteractionState {
  const { choice, confidence, board, whiteboard, caption, listenHint, turnCount, check } = input;
  const infer = input.inferFromContext !== false;

  const spokenText = [caption?.native, caption?.translation].filter(Boolean).join(" ").trim();

  const fromEvent = check ? controlsFromCheck(check, choice?.picked) : null;

  const activeChoice: ActiveChoice | null = fromEvent
    ? fromEvent.choice
    : choice
      ? { ...choice, source: "event" }
      : infer
        ? inferChoiceFromContext(board, caption)
        : null;

  const activeOrderChallenge: ActiveOrderChallenge | null = fromEvent
    ? fromEvent.order
    : !activeChoice && infer
      ? inferOrderChallenge(board, spokenText)
      : null;

  const activeFillBlank: ActiveFillBlank | null = fromEvent
    ? fromEvent.fill
    : !activeChoice && !activeOrderChallenge && infer
      ? inferFillBlank(board, whiteboard, caption)
      : null;

  const activeNumeric: ActiveNumeric | null = fromEvent ? fromEvent.numeric : null;

  const showConfidence =
    !activeChoice && !activeOrderChallenge && !activeFillBlank && !activeNumeric && Boolean(confidence);

  const preferTextInput =
    !activeChoice &&
    !activeOrderChallenge &&
    !showConfidence &&
    (Boolean(activeFillBlank) || Boolean(activeNumeric) || (infer && TYPE_PROMPT_RE.test(spokenText)));

  let quickActions: DynamicQuickAction[];
  if (hasUnrevealedBoard(board)) {
    quickActions = [
      { label: "Next step →", text: "Continue to the next step.", primary: true },
      { label: "Explain simpler", text: "Can you explain that in simpler words?" },
      { label: "Example", text: "Can you give me a practical example?" },
      { label: "Quiz me", text: "Ask me a quick multiple-choice question to check my understanding." },
    ];
  } else if (listenHint?.expect) {
    const trimmed =
      listenHint.expect.length > 28
        ? `${listenHint.expect.slice(0, 27)}…`
        : listenHint.expect;
    quickActions = [
      { label: `Use “${trimmed}”`, text: listenHint.expect, primary: true },
      { label: "Give a hint", text: "Can you give me a quick hint?" },
      { label: "Explain simpler", text: "Can you explain that in simpler words?" },
      { label: "Next step →", text: "Let's move to the next step." },
    ];
  } else if (turnCount === 0) {
    quickActions = [
      { label: "Let's go →", text: "I'm ready, let's begin!", primary: true },
      { label: "Show an example", text: "Can you show me an example first?" },
      { label: "Explain simpler", text: "Can you explain this simply?" },
    ];
  } else {
    quickActions = [
      { label: "Next step →", text: "Continue to the next step.", primary: true },
      { label: "Explain simpler", text: "Can you explain that in simpler words?" },
      { label: "Example", text: "Can you give me a practical example?" },
      { label: "Quiz me", text: "Ask me a quick multiple-choice question to check my understanding." },
      { label: "Got it!", text: "Got it, I understand!" },
    ];
  }

  return {
    activeChoice,
    activeOrderChallenge,
    activeFillBlank,
    activeNumeric,
    showConfidence,
    preferTextInput,
    quickActions,
  };
}

/** Controls for one answerable event. ask_order without a checkId (Live: no server round trip) is shuffled here. */
export function controlsFromCheck(
  check: AnswerableClientEvent,
  picked?: string,
): {
  choice: ActiveChoice | null;
  order: ActiveOrderChallenge | null;
  fill: ActiveFillBlank | null;
  numeric: ActiveNumeric | null;
} {
  const none = { choice: null, order: null, fill: null, numeric: null };
  const checkId = check.checkId;
  switch (check.type) {
    case "ask_choice":
      return {
        ...none,
        choice: { question: check.question, options: check.options, source: "event", ...(picked ? { picked } : {}), ...(checkId ? { checkId } : {}) },
      };
    case "ask_order":
      return {
        ...none,
        order: { prompt: check.prompt, items: checkId ? check.items : rotateForDisplay(check.items), ...(checkId ? { checkId } : {}) },
      };
    case "ask_fill":
      return { ...none, fill: { template: check.prompt, wordBank: check.options ?? [], ...(checkId ? { checkId } : {}) } };
    case "ask_numeric":
      return {
        ...none,
        numeric: { prompt: check.prompt, ...(check.unit ? { unit: check.unit } : {}), ...(checkId ? { checkId } : {}) },
      };
  }
}

/** Live sends ask_order items in the correct order (the model's key); never show them that way. */
function rotateForDisplay(items: readonly string[]): string[] {
  if (items.length < 2) return [...items];
  // Reverse, then rotate by one: never the key's order (2 items simply swap).
  const reversed = [...items].reverse();
  return items.length > 2 ? [...reversed.slice(1), reversed[0]] : reversed;
}
