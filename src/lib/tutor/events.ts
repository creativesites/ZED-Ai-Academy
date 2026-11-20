import { z } from "zod";
import { GESTURES, MOODS, TONE_SHAPES } from "./contract.generated.ts";

// The only thing the avatar and UI listen to, identical across Live, Voice and Text modes.
// `say` is text the teacher speaks; in Live mode it comes from native audio, so it is not a tool.

const nonEmpty = z.string().min(1);

const gestureSchema = z.enum(GESTURES);
const toneShapeSchema = z.enum(TONE_SHAPES);
const moodSchema = z.enum(MOODS);

export const BOARD_KINDS = ["bullets", "steps", "equation", "code", "table", "note"] as const;
export type BoardKind = (typeof BOARD_KINDS)[number];
export const EVIDENCE_RESULTS = ["correct", "partial", "misconception"] as const;
export type EvidenceResult = (typeof EVIDENCE_RESULTS)[number];
export const MAX_BOARD_ITEMS = 8;
export const MAX_EVENTS_PER_TURN = 12;
const YOUTUBE_ID = /^[A-Za-z0-9_-]{11}$/;

export const tutorEventSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("say"),
    text: nonEmpty,
    romanization: z.string().optional(),
    translation: z.string().optional(),
    audioUrl: z.string().optional(),
  }),
  z.object({
    type: z.literal("gesture"),
    name: gestureSchema,
    toneShape: toneShapeSchema.optional(),
    countTo: z.number().int().min(1).max(5).optional(),
  }),
  z.object({
    type: z.literal("mood"),
    mood: moodSchema,
    intensity: z.number().min(0).max(100).optional(),
  }),
  z.object({
    type: z.literal("show_card"),
    item: z.object({
      text: nonEmpty,
      pron: z.string().optional(),
      meaning: z.string().optional(),
      audioUrl: z.string().optional(),
      vocabId: z.string().optional(),
    }),
  }),
  z.object({
    type: z.literal("show_text"),
    text: nonEmpty,
    highlight: z.array(z.string()).optional(),
  }),
  z.object({
    type: z.literal("trace_tone"),
    tones: z.array(toneShapeSchema).min(1).max(4),
    labels: z.array(z.string()).optional(),
  }),
  z.object({
    type: z.literal("listen"),
    expect: z.string().optional(),
    hint: z.string().optional(),
  }),
  z.object({
    type: z.literal("note_mistake"),
    said: z.string(),
    correct: z.string(),
    category: nonEmpty,
  }),
  z.object({
    type: z.literal("advance_scene"),
    beat: nonEmpty,
  }),
  z.object({
    type: z.literal("end_session"),
    summary: z.string().optional(),
  }),
  // ---- v2 teaching events (any subject). See docs/rive + the ZAI Teacher design. ----
  z
    .object({
      type: z.literal("show_board"),
      kind: z.enum(BOARD_KINDS),
      title: z.string().max(120).optional(),
      items: z.array(z.string().min(1).max(240)).max(MAX_BOARD_ITEMS).optional(),
      text: z.string().max(1200).optional(),
      rows: z.array(z.array(z.string().max(120)).min(1).max(5)).max(MAX_BOARD_ITEMS).optional(),
      language: z.string().max(24).optional(),
      /** How many items to show at once; reveal_step shows the rest one by one. Defaults to all. */
      revealed: z.number().int().min(0).max(MAX_BOARD_ITEMS).optional(),
    })
    .refine((b) => (b.items && b.items.length > 0) || (b.text && b.text.trim() !== "") || (b.rows && b.rows.length > 0), {
      message: "show_board needs items, text or rows",
    }),
  z.object({
    type: z.literal("reveal_step"),
    /** Zero-based item index to reveal up to. Omitted: reveal the next item. */
    index: z.number().int().min(0).max(MAX_BOARD_ITEMS).optional(),
  }),
  z.object({
    type: z.literal("ask_choice"),
    question: nonEmpty.max(240),
    options: z.array(z.string().min(1).max(160)).min(2).max(5),
  }),
  z.object({
    type: z.literal("ask_confidence"),
    prompt: z.string().max(160).optional(),
  }),
  z.object({
    type: z.literal("show_lesson_ref"),
    label: nonEmpty.max(160),
    blockId: z.string().max(64).optional(),
    seconds: z.number().int().min(0).optional(),
  }),
  z.object({
    type: z.literal("play_clip"),
    videoId: z.string().regex(YOUTUBE_ID),
    start: z.number().int().min(0).optional(),
    end: z.number().int().min(0).optional(),
    caption: z.string().max(160).optional(),
  }),
  z.object({
    type: z.literal("note_evidence"),
    objective: nonEmpty.max(200),
    result: z.enum(EVIDENCE_RESULTS),
    detail: z.string().max(400).optional(),
    said: z.string().max(400).optional(),
    correct: z.string().max(400).optional(),
  }),
  z.object({
    type: z.literal("advance_step"),
    step: nonEmpty,
  }),
  z.object({
    type: z.literal("switch_scene"),
    scene: nonEmpty.max(40),
  }),
  z.object({
    type: z.literal("award"),
    title: nonEmpty.max(80),
    detail: z.string().max(160).optional(),
  }),
]);

