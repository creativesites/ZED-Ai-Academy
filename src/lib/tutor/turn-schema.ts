import { GESTURES, MOODS, TONE_SHAPES } from "./contract.generated.ts";
import { MAX_EVENTS_PER_TURN } from "./events.ts";

// JSON Schema passed as responseJsonSchema for Voice and Text turns (Gemini structured output).
// Hand-written in the subset Gemini accepts. It mirrors tutorTurnResponseSchema in events.ts;
// parseTutorTurn stays the source of truth and drops anything this schema lets through.

export const TUTOR_EVENT_TYPES = [
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

export const TUTOR_TURN_JSON_SCHEMA = {
  type: "object",
  properties: {
    events: {
      type: "array",
      maxItems: MAX_EVENTS_PER_TURN,
      items: {
        type: "object",
        description: "One teacher event. Set only the fields that belong to its type.",
        properties: {
          type: { type: "string", enum: [...TUTOR_EVENT_TYPES] },
          // say
          text: { type: "string", description: "say: what the teacher speaks aloud. show_text: text to write on the board." },
          romanization: { type: "string" },
          translation: { type: "string" },
          // gesture
          name: { type: "string", enum: [...GESTURES] },
          toneShape: { type: "string", enum: [...TONE_SHAPES] },
          countTo: { type: "integer", minimum: 1, maximum: 5 },
          // mood
          mood: { type: "string", enum: [...MOODS] },
          intensity: { type: "number", minimum: 0, maximum: 100 },
          // show_card
          item: {
            type: "object",
            properties: {
              text: { type: "string" },
              pron: { type: "string" },
              meaning: { type: "string" },
              vocabId: { type: "string" },
            },
            required: ["text"],
          },
          // show_text
          highlight: { type: "array", items: { type: "string" } },
          // trace_tone
          tones: {
            type: "array",
            items: { type: "string", enum: [...TONE_SHAPES] },
            minItems: 1,
            maxItems: 4,
          },
          labels: { type: "array", items: { type: "string" } },
          // listen
          expect: { type: "string" },
          hint: { type: "string" },
          // note_mistake
          said: { type: "string" },
          correct: { type: "string" },
          category: { type: "string", description: "tone, pronunciation, vocabulary, grammar, word_order or politeness." },
          // advance_scene
          beat: { type: "string" },
          // end_session
          summary: { type: "string" },
        },
        required: ["type"],
      },
    },
  },
  required: ["events"],
} as const;
