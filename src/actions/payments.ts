"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { createServiceClient } from "@/lib/supabase/server";
import { requireTenantAdmin } from "@/lib/tenants/access";
import { sendPaymentConfirmation } from "@/lib/email/emailjs";
import { ensureTenantMembership } from "@/lib/tenants/membership";
import { validateCoupon } from "@/actions/coupons";
import { getPaymentProvider } from "@/lib/payments";
import { formatZmw } from "@/lib/payments/manual-instructions.ts";
import { generateOrderReference } from "@/lib/payments/reference.ts";
import {
  canTransition,
  OPEN_ORDER_STATUSES,
  PROOF_ALLOWED_FROM,
} from "@/lib/payments/order-status.ts";
import { validatePaymentProof, validateRejectionReason } from "@/lib/payments/proof.ts";
import type { PaymentOrder } from "@/lib/payments/types.ts";

/**
 * Payment server actions. Every write uses the service-role client, so each action
 * checks authorization itself:
 *  - learner actions: the signed-in user must own the order
 *  - admin actions: the signed-in user must be an admin of the course's academy
 *    (requireTenantAdmin: company_admin of that tenant, or super_admin)
 *
 * Actions return a result object rather than throwing, so the error text reaches the
 * browser (Next strips thrown messages in production).
 */

export type ActionResult = { ok: true } | { ok: false; error: string };

const SIGN_IN_ERROR = "Sign in to continue.";
const DECIDED_ERROR = "This order was already decided. Refresh the page to see its current status.";

function str(value: unknown): string {
  return typeof value === "string" ? value : "";
}

async function requireAcademyAdmin(
  companyId: string
): Promise<{ ok: true; slug: string | null } | { ok: false; error: string }> {
  try {
    await requireTenantAdmin(companyId);
  } catch {
    return { ok: false, error: "Only academy admins can manage payments." };
  }
  const supabase = createServiceClient();
  const { data } = await supabase.from("companies").select("slug").eq("id", companyId).maybeSingle();
  return { ok: true, slug: data?.slug ?? null };
}

async function loadOrderWithCourse(orderId: string) {
  const supabase = createServiceClient();
  const { data: order } = await supabase
    .from("orders")
    .select("id, user_id, course_id, status, amount, currency, payment_reference")
    .eq("id", orderId)
    .maybeSingle();
  if (!order || !order.course_id) return null;

  const { data: course } = await supabase
    .from("courses")
    .select("id, title, slug, company_id")
    .eq("id", order.course_id)
    .maybeSingle();
  if (!course || !course.company_id) return null;

  return {
    order,
    course: { id: course.id, title: course.title, slug: course.slug, company_id: course.company_id },
  };
}

/**
 * Starts (or resumes) checkout for a course. Reuses an open order so the reference stays
 * stable. The price is always recomputed here; a coupon is re-validated on the server.
 */
export async function startCheckout(input: { courseId: string; couponCode?: string }): Promise<ActionResult> {
  const { userId } = await auth();
  if (!userId) return { ok: false, error: SIGN_IN_ERROR };

  const courseId = str(input?.courseId);
  const supabase = createServiceClient();
  const { data: course } = await supabase
    .from("courses")
    .select("id, title, slug, price_type, price_amount, company_id")
    .eq("id", courseId)
    .eq("status", "published")
    .maybeSingle();

  if (!course || course.price_type === "free" || !course.price_amount || !course.company_id) {
    return { ok: false, error: "This course is not available for purchase." };
  }

  const { data: enrollment } = await supabase
    .from("enrollments")
    .select("status")
    .eq("user_id", userId)
    .eq("course_id", course.id)
    .maybeSingle();
  if (enrollment?.status === "active") redirect(`/courses/${course.slug}/learn`);

  const { data: openOrder } = await supabase
    .from("orders")
    .select("id, user_id, course_id, company_id, amount, currency, status, payment_reference")
    .eq("user_id", userId)
    .eq("course_id", course.id)
    .in("status", [...OPEN_ORDER_STATUSES])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  let amount = Number(course.price_amount);
  const couponCode = str(input?.couponCode).trim();
  if (couponCode) {
    const coupon = await validateCoupon(couponCode, course.id, amount);
    if (!coupon.valid) return { ok: false, error: coupon.error };
    amount = Math.round(coupon.finalPrice * 100) / 100;
  }
  if (!(amount > 0)) {
    return { ok: false, error: "This price cannot be paid by mobile money. Contact the academy." };
  }

  let order = openOrder;
  if (order?.status === "awaiting_confirmation") {
    return { ok: false, error: "Your payment is already waiting for confirmation." };
  }
  if (order && Number(order.amount) !== amount) {
    // Only an order that has not been paid yet can change its price.
    const { data: repriced } = await supabase
      .from("orders")
      .update({ amount })
      .eq("id", order.id)
      .in("status", [...PROOF_ALLOWED_FROM])
      .select("id, user_id, course_id, company_id, amount, currency, status, payment_reference")
      .maybeSingle();
    if (!repriced) return { ok: false, error: DECIDED_ERROR };
    order = repriced;
  }
  if (!order) {
    const created = await createPendingOrder(userId, course.id, course.company_id, amount);
    if (!created) return { ok: false, error: "Could not create your order. Please try again." };
    order = created;
  }

  let start;
  try {
    start = await getPaymentProvider().createPayment(
      toPaymentOrder(order, course.title, course.company_id)
    );
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Could not start payment." };
  }
  if (start.kind === "redirect") redirect(start.url);

  revalidatePath(`/courses/${course.slug}/checkout`);
  return { ok: true };
}

