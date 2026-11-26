import { timingSafeEqual } from "node:crypto";
import { reconcilePendingOrders } from "@/lib/payments/orders";

export const dynamic = "force-dynamic";

function authorized(header: string | null): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret || !header) return false;
  const a = Buffer.from(header);
  const b = Buffer.from(`Bearer ${secret}`);
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * Re-checks payments left `pending` (webhook missed, buyer closed the tab). Run every ~15 min
 * from a scheduler that sends `Authorization: Bearer $CRON_SECRET`.
 */
export async function GET(req: Request) {
  if (!authorized(req.headers.get("authorization"))) {
    return new Response("Unauthorized", { status: 401 });
  }
  const result = await reconcilePendingOrders(10, 50);
  return Response.json(result);
}
