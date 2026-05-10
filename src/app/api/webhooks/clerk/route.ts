import { headers } from "next/headers";
import { Webhook } from "svix";
import { createServiceClient } from "@/lib/supabase/server";
import { sendWelcomeEmail } from "@/lib/email/emailjs";
import type { CompanyMemberRole, UserRole } from "@/types/database";

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
  | { type: "organization.created"; data: ClerkOrganizationPayload }
  | { type: "organization.updated"; data: ClerkOrganizationPayload }
  | { type: "organization.deleted"; data: ClerkOrganizationPayload }
  | { type: "organizationMembership.created"; data: ClerkMembershipPayload }
  | { type: "organizationMembership.deleted"; data: ClerkMembershipPayload }
  | { type: string; data: unknown };

type ClerkOrganizationPayload = {
  id: string;
  name: string;
  slug: string | null;
  image_url?: string | null;
  logo_url?: string | null;
  created_by?: string | null;
};

type ClerkMembershipPayload = {
  organization: { id: string };
  public_user_data: { user_id: string };
  role: string;
};

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

  const supabase = createServiceClient();

  // Handle Organization Events
  if (event.type.startsWith("organization")) {
    if (event.type === "organization.created" || event.type === "organization.updated") {
      const data = event.data as ClerkOrganizationPayload;
      const { error } = await supabase.from("companies").upsert({
        id: data.id,
        name: data.name,
        slug: data.slug || data.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""),
        logo_url: data.image_url || data.logo_url,
        admin_id: data.created_by, // Clerk provides creator ID
        updated_at: new Date().toISOString(),
      }, { onConflict: "id" });
      if (error) console.error("Org sync error:", error);

      // If it's a new organization, ensure the creator is marked as company_admin
      if (event.type === "organization.created" && data.created_by) {
        await supabase.from("profiles").update({
          role: "company_admin",
          company_id: data.id
        }).eq("id", data.created_by);

        await supabase.from("company_members").upsert({
          company_id: data.id,
          profile_id: data.created_by,
          status: "active",
          role: "company_admin",
          joined_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }, { onConflict: "company_id, profile_id" });
      }
    }

    if (event.type === "organization.deleted") {
      const data = event.data as ClerkOrganizationPayload;
      await supabase.from("companies").delete().eq("id", data.id);
    }

    if (event.type === "organizationMembership.created") {
      const { organization, public_user_data, role: clerkRole } = event.data as ClerkMembershipPayload;
      
      // Update profile's company_id and role
      // If clerkRole is admin, they are either company_admin (if creator) or instructor (if invited)
      // For now, let's assume invited admins are instructors
      let dbRole: UserRole = "teacher";
      let memberRole: CompanyMemberRole = "teacher";
      if (clerkRole === "org:admin") {
        // If they are the creator, they should already be company_admin from organization.created
        // but we can check if they are the admin_id in companies
        const { data: company } = await supabase.from("companies").select("admin_id").eq("id", organization.id).single();
        if (company?.admin_id === public_user_data.user_id) {
          dbRole = "company_admin";
          memberRole = "company_admin";
        }
      } else {
        dbRole = "learner";
        memberRole = "learner";
      }

      await supabase.from("company_members").upsert({
        company_id: organization.id,
        profile_id: public_user_data.user_id,
        status: "active",
        role: memberRole,
        joined_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }, { onConflict: "company_id, profile_id" });

      await supabase.from("profiles").update({
        company_id: organization.id,
        role: dbRole
      }).eq("id", public_user_data.user_id);
    }

    if (event.type === "organizationMembership.deleted") {
      const data = event.data as ClerkMembershipPayload;
      await supabase.from("company_members")
        .delete()
        .eq("company_id", data.organization.id)
        .eq("profile_id", data.public_user_data.user_id);
    }

    return new Response("OK", { status: 200 });
  }

  if (event.type !== "user.created" && event.type !== "user.updated") {
    return new Response("Event ignored", { status: 200 });
  }

  const user = event.data as ClerkUserPayload;
  const primaryEmail = user.email_addresses.find(
    (e) => e.id === user.primary_email_address_id
  )?.email_address ?? null;

  const fullName = [user.first_name, user.last_name].filter(Boolean).join(" ") || null;

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
