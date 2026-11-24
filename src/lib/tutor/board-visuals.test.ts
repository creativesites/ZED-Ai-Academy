import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { parseChartData, parseCompareData, parseDiagramNodes } from "./board-visuals.ts";

describe("tutor/board-visuals", () => {
  it("parses chart data from rows and skips non-numeric header row", () => {
    const data = parseChartData({
      type: "show_board",
      kind: "chart",
      rows: [
        ["Quarter", "Revenue"],
        ["Q1", "$40k"],
        ["Q2", "$80k"],
      ],
      shown: 3,
    });
    assert.equal(data.length, 2);
    assert.equal(data[0]?.label, "Q1");
    assert.equal(data[0]?.pct, 50);
    assert.equal(data[1]?.pct, 100);
  });

  it("parses chart data from colon-separated items", () => {
    const data = parseChartData({
      type: "show_board",
      kind: "chart",
      items: ["Gross Margin: 60%", "Net Margin: 15%"],
      shown: 2,
    });
    assert.equal(data.length, 2);
    assert.equal(data[0]?.value, 60);
    assert.equal(data[1]?.pct, 25);
  });

  it("parses diagram nodes from arrow-separated text", () => {
    const nodes = parseDiagramNodes({
      type: "show_board",
      kind: "diagram",
      text: "Client Request -> API Gateway -> Database",
      shown: 1,
    });
    assert.deepEqual(
      nodes.map((n) => n.label),
      ["Client Request", "API Gateway", "Database"],
    );
  });

  it("parses side-by-side comparison pairs from rows and vs-items", () => {
    const fromRows = parseCompareData({
      type: "show_board",
      kind: "compare",
      rows: [
        ["Weak", "Strong"],
        ["Free tomorrow?", "Are you available Tuesday at 2pm to review Q3?"],
      ],
      shown: 2,
    });
    assert.equal(fromRows?.leftHeader, "Weak");
    assert.equal(fromRows?.rightHeader, "Strong");
    assert.equal(fromRows?.rows.length, 1);

    const fromItems = parseCompareData({
      type: "show_board",
      kind: "compare",
      items: ["Passive voice vs Active voice"],
      shown: 1,
    });
    assert.equal(fromItems?.rows[0]?.left, "Passive voice");
    assert.equal(fromItems?.rows[0]?.right, "Active voice");
  });
});
