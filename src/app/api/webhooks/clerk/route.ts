import { headers } from "next/headers";
import { Webhook } from "svix";
import { createServiceClient } from "@/lib/supabase/server";
import { sendWelcomeEmail } from "@/lib/email/emailjs";
import { generateAcademySlug } from "@/lib/tenants/slug-server";
import type { CompanyMemberRole } from "@/types/database";

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

type ServiceClient = ReturnType<typeof createServiceClient>;

/**
 * INSERT ... ON CONFLICT DO NOTHING: an existing membership (any role, any
 * status, including a deliberate deactivation) is never changed here.
 */
async function insertMembershipIfMissing(
  supabase: ServiceClient,
  companyId: string,
  profileId: string,
  role: CompanyMemberRole
) {
  // The membership row references the profile; make sure one exists (never changes its role).
  await supabase
    .from("profiles")
    .upsert({ id: profileId }, { onConflict: "id", ignoreDuplicates: true });

  const now = new Date().toISOString();
  const { error } = await supabase.from("company_members").upsert(
    {
      company_id: companyId,
      profile_id: profileId,
      status: "active",
      role,
      joined_at: now,
      updated_at: now,
    },
    { onConflict: "company_id, profile_id", ignoreDuplicates: true }
  );
  if (error) console.error("Membership sync error:", error);
}

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

  // Organization events. Supabase (companies, company_members, profiles) is the
  // source of truth for academies and roles; Clerk organizations only mirror
  // membership. So this handler only INSERTS what is missing: it never updates
  // a role, never writes companies.slug for an existing academy, and never
  // touches profiles.role.
  if (event.type.startsWith("organization")) {
    if (event.type === "organization.created") {
      const data = event.data as ClerkOrganizationPayload;
      const { data: existing } = await supabase.from("companies").select("id").eq("id", data.id).maybeSingle();
      if (!existing) {
        // createAcademy normally writes this row first; this only covers
        // organizations created elsewhere (e.g. the Clerk dashboard).
        try {
          const slug = await generateAcademySlug(supabase, data.name, data.id);
          const { error } = await supabase.from("companies").insert({
            id: data.id,
            name: data.name,
            slug,
            logo_url: data.image_url || data.logo_url || null,
            admin_id: data.created_by ?? null,
          });
          // 23505: createAcademy inserted it in the meantime, which is fine.
          if (error && error.code !== "23505") console.error("Org sync error:", error);
        } catch (error) {
          console.error("Org sync error:", error);
        }
      }

      if (data.created_by) {
        await insertMembershipIfMissing(supabase, data.id, data.created_by, "company_admin");
      }
    }

    if (event.type === "organization.updated") {
      // Name and logo only. The academy's slug is owned by the database.
      const data = event.data as ClerkOrganizationPayload;
      const logo = data.image_url || data.logo_url;
      const { error } = await supabase
        .from("companies")
        .update({
          name: data.name,
          ...(logo ? { logo_url: logo } : {}),
          updated_at: new Date().toISOString(),
        })
        .eq("id", data.id);
      if (error) console.error("Org update sync error:", error);
    }

    if (event.type === "organization.deleted") {
      const data = event.data as ClerkOrganizationPayload;
      await supabase.from("companies").delete().eq("id", data.id);
    }

    if (event.type === "organizationMembership.created") {
      const { organization, public_user_data, role: clerkRole } = event.data as ClerkMembershipPayload;
      // Only the academy owner is mirrored as an admin; anyone else is a learner
      // until the academy grants more (staff code, admin role change) in the app.
      let memberRole: CompanyMemberRole = "learner";
      if (clerkRole === "org:admin") {
        const { data: company } = await supabase
          .from("companies")
          .select("admin_id")
          .eq("id", organization.id)
          .maybeSingle();
        if (company?.admin_id === public_user_data.user_id) memberRole = "company_admin";
      }
      await insertMembershipIfMissing(supabase, organization.id, public_user_data.user_id, memberRole);
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

  // Name, email and avatar only: the role is owned by the app, never by Clerk.
  // Missing values are skipped so a name typed during onboarding is not erased.
  const { error } = await supabase.from("profiles").upsert(
    {
      id: user.id,
      ...(fullName ? { full_name: fullName } : {}),
      ...(primaryEmail ? { email: primaryEmail } : {}),
      ...(user.image_url ? { avatar_url: user.image_url } : {}),
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
