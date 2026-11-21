"use server";

import { createClient } from "@/lib/supabase/server";
import { computeDiscountedPrice, type CouponRecord, type DiscountType } from "@/lib/payments/pricing";

export type CouponResult =
  | { valid: true; code: string; discountType: "percent" | "fixed"; discountValue: number; finalPrice: number }
  | { valid: false; error: string };

export async function validateCoupon(code: string, courseId: string, originalPrice: number): Promise<CouponResult> {
  const res = await resolveCouponForCourse(code, courseId, originalPrice);
  if (!res.valid) return res;
  return {
    valid: true,
    code: res.code,
    discountType: res.discountType,
    discountValue: res.discountValue,
    finalPrice: res.finalPrice,
  };
}

export type ResolvedCouponResult =
  | {
      valid: true;
      code: string;
      discountType: DiscountType;
      discountValue: number;
      discountAmount: number;
      finalPrice: number;
    }
  | { valid: false; error: string };

/**
 * Authoritative server-side coupon validation against the course's real price and tenant.
 */
export async function resolveCouponForCourse(
  code: string,
  courseId: string,
  fallbackOriginalPrice?: number
): Promise<ResolvedCouponResult> {
  const normalized = code.trim().toUpperCase();
  if (!normalized) return { valid: false, error: "Enter a coupon code." };

  const supabase = createClient();

  const [{ data: course }, { data: coupon }] = await Promise.all([
    supabase
      .from("courses")
      .select("id, price_amount, company_id")
      .eq("id", courseId)
      .maybeSingle(),
    supabase
      .from("coupons")
      .select("*")
      .eq("code", normalized)
      .eq("active", true)
      .maybeSingle(),
  ]);

  if (!coupon) return { valid: false, error: "Invalid or expired coupon code." };

  const originalPrice = course?.price_amount ?? fallbackOriginalPrice ?? 0;
  const record: CouponRecord = {
    code: coupon.code,
    discount_type: coupon.discount_type as DiscountType,
    discount_value: Number(coupon.discount_value),
    active: Boolean(coupon.active),
    starts_at: (coupon as { starts_at?: string | null }).starts_at ?? null,
    expires_at: coupon.expires_at,
    max_uses: coupon.max_uses,
    uses_count: coupon.uses_count,
    course_id: coupon.course_id,
    company_id: (coupon as { company_id?: string | null }).company_id ?? null,
  };

  const computed = computeDiscountedPrice(originalPrice, record, {
    courseId,
    companyId: course?.company_id ?? null,
  });

  if (!computed.valid) {
    return { valid: false, error: computed.error };
  }

  return {
    valid: true,
    code: computed.code,
    discountType: computed.discountType,
    discountValue: computed.discountValue,
    discountAmount: computed.discountAmount,
    finalPrice: computed.finalPrice,
  };
}
