import { z } from "zod";
import { GESTURES, MOODS, TONE_SHAPES } from "../contract.generated.ts";
import { defineEvent, field, objectField } from "./define.ts";

// THE tutor event contract. Every event is defined once here; the Zod parser, the flat Gemini turn schema and the
// Gemini Live tool declarations are derived from these definitions (derive.ts, built in index.ts).
// `say` is text the teacher speaks; in Live mode it comes from native audio, so it is not a Live tool.
//
// Changing anything here changes what the model is taught. Bump CONTRACT_VERSION (index.ts) and refresh the
// snapshot fixture (contract.test.ts explains how) in the same commit; the drift test fails otherwise.
//
// v3 (Architecture §3.4) added answerable events. Answer-key fields are `serverOnly: true`: the parser keeps them for
// the server and `toClientEvent` strips them before the event reaches the browser.

const nonEmpty = z.string().min(1);
const YOUTUBE_ID = /^[A-Za-z0-9_-]{11}$/;

export const MAX_BOARD_ITEMS = 8;
export const MAX_EVENTS_PER_TURN = 12;

export const EVIDENCE_RESULTS = ["correct", "partial", "misconception"] as const;
export type EvidenceResult = (typeof EVIDENCE_RESULTS)[number];

/**
 * Board widget kinds, defined once. `content` lists the show_board fields the client reads for that kind (see
 * board.ts / board-visuals.ts). The widget registry (Architecture §6.2) grows from this list; new kinds will carry a
 * JSON-string `payload` so the Gemini schema stays flat.
 */
export const BOARD_WIDGETS = [
  { kind: "bullets", content: ["items"], doc: "a bulleted list" },
  { kind: "steps", content: ["items"], doc: "numbered steps, revealable one by one" },
  { kind: "equation", content: ["text"], doc: "an equation or worked line" },
  { kind: "code", content: ["text"], doc: "a code snippet (language optional)" },
  { kind: "table", content: ["rows"], doc: "a small table; first row is the header" },
  { kind: "note", content: ["text"], doc: "a short note" },
  { kind: "diagram", content: ["items", "text"], doc: "ordered nodes, or arrow-separated text" },
  { kind: "chart", content: ["rows", "items"], doc: "bars from rows or 'Label: 42%' items" },
  { kind: "compare", content: ["rows", "items"], doc: "side-by-side pairs from rows or 'A vs B' items" },
] as const satisfies readonly { kind: string; content: readonly ("items" | "text" | "rows")[]; doc: string }[];

export const BOARD_KINDS = BOARD_WIDGETS.map((w) => w.kind) as unknown as readonly [
  (typeof BOARD_WIDGETS)[number]["kind"],
  ...(typeof BOARD_WIDGETS)[number]["kind"][],
];
export type BoardKind = (typeof BOARD_KINDS)[number];

const gestureSchema = z.enum(GESTURES);
const toneShapeSchema = z.enum(TONE_SHAPES);
const moodSchema = z.enum(MOODS);

// ---- v1 events ----

const say = defineEvent(
  "say",
  {
    text: field(nonEmpty, {
      turnDescription:
        "say: what the teacher speaks aloud. show_text: a short written prompt. show_board: equation, code or note text.",
    }),
    romanization: field(z.string().optional()),
    translation: field(z.string().optional()),
    audioUrl: field(z.string().optional(), { turn: false }),
  },
  { since: 1, live: false },
);

const gesture = defineEvent(
  "gesture",
  {
    name: field(gestureSchema, { description: "Gesture to play." }),
    toneShape: field(toneShapeSchema.optional(), { description: "Tone contour for trace_tone." }),
    countTo: field(z.number().int().min(1).max(5).optional(), {
      description: "Count target for count.",
      turnDescription: "1 to 5.",
    }),
  },
  {
    since: 1,
    liveDescription:
      "Play a body gesture on the teacher avatar. Use 'trace_tone' with toneShape to show a tone contour; use 'count' with countTo to count.",
  },
);

const mood = defineEvent(
  "mood",
  {
    mood: field(moodSchema),
    intensity: field(z.number().min(0).max(100).optional(), { turnDescription: "0 to 100." }),
  },
  { since: 1, liveDescription: "Set the teacher's facial mood." },
);

