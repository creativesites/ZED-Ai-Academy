import { auth, currentUser } from "@clerk/nextjs/server";
import { redirect, notFound } from "next/navigation";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { initiatePayment } from "@/lib/payments/paychangu";
import { isFreeAfterDiscount } from "@/lib/payments/pricing";
import { insertOrder, incrementCouponUsage } from "@/lib/payments/orders";
import { resolveCouponForCourse } from "@/actions/coupons";
import { ensureTenantMembership } from "@/actions/tenants";
import { randomUUID } from "crypto";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { buttonVariants } from "@/components/ui/button-variants";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, BookOpen, CheckCircle, Lock, Shield } from "lucide-react";
import type { Metadata } from "next";
import { CheckoutPanel } from "@/components/learner/checkout-panel";
import { BRAND } from "@/lib/brand";

type Props = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ error?: string }>;
};

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

async function startCheckout(slug: string, courseId: string, formData: FormData) {
  "use server";

  const { userId } = await auth();
  if (!userId) redirect(`/sign-in?redirect_url=/courses/${slug}/checkout`);

  const clerkUser = await currentUser();
  if (!clerkUser) redirect(`/sign-in?redirect_url=/courses/${slug}/checkout`);

  const primaryEmail = clerkUser.emailAddresses.find(
    (e) => e.id === clerkUser.primaryEmailAddressId
  )?.emailAddress;

  if (!primaryEmail) throw new Error("No email address on account");

  const supabase = createClient();

  // Re-fetch authoritative course details from DB (never trust client price/slug)
  const { data: course } = await supabase
    .from("courses")
    .select("id, title, price_amount, price_type, slug, company_id, status")
    .eq("id", courseId)
    .eq("status", "published")
    .single();

  if (!course || course.price_type === "free" || !course.price_amount) {
    throw new Error("Course not found");
  }

  // Check not already enrolled (active)
  const { data: existing } = await supabase
    .from("enrollments")
    .select("id, status")
    .eq("user_id", userId)
    .eq("course_id", course.id)
    .eq("status", "active")
    .maybeSingle();

  if (existing) redirect(`/courses/${course.slug}/learn`);

  // Re-validate coupon server-side if provided
  const rawCouponCode = (formData.get("couponCode") as string | null)?.trim().toUpperCase() || null;
  let finalAmount = course.price_amount;
  let discountAmount = 0;
  let validatedCouponCode: string | null = null;

  if (rawCouponCode) {
    const couponRes = await resolveCouponForCourse(rawCouponCode, course.id, course.price_amount);
    if (!couponRes.valid) {
      redirect(`/courses/${course.slug}/checkout?error=${encodeURIComponent(couponRes.error)}`);
    }
    finalAmount = couponRes.finalPrice;
    discountAmount = couponRes.discountAmount;
    validatedCouponCode = couponRes.code;
  }

  const txRef = `zaa-${course.id.slice(0, 8)}-${randomUUID().slice(0, 8)}`;

  // 100% coupon → active enrollment without calling the payment provider
  if (isFreeAfterDiscount(finalAmount)) {
    const { error: orderError } = await insertOrder({
      userId,
      courseId: course.id,
      companyId: course.company_id,
      amount: 0,
      currency: "ZMW",
      status: "paid",
      paymentReference: txRef,
      paymentMethod: "coupon",
      couponCode: validatedCouponCode,
      discountAmount,
      paidAt: new Date().toISOString(),
    });

    if (orderError) throw new Error(orderError.message);

    const serviceClient = createServiceClient();
    const { error: enrollError } = await serviceClient.from("enrollments").upsert(
      {
        user_id: userId,
        course_id: course.id,
        company_id: course.company_id,
        status: "active",
        source: "individual_purchase",
      },
      { onConflict: "user_id,course_id" }
    );

    if (enrollError) throw new Error(enrollError.message);

    if (course.company_id) {
      try {
        await ensureTenantMembership(userId, course.company_id, "learner");
      } catch (err) {
        console.error("[checkout] Failed to ensure tenant membership:", err);
      }
    }

    if (validatedCouponCode) {
      await incrementCouponUsage(validatedCouponCode);
    }

    redirect(`/courses/${course.slug}/learn?enrolled=1`);
  }

  // Create pending order with server-computed discounted amount
  const { error: orderError } = await insertOrder({
    userId,
    courseId: course.id,
    companyId: course.company_id,
    amount: finalAmount,
    currency: "ZMW",
    status: "pending",
    paymentReference: txRef,
    couponCode: validatedCouponCode,
    discountAmount,
  });

  if (orderError) throw new Error(orderError.message);

  if (process.env.NODE_ENV !== "production") {
    console.info("[checkout] Initiating PayChangu payment", {
      txRef,
      courseId: course.id,
      originalPrice: course.price_amount,
      finalAmount,
      discountAmount,
      couponCode: validatedCouponCode,
    });
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || BRAND.url;

  const result = await initiatePayment({
    txRef,
    amount: finalAmount,
    currency: "ZMW",
    email: primaryEmail,
    firstName: clerkUser.firstName ?? "",
    lastName: clerkUser.lastName ?? "",
    courseTitle: course.title,
    returnUrl: `${appUrl}/courses/${course.slug}/learn?enrolled=1`,
    callbackUrl: `${appUrl}/api/webhooks/paychangu`,
  });

  if (!result.success) {
    throw new Error(result.error);
  }

  redirect(result.checkoutUrl);
}

export default async function CheckoutPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const { error: checkoutError } = await searchParams;
  const { userId } = await auth();
  if (!userId) redirect(`/sign-in?redirect_url=/courses/${slug}/checkout`);

  const supabase = createClient();

  const { data: courseRaw } = await supabase
    .from("courses")
    .select("id, title, description, thumbnail_url, category, level, price_type, price_amount, slug, company_id, companies(slug)")
    .eq("slug", slug)
    .eq("status", "published")
    .single();

  const course = courseRaw as {
    id: string;
    title: string;
    description: string | null;
    thumbnail_url: string | null;
    category: string | null;
    level: string | null;
    price_type: string | null;
    price_amount: number | null;
    slug: string;
    company_id: string | null;
    companies: { slug: string } | { slug: string }[] | null;
  } | null;

  if (!course) notFound();
  if (course.price_type === "free") redirect(`/courses/${slug}`);
  if (!course.price_amount) redirect(`/courses/${slug}`);

  const comp = Array.isArray(course.companies)
    ? course.companies[0]
    : course.companies;
  const tenantSlug = comp?.slug || "zedai";

  // Already enrolled (active)?
  const { data: existing } = await supabase
    .from("enrollments")
    .select("id")
    .eq("user_id", userId)
    .eq("course_id", course.id)
    .eq("status", "active")
    .maybeSingle();

  if (existing) redirect(`/courses/${slug}/learn`);

  const startCheckoutForCourse = startCheckout.bind(null, slug, course.id);

  return (
    <div className="container" style={{ paddingTop: "60px", paddingBottom: "80px" }}>

      {/* Back */}
      <Link
        href={`/academy/${tenantSlug}/courses/${slug}`}
        className={cn(
          buttonVariants({ variant: "ghost" }),
          "mb-8 rounded-full text-slate-500 hover:bg-brand-soft hover:text-ink flex items-center justify-center w-fit h-9 px-3"
        )}
      >
        <ArrowLeft className="mr-1 h-4 w-4" />
        Back to course
      </Link>

      <div className="mb-8">
        <p className="text-xs font-bold uppercase tracking-widest text-brand-text mb-1">Secure Checkout</p>
        <h1 className="text-3xl font-bold tracking-tight text-ink">Complete your enrollment</h1>
      </div>

      <div className="grid gap-8 lg:grid-cols-[1fr_380px]">

        {/* Left — course preview + what's included */}
        <div className="space-y-6">

          {/* Course preview */}
          <div className="marketing-card rounded-[2.5rem] border-0 p-6 flex gap-6 items-start">
            <div className="h-24 w-32 shrink-0 overflow-hidden rounded-[1.5rem] bg-brand-soft">
              {course.thumbnail_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={course.thumbnail_url}
                  alt={course.title}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center">
                  <BookOpen className="h-8 w-8 text-brand-text/40" />
                </div>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="mb-2 flex flex-wrap gap-1.5">
                {course.category && (
                  <Badge className="border-0 bg-brand-soft text-brand-text text-[11px] font-bold">
                    {course.category}
                  </Badge>
                )}
                {course.level && (
                  <Badge className="border-slate-200 bg-slate-50 text-slate-600 capitalize text-[11px]">
                    {course.level}
                  </Badge>
                )}
              </div>
              <h2 className="text-lg font-bold text-ink line-clamp-2">{course.title}</h2>
              {course.description && (
                <p className="mt-1.5 text-sm text-slate-500 line-clamp-2 leading-relaxed">{course.description}</p>
              )}
            </div>
          </div>

          {/* What's included */}
          <div className="marketing-outline-card rounded-[2.5rem] border-0 p-8">
            <div className="mb-5 flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-brand-text" />
              <h3 className="text-xs font-bold uppercase tracking-widest text-ink">What You Get</h3>
            </div>
            <ul className="space-y-4">
              {[
                "Lifetime access — yours forever",
                "AI Tutor available in every lesson",
                "Scored quizzes & knowledge checks",
                "Certificate of completion",
                "Self-paced — learn on your schedule",
              ].map((item) => (
                <li key={item} className="flex items-center gap-3 text-sm font-medium text-ink">
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-xl bg-green-100 text-green-600">
                    <CheckCircle className="h-4 w-4" />
                  </div>
                  {item}
                </li>
              ))}
            </ul>
          </div>

          {/* Trust badges */}
          <div className="flex flex-wrap gap-4 px-2 text-xs font-medium text-slate-400">
            <span className="flex items-center gap-1.5">
              <Shield className="h-3.5 w-3.5" />
              Secure payment via PayChangu
            </span>
            <span className="flex items-center gap-1.5">
              <Lock className="h-3.5 w-3.5" />
              End-to-end encrypted
            </span>
          </div>
        </div>

        {/* Right — order summary + CTA */}
        <div className="h-fit rounded-[2.5rem] bg-ink p-8 text-white shadow-2xl">
          <p className="text-xs font-bold uppercase tracking-widest text-brand-electric mb-6">Order Summary</p>

          <div className="space-y-3 border-b border-white/10 pb-6 mb-6">
            <div className="flex items-center justify-between text-sm">
              <span className="text-white/60">Course price</span>
              <span className="font-bold text-white">ZMW {course.price_amount.toLocaleString()}</span>
            </div>
          </div>

          {checkoutError && (
            <div className="mb-4 rounded-xl bg-red-500/15 border border-red-400/30 px-3 py-2 text-xs font-medium text-red-200">
              {checkoutError}
            </div>
          )}

          <CheckoutPanel courseId={course.id} originalPrice={course.price_amount}>
            {(finalPrice, couponCode) => (
              <form action={startCheckoutForCourse}>
                <input type="hidden" name="couponCode" value={couponCode ?? ""} />
                <Button
                  type="submit"
                  className="w-full rounded-full bg-brand py-7 text-base font-bold text-white hover:bg-brand-hover transition-all hover:scale-[1.02] active:scale-95 shadow-xl"
                >
                  {finalPrice <= 0 ? "Enrol now — Free with coupon" : "Pay with PayChangu"}
                </Button>
              </form>
            )}
          </CheckoutPanel>

          <p className="mt-4 text-center text-xs font-medium text-white/40">
            MTN MoMo · Airtel Money · Visa / Mastercard
          </p>

          <div className="mt-6 rounded-2xl bg-white/5 p-4 text-xs leading-relaxed text-white/50">
            You&apos;ll be redirected to PayChangu to complete payment securely.
            Instant access granted after confirmation.
          </div>
        </div>
      </div>
    </div>
  );
}
