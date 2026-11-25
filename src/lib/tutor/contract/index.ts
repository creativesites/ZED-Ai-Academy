import { z } from "zod";
import {
  CORE_EVENT_TYPES,
  EVENT_DEFINITIONS,
  LANGUAGE_PACK_EVENT_TYPES,
  TURN_EXTRA_PROPERTIES,
  type TutorEventType,
} from "./definitions.ts";
import {
  deriveLiveToolDeclarations,
  deriveServerOnlyFields,
  deriveTurnJsonSchema,
  stripServerOnly,
  type LiveToolDeclarationOf,
} from "./derive.ts";

// The tutor event contract, single source (Architecture §6.1). Every artefact below is derived from
// EVENT_DEFINITIONS once, at module load. events.ts and turn-schema.ts re-export from here for existing callers.
//
// Derived at runtime rather than generated into a file: the derivation is a few hundred microseconds once per
// process, there is no generated file to forget to regenerate, and contract.test.ts pins the derived output to a
// reviewed snapshot so any change to what the model sees shows up as a fixture diff.

/**
 * Version of the tutor event contract (event set + fields), stored on each `tutor_turns` row.
 * 1: the original language-tutor events. 2: teaching events (show_board, ask_choice, note_evidence, ...).
 * 3: ask_order / ask_fill / ask_numeric and server-held answer keys (ask_choice.answer), graded by the server.
 * Not the Rive avatar contract version (contract.generated.ts CONTRACT_VERSION, a semver string).
 */
export const CONTRACT_VERSION = 3 as const;

export * from "./definitions.ts";
export type { LiveSchemaProperty, TurnSchemaProperty } from "./derive.ts";

type EventDefinitions = typeof EVENT_DEFINITIONS;
// Generic so the mapped type keeps the tuple shape (a mapped type over a concrete tuple does not).
type SchemasOf<T extends readonly unknown[]> = { -readonly [K in keyof T]: T[K] extends { schema: infer S } ? S : never };
type EventSchemas = SchemasOf<EventDefinitions>;

export const tutorEventSchema = z.discriminatedUnion(
  "type",
  EVENT_DEFINITIONS.map((d) => d.schema) as unknown as EventSchemas,
);

export type TutorEvent = z.infer<typeof tutorEventSchema>;

/** Every event type the parser accepts, in definition order. */
export const TUTOR_EVENT_TYPES = EVENT_DEFINITIONS.map((d) => d.type) as unknown as readonly TutorEventType[];

/** Event types v1 shipped with. Kept forever so stored sessions replay. */
export const V1_EVENT_TYPES = EVENT_DEFINITIONS.filter((d) => d.meta.since === 1).map(
  (d) => d.type,
) as unknown as readonly TutorEventType[];

function isLanguagePack(pack: string | null | undefined): boolean {
  return typeof pack === "string" && pack.startsWith("language-");
}

/** The event types a skill pack is taught (prompt and Live tools). Parsing still accepts every type. */
export function eventTypesForPack(pack: string | null | undefined): TutorEventType[] {
  return isLanguagePack(pack) ? [...CORE_EVENT_TYPES, ...LANGUAGE_PACK_EVENT_TYPES] : [...CORE_EVENT_TYPES];
}

export type LiveToolDeclaration = LiveToolDeclarationOf<Exclude<TutorEventType, "say">>;

const ALL_LIVE_TOOLS = deriveLiveToolDeclarations(EVENT_DEFINITIONS) as LiveToolDeclaration[];

/** Live tool declarations. With a pack, only the tools that pack is taught; without one, every tool. */
export function liveToolDeclarations(pack?: string | null): LiveToolDeclaration[] {
  const all = structuredClone(ALL_LIVE_TOOLS);
  if (pack === undefined) return all;
  const allowed = new Set<string>(eventTypesForPack(pack));
  return all.filter((d) => allowed.has(d.name));
}

/** JSON Schema passed as responseJsonSchema for Voice and Text turns (Gemini structured output). */
export const TUTOR_TURN_JSON_SCHEMA = deriveTurnJsonSchema(EVENT_DEFINITIONS, TURN_EXTRA_PROPERTIES);

/** Answer-key fields per event type that must never reach the client. Empty in contract v2. */
export const SERVER_ONLY_FIELDS = deriveServerOnlyFields(EVENT_DEFINITIONS);

/**
 * The event as the browser may see it: server-only (answer-key) fields removed. Apply to every event leaving the
 * server once v3 adds answer keys. Live tool calls go model → browser directly, so answerable events in Live need a
 * server round trip (Stream F) before they can carry a key.
 */
export function toClientEvent<E extends TutorEvent>(event: E): E {
  return stripServerOnly(event, SERVER_ONLY_FIELDS);
}
