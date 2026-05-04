/**
 * PayChangu payment gateway abstraction.
 * Docs: https://paychangu.com/developers
 *
 * Swap this file to switch payment processors — the checkout page and
 * webhook handler only import the types and functions defined here.
 */

const API_BASE = "https://api.paychangu.com";
const SECRET_KEY = process.env.PAYCHANGU_SECRET_KEY!;

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
    currency: params.currency ?? "ZMW",
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
        Authorization: `Bearer ${SECRET_KEY}`,
      },
      body: JSON.stringify(body),
    });

    const json = await res.json();

    if (!res.ok || json.status !== "success") {
      return { success: false, error: json.message ?? "Payment gateway error" };
    }

    const checkoutUrl: string = json.data?.checkout_url ?? json.data?.link;
    if (!checkoutUrl) {
      return { success: false, error: "No checkout URL returned" };
    }

    return { success: true, checkoutUrl };
  } catch (err) {
    console.error("PayChangu initiatePayment error:", err);
    return { success: false, error: "Failed to connect to payment gateway" };
  }
}

export type WebhookPayload = {
  tx_ref: string;
  status: "success" | "failed" | "cancelled";
  amount: number;
  currency: string;
  payment_method?: string;
  [key: string]: unknown;
};

/**
 * Verify the webhook payload is genuine.
 * PayChangu sends an Authorization header with your secret key.
 * Returns the parsed payload if valid, null if the request should be rejected.
 */
export function verifyWebhook(
  authHeader: string | null,
  body: WebhookPayload
): WebhookPayload | null {
  if (!authHeader) return null;
  // PayChangu sends "Bearer <secret_key>" as the Authorization header
  const token = authHeader.replace(/^Bearer\s+/i, "").trim();
  if (token !== SECRET_KEY) return null;
  return body;
}
