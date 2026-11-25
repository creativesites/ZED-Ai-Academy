/**
 * Parsing a model's JSON reply. Pure.
 *
 * With `responseJsonSchema` the reply should be exactly one JSON value, but models occasionally wrap it in markdown
 * fences or add a sentence around it. The generation routes used to regex the reply; this keeps that tolerance in
 * one tested place: strict parse first, then fences stripped, then the outermost object/array substring.
 */

export type JsonShape = "object" | "array";

export class AiJsonError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AiJsonError";
  }
}

function matchesShape(value: unknown, shape: JsonShape): boolean {
  if (shape === "array") return Array.isArray(value);
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function tryParse(text: string): { ok: true; value: unknown } | { ok: false } {
  try {
    return { ok: true, value: JSON.parse(text) };
  } catch {
    return { ok: false };
  }
}

const FENCE = /^```(?:json|JSON)?\s*([\s\S]*?)\s*```$/;

/** Parses the JSON value of the expected shape from a model reply, or throws {@link AiJsonError}. */
export function parseModelJson(raw: string | null | undefined, shape: JsonShape = "object"): unknown {
  const text = (raw ?? "").trim();
  if (!text) throw new AiJsonError("The model returned an empty reply.");

  const whole = tryParse(text);
  if (whole.ok) {
    // Valid JSON of the wrong shape is a shape error: do not go digging inside it.
    if (matchesShape(whole.value, shape)) return whole.value;
    throw new AiJsonError(`The model reply was JSON but not a JSON ${shape}.`);
  }

  const candidates: string[] = [];
  const fenced = FENCE.exec(text);
  if (fenced) candidates.push(fenced[1]);
  const span = shape === "array" ? /\[[\s\S]*\]/.exec(text) : /\{[\s\S]*\}/.exec(text);
  if (span) candidates.push(span[0]);

  for (const candidate of candidates) {
    const parsed = tryParse(candidate);
    if (parsed.ok && matchesShape(parsed.value, shape)) return parsed.value;
  }
  // A bare array when an object was wanted (or vice versa) is a shape error, not a parse error.
  throw new AiJsonError(`The model reply did not contain a JSON ${shape}.`);
}
