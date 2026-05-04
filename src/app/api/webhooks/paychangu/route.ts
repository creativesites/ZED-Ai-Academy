import { NextRequest } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { verifyWebhook } from "@/lib/payments/paychangu";
import { sendPaymentConfirmation } from "@/lib/email/emailjs";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const authHeader = req.headers.get("authorization");

  const payload = verifyWebhook(authHeader, body);
  if (!payload) {
    return new Response("Unauthorized", { status: 401 });
  }

  if (payload.status !== "success") {
    // Update order status to failed/cancelled
    if (payload.tx_ref) {
      const supabase = createServiceClient();
      await supabase
        .from("orders")
        .update({ status: payload.status === "failed" ? "failed" : "failed" })
        .eq("payment_reference", payload.tx_ref);
    }
    return new Response("OK", { status: 200 });
  }

  const supabase = createServiceClient();

  // Find the pending order
  const { data: order } = await supabase
    .from("orders")
    .select("id, user_id, course_id, amount")
    .eq("payment_reference", payload.tx_ref)
    .eq("status", "pending")
    .single();

  if (!order) {
    // Already processed (idempotency guard)
    return new Response("OK", { status: 200 });
  }

  // Mark order paid
  await supabase
    .from("orders")
    .update({
      status: "paid" as const,
      payment_method: payload.payment_method ?? null,
      paid_at: new Date().toISOString(),
    })
    .eq("id", order.id);

  if (!order.course_id) {
    return new Response("OK", { status: 200 });
  }

  // Create enrollment
  const { error: enrollError } = await supabase.from("enrollments").insert({
    user_id: order.user_id,
    course_id: order.course_id,
    source: "individual_purchase" as const,
  });

  if (enrollError && !enrollError.message.includes("duplicate")) {
    console.error("Enrollment insert failed:", enrollError);
    return new Response("Enrollment failed", { status: 500 });
  }

  // Fetch user profile + course info for confirmation email
  const [profileResult, courseResult] = await Promise.all([
    supabase
      .from("profiles")
      .select("full_name, email")
      .eq("id", order.user_id)
      .single(),
    supabase
      .from("courses")
      .select("title, slug")
      .eq("id", order.course_id!)
      .single(),
  ]);

  const profileEmail = profileResult.data?.email;
  if (profileEmail && profileResult.data && courseResult.data) {
    const profile = profileResult.data;
    const course = courseResult.data;
    const firstName = profile.full_name?.split(" ")[0] ?? "there";
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

    await sendPaymentConfirmation({
      toEmail: profileEmail,
      toName: firstName,
      courseTitle: course.title,
      amount: `ZMW ${order.amount.toLocaleString()}`,
      courseUrl: `${appUrl}/courses/${course.slug}/learn`,
    });
  }

  return new Response("OK", { status: 200 });
}
