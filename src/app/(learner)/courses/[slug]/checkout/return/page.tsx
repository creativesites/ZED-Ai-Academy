import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { CheckCircle2, Clock, XCircle } from "lucide-react";
import { createServiceClient } from "@/lib/supabase/server";
import { settleOrder } from "@/lib/payments/orders";
import { AutoRefresh } from "./auto-refresh";

export const dynamic = "force-dynamic";
export const metadata = { title: "Confirming your payment", robots: { index: false } };

type Props = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ tx_ref?: string; tries?: string }>;
};

/**
 * Where PayChangu sends the buyer after checkout. We verify the payment with PayChangu
 * right here instead of waiting for the webhook, so paying learners land in their course.
 */
export default async function CheckoutReturnPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const { tx_ref: txRef, tries } = await searchParams;
  const { userId } = await auth();
  if (!userId) redirect(`/sign-in?redirect_url=${encodeURIComponent(`/courses/${slug}`)}`);
  if (!txRef) redirect(`/courses/${slug}`);

  // The order must belong to the signed-in user.
  const supabase = createServiceClient();
  const { data: order } = await supabase
    .from("orders")
    .select("id")
    .eq("payment_reference", txRef)
    .eq("user_id", userId)
    .maybeSingle();
  if (!order) redirect(`/courses/${slug}`);

  let state: "paid" | "pending" | "failed" | "mismatch" | "not_found" = "pending";
  try {
    state = (await settleOrder(txRef)).state;
  } catch (err) {
    console.error("[checkout/return] settle failed", err);
  }

  if (state === "paid") redirect(`/courses/${slug}/learn?enrolled=1`);

  const attempt = Math.min(Number(tries ?? "0") || 0, 100);
  const keepPolling = state === "pending" && attempt < 24; // ~2 minutes at 5s

  return (
    <main id="main" className="app-surface mx-auto flex min-h-[60vh] max-w-lg flex-col items-center justify-center px-6 py-16 text-center">
      {state === "pending" ? (
        <>
          <Clock className="h-12 w-12 text-brand-text" aria-hidden />
          <h1 className="mt-4 text-2xl font-bold text-ink">Confirming your payment…</h1>
          <p className="mt-2 text-slate-600">
            Mobile money payments can take a minute. Keep this page open; it checks again automatically.
            You can also leave: you&apos;ll get access as soon as the payment is confirmed.
          </p>
          {keepPolling && <AutoRefresh href={`/courses/${slug}/checkout/return?tx_ref=${encodeURIComponent(txRef)}&tries=${attempt + 1}`} />}
          <Link href={`/courses/${slug}/checkout/return?tx_ref=${encodeURIComponent(txRef)}`} className="mt-6 rounded-xl bg-brand px-5 py-3 text-sm font-semibold text-white hover:bg-brand-hover">
            Check again
          </Link>
        </>
      ) : state === "failed" ? (
        <>
          <XCircle className="h-12 w-12 text-red-600" aria-hidden />
          <h1 className="mt-4 text-2xl font-bold text-ink">Payment not completed</h1>
          <p className="mt-2 text-slate-600">The payment was cancelled or declined, and you have not been charged for this order.</p>
          <Link href={`/courses/${slug}/checkout`} className="mt-6 rounded-xl bg-brand px-5 py-3 text-sm font-semibold text-white hover:bg-brand-hover">
            Try again
          </Link>
        </>
      ) : (
        <>
          <CheckCircle2 className="h-12 w-12 text-amber-500" aria-hidden />
          <h1 className="mt-4 text-2xl font-bold text-ink">We need to check this payment</h1>
          <p className="mt-2 text-slate-600">
            Your payment details didn&apos;t match this order, so we&apos;re reviewing it. Please contact support with
            reference <span className="font-mono">{txRef}</span>.
          </p>
          <Link href="/contact" className="mt-6 rounded-xl border border-line px-5 py-3 text-sm font-semibold text-ink">
            Contact support
          </Link>
        </>
      )}
    </main>
  );
}