/** Event types v1 shipped with. Kept forever so stored sessions replay. */
export const V1_EVENT_TYPES = [
  "say",
  "gesture",
  "mood",
  "show_card",
  "show_text",
  "trace_tone",
  "listen",
  "note_mistake",
  "advance_scene",
  "end_session",
] as const;

/** Events only language packs may use. Other packs never see them in their prompt or tools. */
export const LANGUAGE_ONLY_EVENT_TYPES = ["show_card", "trace_tone"] as const;

/** Events every pack is taught to use (v2). */
export const CORE_EVENT_TYPES = [
  "say",
  "gesture",
  "mood",
  "show_text",
  "show_board",
  "reveal_step",
  "ask_choice",
  "ask_confidence",
  "show_lesson_ref",
  "play_clip",
  "listen",
  "note_evidence",
  "advance_step",
  "switch_scene",
  "award",
  "end_session",
] as const;

/** Language packs add vocabulary cards, tone traces and the said/correct mistake log that feeds SRS. */
export const LANGUAGE_PACK_EVENT_TYPES = [...LANGUAGE_ONLY_EVENT_TYPES, "note_mistake"] as const;

function isLanguagePack(pack: string | null | undefined): boolean {
  return typeof pack === "string" && pack.startsWith("language-");
}

/** The event types a skill pack is taught (prompt and Live tools). Parsing still accepts every type. */
export function eventTypesForPack(pack: string | null | undefined): TutorEventType[] {
  return isLanguagePack(pack) ? [...CORE_EVENT_TYPES, ...LANGUAGE_PACK_EVENT_TYPES] : [...CORE_EVENT_TYPES];
}

/** v1 names that have a v2 replacement. The model is taught the v2 names; v1 still parses and plays. */
export const LEGACY_EVENT_ALIASES = { note_mistake: "note_evidence", advance_scene: "advance_step" } as const;

export type TutorEvent = z.infer<typeof tutorEventSchema>;
export type TutorEventType = TutorEvent["type"];

export const tutorTurnResponseSchema = z.object({
  events: z.array(tutorEventSchema).max(MAX_EVENTS_PER_TURN),
});

export type TutorTurnResponse = z.infer<typeof tutorTurnResponseSchema>;


export type ParseTutorTurnResult =
  | { ok: true; events: TutorEvent[]; dropped: number }
  | { ok: false; error: string };

/**
 * Parses a model turn `{ events: [...] }`. Never throws.
 * Invalid individual events are dropped (and counted in `dropped`) rather than failing the whole turn.
 * Events beyond MAX_EVENTS_PER_TURN are also dropped. A string input is parsed as JSON first,
 * because model text output often arrives that way.
 */
export function parseTutorTurn(json: unknown): ParseTutorTurnResult {
  try {
    let value: unknown = json;
    if (typeof value === "string") {
      try {
        value = JSON.parse(value);
      } catch {
        return { ok: false, error: "turn is not valid JSON" };
      }
    }
    if (typeof value !== "object" || value === null || Array.isArray(value)) {
      return { ok: false, error: "turn must be an object" };
    }
    const rawEvents = (value as { events?: unknown }).events;
    if (!Array.isArray(rawEvents)) {
      return { ok: false, error: "turn.events must be an array" };
    }

    const events: TutorEvent[] = [];
    let dropped = 0;
    for (const raw of rawEvents) {
      if (events.length >= MAX_EVENTS_PER_TURN) {
        dropped++;
        continue;
      }
      const parsed = tutorEventSchema.safeParse(raw);
      if (parsed.success) {
        events.push(parsed.data);
      } else {
        dropped++;
      }
    }
    return { ok: true, events, dropped };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "unknown parse error" };
  }
}

