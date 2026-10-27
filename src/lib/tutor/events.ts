import { z } from "zod";
import { GESTURES, MOODS, TONE_SHAPES } from "./contract.generated.ts";

// The only thing the avatar and UI listen to, identical across Live, Voice and Text modes.
// `say` is text the teacher speaks; in Live mode it comes from native audio, so it is not a tool.

const nonEmpty = z.string().min(1);

const gestureSchema = z.enum(GESTURES);
const toneShapeSchema = z.enum(TONE_SHAPES);
const moodSchema = z.enum(MOODS);

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
]);

export type TutorEvent = z.infer<typeof tutorEventSchema>;
export type TutorEventType = TutorEvent["type"];

export const tutorTurnResponseSchema = z.object({
  events: z.array(tutorEventSchema).max(12),
});

export type TutorTurnResponse = z.infer<typeof tutorTurnResponseSchema>;

export const MAX_EVENTS_PER_TURN = 12;

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

export function liveToolDeclarations(): LiveToolDeclaration[] {
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
  ];
}
