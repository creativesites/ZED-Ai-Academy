import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { z } from "zod";
import {
  BOARD_KINDS,
  BOARD_WIDGETS,
  CONTRACT_VERSION,
  CORE_EVENT_TYPES,
  EVENT_DEFINITIONS,
  EVIDENCE_RESULTS,
  LANGUAGE_ONLY_EVENT_TYPES,
  LANGUAGE_PACK_EVENT_TYPES,
  LEGACY_EVENT_ALIASES,
  MAX_BOARD_ITEMS,
  MAX_EVENTS_PER_TURN,
  SERVER_ONLY_FIELDS,
  TUTOR_EVENT_TYPES,
  TUTOR_TURN_JSON_SCHEMA,
  V1_EVENT_TYPES,
  liveToolDeclarations,
  toClientEvent,
  tutorEventSchema,
} from "./index.ts";
import { defineEvent, field } from "./define.ts";
import {
  deriveEventUnion,
  deriveLiveToolDeclarations,
  deriveServerOnlyFields,
  deriveTurnJsonSchema,
  stripServerOnly,
} from "./derive.ts";

// Drift test. The snapshot is what the model and the parser saw for this CONTRACT_VERSION, captured from the
// hand-written v2 artefacts before they were replaced by derivations. Changing a definition changes the derived
// output and fails here: bump CONTRACT_VERSION, then write a new snapshot with
//   UPDATE_CONTRACT_SNAPSHOT=1 npm run test:tutor
// and review the fixture diff. Old snapshots stay as a record of earlier versions.

const snapshotUrl = new URL(`./__fixtures__/contract-v${CONTRACT_VERSION}.snapshot.json`, import.meta.url);

function currentArtefacts() {
  return {
    eventTypes: TUTOR_EVENT_TYPES,
    v1EventTypes: V1_EVENT_TYPES,
    coreEventTypes: CORE_EVENT_TYPES,
    languageOnlyEventTypes: LANGUAGE_ONLY_EVENT_TYPES,
    languagePackEventTypes: LANGUAGE_PACK_EVENT_TYPES,
    legacyAliases: LEGACY_EVENT_ALIASES,
    boardKinds: BOARD_KINDS,
    evidenceResults: EVIDENCE_RESULTS,
    maxBoardItems: MAX_BOARD_ITEMS,
    maxEventsPerTurn: MAX_EVENTS_PER_TURN,
    liveTools: liveToolDeclarations(),
    turnJsonSchema: TUTOR_TURN_JSON_SCHEMA,
    zodJsonSchema: z.toJSONSchema(tutorEventSchema, { unrepresentable: "any" }),
  };
}

test("derived artefacts are byte-identical to the snapshot for this CONTRACT_VERSION", () => {
  const actual = JSON.stringify(currentArtefacts(), null, 2) + "\n";
  if (process.env.UPDATE_CONTRACT_SNAPSHOT === "1") writeFileSync(snapshotUrl, actual);
  assert.ok(
    existsSync(snapshotUrl),
    `no snapshot for contract v${CONTRACT_VERSION}; run UPDATE_CONTRACT_SNAPSHOT=1 npm run test:tutor and review it`,
  );
  const expected = readFileSync(snapshotUrl, "utf8");
  assert.equal(actual, expected, "contract drifted: bump CONTRACT_VERSION and refresh the snapshot (see top of file)");
});

test("CONTRACT_VERSION covers every defined event", () => {
  const newest = Math.max(...EVENT_DEFINITIONS.map((d) => d.meta.since));
  assert.ok(CONTRACT_VERSION >= newest);
  assert.ok(Number.isInteger(CONTRACT_VERSION) && CONTRACT_VERSION > 0 && CONTRACT_VERSION < 32767, "fits smallint");
});

test("each event is defined once and every artefact covers it", () => {
  const types = EVENT_DEFINITIONS.map((d) => d.type);
  assert.equal(new Set(types).size, types.length);
  assert.deepEqual([...TUTOR_EVENT_TYPES], types);
  assert.deepEqual(TUTOR_TURN_JSON_SCHEMA.properties.events.items.properties.type.enum, types);
  const parserTypes = tutorEventSchema.options.map((o) => o.shape.type.value);
  assert.deepEqual(parserTypes, types);
  const liveNames = liveToolDeclarations().map((d) => d.name);
  assert.deepEqual(liveNames, EVENT_DEFINITIONS.filter((d) => d.meta.live !== false).map((d) => d.type));
  assert.ok(!liveNames.includes("say" as never), "Live speaks natively; say is not a tool");
});

test("every model-facing field appears in the flat turn schema and in its Live tool", () => {
  const flat = TUTOR_TURN_JSON_SCHEMA.properties.events.items.properties as Record<string, unknown>;
  const live = new Map(liveToolDeclarations().map((d) => [d.name as string, d]));
  for (const def of EVENT_DEFINITIONS) {
    for (const [key, f] of Object.entries(def.fields)) {
      if (f.meta.turn !== false) assert.ok(key in flat, `${def.type}.${key} missing from turn schema`);
      const tool = live.get(def.type);
      if (tool && f.meta.live !== false) assert.ok(key in tool.parameters.properties, `${def.type}.${key} missing from Live`);
    }
  }
});

