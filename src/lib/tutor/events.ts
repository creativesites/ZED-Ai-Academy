import { z } from "zod";
import { MAX_EVENTS_PER_TURN, tutorEventSchema, type TutorEvent } from "./contract/index.ts";

// The event contract is defined once in ./contract (definitions.ts) and everything here is derived from it.
// This module keeps the historical import path and the turn parser.
// The only thing the avatar and UI listen to, identical across Live, Voice and Text modes.

export {
  BOARD_KINDS,
  CONTRACT_VERSION,
  CORE_EVENT_TYPES,
  EVIDENCE_RESULTS,
  LANGUAGE_ONLY_EVENT_TYPES,
  LANGUAGE_PACK_EVENT_TYPES,
  LEGACY_EVENT_ALIASES,
  MAX_BOARD_ITEMS,
  MAX_EVENTS_PER_TURN,
  V1_EVENT_TYPES,
  eventTypesForPack,
  liveToolDeclarations,
  toClientEvent,
  tutorEventSchema,
} from "./contract/index.ts";
export type {
  BoardKind,
  EvidenceResult,
  LiveSchemaProperty,
  LiveToolDeclaration,
  TutorEvent,
  TutorEventType,
} from "./contract/index.ts";

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
