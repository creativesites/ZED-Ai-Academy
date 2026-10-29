"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle, Loader2, XCircle } from "lucide-react";
import { confirmOrder, rejectOrder } from "@/actions/payments";

/** Confirm or reject a payment that the learner has submitted. */
export function PaymentOrderActions({ orderId }: { orderId: string }) {
  const router = useRouter();
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleConfirm() {
    setError(null);
    startTransition(async () => {
      const result = await confirmOrder({ orderId });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  function handleReject() {
    setError(null);
    startTransition(async () => {
      const result = await rejectOrder({ orderId, reason });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setRejecting(false);
      setReason("");
      router.refresh();
    });
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={handleConfirm}
          disabled={pending}
          className="flex items-center gap-1.5 rounded-xl border border-green-200 bg-green-50 px-4 py-2 text-xs font-bold text-green-700 transition-colors hover:bg-green-100 disabled:opacity-50"
        >
          {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle className="h-3.5 w-3.5" />}
          Confirm payment
        </button>
        <button
          type="button"
          onClick={() => setRejecting((open) => !open)}
          disabled={pending}
          className="flex items-center gap-1.5 rounded-xl border border-red-200 bg-white px-4 py-2 text-xs font-bold text-red-600 transition-colors hover:bg-red-50 disabled:opacity-50"
        >
          <XCircle className="h-3.5 w-3.5" />
          Reject
        </button>
      </div>

      {rejecting && (
        <div className="space-y-2">
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={2}
            maxLength={500}
            placeholder="Why is this payment not accepted? The learner will see this."
            className="w-full resize-none rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-[#062e39] outline-none focus:border-[#fd5523] focus:ring-2 focus:ring-[#fd5523]/20"
          />
          <button
            type="button"
            onClick={handleReject}
            disabled={pending || reason.trim().length < 3}
            className="rounded-xl bg-red-600 px-4 py-2 text-xs font-bold text-white transition-colors hover:bg-red-700 disabled:opacity-50"
          >
            Send rejection
          </button>
        </div>
      )}

      {error && (
        <p role="alert" className="text-xs font-medium text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}
