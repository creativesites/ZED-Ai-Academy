/**
 * PayChangu payment gateway abstraction.
 * Docs: https://developer.paychangu.com/docs (standard checkout, transaction verification, webhooks)
 *
 * Swap this file to switch payment processors — the checkout page, return page and
 * webhook handler only import the types and functions defined here.
 *
 * Security model (per PayChangu docs): never trust a webhook or redirect on its own.
 * Every payment is confirmed server-side with GET /verify-payment/{tx_ref}, and access is
 * granted only when status, currency and amount match the order (see decideSettlement).
 */

import { createHmac, timingSafeEqual } from "node:crypto";

const API_BASE = "https://api.paychangu.com";

function secretKey(): string {
  const key = process.env.PAYCHANGU_SECRET_KEY;
  if (!key) throw new Error("PAYCHANGU_SECRET_KEY is not configured");
  return key;
}

/**
 * Currency used for checkout and stored on orders. Course prices are entered in kwacha, so this
 * must stay "ZMW" unless prices are converted too.
 * NOTE: PayChangu's public docs list only MWK and USD for standard checkout — confirm ZMW
 * support with PayChangu (or switch processor) before taking real payments.
 */
export function checkoutCurrency(): string {
  return "ZMW";
}

export type InitiatePaymentParams = {
  txRef: string;
  amount: number;
  currency?: string;
  email: string;
  firstName: string;
  lastName: string;
  courseTitle: string;
  courseDescription?: string;
  returnUrl: string;
  callbackUrl: string;
};

export type InitiatePaymentResult =
  | { success: true; checkoutUrl: string }
  | { success: false; error: string };

/**
 * Initialise a payment session with PayChangu.
 * On success, redirect the user to checkoutUrl.
 */
export async function initiatePayment(
  params: InitiatePaymentParams
): Promise<InitiatePaymentResult> {
  const body = {
    amount: String(params.amount),
    currency: params.currency ?? checkoutCurrency(),
    email: params.email,
    first_name: params.firstName,
    last_name: params.lastName,
    callback_url: params.callbackUrl,
    return_url: params.returnUrl,
    tx_ref: params.txRef,
    customization: {
      title: params.courseTitle,
      description: params.courseDescription ?? `Enrollment: ${params.courseTitle}`,
    },
  };

  try {
    const res = await fetch(`${API_BASE}/payment`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        Authorization: `Bearer ${secretKey()}`,
      },
      body: JSON.stringify(body),
    });

    const json = await res.json().catch(() => ({}));

    if (!res.ok || json.status !== "success") {
      console.error("[paychangu] initiate failed", res.status, json?.message);
      return { success: false, error: "The payment gateway could not start this payment." };
    }

    const checkoutUrl: string = json.data?.checkout_url ?? json.data?.link;
    if (!checkoutUrl) {
      return { success: false, error: "The payment gateway did not return a checkout link." };
    }

    return { success: true, checkoutUrl };
  } catch (err) {
    console.error("[paychangu] initiate error:", err);
    return { success: false, error: "Failed to connect to the payment gateway." };
  }
}

export type VerifiedTransaction = {
  txRef: string;
  /** PayChangu transaction status, lower-cased: "success", "failed", "pending", … */
  status: string;
  amount: number;
  currency: string;
  channel: string | null;
};

/**
 * Ask PayChangu for the authoritative state of a transaction.
 * Returns null if the transaction is unknown or the API call failed (treat as "not yet").
 */
export async function verifyTransaction(txRef: string): Promise<VerifiedTransaction | null> {
  try {
    const res = await fetch(`${API_BASE}/verify-payment/${encodeURIComponent(txRef)}`, {
      method: "GET",
      headers: { Accept: "application/json", Authorization: `Bearer ${secretKey()}` },
      cache: "no-store",
    });
    if (!res.ok) {
      if (res.status !== 404 && res.status !== 400) {
        console.error("[paychangu] verify failed", res.status);
      }
      return null;
    }
    const json = await res.json().catch(() => null);
    const data = json?.data;
    if (!data) return null;
    return {
      txRef: String(data.tx_ref ?? ""),
      status: String(data.status ?? "").toLowerCase(),
      amount: Number(data.amount),
      currency: String(data.currency ?? "").toUpperCase(),
      channel: data.authorization?.channel ? String(data.authorization.channel) : null,
    };
  } catch (err) {
    console.error("[paychangu] verify error:", err);
    return null;
  }
}

export type SettlementDecision = "paid" | "failed" | "pending" | "mismatch";

/**
 * Pure decision: what should happen to a pending order given PayChangu's verified state.
 * Per PayChangu docs: tx_ref must match, status must be successful, currency must match,
 * and the amount must be at least the expected amount.
 */
export function decideSettlement(
  order: { paymentReference: string; amount: number; currency: string },
  tx: VerifiedTransaction | null
): SettlementDecision {
  if (!tx) return "pending";
  if (tx.txRef && tx.txRef !== order.paymentReference) return "mismatch";
  if (tx.status === "success" || tx.status === "successful") {
    if (tx.currency !== order.currency.toUpperCase()) return "mismatch";
    if (!Number.isFinite(tx.amount) || tx.amount + 1e-9 < Number(order.amount)) return "mismatch";
    return "paid";
  }
  if (["failed", "cancelled", "canceled", "declined", "expired"].includes(tx.status)) return "failed";
  return "pending";
}

/**
 * Check PayChangu's webhook signature: hex HMAC-SHA256 of the raw body with the webhook
 * secret from the merchant dashboard, sent in the `Signature` header.
 *
 * Returns "valid" | "invalid" | "unconfigured". Webhook bodies are never trusted for
 * payment state either way (we re-query verify-payment), so "unconfigured" is safe to accept.
 */
export function checkWebhookSignature(
  rawBody: string,
  signatureHeader: string | null
): "valid" | "invalid" | "unconfigured" {
  const secret = process.env.PAYCHANGU_WEBHOOK_SECRET;
  if (!secret) return "unconfigured";
  if (!signatureHeader) return "invalid";
  const expected = createHmac("sha256", secret).update(rawBody, "utf8").digest("hex");
  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(signatureHeader.trim().toLowerCase(), "utf8");
  if (a.length !== b.length) return "invalid";
  return timingSafeEqual(a, b) ? "valid" : "invalid";
}

/** Pull our tx_ref out of a webhook payload (top level or nested under data). */
export function extractTxRef(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") return null;
  const p = payload as Record<string, unknown>;
  const data = (p.data && typeof p.data === "object" ? p.data : {}) as Record<string, unknown>;
  const ref = p.tx_ref ?? data.tx_ref;
  return typeof ref === "string" && ref.trim() ? ref.trim() : null;
}
