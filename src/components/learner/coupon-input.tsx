"use client";

import { useState, useTransition } from "react";
import { validateCoupon } from "@/actions/coupons";
import { Tag, Loader2, CheckCircle, XCircle } from "lucide-react";

export function CouponInput({
  courseId,
  originalPrice,
  onApply,
}: {
  courseId: string;
  originalPrice: number;
  onApply: (finalPrice: number, code: string) => void;
}) {
  const [code, setCode] = useState("");
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [pending, startTransition] = useTransition();

  function handleApply() {
    if (!code.trim()) return;
    startTransition(async () => {
      const res = await validateCoupon(code, courseId, originalPrice);
      if (res.valid) {
        setResult({ ok: true, message: `${res.discountType === "percent" ? res.discountValue + "% off" : "ZMW " + res.discountValue + " off"} applied!` });
        onApply(res.finalPrice, res.code);
      } else {
        setResult({ ok: false, message: res.error });
      }
    });
  }

  return (
    <div style={{ marginTop: "12px" }}>
      <div style={{ display: "flex", gap: "8px" }}>
        <div style={{ position: "relative", flex: 1 }}>
          <Tag style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", width: "14px", height: "14px", color: "rgba(255,255,255,0.4)" }} />
          <input
            value={code}
            onChange={(e) => { setCode(e.target.value.toUpperCase()); setResult(null); }}
            placeholder="Coupon code"
            style={{
              width: "100%", background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.15)",
              borderRadius: "12px", padding: "10px 12px 10px 34px", color: "#fff",
              fontSize: "13px", outline: "none", fontFamily: "inherit",
            }}
          />
        </div>
        <button
          onClick={handleApply}
          disabled={pending || !code.trim()}
          style={{
            padding: "10px 16px", borderRadius: "12px", border: "none",
            background: code.trim() ? "#fd5523" : "rgba(255,255,255,0.1)",
            color: "#fff", fontWeight: 700, fontSize: "13px",
            cursor: code.trim() ? "pointer" : "not-allowed",
            display: "flex", alignItems: "center", gap: "6px", flexShrink: 0,
          }}
        >
          {pending ? <Loader2 style={{ width: "14px", height: "14px" }} className="animate-spin" /> : "Apply"}
        </button>
      </div>

      {result && (
        <div style={{
          display: "flex", alignItems: "center", gap: "6px", marginTop: "8px",
          fontSize: "12px", fontWeight: 600,
          color: result.ok ? "#86efac" : "#fca5a5",
        }}>
          {result.ok
            ? <CheckCircle style={{ width: "14px", height: "14px" }} />
            : <XCircle style={{ width: "14px", height: "14px" }} />}
          {result.message}
        </div>
      )}
    </div>
  );
}
