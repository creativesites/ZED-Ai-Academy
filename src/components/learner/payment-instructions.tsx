import type { PaymentInstructions } from "@/lib/payments/types.ts";

/** What the learner must send and where. Shown until the order is confirmed or rejected. */
export function PaymentInstructionsCard({ instructions }: { instructions: PaymentInstructions }) {
  return (
    <div className="space-y-5 rounded-[1.75rem] border border-[#fd5523]/20 bg-[#fff6ee] p-6">
      <div>
        <p className="text-xs font-bold uppercase tracking-widest text-[#fd5523]">Send exactly</p>
        <p className="mt-1 text-3xl font-black text-[#062e39]">{instructions.amountLabel}</p>
      </div>

      <div>
        <p className="text-xs font-bold uppercase tracking-widest text-[#fd5523]">Payment reference</p>
        <p className="mt-1 select-all font-mono text-xl font-bold tracking-wider text-[#062e39]">
          {instructions.reference}
        </p>
        <p className="mt-1 text-xs text-slate-500">
          Put this reference in the payment note so the academy can match your payment.
        </p>
      </div>

      {instructions.methods.length > 0 ? (
        <ul className="space-y-2">
          {instructions.methods.map((method) => (
            <li
              key={method.label}
              className="flex flex-col gap-0.5 rounded-2xl bg-white px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
            >
              <span className="text-sm font-bold text-[#062e39]">{method.label}</span>
              <span className="select-all break-all font-mono text-sm text-slate-700">{method.value}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-slate-600">No payment destinations are listed yet. Contact the academy.</p>
      )}

      {instructions.note && (
        <p className="whitespace-pre-line text-sm leading-relaxed text-slate-600">{instructions.note}</p>
      )}
    </div>
  );
}
