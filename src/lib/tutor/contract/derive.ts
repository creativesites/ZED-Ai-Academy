import { z } from "zod";
import type { EventDef, FieldDef } from "./define.ts";
import { serverOnlyFieldsOf } from "./define.ts";

// Derivations from the event definitions. Pure functions of their input, so tests can feed a hypothetical
// definition set (e.g. a v3 event with a server-only answer) and check the output.

// ---- Gemini Live tool declarations ----
// Plain JSON-Schema-style objects; names match the event `type` values exactly. Map `parameters` to
// `parametersJsonSchema` when passing these to @google/genai (its `parameters` field expects the uppercase
// OpenAPI `Type` enum).

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

export type LiveToolDeclarationOf<Name extends string> = {
  name: Name;
  description: string;
  parameters: {
    type: "object";
    properties: Record<string, LiveSchemaProperty>;
    required: string[];
  };
};

/** Flat Gemini turn-schema property: type, enum, items, nested properties and a description. Never bounds. */
export type TurnSchemaProperty = {
  type: string;
  enum?: string[];
  items?: TurnSchemaProperty;
  properties?: Record<string, TurnSchemaProperty>;
  required?: string[];
  description?: string;
};

type JsonSchemaNode = {
  type?: string;
  enum?: unknown[];
  items?: JsonSchemaNode;
  properties?: Record<string, JsonSchemaNode>;
  required?: string[];
  minimum?: number;
  maximum?: number;
  minItems?: number;
  maxItems?: number;
};

function jsonOf(schema: z.ZodType): JsonSchemaNode {
  return z.toJSONSchema(schema, { unrepresentable: "any", io: "input" }) as JsonSchemaNode;
}

/** A field is required when its validator rejects `undefined`. */
export function isRequiredField(def: FieldDef): boolean {
  return !def.zod.safeParse(undefined).success;
}

// Zod writes ±MAX_SAFE_INTEGER for `.int()` without an explicit bound; that is not a real bound.
function realBound(n: number | undefined): number | undefined {
  if (n === undefined || Math.abs(n) === Number.MAX_SAFE_INTEGER) return undefined;
  return n;
}

function liveFromJson(node: JsonSchemaNode, withBounds: boolean): LiveSchemaProperty {
  const out = { type: node.type } as LiveSchemaProperty;
  if (node.enum) out.enum = node.enum.map(String);
  if (node.items) out.items = liveFromJson(node.items, withBounds);
  if (node.properties) {
    out.properties = {};
    for (const [k, v] of Object.entries(node.properties)) out.properties[k] = liveFromJson(v, withBounds);
    out.required = [...(node.required ?? [])];
  }
  if (withBounds) {
    const min = realBound(node.minimum);
    const max = realBound(node.maximum);
    if (min !== undefined) out.minimum = min;
    if (max !== undefined) out.maximum = max;
    if (node.minItems !== undefined) out.minItems = node.minItems;
    if (node.maxItems !== undefined) out.maxItems = node.maxItems;
  }
  return out;
}

function liveProperty(def: FieldDef): LiveSchemaProperty {
  let out: LiveSchemaProperty;
  if (def.fields) {
    const properties: Record<string, LiveSchemaProperty> = {};
    const required: string[] = [];
    for (const [key, sub] of Object.entries(def.fields)) {
      if (sub.meta.live === false) continue;
      properties[key] = liveProperty(sub);
      if (isRequiredField(sub)) required.push(key);
    }
    // Description before properties keeps the serialised declaration identical to the hand-written v2 one.
    out = { type: "object", ...(def.meta.description !== undefined ? { description: def.meta.description } : {}), properties, required };
  } else {
    out = liveFromJson(jsonOf(def.zod), true);
    if (def.meta.liveItemBounds === false && out.items) out.items = liveFromJson(jsonOf(def.zod).items ?? {}, false);
  }
  if (def.meta.description !== undefined) out.description = def.meta.description;
  return out;
}

export function deriveLiveToolDeclarations<D extends EventDef>(
  defs: readonly D[],
): LiveToolDeclarationOf<D["type"]>[] {
  const out: LiveToolDeclarationOf<D["type"]>[] = [];
  for (const def of defs) {
    if (def.meta.live === false) continue;
    if (!def.meta.liveDescription) throw new Error(`contract: Live event ${def.type} needs a liveDescription`);
    const properties: Record<string, LiveSchemaProperty> = {};
    const required: string[] = [];
    for (const [key, f] of Object.entries(def.fields)) {
      if (f.meta.live === false) continue;
      properties[key] = liveProperty(f);
      if (isRequiredField(f)) required.push(key);
    }
    out.push({ name: def.type, description: def.meta.liveDescription, parameters: { type: "object", properties, required } });
  }
  return out;
}

