// Server grader for answerable interactions (contract v3, Architecture §3.4). Pure: no I/O, no "@/" imports.
//
// Generic on purpose: it grades an answer spec against a learner value and knows nothing about sessions, so any
// surface with a server-held key (Teaching Room checks, dock checks once they become `ask_choice`) can reuse it.

export type AnswerSpec =
  /** `options` as shown; `correct` = zero-based indexes of the right option(s). */
  | { kind: "choice"; options: string[]; correct: number[] }
  /** `items` as shown (shuffled); `correct` = the same items in the right order. */
  | { kind: "order"; items: string[]; correct: string[] }
  /** One list of accepted answers per blank. */
  | { kind: "fill"; blanks: string[][] }
  /** `tolerance` absolute; omitted = exact, or correct rounding of the true value (see numericTolerance). */
  | { kind: "numeric"; value: number; tolerance?: number; unit?: string };

export type GradeOutcome = "correct" | "partial" | "misconception";

export type GradeResult = {
  /** 0..1 */
  score: number;
  result: GradeOutcome;
  /** What the learner gave, as text (for the teacher note and evidence detail). */
  given: string;
  /** The expected answer, as text. Server-side only: goes to the model in the teacher note, never to the client. */
  expected: string;
};

export type GradeError = { error: string };

const PARTIAL_THRESHOLD = 0.5;

function outcomeFor(score: number): GradeOutcome {
  if (score >= 1) return "correct";
  if (score >= PARTIAL_THRESHOLD) return "partial";
  return "misconception";
}

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}

/** Lower-cases, strips accents, punctuation at the ends and inner whitespace runs. Keeps inner punctuation. */
export function normaliseAnswer(text: string): string {
  return text
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^[\s"'.,;:!?()[\]]+|[\s"'.,;:!?()[\]]+$/g, "");
}

/** Levenshtein distance, capped: returns cap+1 as soon as the distance must exceed `cap`. */
export function editDistance(a: string, b: string, cap = 2): number {
  if (Math.abs(a.length - b.length) > cap) return cap + 1;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    let rowMin = i;
    for (let j = 1; j <= b.length; j++) {
      const v = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      cur.push(v);
      if (v < rowMin) rowMin = v;
    }
    if (rowMin > cap) return cap + 1;
    prev = cur;
  }
  return prev[b.length];
}

// ---- choice ----

/** Resolves model-written answer text(s) to option indexes: exact (normalised) text, else a letter/number label. */
export function resolveChoiceAnswer(options: readonly string[], answer: readonly string[]): number[] | null {
  const norm = options.map(normaliseAnswer);
  const out = new Set<number>();
  for (const raw of answer) {
    const a = normaliseAnswer(raw);
    if (!a) return null;
    let idx = norm.indexOf(a);
    if (idx < 0) {
      // "B", "b)", "2" style labels.
      const letter = /^([a-e])\)?$/.exec(a);
      const num = /^([1-5])\)?$/.exec(a);
      if (letter) idx = letter[1].charCodeAt(0) - 97;
      else if (num) idx = Number(num[1]) - 1;
      // Option text written with a label prefix, e.g. "B) Paris".
      if (idx < 0) idx = norm.findIndex((o) => o.replace(/^[a-e1-5][).:]\s*/, "") === a.replace(/^[a-e1-5][).:]\s*/, ""));
    }
    if (idx < 0 || idx >= options.length) return null;
    out.add(idx);
  }
  return out.size > 0 ? [...out].sort((x, y) => x - y) : null;
}

function choiceIndexes(options: readonly string[], value: unknown): number[] | null {
  const items = Array.isArray(value) ? value : [value];
  if (items.length === 0 || items.length > options.length) return null;
  const out = new Set<number>();
  for (const v of items) {
    if (typeof v === "number" && Number.isInteger(v) && v >= 0 && v < options.length) out.add(v);
    else if (typeof v === "string") {
      const idx = options.map(normaliseAnswer).indexOf(normaliseAnswer(v));
      if (idx < 0) return null;
      out.add(idx);
    } else return null;
  }
  return [...out].sort((x, y) => x - y);
}

