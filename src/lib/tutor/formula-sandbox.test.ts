import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { evaluateFormulaExpression, parseInteractiveFormula } from "./formula-sandbox.ts";

describe("tutor/formula-sandbox", () => {
  it("parses and evaluates finance formulas like Profit = Revenue - Cost", () => {
    const parsed = parseInteractiveFormula("Profit = Revenue - Cost");
    assert.ok(parsed);
    assert.equal(parsed.outputName, "Profit");
    assert.deepEqual(
      parsed.variables.map((v) => v.name),
      ["Revenue", "Cost"],
    );
    assert.equal(evaluateFormulaExpression(parsed.expression, { Revenue: 500, Cost: 320 }), 180);
  });

  it("handles exponents and implicit multiplication like A = P * (1 + r)^t", () => {
    const parsed = parseInteractiveFormula("A = P * (1 + r)^t");
    assert.ok(parsed);
    assert.equal(parsed.variables.length, 3);
    const val = evaluateFormulaExpression(parsed.expression, { P: 100, r: 0.1, t: 2 });
    assert.ok(val !== null && Math.abs(val - 121) < 1e-6);
  });

  it("handles unicode multiplication/division and powers", () => {
    const parsed = parseInteractiveFormula("Area = pi × r²");
    assert.ok(parsed);
    assert.deepEqual(
      parsed.variables.map((v) => v.name),
      ["r"],
    );
    const val = evaluateFormulaExpression(parsed.expression, { r: 2 });
    assert.ok(val !== null && Math.abs(val - Math.PI * 4) < 1e-6);
  });

  it("safely returns null on division by zero or invalid/non-formula text", () => {
    assert.equal(evaluateFormulaExpression("10 / x", { x: 0 }), null);
    assert.equal(parseInteractiveFormula("Just a regular sentence"), null);
    assert.equal(parseInteractiveFormula("A = B + C + D + E"), null); // > 3 vars
  });
});