async function createPendingOrder(
  userId: string,
  courseId: string,
  companyId: string,
  amount: number
) {
  const supabase = createServiceClient();
  // The reference is unique in the database; a collision is retried with a new one.
  for (let attempt = 0; attempt < 5; attempt++) {
    const { data, error } = await supabase
      .from("orders")
      .insert({
        user_id: userId,
        course_id: courseId,
        company_id: companyId,
        amount,
        currency: "ZMW",
        status: "pending",
        payment_reference: generateOrderReference(),
      })
      .select("id, user_id, course_id, company_id, amount, currency, status, payment_reference")
      .single();

    if (data) return data;
    if (error?.code !== "23505") {
      console.error("[payments] Could not create order:", error?.message);
      return null;
    }
  }
  return null;
}

function toPaymentOrder(
  order: { id: string; user_id: string; amount: number; currency: string; payment_reference: string | null },
  courseTitle: string,
  companyId: string
): PaymentOrder {
  if (!order.payment_reference) throw new Error("This order has no payment reference.");
  return {
    id: order.id,
    reference: order.payment_reference,
    amount: Number(order.amount),
    currency: order.currency,
    courseTitle,
    userId: order.user_id,
    companyId,
  };
}

/** The learner's "I have paid": stores the transaction ID and moves the order to awaiting_confirmation. */
export async function submitPaymentProof(input: {
  orderId: string;
  transactionId: string;
  method: string;
  note: string;
}): Promise<ActionResult> {
  const { userId } = await auth();
  if (!userId) return { ok: false, error: SIGN_IN_ERROR };

  const proof = validatePaymentProof({
    transactionId: input?.transactionId,
    method: input?.method,
    note: input?.note,
  });
  if (!proof.ok) return proof;

  const supabase = createServiceClient();
  const { data: order } = await supabase
    .from("orders")
    .select("id, status, course_id")
    .eq("id", str(input?.orderId))
    .eq("user_id", userId)
    .maybeSingle();
  if (!order) return { ok: false, error: "Order not found." };
  if (!PROOF_ALLOWED_FROM.includes(order.status)) {
    return { ok: false, error: "This order can no longer accept payment details." };
  }

  const { data: duplicate } = await supabase
    .from("orders")
    .select("id")
    .eq("transaction_id", proof.value.transactionId)
    .neq("id", order.id)
    .in("status", ["awaiting_confirmation", "paid"])
    .limit(1)
    .maybeSingle();
  if (duplicate) {
    return {
      ok: false,
      error: "This transaction ID was already submitted for another order. Check it, or contact the academy.",
    };
  }

  const { data: updated, error } = await supabase
    .from("orders")
    .update({
      status: "awaiting_confirmation",
      transaction_id: proof.value.transactionId,
      payment_method: proof.value.method,
      payment_note: proof.value.note,
      payment_submitted_at: new Date().toISOString(),
      rejection_reason: null,
      rejected_at: null,
    })
    .eq("id", order.id)
    .eq("user_id", userId)
    .in("status", [...PROOF_ALLOWED_FROM])
    .select("id")
    .maybeSingle();

  if (error || !updated) {
    return { ok: false, error: "This order was just updated. Refresh the page and try again." };
  }

  const { data: course } = await supabase
    .from("courses")
    .select("slug")
    .eq("id", order.course_id ?? "")
    .maybeSingle();
  if (course?.slug) revalidatePath(`/courses/${course.slug}/checkout`);
  return { ok: true };
}