// ---- Flat Gemini turn schema (Voice and Text structured output) ----
// One `events[]` item object holding the union of every event's fields, keyed by name. Keep it loose: number
// bounds, array length limits and nested `anyOf`s multiply the constraint states, and past Gemini's limit every
// turn fails with 400 "too many states for serving". The parser enforces bounds after the reply arrives.

function turnFromJson(node: JsonSchemaNode): TurnSchemaProperty {
  const out: TurnSchemaProperty = { type: String(node.type) };
  if (node.enum) out.enum = node.enum.map(String);
  if (node.items) out.items = turnFromJson(node.items);
  if (node.properties) {
    out.properties = {};
    for (const [k, v] of Object.entries(node.properties)) out.properties[k] = turnFromJson(v);
    out.required = [...(node.required ?? [])];
  }
  return out;
}

function turnProperty(def: FieldDef): TurnSchemaProperty {
  let out: TurnSchemaProperty;
  if (def.fields) {
    const properties: Record<string, TurnSchemaProperty> = {};
    const required: string[] = [];
    for (const [key, sub] of Object.entries(def.fields)) {
      if (sub.meta.turn === false) continue;
      properties[key] = turnProperty(sub);
      if (isRequiredField(sub)) required.push(key);
    }
    out = { type: "object", properties, required };
  } else {
    out = turnFromJson(jsonOf(def.zod));
  }
  if (def.meta.turnDescription !== undefined) out.description = def.meta.turnDescription;
  return out;
}

function withoutDescription(p: TurnSchemaProperty): string {
  return JSON.stringify(p, (key, value) => (key === "description" ? undefined : value));
}

export const TURN_EVENT_ITEM_DESCRIPTION = "One teacher event. Set only the fields that belong to its type.";

export function deriveTurnJsonSchema(defs: readonly EventDef[], extraProperties: Record<string, TurnSchemaProperty> = {}) {
  const properties: Record<string, TurnSchemaProperty> = {
    type: { type: "string", enum: defs.map((d) => d.type) },
  };
  for (const def of defs) {
    for (const [key, f] of Object.entries(def.fields)) {
      if (f.meta.turn === false) continue;
      const prop = turnProperty(f);
      const existing = properties[key];
      if (!existing) {
        properties[key] = prop;
        continue;
      }
      // A shared flat property must mean the same shape for every event that uses it.
      if (withoutDescription(existing) !== withoutDescription(prop)) {
        throw new Error(`contract: field ${def.type}.${key} has a different turn-schema shape than an earlier event`);
      }
      if (prop.description !== undefined) {
        throw new Error(`contract: put the turnDescription for "${key}" on its first event, not on ${def.type}`);
      }
    }
  }
  return {
    type: "object",
    properties: {
      ...extraProperties,
      events: {
        type: "array",
        items: { type: "object", description: TURN_EVENT_ITEM_DESCRIPTION, properties, required: ["type"] },
      },
    },
    required: ["events"],
  };
}

// ---- Discriminated union ----

export function deriveEventUnion(defs: readonly EventDef[]) {
  const options = defs.map((d) => d.schema) as unknown as [z.ZodObject<{ type: z.ZodLiteral<string> }>, ...z.ZodObject<{ type: z.ZodLiteral<string> }>[]];
  return z.discriminatedUnion("type", options);
}

// ---- Server-only (answer-key) fields ----

export function deriveServerOnlyFields(defs: readonly EventDef[]): Readonly<Record<string, readonly string[]>> {
  const out: Record<string, readonly string[]> = {};
  for (const def of defs) {
    const fields = serverOnlyFieldsOf(def);
    if (fields.length > 0) out[def.type] = fields;
  }
  return out;
}

/**
 * Removes server-only fields (answer keys) from an event before it leaves the server. Returns the same object when
 * the event has none, so v2 events pass through untouched.
 */
export function stripServerOnly<E extends { type: string }>(
  event: E,
  serverOnly: Readonly<Record<string, readonly string[]>>,
): E {
  const fields = serverOnly[event.type];
  if (!fields || fields.length === 0) return event;
  const copy: Record<string, unknown> = { ...event };
  for (const f of fields) delete copy[f];
  return copy as E;
}
