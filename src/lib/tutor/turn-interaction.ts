import type { BoardState } from "./board.ts";

export type ActiveChoice = {
  question: string;
  options: string[];
  picked?: string;
  source: "event" | "inferred";
};

export type ActiveOrderChallenge = {
  prompt: string;
  items: string[];
};

export type ActiveFillBlank = {
  template: string;
  wordBank: string[];
};

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
};

export type TurnInteractionState = {
  activeChoice: ActiveChoice | null;
  activeOrderChallenge: ActiveOrderChallenge | null;
  activeFillBlank: ActiveFillBlank | null;
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
  const { choice, confidence, board, whiteboard, caption, listenHint, turnCount } = input;

  const spokenText = [caption?.native, caption?.translation].filter(Boolean).join(" ").trim();

  const activeChoice: ActiveChoice | null = choice
    ? { ...choice, source: "event" }
    : inferChoiceFromContext(board, caption);

  const activeOrderChallenge: ActiveOrderChallenge | null =
    !activeChoice ? inferOrderChallenge(board, spokenText) : null;

  const activeFillBlank: ActiveFillBlank | null =
    !activeChoice && !activeOrderChallenge ? inferFillBlank(board, whiteboard, caption) : null;

  const showConfidence = !activeChoice && !activeOrderChallenge && !activeFillBlank && Boolean(confidence);

  const preferTextInput =
    !activeChoice &&
    !activeOrderChallenge &&
    !showConfidence &&
    (Boolean(activeFillBlank) || TYPE_PROMPT_RE.test(spokenText));

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
    showConfidence,
    preferTextInput,
    quickActions,
  };
}
