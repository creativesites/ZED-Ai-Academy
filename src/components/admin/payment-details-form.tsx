"use client";

import { useState, useTransition, type FormEvent } from "react";
import { Loader2 } from "lucide-react";
import { savePaymentDetails } from "@/actions/payments";

export type PaymentDetailValues = {
  mtn: string;
  airtel: string;
  bank: string;
  instructions: string;
};

const FIELD_CLASS =
  "w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-[#062e39] outline-none focus:border-[#fd5523] focus:ring-2 focus:ring-[#fd5523]/20";

/** The academy's own MoMo, Airtel and bank details. Shown to learners at checkout. */
export function PaymentDetailsForm({
  companyId,
  initial,
}: {
  companyId: string;
  initial: PaymentDetailValues;
}) {
  const [values, setValues] = useState(initial);
  const [status, setStatus] = useState<{ ok: boolean; message: string } | null>(null);
  const [pending, startTransition] = useTransition();

  function update(field: keyof PaymentDetailValues, value: string) {
    setValues((current) => ({ ...current, [field]: value }));
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus(null);
    startTransition(async () => {
      const result = await savePaymentDetails({ companyId, ...values });
      setStatus(
        result.ok
          ? { ok: true, message: "Saved. Learners see these details at checkout." }
          : { ok: false, message: result.error }
      );
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5 rounded-[2rem] border border-slate-100 bg-white p-6 shadow-sm">
      <div>
        <h2 className="text-lg font-black text-[#062e39]">Payment details</h2>
        <p className="mt-1 text-sm text-slate-500">
          Where learners send their money. A blank field falls back to the platform default.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <label className="space-y-1.5">
          <span className="text-xs font-bold uppercase tracking-widest text-slate-400">MTN MoMo number</span>
          <input className={FIELD_CLASS} value={values.mtn} maxLength={200} onChange={(e) => update("mtn", e.target.value)} />
        </label>
        <label className="space-y-1.5">
          <span className="text-xs font-bold uppercase tracking-widest text-slate-400">Airtel Money number</span>
          <input className={FIELD_CLASS} value={values.airtel} maxLength={200} onChange={(e) => update("airtel", e.target.value)} />
        </label>
      </div>

      <label className="block space-y-1.5">
        <span className="text-xs font-bold uppercase tracking-widest text-slate-400">Bank details</span>
        <textarea
          className={`${FIELD_CLASS} resize-none`}
          rows={2}
          value={values.bank}
          maxLength={200}
          placeholder="Bank, account name, account number, branch"
          onChange={(e) => update("bank", e.target.value)}
        />
      </label>

      <label className="block space-y-1.5">
        <span className="text-xs font-bold uppercase tracking-widest text-slate-400">Note for learners (optional)</span>
        <textarea
          className={`${FIELD_CLASS} resize-none`}
          rows={3}
          value={values.instructions}
          maxLength={500}
          placeholder="e.g. Send from your own number. Payments are confirmed within one working day."
          onChange={(e) => update("instructions", e.target.value)}
        />
      </label>

      <div className="flex flex-wrap items-center gap-4">
        <button
          type="submit"
          disabled={pending}
          className="flex items-center gap-2 rounded-xl bg-[#062e39] px-5 py-2.5 text-sm font-bold text-white transition-colors hover:bg-[#0b4250] disabled:opacity-50"
        >
          {pending && <Loader2 className="h-4 w-4 animate-spin" />}
          Save payment details
        </button>
        {status && (
          <p role="status" className={`text-sm font-medium ${status.ok ? "text-green-700" : "text-red-600"}`}>
            {status.message}
          </p>
        )}
      </div>
    </form>
  );
}
