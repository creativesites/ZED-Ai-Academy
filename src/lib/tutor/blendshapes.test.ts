import test from "node:test";
import assert from "node:assert/strict";
import { composeFaceMorphs, damp, stylizedMouthShape, VISEME_MORPH_TARGETS } from "./blendshapes.ts";
import type { VisemeValue } from "./contract.generated.ts";

test("all 9 contract visemes (0..8) have morph targets and stylized mouth shapes", () => {
  for (let v = 0; v <= 8; v += 1) {
    const val = v as VisemeValue;
    assert.ok(VISEME_MORPH_TARGETS[val], `viseme ${v} has morph targets`);
    const shape = stylizedMouthShape(val);
    assert.ok(shape.openY >= 0 && shape.openY <= 1.2);
    assert.ok(shape.widthX > 0);
  }
});

test("composeFaceMorphs combines mood intensity, viseme priority, and eye blink", () => {
  const morphs = composeFaceMorphs({
    viseme: 1, // AA
    mood: "happy",
    moodIntensity: 80,
    blink: 0.9,
  });

  assert.equal(morphs.viseme_aa, 0.9);
  assert.equal(morphs.jawOpen, 0.68);
  assert.ok(morphs.mouthSmileLeft > 0.4);
  assert.equal(morphs.eyeBlinkLeft, 0.9);
  assert.equal(morphs.eyeBlinkRight, 0.9);
});

test("damp moves smoothly toward target and handles zero dt safely", () => {
  assert.equal(damp(0, 1, 12, 0), 0);
  const mid = damp(0, 1, 12, 0.05);
  assert.ok(mid > 0.3 && mid < 0.7);
  const near = damp(0, 1, 12, 1.0);
  assert.ok(near > 0.99);
});
