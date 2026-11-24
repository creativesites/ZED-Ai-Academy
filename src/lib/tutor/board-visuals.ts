// Pure parsers for interactive visual TeachingBoard kinds: chart, diagram, and compare.
// Works seamlessly with the existing `show_board` payload fields (items, rows, text) so
// Gemini's JSON schema stays lightweight with zero extra constraint states.

import type { BoardState } from "./board.ts";

export type ChartDatum = {
  label: string;
  value: number;
  displayValue: string;
  pct: number; // 0..100 normalized against max value
};

export type ComparePair = {
  leftHeader: string;
  rightHeader: string;
  rows: Array<{ left: string; right: string }>;
};

export type DiagramNode = {
  index: number;
  label: string;
};

function parseNumeric(raw: string): number | null {
  const cleaned = raw.replace(/[,$€£¥%\s]/g, "");
  const m = /-?\d+(?:\.\d+)?/.exec(cleaned);
  if (!m) return null;
  const n = Number(m[0]);
  return Number.isFinite(n) ? n : null;
}

/** Extracts normalized chart bars from `board.rows` or `board.items` ("Label: 42%"). */
export function parseChartData(board: BoardState): ChartDatum[] {
  const rawEntries: Array<{ label: string; value: number; displayValue: string }> = [];

  if (board.rows && board.rows.length > 0) {
    // Skip header row if second column of row 0 isn't numeric
    const startIdx = board.rows.length > 1 && parseNumeric(board.rows[0][1] ?? "") === null ? 1 : 0;
    const limit = Math.max(board.shown, startIdx + 1);
    for (const row of board.rows.slice(startIdx, limit)) {
      const label = (row[0] ?? "").trim();
      const valStr = (row[1] ?? "").trim();
      const num = parseNumeric(valStr);
      if (label && num !== null) {
        rawEntries.push({ label, value: num, displayValue: valStr || String(num) });
      }
    }
  } else if (board.items && board.items.length > 0) {
    for (const item of board.items.slice(0, Math.max(board.shown, 1))) {
      const m = /^(.+?)\s*[:=—-]\s*([^\s].*)$/.exec(item.trim());
      if (!m) continue;
      const num = parseNumeric(m[2]);
      if (num !== null) {
        rawEntries.push({ label: m[1].trim(), value: num, displayValue: m[2].trim() });
      }
    }
  }

  if (rawEntries.length === 0) return [];
  const maxVal = Math.max(...rawEntries.map((e) => Math.abs(e.value)), 1);
  return rawEntries.map((e) => ({
    ...e,
    pct: Math.min(100, Math.max(6, Math.round((Math.abs(e.value) / maxVal) * 100))),
  }));
}

/** Extracts ordered flow/concept nodes from `board.items` or arrow-separated `board.text`. */
export function parseDiagramNodes(board: BoardState): DiagramNode[] {
  if (board.items && board.items.length > 0) {
    return board.items
      .slice(0, Math.max(board.shown, 1))
      .map((item, i) => ({ index: i, label: item.trim() }))
      .filter((n) => n.label.length > 0);
  }
  if (board.text && board.text.trim()) {
    const parts = board.text
      .split(/\s*(?:->|→|=>|\n)\s*/)
      .map((s) => s.trim())
      .filter(Boolean);
    return parts.slice(0, 8).map((label, i) => ({ index: i, label }));
  }
  return [];
}

/** Extracts side-by-side comparison pairs from `board.rows` or `board.items` ("A vs B"). */
export function parseCompareData(board: BoardState): ComparePair | null {
  if (board.rows && board.rows.length >= 2) {
    const [head, ...body] = board.rows;
    const rows = body
      .slice(0, Math.max(board.shown - 1, body.length))
      .map((r) => ({ left: (r[0] ?? "").trim(), right: (r[1] ?? "").trim() }))
      .filter((r) => r.left || r.right);
    if (rows.length > 0) {
      return {
        leftHeader: (head[0] ?? "Option A").trim(),
        rightHeader: (head[1] ?? "Option B").trim(),
        rows,
      };
    }
  }

  if (board.items && board.items.length > 0) {
    const rows: Array<{ left: string; right: string }> = [];
    for (const item of board.items.slice(0, Math.max(board.shown, 1))) {
      const m = /^(.+?)\s+(?:vs\.?|→|->|\|)\s+(.+)$/i.exec(item.trim());
      if (m) rows.push({ left: m[1].trim(), right: m[2].trim() });
    }
    if (rows.length > 0) {
      return { leftHeader: "Before / Option A", rightHeader: "After / Option B", rows };
    }
  }

  return null;
}

const SUPERSCRIPTS: Record<string, string> = {
  "0": "⁰",
  "1": "¹",
  "2": "²",
  "3": "³",
  "4": "⁴",
  "5": "⁵",
  "6": "⁶",
  "7": "⁷",
  "8": "⁸",
  "9": "⁹",
  "+": "⁺",
  "-": "⁻",
  "n": "ⁿ",
  "x": "ˣ",
};

