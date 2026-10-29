import { test } from "node:test";
import assert from "node:assert/strict";
import {
  canTransition,
  isOpenOrderStatus,
  PROOF_ALLOWED_FROM,
} from "./order-status.ts";
import { ORDER_STATUSES, type OrderStatus } from "./types.ts";

test("learner proof moves pending and rejected orders to awaiting_confirmation", () => {
  assert.equal(canTransition("pending", "awaiting_confirmation"), true);
  assert.equal(canTransition("rejected", "awaiting_confirmation"), true);
});

test("admin confirm and reject only apply to awaiting_confirmation orders", () => {
  assert.equal(canTransition("awaiting_confirmation", "paid"), true);
  assert.equal(canTransition("awaiting_confirmation", "rejected"), true);
  assert.equal(canTransition("pending", "paid"), false, "cannot pay without proof");
  assert.equal(canTransition("rejected", "paid"), false);
  assert.equal(canTransition("paid", "rejected"), false, "paid orders are not re-decided");
});

test("paid, failed and refunded are only left by refund", () => {
  assert.equal(canTransition("paid", "refunded"), true);
  assert.equal(canTransition("paid", "pending"), false);
  assert.equal(canTransition("failed", "pending"), false);
  assert.equal(canTransition("refunded", "paid"), false);
});

test("no status transitions to itself", () => {
  for (const status of ORDER_STATUSES) {
    assert.equal(canTransition(status, status), false, `${status} -> ${status}`);
  }
});

test("proof is only accepted from pending or rejected", () => {
  const allowed: OrderStatus[] = ["pending", "rejected"];
  assert.deepEqual([...PROOF_ALLOWED_FROM].sort(), [...allowed].sort());
  for (const status of ORDER_STATUSES) {
    const expected = allowed.includes(status);
    assert.equal(PROOF_ALLOWED_FROM.includes(status), expected, status);
  }
});

test("open statuses are the ones the checkout shows as in progress", () => {
  assert.equal(isOpenOrderStatus("pending"), true);
  assert.equal(isOpenOrderStatus("awaiting_confirmation"), true);
  assert.equal(isOpenOrderStatus("rejected"), true);
  assert.equal(isOpenOrderStatus("paid"), false);
  assert.equal(isOpenOrderStatus("failed"), false);
  assert.equal(isOpenOrderStatus("refunded"), false);
  assert.equal(isOpenOrderStatus("bogus"), false);
});
