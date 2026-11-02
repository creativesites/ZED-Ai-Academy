import { test } from "node:test";
import assert from "node:assert/strict";
import {
  generateOrderReference,
  isValidOrderReference,
  REFERENCE_ALPHABET,
  REFERENCE_LENGTH,
  REFERENCE_PREFIX,
} from "./reference.ts";

test("reference uses the prefix and the fixed code length", () => {
  const ref = generateOrderReference(() => new Uint8Array(REFERENCE_LENGTH));
  assert.equal(ref, `${REFERENCE_PREFIX}${"A".repeat(REFERENCE_LENGTH)}`);
  assert.equal(ref.length, REFERENCE_PREFIX.length + REFERENCE_LENGTH);
});

test("each random byte maps to the alphabet by its low five bits", () => {
  const bytes = new Uint8Array([0, 1, 31, 32, 255, 200, 129, 64]);
  const ref = generateOrderReference(() => bytes);
  const code = ref.slice(REFERENCE_PREFIX.length);
  const expected = Array.from(bytes, (b) => REFERENCE_ALPHABET[b & 31]).join("");
  assert.equal(code, expected);
});

test("alphabet leaves out look-alike characters", () => {
  for (const bad of ["0", "O", "1", "I"]) {
    assert.equal(REFERENCE_ALPHABET.includes(bad), false, bad);
  }
  assert.equal(REFERENCE_ALPHABET.length, 32);
});

test("generated references validate, and malformed ones do not", () => {
  const ref = generateOrderReference();
  assert.equal(isValidOrderReference(ref), true);
  assert.equal(isValidOrderReference("ZAA-ABCDEFG"), false, "too short");
  assert.equal(isValidOrderReference("ZAA-ABCDEFGHJ"), false, "too long");
  assert.equal(isValidOrderReference("zaa-ABCDEFGH"), false, "wrong case prefix");
  assert.equal(isValidOrderReference("ZAA-0BCDEFGH"), false, "contains 0");
  assert.equal(isValidOrderReference("ZAA-ABCDEFGH\n"), false, "trailing newline");
});

test("default random source yields distinct valid references", () => {
  const seen = new Set<string>();
  for (let i = 0; i < 200; i++) {
    const ref = generateOrderReference();
    assert.equal(isValidOrderReference(ref), true);
    seen.add(ref);
  }
  assert.equal(seen.size, 200);
});
