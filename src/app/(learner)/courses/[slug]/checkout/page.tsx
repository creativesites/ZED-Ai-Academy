import { auth, currentUser } from "@clerk/nextjs/server";
import { redirect, notFound } from "next/navigation";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { initiatePayment } from "@/lib/payments/paychangu";
import { randomUUID } from "crypto";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, BookOpen, CheckCircle, Lock, Shield } from "lucide-react";
import type { Metadata } from "next";
import { CheckoutPanel } from "@/components/learner/checkout-panel";

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

async function startCheckout(slug: string, courseId: string, userId: string) {
  "use server";

  const clerkUser = await currentUser();
  if (!clerkUser) redirect("/sign-in");

  const primaryEmail = clerkUser.emailAddresses.find(
    (e) => e.id === clerkUser.primaryEmailAddressId
  )?.emailAddress;

  if (!primaryEmail) throw new Error("No email address on account");

  const supabase = createClient();

  // Get the course
  const { data: course } = await supabase
    .from("courses")
    .select("id, title, price_amount, slug")
    .eq("id", courseId)
    .single();

  if (!course || !course.price_amount) throw new Error("Course not found");

  // Check not already enrolled
  const { data: existing } = await supabase
    .from("enrollments")
    .select("id")
    .eq("user_id", userId)
    .eq("course_id", courseId)
    .maybeSingle();

  if (existing) redirect(`/courses/${slug}/learn`);

  // Create pending order
  const txRef = `zaa-${courseId.slice(0, 8)}-${randomUUID().slice(0, 8)}`;

  const serviceClient = createServiceClient();
  const { error: orderError } = await serviceClient
    .from("orders")
    .insert({
      user_id: userId,
      course_id: courseId,
      amount: course.price_amount,
      currency: "ZMW",
      status: "pending",
      payment_reference: txRef,
    });

  if (orderError) throw new Error(orderError.message);

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  const result = await initiatePayment({
    txRef,
    amount: course.price_amount,
    currency: "ZMW",
    email: primaryEmail,
    firstName: clerkUser.firstName ?? "",
    lastName: clerkUser.lastName ?? "",
    courseTitle: course.title,
    returnUrl: `${appUrl}/courses/${slug}/learn?enrolled=1`,
    callbackUrl: `${appUrl}/api/webhooks/paychangu`,
  });

  if (!result.success) {
    throw new Error(result.error);
  }

  redirect(result.checkoutUrl);
}

export default async function CheckoutPage({ params }: Props) {
  const { slug } = await params;
  const { userId } = await auth();
  if (!userId) redirect(`/sign-in?redirect_url=/courses/${slug}/checkout`);

  const supabase = createClient();

  const { data: course } = await supabase
    .from("courses")
    .select("id, title, description, thumbnail_url, category, level, price_type, price_amount, slug")
    .eq("slug", slug)
    .eq("status", "published")
    .single();

  if (!course) notFound();
  if (course.price_type === "free") redirect(`/courses/${slug}`);
  if (!course.price_amount) redirect(`/courses/${slug}`);

  // Already enrolled?
  const { data: existing } = await supabase
    .from("enrollments")
    .select("id")
    .eq("user_id", userId)
    .eq("course_id", course.id)
    .maybeSingle();

  if (existing) redirect(`/courses/${slug}/learn`);

  const startCheckoutForCourse = startCheckout.bind(null, slug, course.id, userId);

  return (
    <div className="container" style={{ paddingTop: "60px", paddingBottom: "80px" }}>

      {/* Back */}
      <Button
        variant="ghost"
        size="sm"
        className="mb-8 rounded-full text-slate-500 hover:bg-[#fff6ee] hover:text-[#062e39]"
        render={<Link href={`/courses/${slug}`} />}
      >
        <ArrowLeft className="mr-1 h-4 w-4" />
        Back to course
      </Button>

      <div className="mb-8">
        <p className="text-xs font-bold uppercase tracking-widest text-[#fd5523] mb-1">Secure Checkout</p>
        <h1 className="text-3xl font-bold tracking-tight text-[#062e39]">Complete your enrollment</h1>
      </div>

      <div className="grid gap-8 lg:grid-cols-[1fr_380px]">

        {/* Left — course preview + what's included */}
        <div className="space-y-6">

          {/* Course preview */}
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

          {/* What's included */}
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
        <div className="h-fit rounded-[2.5rem] bg-[#062e39] p-8 text-white shadow-2xl">
          <p className="text-xs font-bold uppercase tracking-widest text-[#fd8d69] mb-6">Order Summary</p>

          <div className="space-y-3 border-b border-white/10 pb-6 mb-6">
            <div className="flex items-center justify-between text-sm">
              <span className="text-white/60">Course price</span>
              <span className="font-bold text-white">ZMW {course.price_amount.toLocaleString()}</span>
            </div>
          </div>

          <CheckoutPanel courseId={course.id} originalPrice={course.price_amount}>
            {(_finalPrice, _couponCode) => (
              <form action={startCheckoutForCourse}>
                <Button
                  type="submit"
                  className="w-full rounded-full bg-[#fd5523] py-7 text-base font-bold text-white hover:bg-[#ef4a16] transition-all hover:scale-[1.02] active:scale-95 shadow-xl"
                >
                  Pay with PayChangu
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
