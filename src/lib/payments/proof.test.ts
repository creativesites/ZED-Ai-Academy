import { test } from "node:test";
import assert from "node:assert/strict";
import {
  NOTE_MAX,
  REJECTION_REASON_MAX,
  validatePaymentProof,
  validateRejectionReason,
} from "./proof.ts";

test("accepts a transaction id with trimmed optional fields", () => {
  const result = validatePaymentProof({
    transactionId: "  MP240101.1234-ABC  ",
    method: "MTN MoMo",
    note: "  paid for the course  ",
  });
  assert.deepEqual(result, {
    ok: true,
    value: { transactionId: "MP240101.1234-ABC", method: "MTN MoMo", note: "paid for the course" },
  });
});

test("method and note are optional and become null when blank", () => {
  const result = validatePaymentProof({ transactionId: "TX12345", method: "", note: "   " });
  assert.deepEqual(result, {
    ok: true,
    value: { transactionId: "TX12345", method: null, note: null },
  });
});

test("rejects missing, too short and too long transaction ids", () => {
  assert.equal(validatePaymentProof({ transactionId: "", method: "", note: "" }).ok, false);
  assert.equal(validatePaymentProof({ transactionId: "abc", method: "", note: "" }).ok, false);
  assert.equal(validatePaymentProof({ transactionId: "a".repeat(65), method: "", note: "" }).ok, false);
  assert.equal(validatePaymentProof({ transactionId: undefined, method: "", note: "" }).ok, false);
});

test("rejects transaction ids with spaces, quotes or leading punctuation", () => {
  assert.equal(validatePaymentProof({ transactionId: "TX 12345", method: "", note: "" }).ok, false);
  assert.equal(validatePaymentProof({ transactionId: "'; drop", method: "", note: "" }).ok, false);
  assert.equal(validatePaymentProof({ transactionId: "-TX1234", method: "", note: "" }).ok, false);
});

test("rejects a method outside the list and an over-long note", () => {
  assert.equal(validatePaymentProof({ transactionId: "TX12345", method: "Cash", note: "" }).ok, false);
  const long = validatePaymentProof({ transactionId: "TX12345", method: "", note: "x".repeat(NOTE_MAX + 1) });
  assert.equal(long.ok, false);
});

test("rejection reason needs at least three characters and has a maximum", () => {
  assert.deepEqual(validateRejectionReason("  Wrong amount  "), { ok: true, value: "Wrong amount" });
  assert.equal(validateRejectionReason("no").ok, false);
  assert.equal(validateRejectionReason(undefined).ok, false);
  assert.equal(validateRejectionReason("r".repeat(REJECTION_REASON_MAX + 1)).ok, false);
});
