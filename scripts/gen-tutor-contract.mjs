// Generates src/lib/tutor/contract.generated.ts from docs/rive/teacher.contract.json.
// Run with: npm run gen:tutor-contract
// Output is deterministic: same JSON in, byte-identical TS out.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const inPath = resolve(root, "docs/rive/teacher.contract.json");
const outPath = resolve(root, "src/lib/tutor/contract.generated.ts");

const contract = JSON.parse(readFileSync(inPath, "utf8"));

// Serialises a JSON value as a TS literal: 2-space indent, identifier keys unquoted,
// arrays of primitives kept on one line. Key order follows the JSON file, so output is deterministic.
function lit(value, indent = "") {
  const next = indent + "  ";
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) {
    if (value.every((v) => v === null || typeof v !== "object")) {
      return `[${value.map((v) => JSON.stringify(v)).join(", ")}]`;
    }
    return `[\n${value.map((v) => next + lit(v, next)).join(",\n")}\n${indent}]`;
  }
  const entries = Object.entries(value);
  if (entries.length === 0) return "{}";
  const body = entries
    .map(([k, v]) => {
      const key = /^[A-Za-z_$][\w$]*$/.test(k) ? k : JSON.stringify(k);
      return `${next}${key}: ${lit(v, next)}`;
    })
    .join(",\n");
  return `{\n${body}\n${indent}}`;
}

function constArray(name, values) {
  return `export const ${name} = ${lit(values)} as const;\n`;
}

function pickProps(vm) {
  const out = {};
  for (const [key, def] of Object.entries(vm)) {
    const entry = { type: def.type };
    if (def.enum !== undefined) entry.enum = def.enum;
    if (def.min !== undefined) entry.min = def.min;
    if (def.max !== undefined) entry.max = def.max;
    if (def.default !== undefined) entry.default = def.default;
    out[key] = entry;
  }
  return out;
}

const enums = contract.enums;
const visemes = contract.visemes.map((v) => ({ value: v.value, name: v.name }));
const visemeValues = visemes.map((v) => v.value);
const artboards = {};
for (const [name, ab] of Object.entries(contract.artboards)) {
  artboards[name] = { size: ab.size, stateMachine: ab.stateMachine, viewModel: ab.viewModel };
}
const toneTrace = {
  traceBox: contract.toneTrace.traceBox,
  durationMs: contract.toneTrace.durationMs,
  paths: contract.toneTrace.paths,
};
const anchors = Object.fromEntries(Object.entries(contract.anchors).filter(([k]) => !k.startsWith("$")));
const riveEvents = Object.keys(contract.events);

const parts = [];
parts.push(
  "// GENERATED — do not edit; run npm run gen:tutor-contract",
  "// Source: docs/rive/teacher.contract.json (contract version " + contract.version + ").",
  "",
);
parts.push(constArray("GESTURES", enums.Gesture));
parts.push("export type Gesture = (typeof GESTURES)[number];\n");
parts.push(constArray("TONE_SHAPES", enums.ToneShape));
parts.push("export type ToneShape = (typeof TONE_SHAPES)[number];\n");
parts.push(constArray("MOODS", enums.Mood));
parts.push("export type Mood = (typeof MOODS)[number];\n");
parts.push(constArray("HAIR_STYLES", enums.HairStyle));
parts.push("export type HairStyle = (typeof HAIR_STYLES)[number];\n");
parts.push(constArray("OUTFIT_STYLES", enums.OutfitStyle));
parts.push("export type OutfitStyle = (typeof OUTFIT_STYLES)[number];\n");
parts.push(constArray("PROPS", enums.Prop));
parts.push("export type Prop = (typeof PROPS)[number];\n");
parts.push(`export const VISEMES = ${lit(visemes)} as const;\n`);
parts.push(`export type VisemeValue = ${visemeValues.join(" | ")};\n`);
parts.push(`export const TEACHER_VM_PROPS = ${lit(pickProps(contract.viewModels.TeacherVM))} as const;\n`);
parts.push(`export const SCENE_VM_PROPS = ${lit(pickProps(contract.viewModels.SceneVM))} as const;\n`);
parts.push(constArray("RIVE_EVENTS", riveEvents));
parts.push(`export const ARTBOARDS = ${lit(artboards)} as const;\n`);
parts.push(`export const TONE_TRACE = ${lit(toneTrace)} as const;\n`);
parts.push(`export const ANCHORS = ${lit(anchors)} as const;\n`);
parts.push(`export const CONTRACT_VERSION = ${JSON.stringify(contract.version)} as const;\n`);

mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, parts.join("\n"));
console.log(`wrote ${outPath}`);
