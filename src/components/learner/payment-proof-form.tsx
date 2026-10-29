"use client";

import { useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { submitPaymentProof } from "@/actions/payments";
import { Button } from "@/components/ui/button";
import { PAYMENT_METHOD_OPTIONS, NOTE_MAX, TRANSACTION_ID_MAX } from "@/lib/payments/proof.ts";

/** "I have paid": the learner gives the transaction ID they received from their provider. */
export function PaymentProofForm({ orderId }: { orderId: string }) {
  const router = useRouter();
  const [transactionId, setTransactionId] = useState("");
  const [method, setMethod] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await submitPaymentProof({ orderId, transactionId, method, note });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 rounded-[1.75rem] border border-slate-200 bg-white p-6">
      <div>
        <h3 className="text-base font-black text-[#062e39]">I have paid</h3>
        <p className="mt-1 text-sm text-slate-500">
          Enter the transaction ID from your payment confirmation SMS or receipt.
        </p>
      </div>

      <div className="space-y-1.5">
        <label htmlFor="transaction-id" className="text-sm font-bold text-[#062e39]">
          Transaction ID
        </label>
        <input
          id="transaction-id"
          name="transactionId"
          required
          maxLength={TRANSACTION_ID_MAX}
          value={transactionId}
          onChange={(e) => setTransactionId(e.target.value)}
          placeholder="e.g. MP250101.1234.A56789"
          autoComplete="off"
          className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 font-mono text-sm text-[#062e39] outline-none focus:border-[#fd5523] focus:ring-2 focus:ring-[#fd5523]/20"
        />
      </div>

      <div className="space-y-1.5">
        <label htmlFor="payment-method" className="text-sm font-bold text-[#062e39]">
          Paid with
        </label>
        <select
          id="payment-method"
          name="method"
          value={method}
          onChange={(e) => setMethod(e.target.value)}
          className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-[#062e39] outline-none focus:border-[#fd5523] focus:ring-2 focus:ring-[#fd5523]/20"
        >
          <option value="">Choose one (optional)</option>
          {PAYMENT_METHOD_OPTIONS.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-1.5">
        <label htmlFor="payment-note" className="text-sm font-bold text-[#062e39]">
          Note <span className="font-normal text-slate-400">(optional)</span>
        </label>
        <textarea
          id="payment-note"
          name="note"
          rows={2}
          maxLength={NOTE_MAX}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          className="w-full resize-none rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-[#062e39] outline-none focus:border-[#fd5523] focus:ring-2 focus:ring-[#fd5523]/20"
        />
      </div>

      {error && (
        <p role="alert" className="text-sm font-medium text-red-600">
          {error}
        </p>
      )}

      <Button
        type="submit"
        disabled={pending || transactionId.trim().length === 0}
        className="w-full rounded-full bg-[#062e39] py-5 text-sm font-bold text-white hover:bg-[#0b4250] disabled:opacity-60"
      >
        {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        Submit payment details
      </Button>
    </form>
  );
}
