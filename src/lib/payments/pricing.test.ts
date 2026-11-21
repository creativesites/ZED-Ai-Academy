import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { computeDiscountedPrice, isFreeAfterDiscount, type CouponRecord } from "./pricing.ts";

const baseCoupon: CouponRecord = {
  code: "SAVE20",
  discount_type: "percent",
  discount_value: 20,
  active: true,
  starts_at: null,
  expires_at: null,
  max_uses: 10,
  uses_count: 2,
  course_id: null,
  company_id: null,
};

const now = new Date("2026-11-21T12:00:00.000Z");

describe("computeDiscountedPrice", () => {
  it("applies percentage discount correctly", () => {
    const res = computeDiscountedPrice(500, baseCoupon, {
      courseId: "course-1",
      companyId: "comp-1",
      now,
    });
    assert.equal(res.valid, true);
    if (res.valid) {
      assert.equal(res.discountAmount, 100);
      assert.equal(res.finalPrice, 400);
      assert.equal(isFreeAfterDiscount(res.finalPrice), false);
    }
  });

  it("handles 100% coupon as free", () => {
    const res = computeDiscountedPrice(
      450,
      { ...baseCoupon, code: "FREE100", discount_value: 100 },
      { courseId: "course-1", now }
    );
    assert.equal(res.valid, true);
    if (res.valid) {
      assert.equal(res.discountAmount, 450);
      assert.equal(res.finalPrice, 0);
      assert.equal(isFreeAfterDiscount(res.finalPrice), true);
    }
  });

  it("applies fixed discount and clamps at 0", () => {
    const res = computeDiscountedPrice(
      300,
      { ...baseCoupon, code: "FLAT500", discount_type: "fixed", discount_value: 500 },
      { courseId: "course-1", now }
    );
    assert.equal(res.valid, true);
    if (res.valid) {
      assert.equal(res.discountAmount, 300);
      assert.equal(res.finalPrice, 0);
      assert.equal(isFreeAfterDiscount(res.finalPrice), true);
    }
  });

  it("rounds fractional currency values cleanly", () => {
    const res = computeDiscountedPrice(
      100,
      { ...baseCoupon, discount_type: "percent", discount_value: 33.33 },
      { courseId: "course-1", now }
    );
    assert.equal(res.valid, true);
    if (res.valid) {
      assert.equal(res.discountAmount, 33.33);
      assert.equal(res.finalPrice, 66.67);
    }
  });

  it("rejects inactive coupons", () => {
    const res = computeDiscountedPrice(
      500,
      { ...baseCoupon, active: false },
      { courseId: "course-1", now }
    );
    assert.equal(res.valid, false);
  });

  it("rejects expired coupons", () => {
    const res = computeDiscountedPrice(
      500,
      { ...baseCoupon, expires_at: "2026-11-20T00:00:00.000Z" },
      { courseId: "course-1", now }
    );
    assert.equal(res.valid, false);
  });

  it("rejects not-yet-active coupons", () => {
    const res = computeDiscountedPrice(
      500,
      { ...baseCoupon, starts_at: "2026-11-22T00:00:00.000Z" },
      { courseId: "course-1", now }
    );
    assert.equal(res.valid, false);
  });

  it("rejects coupons at usage limit", () => {
    const res = computeDiscountedPrice(
      500,
      { ...baseCoupon, max_uses: 5, uses_count: 5 },
      { courseId: "course-1", now }
    );
    assert.equal(res.valid, false);
  });

  it("rejects course mismatch", () => {
    const res = computeDiscountedPrice(
      500,
      { ...baseCoupon, course_id: "course-other" },
      { courseId: "course-1", now }
    );
    assert.equal(res.valid, false);
  });

  it("rejects academy/company mismatch", () => {
    const res = computeDiscountedPrice(
      500,
      { ...baseCoupon, company_id: "comp-other" },
      { courseId: "course-1", companyId: "comp-1", now }
    );
    assert.equal(res.valid, false);
  });
});
