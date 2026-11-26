import test from "node:test";
import assert from "node:assert/strict";
import { generateStaffCode, isUsableStaffCode, staffCodeMatches } from "./staff-code.ts";

test("placeholder, short or missing stored codes are never usable", () => {
  for (const stored of [null, undefined, "", "0000", "000000", "12345", "  "]) {
    assert.equal(isUsableStaffCode(stored), false, String(stored));
    assert.equal(staffCodeMatches(stored, stored), false, String(stored));
  }
});

test("matching codes are accepted, with surrounding whitespace ignored", () => {
  assert.equal(staffCodeMatches("483920", "483920"), true);
  assert.equal(staffCodeMatches("483920", " 483920 "), true);
});

test("wrong or partial codes are rejected", () => {
  assert.equal(staffCodeMatches("483920", "483921"), false);
  assert.equal(staffCodeMatches("483920", "48392"), false);
  assert.equal(staffCodeMatches("483920", ""), false);
  assert.equal(staffCodeMatches("483920", null), false);
});

test("generated codes are 8 digits, usable, and vary", () => {
  const codes = new Set(Array.from({ length: 50 }, () => generateStaffCode()));
  for (const c of codes) {
    assert.match(c, /^[1-9]\d{7}$/);
    assert.equal(isUsableStaffCode(c), true);
  }
  assert.ok(codes.size > 45);
});
