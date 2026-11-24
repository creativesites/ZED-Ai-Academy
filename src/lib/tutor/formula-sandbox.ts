// Safe, zero-eval interactive formula parser & evaluator for TeachingBoard equations.
// Detects simple algebraic formulas like `Profit = Revenue - Cost`, `F = m * a`,
// `A = P * (1 + r)^t`, or `Margin = (Revenue - Cost) / Revenue * 100` and produces
// slider descriptors so learners can experiment with variables live on the board.

export type FormulaVariable = {
  name: string;
  min: number;
  max: number;
  step: number;
  defaultValue: number;
};

export type InteractiveFormula = {
  outputName: string;
  expression: string;
  variables: FormulaVariable[];
};

type Token =
  | { kind: "num"; value: number }
  | { kind: "id"; name: string }
  | { kind: "op"; op: "+" | "-" | "*" | "/" | "^" }
  | { kind: "lparen" }
  | { kind: "rparen" };

const RESERVED_CONSTANTS: Record<string, number> = {
  pi: Math.PI,
  PI: Math.PI,
  e: Math.E,
};

function normalizeFormulaText(raw: string): string {
  return raw
    .replace(/×/g, "*")
    .replace(/·/g, "*")
    .replace(/÷/g, "/")
    .replace(/−/g, "-")
    .replace(/²/g, "^2")
    .replace(/³/g, "^3")
    .replace(/\\times/g, "*")
    .replace(/\\cdot/g, "*")
    .replace(/\\div/g, "/")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenizeExpr(expr: string): Token[] | null {
  const tokens: Token[] = [];
  let i = 0;
  while (i < expr.length) {
    const ch = expr[i];
    if (/\s/.test(ch)) {
      i += 1;
      continue;
    }
    if (/[0-9.]/.test(ch)) {
      let end = i;
      while (end < expr.length && /[0-9.]/.test(expr[end])) end += 1;
      const num = Number(expr.slice(i, end));
      if (!Number.isFinite(num)) return null;
      tokens.push({ kind: "num", value: num });
      i = end;
      continue;
    }
    if (/[a-zA-Z_]/.test(ch)) {
      let end = i;
      while (end < expr.length && /[a-zA-Z0-9_]/.test(expr[end])) end += 1;
      tokens.push({ kind: "id", name: expr.slice(i, end) });
      i = end;
      continue;
    }
    if (ch === "+" || ch === "-" || ch === "*" || ch === "/" || ch === "^") {
      tokens.push({ kind: "op", op: ch });
      i += 1;
      continue;
    }
    if (ch === "(") {
      tokens.push({ kind: "lparen" });
      i += 1;
      continue;
    }
    if (ch === ")") {
      tokens.push({ kind: "rparen" });
      i += 1;
      continue;
    }
    return null;
  }

  // Insert implicit multiplication for cases like `2x` or `2(x + 1)` or `(a)(b)`
  const expanded: Token[] = [];
  for (let idx = 0; idx < tokens.length; idx += 1) {
    const cur = tokens[idx];
    const prev = expanded[expanded.length - 1];
    if (
      prev &&
      (prev.kind === "num" || prev.kind === "id" || prev.kind === "rparen") &&
      (cur.kind === "id" || cur.kind === "lparen")
    ) {
      expanded.push({ kind: "op", op: "*" });
    }
    expanded.push(cur);
  }
  return expanded;
}

/** Recursive-descent arithmetic evaluator (+, -, *, /, ^, parentheses, unary minus). */
export function evaluateFormulaExpression(
  expression: string,
  values: Record<string, number>,
): number | null {
  const tokens = tokenizeExpr(normalizeFormulaText(expression));
  if (!tokens || tokens.length === 0) return null;

  let pos = 0;

  function peek(): Token | undefined {
    return tokens![pos];
  }

  function parseAddSub(): number | null {
    let left = parseMulDiv();
    if (left === null) return null;
    while (true) {
      const t = peek();
      if (t?.kind === "op" && (t.op === "+" || t.op === "-")) {
        pos += 1;
        const right = parseMulDiv();
        if (right === null) return null;
        left = t.op === "+" ? left + right : left - right;
      } else {
        break;
      }
    }
    return left;
  }

  function parseMulDiv(): number | null {
    let left = parsePower();
    if (left === null) return null;
    while (true) {
      const t = peek();
      if (t?.kind === "op" && (t.op === "*" || t.op === "/")) {
        pos += 1;
        const right = parsePower();
        if (right === null) return null;
        if (t.op === "/" && Math.abs(right) < 1e-12) return null;
        left = t.op === "*" ? left * right : left / right;
      } else {
        break;
      }
    }
    return left;
  }

  function parsePower(): number | null {
    const base = parseUnary();
    if (base === null) return null;
    const t = peek();
    if (t?.kind === "op" && t.op === "^") {
      pos += 1;
      const exp = parsePower();
      if (exp === null) return null;
      const res = Math.pow(base, exp);
      return Number.isFinite(res) ? res : null;
    }
    return base;
  }

  function parseUnary(): number | null {
    const t = peek();
    if (t?.kind === "op" && (t.op === "-" || t.op === "+")) {
      pos += 1;
      const val = parseUnary();
      if (val === null) return null;
      return t.op === "-" ? -val : val;
    }
    return parsePrimary();
  }

  function parsePrimary(): number | null {
    const t = peek();
    if (!t) return null;
    if (t.kind === "num") {
      pos += 1;
      return t.value;
    }
    if (t.kind === "id") {
      pos += 1;
      if (t.name in RESERVED_CONSTANTS) return RESERVED_CONSTANTS[t.name];
      const val = values[t.name];
      return typeof val === "number" && Number.isFinite(val) ? val : null;
    }
    if (t.kind === "lparen") {
      pos += 1;
      const inner = parseAddSub();
      if (inner === null) return null;
      if (peek()?.kind !== "rparen") return null;
      pos += 1;
      return inner;
    }
    return null;
  }

  const result = parseAddSub();
  if (result === null || pos !== tokens.length || !Number.isFinite(result)) return null;
  return result;
}

function defaultRangeForVariable(name: string): Omit<FormulaVariable, "name"> {
  const lower = name.toLowerCase();
  if (lower === "r" || lower === "rate" || lower === "interest" || lower === "tax") {
    return { min: 0.01, max: 0.3, step: 0.01, defaultValue: 0.08 };
  }
  if (lower === "t" || lower === "n" || lower === "years" || lower === "time" || lower === "months") {
    return { min: 1, max: 20, step: 1, defaultValue: 5 };
  }
  if (lower === "p" || lower === "principal" || lower === "revenue" || lower === "price" || lower === "sales" || lower === "income") {
    return { min: 50, max: 1000, step: 10, defaultValue: 200 };
  }
  if (lower === "cost" || lower === "cogs" || lower === "expense" || lower === "expenses") {
    return { min: 10, max: 800, step: 10, defaultValue: 120 };
  }
  return { min: 1, max: 100, step: 1, defaultValue: 10 };
}

/**
 * Parses a single-line equation into an interactive slider sandbox if it has 1 to 3 variables
 * and evaluates cleanly with default values. Returns null for non-numeric or complex text.
 */
export function parseInteractiveFormula(rawEquation: string): InteractiveFormula | null {
  const firstLine = rawEquation.split("\n").map((l) => l.trim()).find(Boolean);
  if (!firstLine || firstLine.length > 120) return null;

  const eqIdx = firstLine.indexOf("=");
  if (eqIdx <= 0 || eqIdx !== firstLine.lastIndexOf("=")) return null;

  const lhs = firstLine.slice(0, eqIdx).trim();
  const rhs = normalizeFormulaText(firstLine.slice(eqIdx + 1));
  if (!/^[a-zA-Z][a-zA-Z0-9_\s]{0,24}$/.test(lhs) || !rhs) return null;

  const tokens = tokenizeExpr(rhs);
  if (!tokens) return null;

  const varNames: string[] = [];
  for (const t of tokens) {
    if (t.kind === "id") {
      if (t.name in RESERVED_CONSTANTS) continue;
      if (!varNames.includes(t.name)) varNames.push(t.name);
    }
  }

  if (varNames.length < 1 || varNames.length > 3) return null;

  const variables: FormulaVariable[] = varNames.map((name) => ({
    name,
    ...defaultRangeForVariable(name),
  }));

  const defaults = Object.fromEntries(variables.map((v) => [v.name, v.defaultValue]));
  const testResult = evaluateFormulaExpression(rhs, defaults);
  if (testResult === null) return null;

  return {
    outputName: lhs,
    expression: rhs,
    variables,
  };
}
