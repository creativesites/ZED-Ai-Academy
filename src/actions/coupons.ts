"use server";

import { createClient } from "@/lib/supabase/server";

export type CouponResult =
  | { valid: true; code: string; discountType: "percent" | "fixed"; discountValue: number; finalPrice: number }
  | { valid: false; error: string };

export async function validateCoupon(code: string, courseId: string, originalPrice: number): Promise<CouponResult> {
  if (!code.trim()) return { valid: false, error: "Enter a coupon code." };

  const supabase = createClient();
  const { data: coupon } = await supabase
    .from("coupons")
    .select("*")
    .eq("code", code.trim().toUpperCase())
    .eq("active", true)
    .single();

  if (!coupon) return { valid: false, error: "Invalid or expired coupon code." };

  // Check expiry
  if (coupon.expires_at && new Date(coupon.expires_at) < new Date()) {
    return { valid: false, error: "This coupon has expired." };
  }

  // Check usage limit
  if (coupon.max_uses !== null && coupon.uses_count >= coupon.max_uses) {
    return { valid: false, error: "This coupon has reached its usage limit." };
  }

  // Check course restriction
  if (coupon.course_id && coupon.course_id !== courseId) {
    return { valid: false, error: "This coupon is not valid for this course." };
  }

  const discount =
    coupon.discount_type === "percent"
      ? originalPrice * (coupon.discount_value / 100)
      : coupon.discount_value;

  const finalPrice = Math.max(0, originalPrice - discount);

  return {
    valid: true,
    code: coupon.code,
    discountType: coupon.discount_type as "percent" | "fixed",
    discountValue: coupon.discount_value,
    finalPrice,
  };
}
