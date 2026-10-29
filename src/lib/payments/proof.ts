/**
 * Validation for the learner's "I have paid" submission and the admin's rejection reason. Pure.
 */

export const TRANSACTION_ID_MIN = 4;
export const TRANSACTION_ID_MAX = 64;
export const NOTE_MAX = 500;
export const REJECTION_REASON_MIN = 3;
export const REJECTION_REASON_MAX = 500;

const TRANSACTION_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._/-]*$/;

export const PAYMENT_METHOD_OPTIONS = ["MTN MoMo", "Airtel Money", "Bank transfer", "Other"] as const;

export type ProofResult =
  | { ok: true; value: { transactionId: string; method: string | null; note: string | null } }
  | { ok: false; error: string };

export type ValidationResult = { ok: true; value: string } | { ok: false; error: string };

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export function validatePaymentProof(input: {
  transactionId: unknown;
  method: unknown;
  note: unknown;
}): ProofResult {
  const transactionId = text(input.transactionId);
  if (transactionId.length < TRANSACTION_ID_MIN || transactionId.length > TRANSACTION_ID_MAX) {
    return {
      ok: false,
      error: `Enter the transaction ID (${TRANSACTION_ID_MIN} to ${TRANSACTION_ID_MAX} characters).`,
    };
  }
  if (!TRANSACTION_ID_PATTERN.test(transactionId)) {
    return {
      ok: false,
      error: "The transaction ID may only contain letters, numbers, dots, dashes and slashes.",
    };
  }

  const method = text(input.method);
  if (method && !(PAYMENT_METHOD_OPTIONS as readonly string[]).includes(method)) {
    return { ok: false, error: "Choose a payment method from the list." };
  }

  const note = text(input.note);
  if (note.length > NOTE_MAX) {
    return { ok: false, error: `The note must be ${NOTE_MAX} characters or fewer.` };
  }

  return {
    ok: true,
    value: { transactionId, method: method || null, note: note || null },
  };
}

export function validateRejectionReason(value: unknown): ValidationResult {
  const reason = text(value);
  if (reason.length < REJECTION_REASON_MIN) {
    return { ok: false, error: "Give the learner a short reason (at least 3 characters)." };
  }
  if (reason.length > REJECTION_REASON_MAX) {
    return { ok: false, error: `The reason must be ${REJECTION_REASON_MAX} characters or fewer.` };
  }
  return { ok: true, value: reason };
}