const showCard = defineEvent(
  "show_card",
  {
    item: objectField(
      {
        text: field(nonEmpty),
        pron: field(z.string().optional()),
        meaning: field(z.string().optional()),
        audioUrl: field(z.string().optional(), { turn: false }),
        vocabId: field(z.string().optional()),
      },
      { description: "Card contents: text, optional pron, meaning, audioUrl, vocabId." },
    ),
  },
  { since: 1, liveDescription: "Show a vocabulary card on screen next to the teacher." },
);

const showText = defineEvent(
  "show_text",
  {
    text: field(nonEmpty),
    highlight: field(z.array(z.string()).optional()),
  },
  { since: 1, liveDescription: "Write text on the whiteboard. Optionally highlight substrings." },
);

const traceTone = defineEvent(
  "trace_tone",
  {
    tones: field(z.array(toneShapeSchema).min(1).max(4)),
    labels: field(z.array(z.string()).optional()),
  },
  { since: 1, liveDescription: "Show one to four tone contours in order, with optional labels." },
);

const listen = defineEvent(
  "listen",
  {
    expect: field(z.string().optional()),
    hint: field(z.string().optional()),
  },
  { since: 1, liveDescription: "Hand the turn to the learner. Optionally give the expected answer and a hint." },
);

const noteMistake = defineEvent(
  "note_mistake",
  {
    said: field(z.string(), { description: "What the learner said." }),
    correct: field(z.string(), { description: "The correct form." }),
    category: field(nonEmpty, {
      description: "Mistake category, e.g. tone, vocabulary, grammar.",
      turnDescription: "tone, pronunciation, vocabulary, grammar, word_order or politeness.",
    }),
  },
  { since: 1, liveDescription: "Silently record a learner mistake for the report. Not shown to the learner." },
);

const advanceScene = defineEvent(
  "advance_scene",
  { beat: field(nonEmpty, { description: "Beat id from the scenario." }) },
  { since: 1, liveDescription: "Move the scenario on to the named beat." },
);

const endSession = defineEvent(
  "end_session",
  { summary: field(z.string().optional()) },
  { since: 1, liveDescription: "End the session, with an optional summary for the learner." },
);

// ---- v2 teaching events (any subject). See docs/rive + the ZAI Teacher design. ----

const showBoard = defineEvent(
  "show_board",
  {
    kind: field(z.enum(BOARD_KINDS)),
    title: field(z.string().max(120).optional(), {
      turnDescription: "show_board: board heading. award: what was achieved.",
    }),
    items: field(z.array(z.string().min(1).max(240)).max(MAX_BOARD_ITEMS).optional(), { description: "bullets / steps" }),
    text: field(z.string().max(1200).optional(), { description: "equation, code or note" }),
    rows: field(z.array(z.array(z.string().max(120)).min(1).max(5)).max(MAX_BOARD_ITEMS).optional(), {
      description: "table rows; first row is the header",
      liveItemBounds: false,
    }),
    language: field(z.string().max(24).optional(), { description: "code language" }),
    /** How many items to show at once; reveal_step shows the rest one by one. Defaults to all. */
    revealed: field(z.number().int().min(0).max(MAX_BOARD_ITEMS).optional(), { description: "items visible at first" }),
  },
  {
    since: 2,
    liveDescription:
      "Put teaching content on the board next to the teacher: bullets, numbered steps, an equation or worked line, code, a small table, or a short note. Only use facts from the lesson content.",
    refine: {
      check: (b) => (b.items && b.items.length > 0) || (b.text && b.text.trim() !== "") || (b.rows && b.rows.length > 0) || false,
      message: "show_board needs items, text or rows",
    },
  },
);

const revealStep = defineEvent(
  "reveal_step",
  {
    /** Zero-based item index to reveal up to. Omitted: reveal the next item. */
    index: field(z.number().int().min(0).max(MAX_BOARD_ITEMS).optional()),
  },
  { since: 2, liveDescription: "Reveal the next item on the board (or up to index), in step with what you are saying." },
);

// ---- v3 answerable interactions (Architecture §3.4) ----
// The model supplies an answer key; the server moves it into the session's pending check, strips it from every
// event that leaves the server (`toClientEvent`) and grades the learner's reply itself. Live sessions are not
// taught answer keys (`live: false`): Live tool calls reach the browser directly, so a key there could not be
// kept from the learner and would not make the evidence trustworthy.