const SUBSCRIPTS: Record<string, string> = {
  "0": "₀",
  "1": "₁",
  "2": "₂",
  "3": "₃",
  "4": "₄",
  "5": "₅",
  "6": "₆",
  "7": "₇",
  "8": "₈",
  "9": "₉",
  "i": "ᵢ",
  "n": "ₙ",
  "x": "ₓ",
};

/**
 * Formats plain ASCII or LaTeX-like equations into clean publication-grade math typography
 * without external runtime dependencies.
 */
export function formatEquationDisplay(raw: string): string {
  let out = raw.trim();
  if (!out) return "";

  // Strip surrounding inline/display $ delimiters if the model emitted them.
  out = out.replace(/^\$\$?([\s\S]*?)\$\$?$/, "$1").trim();

  // Common LaTeX commands -> crisp Unicode symbols.
  out = out
    .replace(/\\frac\{([^{}]+)\}\{([^{}]+)\}/g, "($1) / ($2)")
    .replace(/\\sqrt\{([^{}]+)\}/g, "√($1)")
    .replace(/\\times\b/g, "×")
    .replace(/\\cdot\b/g, "·")
    .replace(/\\div\b/g, "÷")
    .replace(/\\pm\b/g, "±")
    .replace(/\\leq?\b/g, "≤")
    .replace(/\\geq?\b/g, "≥")
    .replace(/\\neq?\b/g, "≠")
    .replace(/\\approx\b/g, "≈")
    .replace(/\\infty\b/g, "∞")
    .replace(/\\pi\b/g, "π")
    .replace(/\\theta\b/g, "θ")
    .replace(/\\Delta\b/g, "Δ")
    .replace(/\\sum\b/g, "∑")
    .replace(/\\rightarrow\b|\\to\b/g, "→")
    .replace(/<=/g, "≤")
    .replace(/>=/g, "≥")
    .replace(/!=/g, "≠")
    .replace(/->/g, "→");

  // Superscripts (^2, ^{n+1}) and subscripts (_1, _{n}).
  out = out.replace(/\^(?:\{([0-9+\-nx]+)\}|([0-9nx]))/g, (_, grp: string | undefined, single: string | undefined) => {
    const src = grp ?? single ?? "";
    return [...src].map((c) => SUPERSCRIPTS[c] ?? c).join("");
  });
  out = out.replace(/_(?:\{([0-9inx]+)\}|([0-9inx]))/g, (_, grp: string | undefined, single: string | undefined) => {
    const src = grp ?? single ?? "";
    return [...src].map((c) => SUBSCRIPTS[c] ?? c).join("");
  });

  return out;
}

export type CodeTokenKind = "plain" | "keyword" | "string" | "comment" | "number";
export type CodeToken = { kind: CodeTokenKind; text: string };

const CODE_KEYWORDS = new Set([
  "const",
  "let",
  "var",
  "function",
  "return",
  "if",
  "else",
  "for",
  "while",
  "def",
  "class",
  "import",
  "from",
  "export",
  "async",
  "await",
  "try",
  "catch",
  "true",
  "false",
  "null",
  "None",
  "True",
  "False",
  "SELECT",
  "FROM",
  "WHERE",
  "GROUP",
  "BY",
  "ORDER",
  "JOIN",
  "INSERT",
  "INTO",
  "UPDATE",
  "SET",
  "print",
  "in",
  "of",
  "new",
]);

/** Lightweight syntax tokenizer for a single code line (comments, strings, keywords, numbers). */
export function tokenizeCodeLine(line: string): CodeToken[] {
  if (!line) return [{ kind: "plain", text: " " }];
  const tokens: CodeToken[] = [];
  const pattern = /(\/\/.*$|#.*$|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|`(?:\\.|[^`\\])*`|\b\d+(?:\.\d+)?\b|\b[A-Za-z_][A-Za-z0-9_]*\b)/g;
  let lastIdx = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(line)) !== null) {
    if (match.index > lastIdx) {
      tokens.push({ kind: "plain", text: line.slice(lastIdx, match.index) });
    }
    const text = match[0];
    if (text.startsWith("//") || text.startsWith("#")) {
      tokens.push({ kind: "comment", text });
    } else if (text.startsWith('"') || text.startsWith("'") || text.startsWith("`")) {
      tokens.push({ kind: "string", text });
    } else if (/^\d/.test(text)) {
      tokens.push({ kind: "number", text });
    } else if (CODE_KEYWORDS.has(text)) {
      tokens.push({ kind: "keyword", text });
    } else {
      tokens.push({ kind: "plain", text });
    }
    lastIdx = match.index + text.length;
  }

  if (lastIdx < line.length) {
    tokens.push({ kind: "plain", text: line.slice(lastIdx) });
  }
  return tokens;
}
