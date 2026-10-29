import { auth } from "@clerk/nextjs/server";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { getPaymentProvider } from "@/lib/payments";
import { OPEN_ORDER_STATUSES, PROOF_ALLOWED_FROM } from "@/lib/payments/order-status.ts";
import { formatZmw } from "@/lib/payments/manual-instructions.ts";
import type { PaymentInstructions, PaymentStart } from "@/lib/payments/types.ts";
import { buttonVariants } from "@/components/ui/button-variants";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, BookOpen, CheckCircle, Clock3, Lock, Shield, XCircle } from "lucide-react";
import { PlaceOrderPanel } from "@/components/learner/place-order-panel";
import { PaymentInstructionsCard } from "@/components/learner/payment-instructions";
import { PaymentProofForm } from "@/components/learner/payment-proof-form";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const supabase = createClient();
  const { data } = await supabase
    .from("courses")
    .select("title")
    .eq("slug", slug)
    .single();
  return { title: data ? `Checkout — ${data.title}` : "Checkout" };
}

export default async function CheckoutPage({ params }: Props) {
  const { slug } = await params;
  const { userId } = await auth();
  if (!userId) redirect(`/sign-in?redirect_url=/courses/${slug}/checkout`);

  const supabase = createClient();

  const { data: courseRaw } = await supabase
    .from("courses")
    .select("id, title, description, thumbnail_url, category, level, price_type, price_amount, slug, company_id, companies(slug)")
    .eq("slug", slug)
    .eq("status", "published")
    .single();

  const course = courseRaw as any;

  if (!course) notFound();
  if (course.price_type === "free") redirect(`/courses/${slug}`);
  if (!course.price_amount) redirect(`/courses/${slug}`);

  const comp = Array.isArray(course.companies)
    ? course.companies[0]
    : course.companies;
  const tenantSlug = comp?.slug || "zedai";
  const listPrice = Number(course.price_amount);

  const { data: enrollment } = await supabase
    .from("enrollments")
    .select("status")
    .eq("user_id", userId)
    .eq("course_id", course.id)
    .maybeSingle();
  if (enrollment?.status === "active") redirect(`/courses/${slug}/learn`);

  const { data: openOrder } = await supabase
    .from("orders")
    .select("id, status, amount, currency, payment_reference, transaction_id, rejection_reason")
    .eq("user_id", userId)
    .eq("course_id", course.id)
    .in("status", [...OPEN_ORDER_STATUSES])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  // Work out what an open order shows. Pending and rejected orders need the payment
  // instructions again; awaiting ones only show a status.
  let instructions: PaymentInstructions | null = null;
  let continueToProvider = false;
  let notConfigured = false;
  if (openOrder && PROOF_ALLOWED_FROM.includes(openOrder.status)) {
    const provider = getPaymentProvider();
    let start: PaymentStart | null | undefined;
    if (provider.resumePayment) {
      start = await provider.resumePayment({
        id: openOrder.id,
        reference: openOrder.payment_reference ?? "",
        amount: Number(openOrder.amount),
        currency: openOrder.currency,
        courseTitle: course.title,
        userId,
        companyId: course.company_id,
      });
    }
    if (start?.kind === "manual") instructions = start.instructions;
    else if (start === null) notConfigured = true;
    else continueToProvider = true;
  }

  const isAwaiting = openOrder?.status === "awaiting_confirmation";
  const isRejected = openOrder?.status === "rejected";

  return (
    <div className="container" style={{ paddingTop: "60px", paddingBottom: "80px" }}>

      {/* Back */}
      <Link
        href={`/academy/${tenantSlug}/courses/${slug}`}
        className={cn(
          buttonVariants({ variant: "ghost" }),
          "mb-8 rounded-full text-slate-500 hover:bg-[#fff6ee] hover:text-[#062e39] flex items-center justify-center w-fit h-9 px-3"
        )}
      >
        <ArrowLeft className="mr-1 h-4 w-4" />
        Back to course
      </Link>

      <div className="mb-8">
        <p className="text-xs font-bold uppercase tracking-widest text-[#fd5523] mb-1">Secure Checkout</p>
        <h1 className="text-3xl font-bold tracking-tight text-[#062e39]">Complete your enrollment</h1>
      </div>

      <div className="grid gap-8 lg:grid-cols-[1fr_420px]">

        {/* Left: course preview + what's included */}
        <div className="space-y-6">

          <div className="marketing-card rounded-[2.5rem] border-0 p-6 flex gap-6 items-start">
            <div className="h-24 w-32 shrink-0 overflow-hidden rounded-[1.5rem] bg-[#fff6ee]">
              {course.thumbnail_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={course.thumbnail_url}
                  alt={course.title}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center">
                  <BookOpen className="h-8 w-8 text-[#fd5523]/40" />
                </div>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="mb-2 flex flex-wrap gap-1.5">
                {course.category && (
                  <Badge className="border-0 bg-[#fff6ee] text-[#fd5523] text-[11px] font-bold">
                    {course.category}
                  </Badge>
                )}
                {course.level && (
                  <Badge className="border-slate-200 bg-slate-50 text-slate-600 capitalize text-[11px]">
                    {course.level}
                  </Badge>
                )}
              </div>
              <h2 className="text-lg font-bold text-[#062e39] line-clamp-2">{course.title}</h2>
              {course.description && (
                <p className="mt-1.5 text-sm text-slate-500 line-clamp-2 leading-relaxed">{course.description}</p>
              )}
            </div>
          </div>

          <div className="marketing-outline-card rounded-[2.5rem] border-0 p-8">
            <div className="mb-5 flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-[#fd5523]" />
              <h3 className="text-xs font-bold uppercase tracking-widest text-[#062e39]">What You Get</h3>
            </div>
            <ul className="space-y-4">
              {[
                "Lifetime access — yours forever",
                "AI Tutor available in every lesson",
                "Scored quizzes & knowledge checks",
                "Certificate of completion",
                "Self-paced — learn on your schedule",
              ].map((item) => (
                <li key={item} className="flex items-center gap-3 text-sm font-medium text-[#062e39]">
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-xl bg-green-100 text-green-600">
                    <CheckCircle className="h-4 w-4" />
                  </div>
                  {item}
                </li>
              ))}
            </ul>
          </div>

          <div className="flex flex-wrap gap-4 px-2 text-xs font-medium text-slate-400">
            <span className="flex items-center gap-1.5">
              <Shield className="h-3.5 w-3.5" />
              Pay by MTN MoMo, Airtel Money or bank transfer
            </span>
            <span className="flex items-center gap-1.5">
              <Lock className="h-3.5 w-3.5" />
              Access is granted once the academy confirms your payment
            </span>
          </div>
        </div>

        {/* Right: order summary and the next step */}
        <div className="h-fit space-y-6 rounded-[2.5rem] border border-slate-200 bg-white p-8 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-widest text-[#fd5523]">Order Summary</p>

          <div className="space-y-3 border-b border-slate-100 pb-6">
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-500">Course price</span>
              <span className="font-bold text-[#062e39]">{formatZmw(listPrice)}</span>
            </div>
            {openOrder && (
              <>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-500">Amount due</span>
                  <span className="font-bold text-[#062e39]">{formatZmw(Number(openOrder.amount))}</span>
                </div>
                {openOrder.payment_reference && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-500">Order reference</span>
                    <span className="font-mono font-bold text-[#062e39]">{openOrder.payment_reference}</span>
                  </div>
                )}
              </>
            )}
          </div>

          {!openOrder && (
            <PlaceOrderPanel courseId={course.id} originalPrice={listPrice} />
          )}

          {continueToProvider && (
            <PlaceOrderPanel courseId={course.id} originalPrice={listPrice} continueOnly />
          )}

          {notConfigured && (
            <Notice tone="amber" icon={<Clock3 className="h-4 w-4" />} title="Payment is not set up yet">
              This academy has not added its payment details yet. Contact the academy to complete your enrollment.
            </Notice>
          )}

          {isAwaiting && (
            <Notice tone="amber" icon={<Clock3 className="h-4 w-4" />} title="Payment details received">
              Transaction ID <span className="font-mono font-bold">{openOrder?.transaction_id}</span>. The academy is
              checking it. You get access as soon as it is confirmed.
            </Notice>
          )}

          {instructions && (
            <>
              {isRejected && (
                <Notice tone="red" icon={<XCircle className="h-4 w-4" />} title="Your last payment was not accepted">
                  {openOrder?.rejection_reason ?? "The academy could not match this payment."} Check the details
                  below and submit again.
                </Notice>
              )}
              <PaymentInstructionsCard instructions={instructions} />
              <PaymentProofForm orderId={openOrder!.id} />
            </>
          )}

          <p className="text-xs leading-relaxed text-slate-400">
            Send the exact amount with your order reference in the payment note. Your access starts when the
            academy confirms the payment.
          </p>
        </div>
      </div>
    </div>
  );
}

function Notice({
  tone,
  icon,
  title,
  children,
}: {
  tone: "amber" | "red";
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  const styles =
    tone === "red"
      ? "border-red-200 bg-red-50 text-red-800"
      : "border-amber-200 bg-amber-50 text-amber-900";
  return (
    <div className={cn("rounded-[1.5rem] border p-5", styles)}>
      <div className="flex items-center gap-2 font-bold">
        {icon}
        {title}
      </div>
      <p className="mt-2 text-sm leading-relaxed">{children}</p>
    </div>
  );
}