// Function declarations for Gemini Live. Live speaks natively, so `say` is excluded.
// Plain JSON-Schema-style objects; names match the event `type` values exactly.
// Map `parameters` to `parametersJsonSchema` when passing these to @google/genai
// (its `parameters` field expects the uppercase OpenAPI `Type` enum).

export type LiveSchemaProperty = {
  type: "string" | "number" | "integer" | "boolean" | "array" | "object";
  description?: string;
  enum?: string[];
  items?: LiveSchemaProperty;
  properties?: Record<string, LiveSchemaProperty>;
  required?: string[];
  minimum?: number;
  maximum?: number;
  minItems?: number;
  maxItems?: number;
};

export type LiveToolDeclaration = {
  name: Exclude<TutorEventType, "say">;
  description: string;
  parameters: {
    type: "object";
    properties: Record<string, LiveSchemaProperty>;
    required: string[];
  };
};

/** Live tool declarations. With a pack, only the tools that pack is taught; without one, every tool. */
export function liveToolDeclarations(pack?: string | null): LiveToolDeclaration[] {
  const all = allLiveToolDeclarations();
  if (pack === undefined) return all;
  const allowed = new Set<string>(eventTypesForPack(pack));
  return all.filter((d) => allowed.has(d.name));
}

function allLiveToolDeclarations(): LiveToolDeclaration[] {
  return [
    {
      name: "gesture",
      description:
        "Play a body gesture on the teacher avatar. Use 'trace_tone' with toneShape to show a tone contour; use 'count' with countTo to count.",
      parameters: {
        type: "object",
        properties: {
          name: { type: "string", enum: [...GESTURES], description: "Gesture to play." },
          toneShape: { type: "string", enum: [...TONE_SHAPES], description: "Tone contour for trace_tone." },
          countTo: { type: "integer", minimum: 1, maximum: 5, description: "Count target for count." },
        },
        required: ["name"],
      },
    },
    {
      name: "mood",
      description: "Set the teacher's facial mood.",
      parameters: {
        type: "object",
        properties: {
          mood: { type: "string", enum: [...MOODS] },
          intensity: { type: "number", minimum: 0, maximum: 100 },
        },
        required: ["mood"],
      },
    },
    {
      name: "show_card",
      description: "Show a vocabulary card on screen next to the teacher.",
      parameters: {
        type: "object",
        properties: {
          item: {
            type: "object",
            description: "Card contents: text, optional pron, meaning, audioUrl, vocabId.",
            properties: {
              text: { type: "string" },
              pron: { type: "string" },
              meaning: { type: "string" },
              audioUrl: { type: "string" },
              vocabId: { type: "string" },
            },
            required: ["text"],
          },
        },
        required: ["item"],
      },
    },
    {
      name: "show_text",
      description: "Write text on the whiteboard. Optionally highlight substrings.",
      parameters: {
        type: "object",
        properties: {
          text: { type: "string" },
          highlight: { type: "array", items: { type: "string" } },
        },
        required: ["text"],
      },
    },
    {
      name: "trace_tone",
      description: "Show one to four tone contours in order, with optional labels.",
      parameters: {
        type: "object",
        properties: {
          tones: { type: "array", items: { type: "string", enum: [...TONE_SHAPES] }, minItems: 1, maxItems: 4 },
          labels: { type: "array", items: { type: "string" } },
        },
        required: ["tones"],
      },
    },
    {
      name: "listen",
      description: "Hand the turn to the learner. Optionally give the expected answer and a hint.",
      parameters: {
        type: "object",
        properties: {
          expect: { type: "string" },
          hint: { type: "string" },
        },
        required: [],
      },
    },
    {
      name: "note_mistake",
      description: "Silently record a learner mistake for the report. Not shown to the learner.",
      parameters: {
        type: "object",
        properties: {
          said: { type: "string", description: "What the learner said." },
          correct: { type: "string", description: "The correct form." },
          category: { type: "string", description: "Mistake category, e.g. tone, vocabulary, grammar." },
        },
        required: ["said", "correct", "category"],
      },
    },
    {
      name: "advance_scene",
      description: "Move the scenario on to the named beat.",
      parameters: {
        type: "object",
        properties: {
          beat: { type: "string", description: "Beat id from the scenario." },
        },
        required: ["beat"],
      },
    },
    {
      name: "end_session",
      description: "End the session, with an optional summary for the learner.",
      parameters: {
        type: "object",
        properties: {
          summary: { type: "string" },
        },
        required: [],
      },
    },
    {
      name: "show_board",
      description:
        "Put teaching content on the board next to the teacher: bullets, numbered steps, an equation or worked line, code, a small table, or a short note. Only use facts from the lesson content.",
      parameters: {
        type: "object",
        properties: {
          kind: { type: "string", enum: [...BOARD_KINDS] },
          title: { type: "string" },
          items: { type: "array", items: { type: "string" }, maxItems: MAX_BOARD_ITEMS, description: "bullets / steps" },
          text: { type: "string", description: "equation, code or note" },
          rows: {
            type: "array",
            items: { type: "array", items: { type: "string" } },
            maxItems: MAX_BOARD_ITEMS,
            description: "table rows; first row is the header",
          },
          language: { type: "string", description: "code language" },
          revealed: { type: "integer", minimum: 0, maximum: MAX_BOARD_ITEMS, description: "items visible at first" },
        },
        required: ["kind"],
      },
    },
    {
      name: "reveal_step",
      description: "Reveal the next item on the board (or up to index), in step with what you are saying.",
      parameters: {
        type: "object",
        properties: { index: { type: "integer", minimum: 0, maximum: MAX_BOARD_ITEMS } },
        required: [],
      },
    },
    {
      name: "ask_choice",
      description: "Ask a multiple-choice question on the board. Do not reveal the answer; react to the learner's pick.",
      parameters: {
        type: "object",
        properties: {
          question: { type: "string" },
          options: { type: "array", items: { type: "string" }, minItems: 2, maxItems: 5 },
        },
        required: ["question", "options"],
      },
    },
    {
      name: "ask_confidence",
      description: "Ask the learner how sure they feel (Lost, Unsure, Got it). Use it to decide whether to simplify or move on.",
      parameters: { type: "object", properties: { prompt: { type: "string" } }, required: [] },
    },
    {
      name: "show_lesson_ref",
      description: "Point the learner back to part of this lesson, optionally a video time in seconds.",
      parameters: {
        type: "object",
        properties: {
          label: { type: "string" },
          blockId: { type: "string" },
          seconds: { type: "integer", minimum: 0 },
        },
        required: ["label"],
      },
    },
    {
      name: "play_clip",
      description: "Play a short segment of a YouTube video that appears in the lesson content. Never invent a video id.",
      parameters: {
        type: "object",
        properties: {
          videoId: { type: "string" },
          start: { type: "integer", minimum: 0 },
          end: { type: "integer", minimum: 0 },
          caption: { type: "string" },
        },
        required: ["videoId"],
      },
    },
    {
      name: "note_evidence",
      description:
        "Silently record evidence about a learning objective: correct, partial or misconception, with a short detail. Not shown to the learner.",
      parameters: {
        type: "object",
        properties: {
          objective: { type: "string", description: "The objective or step goal this answer is evidence for." },
          result: { type: "string", enum: [...EVIDENCE_RESULTS] },
          detail: { type: "string" },
          said: { type: "string" },
          correct: { type: "string" },
        },
        required: ["objective", "result"],
      },
    },
    {
      name: "advance_step",
      description: "Move the flow on to the named step.",
      parameters: {
        type: "object",
        properties: { step: { type: "string", description: "Step id from the flow." } },
        required: ["step"],
      },
    },
    {
      name: "switch_scene",
      description: "Change the backdrop scene, for example for a roleplay.",
      parameters: { type: "object", properties: { scene: { type: "string" } }, required: ["scene"] },
    },
    {
      name: "award",
      description: "Celebrate a real achievement, such as an objective clearly met. Use rarely.",
      parameters: {
        type: "object",
        properties: { title: { type: "string" }, detail: { type: "string" } },
        required: ["title"],
      },
    },
  ];
}
