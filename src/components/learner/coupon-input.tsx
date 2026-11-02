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
    <div className="mt-3">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Tag className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
          <input
            value={code}
            onChange={(e) => { setCode(e.target.value.toUpperCase()); setResult(null); }}
            placeholder="Coupon code"
            aria-label="Coupon code"
            className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-9 pr-3 text-sm text-[#062e39] outline-none focus:border-[#fd5523] focus:ring-2 focus:ring-[#fd5523]/20"
          />
        </div>
        <button
          type="button"
          onClick={handleApply}
          disabled={pending || !code.trim()}
          className="flex shrink-0 items-center gap-1.5 rounded-xl bg-[#062e39] px-4 py-2.5 text-sm font-bold text-white transition-colors hover:bg-[#0b4250] disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400"
        >
          {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Apply"}
        </button>
      </div>

      {result && (
        <div
          className={`mt-2 flex items-center gap-1.5 text-xs font-semibold ${result.ok ? "text-green-700" : "text-red-600"}`}
        >
          {result.ok ? <CheckCircle className="h-3.5 w-3.5" /> : <XCircle className="h-3.5 w-3.5" />}
          {result.message}
        </div>
      )}
    </div>
  );
}
