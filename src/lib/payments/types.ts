/**
 * Payment provider contract. Pure types only: no runtime imports.
 *
 * A provider turns an order into a way for the learner to pay. Two shapes exist:
 *  - redirect: send the learner to a hosted checkout page (card / mobile money gateways)
 *  - manual:   show the learner where to send money and what reference to quote
 *
 * Adding a processor = one provider file implementing PaymentProvider, registered in
 * src/lib/payments/index.ts, and PAYMENT_PROVIDER set to its id.
 */

export const ORDER_STATUSES = [
  "pending",
  "awaiting_confirmation",
  "paid",
  "rejected",
  "failed",
  "refunded",
] as const;

export type OrderStatus = (typeof ORDER_STATUSES)[number];

/** The order fields a provider needs. Built from the orders row plus its course. */
export type PaymentOrder = {
  id: string;
  /** Unique, human-typeable code the learner puts in the payment note. */
  reference: string;
  amount: number;
  currency: string;
  courseTitle: string;
  userId: string;
  /** Tenant (academy) that owns the course. */
  companyId: string;
};

export type PaymentInstructions = {
  amountLabel: string;
  reference: string;
  /** Payment destinations the learner can use, e.g. MTN MoMo number. */
  methods: { label: string; value: string }[];
  /** Optional free text from the academy, shown under the methods. */
  note: string | null;
};

export type PaymentStart =
  | { kind: "redirect"; url: string }
  | { kind: "manual"; instructions: PaymentInstructions };

export type WebhookEvent = {
  reference: string;
  status: "paid" | "failed";
  providerRef: string | null;
};

export interface PaymentProvider {
  id: string;
  label: string;
  /** Start paying for an order. Called when the learner places an order. */
  createPayment(order: PaymentOrder): Promise<PaymentStart>;
  /**
   * Show the payment instructions again for an order that is still open.
   * Return null when the provider cannot re-show them (the checkout then offers a restart).
   */
  resumePayment?(order: PaymentOrder): Promise<PaymentStart | null>;
  /** Verify a provider webhook and return the event, or null to reject the request. */
  verifyWebhook?(req: Request): Promise<WebhookEvent | null>;
}

/** Per-academy manual payment destinations. Stored in companies.payment_settings. */
export type ManualPaymentDetails = {
  mtn: string | null;
  airtel: string | null;
  bank: string | null;
  instructions: string | null;
};
