export type DiscountType = "percent" | "fixed";

export type CouponRecord = {
  code: string;
  discount_type: DiscountType;
  discount_value: number;
  active: boolean;
  starts_at?: string | null;
  expires_at: string | null;
  max_uses: number | null;
  uses_count: number;
  course_id: string | null;
  company_id?: string | null;
};

export type PriceComputationContext = {
  courseId: string;
  companyId?: string | null;
  now?: Date;
};

export type PriceComputationResult =
  | {
      valid: true;
      code: string;
      discountType: DiscountType;
      discountValue: number;
      originalPrice: number;
      discountAmount: number;
      finalPrice: number;
    }
  | {
      valid: false;
      error: string;
    };

function roundCurrency(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * Pure server-side coupon validation and price computation.
 * Never trusts a client-supplied final price or discount amount.
 */
export function computeDiscountedPrice(
  originalPrice: number,
  coupon: CouponRecord,
  context: PriceComputationContext
): PriceComputationResult {
  if (!Number.isFinite(originalPrice) || originalPrice <= 0) {
    return { valid: false, error: "Invalid course price." };
  }

  if (!coupon.active) {
    return { valid: false, error: "Invalid or expired coupon code." };
  }

  const now = context.now ?? new Date();

  if (coupon.starts_at && new Date(coupon.starts_at) > now) {
    return { valid: false, error: "This coupon is not active yet." };
  }

  if (coupon.expires_at && new Date(coupon.expires_at) < now) {
    return { valid: false, error: "This coupon has expired." };
  }

  if (coupon.max_uses !== null && coupon.uses_count >= coupon.max_uses) {
    return { valid: false, error: "This coupon has reached its usage limit." };
  }

  if (coupon.course_id && coupon.course_id !== context.courseId) {
    return { valid: false, error: "This coupon is not valid for this course." };
  }

  if (coupon.company_id && coupon.company_id !== context.companyId) {
    return { valid: false, error: "This coupon is not valid for this academy." };
  }

  if (!Number.isFinite(coupon.discount_value) || coupon.discount_value <= 0) {
    return { valid: false, error: "Invalid coupon discount value." };
  }

  let rawDiscount = 0;
  if (coupon.discount_type === "percent") {
    const pct = Math.min(100, Math.max(0, coupon.discount_value));
    rawDiscount = originalPrice * (pct / 100);
  } else {
    rawDiscount = coupon.discount_value;
  }

  const discountAmount = Math.min(originalPrice, Math.max(0, roundCurrency(rawDiscount)));
  const finalPrice = Math.max(0, roundCurrency(originalPrice - discountAmount));

  return {
    valid: true,
    code: coupon.code,
    discountType: coupon.discount_type,
    discountValue: coupon.discount_value,
    originalPrice,
    discountAmount,
    finalPrice,
  };
}

export function isFreeAfterDiscount(finalPrice: number): boolean {
  return finalPrice <= 0;
}
