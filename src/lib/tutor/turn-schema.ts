// JSON Schema passed as responseJsonSchema for Voice and Text turns (Gemini structured output), derived from the
// event definitions in ./contract. It mirrors tutorEventSchema; parseTutorTurn stays the source of truth and drops
// anything this schema lets through. It is kept loose: number bounds, array length limits and nested arrays
// multiply the constraint states, and past Gemini's limit every turn fails with 400 "too many states for serving".
// Bounds live in the Zod validators instead; turn-schema.test.ts keeps them out of here.

export { TUTOR_EVENT_TYPES, TUTOR_TURN_JSON_SCHEMA } from "./contract/index.ts";
