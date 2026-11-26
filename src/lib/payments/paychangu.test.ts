import test from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { checkWebhookSignature, decideSettlement, extractTxRef, type VerifiedTransaction } from "./paychangu.ts";

const order = { paymentReference: "tx_123", amount: 250, currency: "ZMW" };
const tx = (over: Partial<VerifiedTransaction>): VerifiedTransaction => ({
  txRef: "tx_123", status: "success", amount: 250, currency: "ZMW", channel: "mobile_money", ...over,
});

test("verified success with matching currency and amount settles as paid", () => {
  assert.equal(decideSettlement(order, tx({})), "paid");
  assert.equal(decideSettlement(order, tx({ amount: 300 })), "paid"); // overpayment still grants
});

test("underpayment, wrong currency or wrong tx_ref is a mismatch, never paid", () => {
  assert.equal(decideSettlement(order, tx({ amount: 249.99 })), "mismatch");
  assert.equal(decideSettlement(order, tx({ currency: "MWK" })), "mismatch");
  assert.equal(decideSettlement(order, tx({ txRef: "tx_other" })), "mismatch");
  assert.equal(decideSettlement(order, tx({ amount: Number.NaN })), "mismatch");
});

test("unknown verification result stays pending; declines fail", () => {
  assert.equal(decideSettlement(order, null), "pending");
  assert.equal(decideSettlement(order, tx({ status: "pending" })), "pending");
  assert.equal(decideSettlement(order, tx({ status: "failed" })), "failed");
  assert.equal(decideSettlement(order, tx({ status: "cancelled" })), "failed");
});

test("webhook signature: HMAC-SHA256 hex of raw body with the webhook secret", () => {
  const body = JSON.stringify({ tx_ref: "tx_123", status: "success" });
  delete process.env.PAYCHANGU_WEBHOOK_SECRET;
  assert.equal(checkWebhookSignature(body, null), "unconfigured");

  process.env.PAYCHANGU_WEBHOOK_SECRET = "whsec_test";
  const good = createHmac("sha256", "whsec_test").update(body).digest("hex");
  assert.equal(checkWebhookSignature(body, good), "valid");
  assert.equal(checkWebhookSignature(body, good.toUpperCase()), "valid");
  assert.equal(checkWebhookSignature(body + " ", good), "invalid");
  assert.equal(checkWebhookSignature(body, null), "invalid");
  assert.equal(checkWebhookSignature(body, "deadbeef"), "invalid");
  delete process.env.PAYCHANGU_WEBHOOK_SECRET;
});

test("extractTxRef reads top-level or nested tx_ref only", () => {
  assert.equal(extractTxRef({ tx_ref: " tx_9 " }), "tx_9");
  assert.equal(extractTxRef({ data: { tx_ref: "tx_8" } }), "tx_8");
  assert.equal(extractTxRef({ reference: "123" }), null);
  assert.equal(extractTxRef(null), null);
});