/** Server-held answer key: option text(s) for ask_choice, accepted answers per blank for ask_fill. */
// The flat turn schema has one property per name, so only the first event using a name carries its turnDescription.
const answerKey = (max: number, first = false) =>
  field(z.array(z.string().min(1).max(160)).min(1).max(max).optional(), {
    serverOnly: true,
    live: false,
    ...(first
      ? {
          turnDescription:
            "Answer key, held by the server and never shown. ask_choice: the correct option text(s), copied exactly. ask_fill: one accepted answer per blank, synonyms separated by |.",
        }
      : {}),
  });

/** Objective id (from the objectives list) a check is evidence for. */
const checkObjective = (first = false) =>
  field(z.string().max(200).optional(), {
    live: false,
    ...(first ? { turnDescription: "Objective id (before the colon in the objectives list) this check or evidence is about." } : {}),
  });

/** Set by the server when it holds the answer; the learner's reply quotes it. Never written by the model. */
const checkId = () => field(z.string().max(64).optional(), { turn: false, live: false });

const askChoice = defineEvent(
  "ask_choice",
  {
    question: field(nonEmpty.max(240)),
    options: field(z.array(z.string().min(1).max(160)).min(2).max(5)),
    answer: answerKey(5, true),
    objective: checkObjective(true),
    checkId: checkId(),
  },
  {
    since: 2,
    liveDescription: "Ask a multiple-choice question on the board. Do not reveal the answer; react to the learner's pick.",
  },
);

const askConfidence = defineEvent(
  "ask_confidence",
  { prompt: field(z.string().max(160).optional()) },
  {
    since: 2,
    liveDescription:
      "Ask the learner how sure they feel (Lost, Unsure, Got it). Use it to decide whether to simplify or move on.",
  },
);

const showLessonRef = defineEvent(
  "show_lesson_ref",
  {
    label: field(nonEmpty.max(160)),
    blockId: field(z.string().max(64).optional()),
    seconds: field(z.number().int().min(0).optional()),
  },
  { since: 2, liveDescription: "Point the learner back to part of this lesson, optionally a video time in seconds." },
);

const playClip = defineEvent(
  "play_clip",
  {
    videoId: field(z.string().regex(YOUTUBE_ID)),
    start: field(z.number().int().min(0).optional()),
    end: field(z.number().int().min(0).optional()),
    caption: field(z.string().max(160).optional()),
  },
  {
    since: 2,
    liveDescription: "Play a short segment of a YouTube video that appears in the lesson content. Never invent a video id.",
  },
);

const noteEvidence = defineEvent(
  "note_evidence",
  {
    objective: field(nonEmpty.max(200), { description: "The objective or step goal this answer is evidence for." }),
    result: field(z.enum(EVIDENCE_RESULTS)),
    detail: field(z.string().max(400).optional(), { turnDescription: "note_evidence detail. award: short detail." }),
    said: field(z.string().max(400).optional()),
    correct: field(z.string().max(400).optional()),
  },
  {
    since: 2,
    liveDescription:
      "Silently record evidence about a learning objective: correct, partial or misconception, with a short detail. Not shown to the learner.",
  },
);

const advanceStep = defineEvent(
  "advance_step",
  { step: field(nonEmpty, { description: "Step id from the flow." }) },
  { since: 2, liveDescription: "Move the flow on to the named step." },
);

const switchScene = defineEvent(
  "switch_scene",
  { scene: field(nonEmpty.max(40)) },
  { since: 2, liveDescription: "Change the backdrop scene, for example for a roleplay." },
);

const award = defineEvent(
  "award",
  {
    title: field(nonEmpty.max(80)),
    detail: field(z.string().max(160).optional()),
  },
  { since: 2, liveDescription: "Celebrate a real achievement, such as an objective clearly met. Use rarely." },
);

const askOrder = defineEvent(
  "ask_order",
  {
    prompt: field(nonEmpty.max(240)),
    /** The model writes the items in the CORRECT order; the server shuffles them and keeps the order as `answer`. */
    items: field(z.array(z.string().min(1).max(160)).min(2).max(6)),
    answer: field(z.array(z.string().min(1).max(160)).min(2).max(6).optional(), { serverOnly: true, turn: false, live: false }),
    objective: checkObjective(),
    checkId: checkId(),
  },
  {
    since: 3,
    liveDescription:
      "Ask the learner to put two to six items in order. List the items in the correct order; they are shuffled for the learner.",
  },
);

