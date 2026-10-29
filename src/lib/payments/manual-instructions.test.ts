import { test } from "node:test";
import assert from "node:assert/strict";
import {
  buildManualInstructions,
  formatZmw,
  resolveManualDetails,
} from "./manual-instructions.ts";

test("academy values win over env, field by field", () => {
  const details = resolveManualDetails(
    { mtn: "0977000001", airtel: null, bank: "  ", instructions: "Quote the reference." },
    { MANUAL_PAY_MTN: "0960000000", MANUAL_PAY_AIRTEL: "0970000000", MANUAL_PAY_BANK: "Acc 123" }
  );
  assert.deepEqual(details, {
    mtn: "0977000001",
    airtel: "0970000000",
    bank: "Acc 123",
    instructions: "Quote the reference.",
  });
});

test("missing academy settings fall back to env, and empty env gives null", () => {
  assert.deepEqual(resolveManualDetails(null, {}), {
    mtn: null,
    airtel: null,
    bank: null,
    instructions: null,
  });
  assert.equal(resolveManualDetails(undefined, { MANUAL_PAY_MTN: "  0960000000 " }).mtn, "0960000000");
});

test("formatZmw shows whole amounts without cents and keeps real cents", () => {
  assert.equal(formatZmw(1200), "ZMW 1,200");
  assert.equal(formatZmw(99.5), "ZMW 99.50");
  assert.equal(formatZmw(0), "ZMW 0");
});

test("instructions list only the destinations that are configured", () => {
  const instructions = buildManualInstructions(
    { amount: 450, reference: "ZAA-ABCD2345" },
    { mtn: "0977000001", airtel: null, bank: "Bank X 0011", instructions: null }
  );
  assert.deepEqual(instructions, {
    amountLabel: "ZMW 450",
    reference: "ZAA-ABCD2345",
    methods: [
      { label: "MTN MoMo", value: "0977000001" },
      { label: "Bank transfer", value: "Bank X 0011" },
    ],
    note: null,
  });
});

test("no configured destinations gives an empty method list", () => {
  const instructions = buildManualInstructions(
    { amount: 10, reference: "ZAA-ABCD2345" },
    { mtn: null, airtel: null, bank: null, instructions: null }
  );
  assert.deepEqual(instructions.methods, []);
});
