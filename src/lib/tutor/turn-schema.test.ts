import { test } from "node:test";
import assert from "node:assert/strict";
import { TUTOR_TURN_JSON_SCHEMA, TUTOR_EVENT_TYPES } from "./turn-schema.ts";
import { tutorEventSchema } from "./events.ts";

// Gemini refuses a schema with too many constraint states ("too many states for serving"), and then
// every Voice and Text turn fails. Number bounds and array length limits were what pushed it over,
// so they stay out of this schema; events.ts enforces them after the reply arrives.

const BOUND_KEYS = ["minimum", "maximum", "minItems", "maxItems", "minLength", "maxLength", "pattern", "format"];

function findBounds(node: unknown, path: string, found: string[]): void {
  if (Array.isArray(node)) {
    node.forEach((child, i) => findBounds(child, `${path}[${i}]`, found));
    return;
  }
  if (typeof node !== "object" || node === null) return;
  for (const [key, value] of Object.entries(node)) {
    if (BOUND_KEYS.includes(key)) found.push(`${path}.${key}`);
    findBounds(value, `${path}.${key}`, found);
  }
}

test("turn schema has no bounds that inflate Gemini's constraint states", () => {
  const found: string[] = [];
  findBounds(TUTOR_TURN_JSON_SCHEMA, "schema", found);
  assert.deepEqual(found, []);
});

test("turn schema lists every event type the parser accepts", () => {
  const parserTypes = tutorEventSchema.options.map((o) => o.shape.type.value).sort();
  assert.deepEqual([...TUTOR_EVENT_TYPES].sort(), parserTypes);
});