const askFill = defineEvent(
  "ask_fill",
  {
    /** Text with one ___ per blank. */
    prompt: field(nonEmpty.max(400)),
    /** Optional word bank. */
    options: field(z.array(z.string().min(1).max(160)).min(2).max(8).optional()),
    answer: answerKey(4),
    objective: checkObjective(),
    checkId: checkId(),
  },
  {
    since: 3,
    liveDescription: "Ask the learner to fill in the blanks (___) in a short text, optionally from a word bank.",
  },
);

const askNumeric = defineEvent(
  "ask_numeric",
  {
    prompt: field(nonEmpty.max(240)),
    unit: field(z.string().max(24).optional(), { turnDescription: "ask_numeric: unit of the answer, e.g. kg or %." }),
    value: field(z.number().finite().optional(), {
      serverOnly: true,
      live: false,
      turnDescription: "ask_numeric: the correct number. Held by the server, never shown.",
    }),
    tolerance: field(z.number().finite().min(0).optional(), {
      serverOnly: true,
      live: false,
      turnDescription: "ask_numeric: allowed difference from value (absolute). Omit to accept correct rounding only.",
    }),
    objective: checkObjective(),
    checkId: checkId(),
  },
  {
    since: 3,
    liveDescription: "Ask the learner for a number, with an optional unit.",
  },
);

/** Every event, in wire order. The order is the Gemini enum order and the Live tool order: append only. */
export const EVENT_DEFINITIONS = [
  say,
  gesture,
  mood,
  showCard,
  showText,
  traceTone,
  listen,
  noteMistake,
  advanceScene,
  endSession,
  showBoard,
  revealStep,
  askChoice,
  askConfidence,
  showLessonRef,
  playClip,
  noteEvidence,
  advanceStep,
  switchScene,
  award,
  askOrder,
  askFill,
  askNumeric,
] as const;

export type TutorEventType = (typeof EVENT_DEFINITIONS)[number]["type"];

/** Events that carry a server-held answer key and are graded by the server (contract v3). */
export const ANSWERABLE_EVENT_TYPES = ["ask_choice", "ask_order", "ask_fill", "ask_numeric"] as const satisfies readonly TutorEventType[];
export type AnswerableEventType = (typeof ANSWERABLE_EVENT_TYPES)[number];

// ---- Teaching policy: which events each kind of pack is taught (prompt and Live tools). ----
// Explicit lists because their order is part of the prompt text. Parsing still accepts every type.

/** Events only language packs may use. Other packs never see them in their prompt or tools. */
export const LANGUAGE_ONLY_EVENT_TYPES = ["show_card", "trace_tone"] as const satisfies readonly TutorEventType[];

/** Events every pack is taught to use (v2 + the v3 answerable checks). */
export const CORE_EVENT_TYPES = [
  "say",
  "gesture",
  "mood",
  "show_text",
  "show_board",
  "reveal_step",
  "ask_choice",
  "ask_order",
  "ask_fill",
  "ask_numeric",
  "ask_confidence",
  "show_lesson_ref",
  "play_clip",
  "listen",
  "note_evidence",
  "advance_step",
  "switch_scene",
  "award",
  "end_session",
] as const satisfies readonly TutorEventType[];

/** Language packs add vocabulary cards, tone traces and the said/correct mistake log that feeds SRS. */
export const LANGUAGE_PACK_EVENT_TYPES = [...LANGUAGE_ONLY_EVENT_TYPES, "note_mistake"] as const;

/** v1 names that have a v2 replacement. The model is taught the v2 names; v1 still parses and plays. */
export const LEGACY_EVENT_ALIASES = { note_mistake: "note_evidence", advance_scene: "advance_step" } as const;

/** Top-level fields of a Voice/Text turn besides `events` (flat Gemini schema only). */
export const TURN_EXTRA_PROPERTIES = {
  learnerText: {
    type: "string",
    description: "When the learner spoke in audio, verbatim transcript of what they said.",
  },
} as const;
