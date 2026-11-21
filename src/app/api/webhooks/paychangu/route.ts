import { NextRequest } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { verifyWebhook } from "@/lib/payments/paychangu";
import { confirmPaidOrder } from "@/lib/payments/orders";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const authHeader = req.headers.get("authorization");

  const payload = verifyWebhook(authHeader, body);
  if (!payload) {
    return new Response("Unauthorized", { status: 401 });
  }

  if (payload.status !== "success") {
    if (payload.tx_ref) {
      const supabase = createServiceClient();
      await supabase
        .from("orders")
        .update({ status: "failed" })
        .eq("payment_reference", payload.tx_ref);
    }
    return new Response("OK", { status: 200 });
  }

  const result = await confirmPaidOrder({
    txRef: payload.tx_ref,
    paymentMethod: payload.payment_method ?? null,
  });

  if (!result.ok) {
    return new Response(result.error, { status: 500 });
  }

  return new Response("OK", { status: 200 });
}