function gradeChoice(spec: Extract<AnswerSpec, { kind: "choice" }>, value: unknown): GradeResult | GradeError {
  const picked = choiceIndexes(spec.options, value);
  if (!picked) return { error: "choice value must be option index(es) or option text" };
  const correct = new Set(spec.correct);
  const exact = picked.length === correct.size && picked.every((i) => correct.has(i));
  let score = exact ? 1 : 0;
  // Multi-answer questions: some right picks and no wrong ones earn partial credit.
  if (!exact && correct.size > 1 && picked.every((i) => correct.has(i))) score = picked.length / correct.size;
  return {
    score,
    result: outcomeFor(score),
    given: picked.map((i) => spec.options[i]).join("; "),
    expected: spec.correct.map((i) => spec.options[i]).join("; "),
  };
}

// ---- order ----

function orderValue(items: readonly string[], value: unknown): string[] | null {
  if (!Array.isArray(value) || value.length !== items.length) return null;
  const out: string[] = [];
  for (const v of value) {
    if (typeof v === "number" && Number.isInteger(v) && v >= 0 && v < items.length) out.push(items[v]);
    else if (typeof v === "string") {
      const idx = items.map(normaliseAnswer).indexOf(normaliseAnswer(v));
      if (idx < 0) return null;
      out.push(items[idx]);
    } else return null;
  }
  if (new Set(out.map(normaliseAnswer)).size !== out.length) return null;
  return out;
}

/** Fraction of item pairs the learner put in the same relative order as the key (1 = exact, 0 = reversed). */
export function pairwiseOrderScore(correct: readonly string[], given: readonly string[]): number {
  const pos = new Map(given.map((g, i) => [normaliseAnswer(g), i]));
  const n = correct.length;
  if (n < 2) return 1;
  let agree = 0;
  let total = 0;
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      total++;
      const a = pos.get(normaliseAnswer(correct[i]));
      const b = pos.get(normaliseAnswer(correct[j]));
      if (a !== undefined && b !== undefined && a < b) agree++;
    }
  }
  return total === 0 ? 1 : agree / total;
}

function gradeOrder(spec: Extract<AnswerSpec, { kind: "order" }>, value: unknown): GradeResult | GradeError {
  const given = orderValue(spec.items, value);
  if (!given) return { error: "order value must list every item once" };
  const score = clamp01(pairwiseOrderScore(spec.correct, given));
  return { score, result: outcomeFor(score), given: given.join(" → "), expected: spec.correct.join(" → ") };
}

// ---- fill ----

/** Splits each model-written blank answer on | into accepted alternatives. */
export function fillBlanksFromAnswer(answer: readonly string[]): string[][] {
  return answer
    .map((entry) => entry.split("|").map((s) => s.trim()).filter(Boolean))
    .filter((alts) => alts.length > 0);
}

function gradeFill(spec: Extract<AnswerSpec, { kind: "fill" }>, value: unknown): GradeResult | GradeError {
  const given = Array.isArray(value) ? value : [value];
  if (given.length === 0 || given.length > 8 || !given.every((v) => typeof v === "string")) {
    return { error: "fill value must be text, or one text per blank" };
  }
  const texts = given as string[];
  // A single answer for a multi-blank prompt may separate blanks with commas or slashes.
  const parts =
    texts.length === 1 && spec.blanks.length > 1 ? texts[0].split(/\s*[,/;]\s*/) : texts;
  let total = 0;
  for (let i = 0; i < spec.blanks.length; i++) {
    const g = normaliseAnswer(parts[i] ?? "");
    if (!g) continue;
    const accepted = spec.blanks[i].map(normaliseAnswer);
    if (accepted.includes(g)) total += 1;
    // One slip in a longer word (a typo, not a different word) earns half credit.
    else if (g.length >= 5 && accepted.some((a) => a.length >= 5 && editDistance(a, g, 1) <= 1)) total += 0.5;
  }
  const score = spec.blanks.length === 0 ? 0 : clamp01(total / spec.blanks.length);
  return {
    score,
    result: outcomeFor(score),
    given: parts.slice(0, spec.blanks.length).join(" / "),
    expected: spec.blanks.map((b) => b[0]).join(" / "),
  };
}