/** Admin confirms a payment and grants course access (creates or reactivates the enrollment). */
export async function confirmOrder(input: { orderId: string }): Promise<ActionResult> {
  const { userId } = await auth();
  if (!userId) return { ok: false, error: SIGN_IN_ERROR };

  const loaded = await loadOrderWithCourse(str(input?.orderId));
  if (!loaded) return { ok: false, error: "Order not found." };
  const { order, course } = loaded;

  const admin = await requireAcademyAdmin(course.company_id);
  if (!admin.ok) return admin;

  if (!canTransition(order.status, "paid")) {
    return { ok: false, error: "Only orders awaiting confirmation can be confirmed." };
  }

  const supabase = createServiceClient();
  // Claim the order first. A second confirm or a concurrent reject then matches no row.
  const { data: claimed } = await supabase
    .from("orders")
    .update({
      status: "paid",
      paid_at: new Date().toISOString(),
      decided_by: userId,
      rejection_reason: null,
      rejected_at: null,
    })
    .eq("id", order.id)
    .eq("status", "awaiting_confirmation")
    .select("id")
    .maybeSingle();
  if (!claimed) return { ok: false, error: DECIDED_ERROR };

  const { error: enrollError } = await supabase.from("enrollments").upsert(
    {
      user_id: order.user_id,
      course_id: course.id,
      source: "individual_purchase",
      status: "active",
      order_id: order.id,
    },
    { onConflict: "user_id,course_id" }
  );

  if (enrollError) {
    console.error("[payments] Enrollment failed after confirm:", enrollError.message);
    // Put the order back so the admin can try again.
    await supabase
      .from("orders")
      .update({ status: "awaiting_confirmation", paid_at: null, decided_by: null })
      .eq("id", order.id)
      .eq("status", "paid");
    return { ok: false, error: "Could not grant course access. The order is still awaiting confirmation." };
  }

  try {
    await ensureTenantMembership(order.user_id, course.company_id, "learner");
  } catch (err) {
    console.error("[payments] Could not add learner to the academy:", err);
  }

  try {
    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name, email")
      .eq("id", order.user_id)
      .maybeSingle();
    if (profile?.email) {
      const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
      await sendPaymentConfirmation({
        toEmail: profile.email,
        toName: profile.full_name?.split(" ")[0] ?? "there",
        courseTitle: course.title,
        amount: formatZmw(Number(order.amount)),
        courseUrl: `${appUrl}/courses/${course.slug}/learn`,
      });
    }
  } catch (err) {
    console.error("[payments] Confirmation email failed:", err);
  }

  if (admin.slug) revalidatePath(`/academy/${admin.slug}/admin/payments`);
  revalidatePath(`/courses/${course.slug}/checkout`);
  return { ok: true };
}

/** Admin rejects a payment with a reason the learner will see. */
export async function rejectOrder(input: { orderId: string; reason: string }): Promise<ActionResult> {
  const { userId } = await auth();
  if (!userId) return { ok: false, error: SIGN_IN_ERROR };

  const reason = validateRejectionReason(input?.reason);
  if (!reason.ok) return reason;

  const loaded = await loadOrderWithCourse(str(input?.orderId));
  if (!loaded) return { ok: false, error: "Order not found." };
  const { order, course } = loaded;

  const admin = await requireAcademyAdmin(course.company_id);
  if (!admin.ok) return admin;

  if (!canTransition(order.status, "rejected")) {
    return { ok: false, error: "Only orders awaiting confirmation can be rejected." };
  }

  const supabase = createServiceClient();
  const { data: updated } = await supabase
    .from("orders")
    .update({
      status: "rejected",
      rejection_reason: reason.value,
      rejected_at: new Date().toISOString(),
      decided_by: userId,
    })
    .eq("id", order.id)
    .eq("status", "awaiting_confirmation")
    .select("id")
    .maybeSingle();
  if (!updated) return { ok: false, error: DECIDED_ERROR };

  if (admin.slug) revalidatePath(`/academy/${admin.slug}/admin/payments`);
  revalidatePath(`/courses/${course.slug}/checkout`);
  return { ok: true };
}

const DETAIL_LIMIT = 200;
const INSTRUCTIONS_LIMIT = 500;

/** Admin saves the academy's MoMo, Airtel and bank details. Blank fields use the platform defaults. */
export async function savePaymentDetails(input: {
  companyId: string;
  mtn: string;
  airtel: string;
  bank: string;
  instructions: string;
}): Promise<ActionResult> {
  const { userId } = await auth();
  if (!userId) return { ok: false, error: SIGN_IN_ERROR };

  const companyId = str(input?.companyId);
  const admin = await requireAcademyAdmin(companyId);
  if (!admin.ok) return admin;

  const fields = {
    mtn: str(input?.mtn).trim(),
    airtel: str(input?.airtel).trim(),
    bank: str(input?.bank).trim(),
    instructions: str(input?.instructions).trim(),
  };
  for (const [label, value] of [["MTN MoMo", fields.mtn], ["Airtel Money", fields.airtel], ["Bank details", fields.bank]] as const) {
    if (value.length > DETAIL_LIMIT) return { ok: false, error: `${label} must be ${DETAIL_LIMIT} characters or fewer.` };
  }
  if (fields.instructions.length > INSTRUCTIONS_LIMIT) {
    return { ok: false, error: `Instructions must be ${INSTRUCTIONS_LIMIT} characters or fewer.` };
  }

  const supabase = createServiceClient();
  const { error } = await supabase
    .from("companies")
    .update({
      payment_settings: {
        mtn: fields.mtn || null,
        airtel: fields.airtel || null,
        bank: fields.bank || null,
        instructions: fields.instructions || null,
      },
      updated_at: new Date().toISOString(),
    })
    .eq("id", companyId);
  if (error) {
    console.error("[payments] Could not save payment details:", error.message);
    return { ok: false, error: "Could not save payment details. Please try again." };
  }

  if (admin.slug) revalidatePath(`/academy/${admin.slug}/admin/payments`);
  return { ok: true };
}
