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
