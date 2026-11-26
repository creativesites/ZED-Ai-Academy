import "server-only";
import { createServiceClient } from "@/lib/supabase/server";
import { ensureTenantMembership } from "@/actions/tenants";
import { sendPaymentConfirmation } from "@/lib/email/emailjs";
import type { OrderStatus } from "@/types/database";
import { BRAND } from "@/lib/brand";
import { decideSettlement, verifyTransaction } from "@/lib/payments/paychangu";

type InsertOrderParams = {
  userId: string;
  courseId: string;
  companyId: string | null;
  amount: number;
  currency?: string;
  status: OrderStatus;
  paymentReference: string;
  paymentMethod?: string | null;
  couponCode?: string | null;
  discountAmount?: number;
  paidAt?: string | null;
};

function isMissingColumnError(err: { code?: string; message?: string } | null): boolean {
  if (!err) return false;
  if (err.code === "42703" || err.code === "PGRST204") return true;
  const msg = (err.message ?? "").toLowerCase();
  return msg.includes("coupon_code") || msg.includes("discount_amount");
}

export async function insertOrder(params: InsertOrderParams) {
  const serviceClient = createServiceClient();
  const basePayload = {
    user_id: params.userId,
    course_id: params.courseId,
    company_id: params.companyId,
    amount: params.amount,
    currency: params.currency ?? "ZMW",
    status: params.status,
    payment_reference: params.paymentReference,
    payment_method: params.paymentMethod ?? null,
    paid_at: params.paidAt ?? null,
  };

  const { error } = await serviceClient.from("orders").insert({
    ...basePayload,
    coupon_code: params.couponCode ?? null,
    discount_amount: params.discountAmount ?? 0,
  });

  if (error && isMissingColumnError(error)) {
    const fallback = await serviceClient.from("orders").insert(basePayload);
    return { error: fallback.error };
  }

  return { error };
}

/**
 * Atomically bump a coupon's use count, respecting max_uses. Retries the compare-and-swap a
 * few times so concurrent redemptions don't silently lose an increment.
 * Returns false if the coupon is exhausted or unknown.
 */
export async function incrementCouponUsage(couponCode: string | null | undefined): Promise<boolean> {
  const normalized = couponCode?.trim().toUpperCase();
  if (!normalized) return false;

  const serviceClient = createServiceClient();
  for (let attempt = 0; attempt < 4; attempt++) {
    const { data: coupon } = await serviceClient
      .from("coupons")
      .select("id, uses_count, max_uses")
      .eq("code", normalized)
      .maybeSingle();

    if (!coupon) return false;
    if (coupon.max_uses !== null && coupon.uses_count >= coupon.max_uses) return false;

    const { data: updated } = await serviceClient
      .from("coupons")
      .update({ uses_count: coupon.uses_count + 1 })
      .eq("id", coupon.id)
      .eq("uses_count", coupon.uses_count)
      .select("id");
    if (updated && updated.length > 0) return true;
  }
  console.error("[coupons] could not increment usage after retries", normalized);
  return false;
}

type OrderRow = {
  id: string;
  user_id: string;
  course_id: string | null;
  company_id: string | null;
  amount: number;
  currency: string | null;
  status: OrderStatus;
  payment_reference: string;
  coupon_code?: string | null;
};

export type SettleResult =
  | { state: "paid"; courseId: string | null; alreadyProcessed: boolean }
  | { state: "pending" | "failed" | "mismatch" | "not_found"; courseId: string | null };

/**
 * Bring a single order up to date with PayChangu. Safe to call any number of times, from the
 * webhook, the buyer's return page or a reconcile job: only one caller can move an order from
 * `pending` to `paid`, so enrollment, coupon usage and the receipt happen exactly once.
 */
