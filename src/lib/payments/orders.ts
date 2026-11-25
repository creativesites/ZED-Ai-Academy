import "server-only";
import { createServiceClient } from "@/lib/supabase/server";
import { ensureTenantMembership } from "@/actions/tenants";
import { sendPaymentConfirmation } from "@/lib/email/emailjs";
import type { OrderStatus } from "@/types/database";
import { BRAND } from "@/lib/brand";

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

export async function incrementCouponUsage(couponCode: string | null | undefined) {
  const normalized = couponCode?.trim().toUpperCase();
  if (!normalized) return;

  const serviceClient = createServiceClient();
  const { data: coupon } = await serviceClient
    .from("coupons")
    .select("id, uses_count, max_uses")
    .eq("code", normalized)
    .maybeSingle();

  if (!coupon) return;
  if (coupon.max_uses !== null && coupon.uses_count >= coupon.max_uses) return;

  await serviceClient
    .from("coupons")
    .update({ uses_count: coupon.uses_count + 1 })
    .eq("id", coupon.id)
    .eq("uses_count", coupon.uses_count);
}

export async function confirmPaidOrder({
  txRef,
  paymentMethod,
}: {
  txRef: string;
  paymentMethod?: string | null;
}): Promise<{ ok: true; alreadyProcessed?: boolean } | { ok: false; error: string }> {
  const supabase = createServiceClient();

  let order: {
    id: string;
    user_id: string;
    course_id: string | null;
    company_id: string | null;
    amount: number;
    coupon_code?: string | null;
  } | null = null;

  const primaryLookup = await supabase
    .from("orders")
    .select("id, user_id, course_id, company_id, amount, coupon_code")
    .eq("payment_reference", txRef)
    .eq("status", "pending")
    .maybeSingle();

  if (primaryLookup.error && isMissingColumnError(primaryLookup.error)) {
    const fallbackLookup = await supabase
      .from("orders")
      .select("id, user_id, course_id, company_id, amount")
      .eq("payment_reference", txRef)
      .eq("status", "pending")
      .maybeSingle();
    order = fallbackLookup.data;
  } else {
    order = primaryLookup.data;
  }

  if (!order) {
    return { ok: true, alreadyProcessed: true };
  }

  await supabase
    .from("orders")
    .update({
      status: "paid" as const,
      payment_method: paymentMethod ?? null,
      paid_at: new Date().toISOString(),
    })
    .eq("id", order.id);

  if (order.coupon_code) {
    await incrementCouponUsage(order.coupon_code);
  }

  if (!order.course_id) {
    return { ok: true };
  }

  const { error: enrollError } = await supabase.from("enrollments").insert({
    user_id: order.user_id,
    course_id: order.course_id,
    company_id: order.company_id,
    status: "active",
    source: "individual_purchase" as const,
  });

  if (enrollError && !enrollError.message.includes("duplicate")) {
    console.error("Enrollment insert failed:", enrollError);
    return { ok: false, error: "Enrollment failed" };
  }

  const [profileResult, courseResult] = await Promise.all([
    supabase
      .from("profiles")
      .select("full_name, email")
      .eq("id", order.user_id)
      .single(),
    supabase
      .from("courses")
      .select("title, slug, company_id")
      .eq("id", order.course_id)
      .single(),
  ]);

  const resolvedCompanyId = courseResult.data?.company_id ?? order.company_id;
  if (resolvedCompanyId) {
    try {
      await ensureTenantMembership(order.user_id, resolvedCompanyId, "learner");
    } catch (membershipErr) {
      console.error("[PayChangu Webhook] Failed to ensure tenant membership:", membershipErr);
    }
  }

  const profileEmail = profileResult.data?.email;
  if (profileEmail && profileResult.data && courseResult.data) {
    const profile = profileResult.data;
    const course = courseResult.data;
    const firstName = profile.full_name?.split(" ")[0] ?? "there";
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || BRAND.url;

    await sendPaymentConfirmation({
      toEmail: profileEmail,
      toName: firstName,
      courseTitle: course.title,
      amount: `ZMW ${order.amount.toLocaleString()}`,
      courseUrl: `${appUrl}/courses/${course.slug}/learn`,
    });
  }

  return { ok: true };
}
