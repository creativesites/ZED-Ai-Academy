import { test } from "node:test";
import assert from "node:assert/strict";
import { resolveLite, shouldDefaultToLite } from "./lite-mode.ts";

test("Lite is the default on save-data, slow links and cellular", () => {
  assert.equal(shouldDefaultToLite({ saveData: true }), true);
  assert.equal(shouldDefaultToLite({ effectiveType: "3g" }), true);
  assert.equal(shouldDefaultToLite({ effectiveType: "2g" }), true);
  assert.equal(shouldDefaultToLite({ type: "cellular", effectiveType: "4g" }), true);
  assert.equal(shouldDefaultToLite({ type: "wifi", effectiveType: "4g" }), false);
  assert.equal(shouldDefaultToLite({}), false);
  assert.equal(shouldDefaultToLite(null), false);
});

test("a saved choice beats the network guess", () => {
  assert.equal(resolveLite("0", { saveData: true }), false);
  assert.equal(resolveLite("1", { type: "wifi" }), true);
  assert.equal(resolveLite(null, { saveData: true }), true);
  assert.equal(resolveLite("maybe", {}), false);
});
