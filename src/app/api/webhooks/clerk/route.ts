import { headers } from "next/headers";
import { Webhook } from "svix";
import { createServiceClient } from "@/lib/supabase/server";
import { sendWelcomeEmail } from "@/lib/email/emailjs";

type ClerkUserPayload = {
  id: string;
  email_addresses: { email_address: string; id: string }[];
  primary_email_address_id: string | null;
  first_name: string | null;
  last_name: string | null;
  image_url: string | null;
};

type WebhookEvent =
  | { type: "user.created"; data: ClerkUserPayload }
  | { type: "user.updated"; data: ClerkUserPayload }
  | { type: string; data: unknown };

export async function POST(req: Request) {
  const webhookSecret = process.env.CLERK_WEBHOOK_SECRET;
  if (!webhookSecret) {
    return new Response("Webhook secret not configured", { status: 500 });
  }

  const headerPayload = await headers();
  const svixId = headerPayload.get("svix-id");
  const svixTimestamp = headerPayload.get("svix-timestamp");
  const svixSignature = headerPayload.get("svix-signature");

  if (!svixId || !svixTimestamp || !svixSignature) {
    return new Response("Missing svix headers", { status: 400 });
  }

  const body = await req.text();
  const wh = new Webhook(webhookSecret);

  let event: WebhookEvent;
  try {
    event = wh.verify(body, {
      "svix-id": svixId,
      "svix-timestamp": svixTimestamp,
      "svix-signature": svixSignature,
    }) as WebhookEvent;
  } catch {
    return new Response("Invalid signature", { status: 400 });
  }

  if (event.type !== "user.created" && event.type !== "user.updated") {
    return new Response("Event ignored", { status: 200 });
  }

  const user = event.data as ClerkUserPayload;
  const primaryEmail = user.email_addresses.find(
    (e) => e.id === user.primary_email_address_id
  )?.email_address ?? null;

  const fullName = [user.first_name, user.last_name].filter(Boolean).join(" ") || null;

  const supabase = createServiceClient();

  const { error } = await supabase.from("profiles").upsert(
    {
      id: user.id,
      full_name: fullName,
      avatar_url: user.image_url,
      email: primaryEmail,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "id" }
  );

  if (error) {
    console.error("Failed to upsert profile:", error);
    return new Response("Database error", { status: 500 });
  }

  // Send welcome email on new signup only
  if (event.type === "user.created" && primaryEmail && fullName) {
    sendWelcomeEmail({
      toEmail: primaryEmail,
      toName: user.first_name ?? fullName,
    }).catch(console.error);
  }

  return new Response("OK", { status: 200 });
}