export async function settleOrder(txRef: string): Promise<SettleResult> {
  const supabase = createServiceClient();

  const { data: order } = await supabase
    .from("orders")
    .select("id, user_id, course_id, company_id, amount, currency, status, payment_reference, coupon_code")
    .eq("payment_reference", txRef)
    .maybeSingle<OrderRow>();

  if (!order) return { state: "not_found", courseId: null };
  if (order.status === "paid") return { state: "paid", courseId: order.course_id, alreadyProcessed: true };
  if (order.status !== "pending") return { state: "failed", courseId: order.course_id };

  const tx = await verifyTransaction(txRef);
  const decision = decideSettlement(
    { paymentReference: order.payment_reference, amount: Number(order.amount), currency: order.currency ?? "ZMW" },
    tx
  );

  if (decision === "mismatch") {
    console.error("[payments] verified transaction does not match order", {
      orderId: order.id,
      expected: { amount: order.amount, currency: order.currency },
      got: tx ? { amount: tx.amount, currency: tx.currency, status: tx.status } : null,
    });
    return { state: "mismatch", courseId: order.course_id };
  }

  if (decision === "failed") {
    await supabase.from("orders").update({ status: "failed" }).eq("id", order.id).eq("status", "pending");
    return { state: "failed", courseId: order.course_id };
  }

  if (decision === "pending") return { state: "pending", courseId: order.course_id };

  // decision === "paid": claim the transition. Only the caller whose update matches wins.
  const { data: claimed, error: claimError } = await supabase
    .from("orders")
    .update({ status: "paid" as const, payment_method: tx?.channel ?? null, paid_at: new Date().toISOString() })
    .eq("id", order.id)
    .eq("status", "pending")
    .select("id");

  if (claimError) {
    console.error("[payments] could not mark order paid", order.id, claimError);
    throw new Error("Could not record payment");
  }
  if (!claimed || claimed.length === 0) {
    return { state: "paid", courseId: order.course_id, alreadyProcessed: true };
  }

  await grantPaidAccess(order);
  return { state: "paid", courseId: order.course_id, alreadyProcessed: false };
}

async function grantPaidAccess(order: OrderRow) {
  const supabase = createServiceClient();

  if (order.coupon_code) {
    await incrementCouponUsage(order.coupon_code);
  }

  if (!order.course_id) return;

  // Upsert so an existing pending_payment (or previously revoked) enrollment becomes active.
  const { error: enrollError } = await supabase.from("enrollments").upsert(
    {
      user_id: order.user_id,
      course_id: order.course_id,
      company_id: order.company_id,
      status: "active",
      source: "individual_purchase" as const,
    },
    { onConflict: "user_id,course_id" }
  );
  if (enrollError) {
    console.error("[payments] enrollment upsert failed for paid order", order.id, enrollError);
    throw new Error("Enrollment failed");
  }

  const [profileResult, courseResult] = await Promise.all([
    supabase.from("profiles").select("full_name, email").eq("id", order.user_id).single(),
    supabase.from("courses").select("title, slug, company_id").eq("id", order.course_id).single(),
  ]);

  const resolvedCompanyId = courseResult.data?.company_id ?? order.company_id;
  if (resolvedCompanyId) {
    try {
      await ensureTenantMembership(order.user_id, resolvedCompanyId, "learner");
    } catch (membershipErr) {
      console.error("[payments] failed to ensure tenant membership:", membershipErr);
    }
  }

  const profileEmail = profileResult.data?.email;
  if (profileEmail && profileResult.data && courseResult.data) {
    const firstName = profileResult.data.full_name?.split(" ")[0] ?? "there";
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || BRAND.url;
    // Receipt is best-effort: never fail a confirmed payment because email failed.
    sendPaymentConfirmation({
      toEmail: profileEmail,
      toName: firstName,
      courseTitle: courseResult.data.title,
      amount: `${order.currency ?? "ZMW"} ${Number(order.amount).toLocaleString()}`,
      courseUrl: `${appUrl}/courses/${courseResult.data.slug}/learn`,
    }).catch((err) => console.error("[payments] receipt email failed", err));
  }
}

/** Re-check every order that has been pending longer than `olderThanMinutes`. */
export async function reconcilePendingOrders(olderThanMinutes = 10, limit = 50) {
  const supabase = createServiceClient();
  const cutoff = new Date(Date.now() - olderThanMinutes * 60_000).toISOString();
  const { data: pending } = await supabase
    .from("orders")
    .select("payment_reference")
    .eq("status", "pending")
    .lt("created_at", cutoff)
    .order("created_at", { ascending: true })
    .limit(limit);

  const summary: Record<string, number> = {};
  for (const row of pending ?? []) {
    if (!row.payment_reference) continue;
    try {
      const r = await settleOrder(row.payment_reference);
      summary[r.state] = (summary[r.state] ?? 0) + 1;
    } catch (err) {
      console.error("[payments] reconcile failed for", row.payment_reference, err);
      summary.error = (summary.error ?? 0) + 1;
    }
  }
  return { checked: pending?.length ?? 0, summary };
}