// ---- numeric ----

/** Parses "1,234.5", "1 234,5", "45%", "9.8 m/s²", "-3" etc. Returns the number and its decimal places. */
export function parseLearnerNumber(raw: unknown): { value: number; decimals: number } | null {
  if (typeof raw === "number") {
    if (!Number.isFinite(raw)) return null;
    const s = String(raw);
    return { value: raw, decimals: s.includes(".") ? s.split(".")[1].length : 0 };
  }
  if (typeof raw !== "string") return null;
  const m = /[-+−]?\s*\d[\d\s,.']*/.exec(raw.trim());
  if (!m) return null;
  let s = m[0].replace(/−/, "-").replace(/[\s']/g, "");
  const lastComma = s.lastIndexOf(",");
  const lastDot = s.lastIndexOf(".");
  if (lastComma >= 0 && lastDot >= 0) {
    // Whichever separator comes last is the decimal point.
    s = lastDot > lastComma ? s.replace(/,/g, "") : s.replace(/\./g, "").replace(",", ".");
  } else if (lastComma >= 0) {
    // "1,234" / "12,345,678" are thousands; "3,5" is a decimal comma.
    s = /^[-+]?\d{1,3}(,\d{3})+$/.test(s) ? s.replace(/,/g, "") : s.replace(",", ".");
  } else if ((s.match(/\./g) ?? []).length > 1) {
    s = s.replace(/\./g, ""); // "1.234.567"
  }
  s = s.replace(/[.,]$/, "");
  const value = Number(s);
  if (!Number.isFinite(value)) return null;
  return { value, decimals: s.includes(".") ? s.split(".")[1].length : 0 };
}

function decimalsOf(n: number): number {
  const s = String(n);
  if (s.includes("e")) return 6;
  return s.includes(".") ? Math.min(6, s.split(".")[1].length) : 0;
}

/**
 * Tolerance for a numeric check. An explicit tolerance wins. Otherwise the learner may round the true value to at
 * least min(2, its decimals) places: 3.14159 accepts 3.14 but not 3.1; 3.4 accepts 3.4 but not 3.
 */
export function numericTolerance(spec: { value: number; tolerance?: number }, learnerDecimals: number): number {
  const eps = 1e-9 * Math.max(1, Math.abs(spec.value));
  if (spec.tolerance !== undefined && spec.tolerance >= 0) return spec.tolerance + eps;
  const required = Math.min(2, decimalsOf(spec.value));
  if (learnerDecimals >= required && learnerDecimals < decimalsOf(spec.value)) return 0.5 * 10 ** -learnerDecimals + eps;
  return eps;
}

function gradeNumeric(spec: Extract<AnswerSpec, { kind: "numeric" }>, value: unknown): GradeResult | GradeError {
  const parsed = parseLearnerNumber(value);
  if (!parsed) return { error: "numeric value must be a number" };
  const tol = numericTolerance(spec, parsed.decimals);
  const ok = Math.abs(parsed.value - spec.value) <= tol;
  const unit = spec.unit ? ` ${spec.unit}` : "";
  return {
    score: ok ? 1 : 0,
    result: ok ? "correct" : "misconception",
    given: `${parsed.value}${unit}`,
    expected: `${spec.value}${unit}${spec.tolerance ? ` (± ${spec.tolerance})` : ""}`,
  };
}

/** Grades one learner value against a spec. Never throws; a malformed value is an error, not a wrong answer. */
export function gradeInteraction(spec: AnswerSpec, value: unknown): GradeResult | GradeError {
  try {
    switch (spec.kind) {
      case "choice":
        return gradeChoice(spec, value);
      case "order":
        return gradeOrder(spec, value);
      case "fill":
        return gradeFill(spec, value);
      case "numeric":
        return gradeNumeric(spec, value);
    }
  } catch {
    return { error: "could not grade" };
  }
}

export function isGradeError(r: GradeResult | GradeError): r is GradeError {
  return "error" in r;
}
