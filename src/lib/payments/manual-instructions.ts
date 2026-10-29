import type { ManualPaymentDetails, PaymentInstructions, PaymentOrder } from "./types.ts";

/** Platform-level fallbacks, used when an academy has not set a value of its own. */
export type ManualEnv = {
  MANUAL_PAY_MTN?: string | undefined;
  MANUAL_PAY_AIRTEL?: string | undefined;
  MANUAL_PAY_BANK?: string | undefined;
};

function clean(value: string | null | undefined): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

/**
 * Per-field merge: the academy's own value wins, otherwise the env var is used.
 * The caller passes the stored settings and the env, so this stays pure.
 */
export function resolveManualDetails(
  academy: Partial<ManualPaymentDetails> | null | undefined,
  env: ManualEnv
): ManualPaymentDetails {
  return {
    mtn: clean(academy?.mtn) ?? clean(env.MANUAL_PAY_MTN),
    airtel: clean(academy?.airtel) ?? clean(env.MANUAL_PAY_AIRTEL),
    bank: clean(academy?.bank) ?? clean(env.MANUAL_PAY_BANK),
    instructions: clean(academy?.instructions),
  };
}

/** Formats a ZMW amount, e.g. 1200 -> "ZMW 1,200" and 99.5 -> "ZMW 99.50". */
export function formatZmw(amount: number): string {
  const hasCents = Math.abs(amount - Math.trunc(amount)) > 0.001;
  const formatted = amount.toLocaleString("en-US", {
    minimumFractionDigits: hasCents ? 2 : 0,
    maximumFractionDigits: 2,
  });
  return `ZMW ${formatted}`;
}

/** Turns an order and its resolved destinations into what the learner is shown. */
export function buildManualInstructions(
  order: Pick<PaymentOrder, "amount" | "reference">,
  details: ManualPaymentDetails
): PaymentInstructions {
  const methods: PaymentInstructions["methods"] = [];
  if (details.mtn) methods.push({ label: "MTN MoMo", value: details.mtn });
  if (details.airtel) methods.push({ label: "Airtel Money", value: details.airtel });
  if (details.bank) methods.push({ label: "Bank transfer", value: details.bank });

  return {
    amountLabel: formatZmw(order.amount),
    reference: order.reference,
    methods,
    note: details.instructions,
  };
}
