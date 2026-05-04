"use client";

import { useState } from "react";
import { CouponInput } from "./coupon-input";

export function CheckoutPanel({
  courseId,
  originalPrice,
  children,
}: {
  courseId: string;
  originalPrice: number;
  children: (finalPrice: number, couponCode: string | null) => React.ReactNode;
}) {
  const [finalPrice, setFinalPrice] = useState(originalPrice);
  const [couponCode, setCouponCode] = useState<string | null>(null);

  return (
    <div>
      {/* Price display */}
      <div style={{ marginBottom: "8px" }}>
        {couponCode && finalPrice < originalPrice && (
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
            <span style={{ fontSize: "14px", color: "rgba(255,255,255,0.45)", textDecoration: "line-through" }}>
              ZMW {originalPrice.toLocaleString()}
            </span>
            <span style={{ fontSize: "11px", background: "#fd5523", color: "#fff", padding: "2px 8px", borderRadius: "10px", fontWeight: 700 }}>
              COUPON
            </span>
          </div>
        )}
        <div style={{ display: "flex", alignItems: "baseline", gap: "4px" }}>
          <span style={{ fontSize: "40px", fontWeight: 800, color: "#fd8d69", lineHeight: 1 }}>
            {finalPrice.toLocaleString()}
          </span>
          <span style={{ fontSize: "12px", fontWeight: 700, color: "rgba(255,255,255,0.4)", textTransform: "uppercase", letterSpacing: "0.08em" }}>ZMW</span>
        </div>
      </div>

      <CouponInput
        courseId={courseId}
        originalPrice={originalPrice}
        onApply={(price, code) => { setFinalPrice(price); setCouponCode(code); }}
      />

      <div style={{ marginTop: "16px" }}>
        {children(finalPrice, couponCode)}
      </div>
    </div>
  );
}
