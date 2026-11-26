import { NextRequest } from "next/server";
import { checkWebhookSignature, extractTxRef } from "@/lib/payments/paychangu";
import { settleOrder } from "@/lib/payments/orders";

/**
 * PayChangu webhook (IPN). The body is only used to learn which transaction changed:
 * settleOrder() re-queries PayChangu's verify endpoint and checks status, currency and
 * amount against the order before granting anything.
 *
 * PayChangu treats any non-200 as a failure and retries (3× at 30-minute intervals),
 * so we return 500 only for errors worth retrying.
 */
export async function POST(req: NextRequest) {
  const rawBody = await req.text();

  const signature = checkWebhookSignature(rawBody, req.headers.get("signature"));
  if (signature === "invalid") {
    return new Response("Invalid signature", { status: 401 });
  }
  if (signature === "unconfigured") {
    console.warn("[paychangu webhook] PAYCHANGU_WEBHOOK_SECRET not set; relying on verify-payment only");
  }

  let payload: unknown;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return new Response("Bad request", { status: 400 });
  }

  const txRef = extractTxRef(payload);
  if (!txRef) {
    // Not one of our checkout transactions (e.g. payouts). Acknowledge so it isn't retried.
    return new Response("OK", { status: 200 });
  }

  try {
    const result = await settleOrder(txRef);
    if (result.state === "mismatch") {
      console.error("[paychangu webhook] amount/currency mismatch", { txRef });
    }
    return new Response("OK", { status: 200 });
  } catch (err) {
    console.error("[paychangu webhook] settle failed", { txRef, err });
    return new Response("Retry later", { status: 500 });
  }
}