test("turn schema stays flat: no unions and objects nested at most one level inside an event", () => {
  const forbidden: string[] = [];
  function walk(node: unknown, path: string, objectDepth: number) {
    if (typeof node !== "object" || node === null) return;
    const n = node as Record<string, unknown>;
    for (const key of ["anyOf", "oneOf", "allOf", "$ref", "$defs"]) if (key in n) forbidden.push(`${path}.${key}`);
    const depth = n.type === "object" ? objectDepth + 1 : objectDepth;
    if (depth > 3) forbidden.push(`${path} (object depth ${depth})`);
    if (n.properties) for (const [k, v] of Object.entries(n.properties as object)) walk(v, `${path}.${k}`, depth);
    if (n.items) walk(n.items, `${path}[]`, depth);
  }
  walk(TUTOR_TURN_JSON_SCHEMA, "schema", 0);
  assert.deepEqual(forbidden, []);
});

test("board kinds come from the widget definitions", () => {
  assert.deepEqual([...BOARD_KINDS], BOARD_WIDGETS.map((w) => w.kind));
  assert.equal(new Set(BOARD_KINDS).size, BOARD_KINDS.length);
});

test("teaching lists and legacy aliases only name defined events", () => {
  const defined = new Set<string>(TUTOR_EVENT_TYPES);
  for (const t of [...CORE_EVENT_TYPES, ...LANGUAGE_PACK_EVENT_TYPES]) assert.ok(defined.has(t), t);
  for (const [from, to] of Object.entries(LEGACY_EVENT_ALIASES)) {
    assert.ok(defined.has(from) && defined.has(to), `${from} -> ${to}`);
  }
});

test("contract v2 has no server-only fields, and toClientEvent passes events through untouched", () => {
  assert.deepEqual(SERVER_ONLY_FIELDS, {});
  const ev = { type: "ask_choice" as const, question: "2+2?", options: ["3", "4"] };
  assert.equal(toClientEvent(ev), ev);
});

// ---- A hypothetical v3 definition set: proves answer keys are an additive change. ----

const v3AskChoice = defineEvent(
  "ask_choice",
  {
    question: field(z.string().min(1).max(240)),
    options: field(z.array(z.string().min(1).max(160)).min(2).max(5)),
    answer: field(z.array(z.number().int().min(0).max(4)).optional(), {
      serverOnly: true,
      description: "Zero-based index(es) of the correct option. Held by the server, never shown.",
    }),
  },
  { since: 3, liveDescription: "Ask a multiple-choice question." },
);
const v3AskNumeric = defineEvent(
  "ask_numeric",
  {
    prompt: field(z.string().min(1)),
    unit: field(z.string().optional()),
    value: field(z.number(), { serverOnly: true }),
    tolerance: field(z.number().min(0).optional(), { serverOnly: true }),
  },
  { since: 3, liveDescription: "Ask for a number." },
);
const v3Defs = [v3AskChoice, v3AskNumeric] as const;

test("server-only fields: the model is taught them, the parser keeps them, the client never gets them", () => {
  const union = deriveEventUnion(v3Defs);
  const parsed = union.safeParse({ type: "ask_choice", question: "2+2?", options: ["3", "4"], answer: [1] });
  assert.ok(parsed.success);
  assert.deepEqual((parsed.data as { answer?: number[] }).answer, [1]);

  const flat = deriveTurnJsonSchema(v3Defs).properties.events.items.properties;
  assert.ok("answer" in flat && "value" in flat && "tolerance" in flat);
  const live = deriveLiveToolDeclarations(v3Defs);
  assert.ok("answer" in live[0].parameters.properties);

  const serverOnly = deriveServerOnlyFields(v3Defs);
  assert.deepEqual(serverOnly, { ask_choice: ["answer"], ask_numeric: ["value", "tolerance"] });
  const event = { type: "ask_numeric", prompt: "g?", unit: "m/s²", value: 9.81, tolerance: 0.1 };
  const client = stripServerOnly(event, serverOnly);
  assert.deepEqual(client, { type: "ask_numeric", prompt: "g?", unit: "m/s²" });
  assert.equal(event.value, 9.81, "the original event (server copy) keeps the answer");
});

test("the turn schema derivation refuses ambiguous shared fields", () => {
  const a = defineEvent("a", { x: field(z.string()) }, { since: 1, liveDescription: "a" });
  const b = defineEvent("b", { x: field(z.number()) }, { since: 1, liveDescription: "b" });
  assert.throws(() => deriveTurnJsonSchema([a, b]), /different turn-schema shape/);
  const c = defineEvent("c", { x: field(z.string(), { turnDescription: "late" }) }, { since: 1, liveDescription: "c" });
  assert.throws(() => deriveTurnJsonSchema([a, c]), /first event/);
});

test("a Live event without a description is rejected", () => {
  const bare = defineEvent("bare", { x: field(z.string()) }, { since: 1 });
  assert.throws(() => deriveLiveToolDeclarations([bare]), /liveDescription/);
});

test("liveToolDeclarations returns fresh copies callers can mutate safely", () => {
  const first = liveToolDeclarations();
  first[0].description = "mutated";
  assert.notEqual(liveToolDeclarations()[0].description, "mutated");
});
