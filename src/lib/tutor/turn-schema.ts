import { GESTURES, MOODS, TONE_SHAPES } from "./contract.generated.ts";
import { BOARD_KINDS, EVIDENCE_RESULTS } from "./events.ts";

// JSON Schema passed as responseJsonSchema for Voice and Text turns (Gemini structured output).
// Hand-written in the subset Gemini accepts. It mirrors tutorTurnResponseSchema in events.ts;
// parseTutorTurn stays the source of truth and drops anything this schema lets through.
// Keep it loose: number bounds, array length limits and nested arrays multiply the constraint
// states, and past Gemini's limit every turn fails with 400 "too many states for serving".
// Bounds live in events.ts instead; turn-schema.test.ts keeps them out of here.

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
  "show_board",
  "reveal_step",
  "ask_choice",
  "ask_confidence",
  "show_lesson_ref",
  "play_clip",
  "note_evidence",
  "advance_step",
  "switch_scene",
  "award",
] as const;

export const TUTOR_TURN_JSON_SCHEMA = {
  type: "object",
  properties: {
    learnerText: {
      type: "string",
      description: "When the learner spoke in audio, verbatim transcript of what they said.",
    },
    events: {
      type: "array",
      items: {
        type: "object",
        description: "One teacher event. Set only the fields that belong to its type.",
        properties: {
          type: { type: "string", enum: [...TUTOR_EVENT_TYPES] },
          // say
          text: { type: "string", description: "say: what the teacher speaks aloud. show_text: a short written prompt. show_board: equation, code or note text." },
          romanization: { type: "string" },
          translation: { type: "string" },
          // gesture
          name: { type: "string", enum: [...GESTURES] },
          toneShape: { type: "string", enum: [...TONE_SHAPES] },
          countTo: { type: "integer", description: "1 to 5." },
          // mood
          mood: { type: "string", enum: [...MOODS] },
          intensity: { type: "number", description: "0 to 100." },
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
          // show_board (also uses title, text, language)
          kind: { type: "string", enum: [...BOARD_KINDS] },
          title: { type: "string", description: "show_board: board heading. award: what was achieved." },
          items: { type: "array", items: { type: "string" } },
          rows: { type: "array", items: { type: "array", items: { type: "string" } } },
          language: { type: "string" },
          revealed: { type: "integer" },
          // reveal_step
          index: { type: "integer" },
          // ask_choice / ask_confidence
          question: { type: "string" },
          options: { type: "array", items: { type: "string" } },
          prompt: { type: "string" },
          // show_lesson_ref
          label: { type: "string" },
          blockId: { type: "string" },
          seconds: { type: "integer" },
          // play_clip
          videoId: { type: "string" },
          start: { type: "integer" },
          end: { type: "integer" },
          caption: { type: "string" },
          // note_evidence (also uses said, correct)
          objective: { type: "string" },
          result: { type: "string", enum: [...EVIDENCE_RESULTS] },
          detail: { type: "string", description: "note_evidence detail. award: short detail." },
          // advance_step
          step: { type: "string" },
          // switch_scene
          scene: { type: "string" },
        },
        required: ["type"],
      },
    },
  },
  required: ["events"],
} as const;
