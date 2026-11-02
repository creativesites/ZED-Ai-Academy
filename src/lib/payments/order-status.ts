import type { OrderStatus } from "./types.ts";

/**
 * Allowed order status transitions.
 *
 *   pending ──learner submits proof──▶ awaiting_confirmation ──admin confirms──▶ paid ──▶ refunded
 *      │                                   │
 *      │                                   └──admin rejects──▶ rejected
 *      │                                                         │
 *      └──▶ failed ◀─────────────────────────────────────────────┘
 *
 * rejected ──learner resubmits proof──▶ awaiting_confirmation
 */
const TRANSITIONS: Record<OrderStatus, readonly OrderStatus[]> = {
  pending: ["awaiting_confirmation", "failed"],
  awaiting_confirmation: ["paid", "rejected"],
  rejected: ["awaiting_confirmation", "failed"],
  paid: ["refunded"],
  failed: [],
  refunded: [],
};

export function canTransition(from: OrderStatus, to: OrderStatus): boolean {
  return TRANSITIONS[from].includes(to);
}

/** Orders the checkout page should show as in progress. */
export const OPEN_ORDER_STATUSES: readonly OrderStatus[] = [
  "pending",
  "awaiting_confirmation",
  "rejected",
];

/** Statuses from which the learner may submit (or resubmit) payment proof. */
export const PROOF_ALLOWED_FROM: readonly OrderStatus[] = ["pending", "rejected"];

export function isOpenOrderStatus(status: string): status is OrderStatus {
  return (OPEN_ORDER_STATUSES as readonly string[]).includes(status);
}

export const ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
  pending: "Awaiting payment",
  awaiting_confirmation: "Awaiting confirmation",
  paid: "Paid",
  rejected: "Rejected",
  failed: "Cancelled",
  refunded: "Refunded",
};
