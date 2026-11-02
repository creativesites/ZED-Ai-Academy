"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { startCheckout } from "@/actions/payments";
import { Button } from "@/components/ui/button";
import { CouponInput } from "./coupon-input";

/**
 * Places the order (or continues to the provider). A coupon is only offered before an
 * order exists; the server recomputes the price from the coupon code.
 */
export function PlaceOrderPanel({
  courseId,
  originalPrice,
  continueOnly = false,
}: {
  courseId: string;
  originalPrice: number;
  continueOnly?: boolean;
}) {
  const router = useRouter();
  const [finalPrice, setFinalPrice] = useState(originalPrice);
  const [couponCode, setCouponCode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handlePlaceOrder() {
    setError(null);
    startTransition(async () => {
      const result = await startCheckout(
        continueOnly ? { courseId } : { courseId, couponCode: couponCode ?? undefined }
      );
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      {!continueOnly && (
        <>
          <div className="flex items-baseline justify-between gap-3">
            <span className="text-sm font-bold text-[#062e39]">Total</span>
            <span className="flex items-baseline gap-2">
              {couponCode && finalPrice < originalPrice && (
                <span className="text-sm text-slate-400 line-through">ZMW {originalPrice.toLocaleString()}</span>
              )}
              <span className="text-3xl font-black text-[#062e39]">ZMW {finalPrice.toLocaleString()}</span>
            </span>
          </div>
          <CouponInput
            courseId={courseId}
            originalPrice={originalPrice}
            onApply={(price, code) => {
              setFinalPrice(price);
              setCouponCode(code);
            }}
          />
        </>
      )}

      <Button
        type="button"
        onClick={handlePlaceOrder}
        disabled={pending}
        className="w-full rounded-full bg-[#fd5523] py-6 text-base font-bold text-white shadow-lg hover:bg-[#ef4a16] disabled:opacity-60"
      >
        {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        {continueOnly ? "Continue to payment" : "Place order"}
      </Button>

      {error && (
        <p role="alert" className="text-sm font-medium text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}
