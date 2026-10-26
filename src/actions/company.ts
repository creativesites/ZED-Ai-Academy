"use server";

import { revalidatePath } from "next/cache";
import { auth, clerkClient } from "@clerk/nextjs/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { generateUniqueSlug } from "@/lib/utils";

export async function syncActiveOrganization() {
  const { userId, orgId } = await auth();
  if (!userId || !orgId) return null;

  const supabaseAdmin = createServiceClient();
  const { data: existing } = await supabaseAdmin.from("companies").select("id").eq("id", orgId).maybeSingle();
  
  if (existing) return existing;

  // Fetch from Clerk and sync
  const client = await clerkClient();
  const org = await client.organizations.getOrganization({ organizationId: orgId });
  
  if (org) {
    const slug = await generateUniqueSlug(supabaseAdmin, org.name, "companies", org.id);
    await supabaseAdmin.from("companies").upsert({
      id: org.id,
      name: org.name,
      slug: slug,
      logo_url: org.imageUrl,
      admin_id: org.createdBy,
    });
  }
}

export async function updateCompanySettings(formData: FormData) {
  const { userId, orgId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const tenantSlug = formData.get("tenant_slug") as string | null;
  const logoUrl = formData.get("logo_url") as string | null;
  const primaryColor = formData.get("primary_color") as string | null;
  const homeTemplate = formData.get("home_template") as string | null;
  const homeContent = formData.get("home_content") as string | null;

  const supabase = createServiceClient();

  // Resolve target company: tenantSlug takes precedence when editing a specific academy
  let targetCompanyId: string | null = null;

  if (tenantSlug) {
    const { data: targetCompany } = await supabase
      .from("companies")
      .select("id, admin_id")
      .eq("slug", tenantSlug)
      .maybeSingle();

    if (targetCompany) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", userId)
        .maybeSingle();

      if (profile?.role === "super_admin" || targetCompany.admin_id === userId) {
        targetCompanyId = targetCompany.id;
      } else {
        const { data: member } = await supabase
          .from("company_members")
          .select("role")
          .eq("company_id", targetCompany.id)
          .eq("profile_id", userId)
          .eq("status", "active")
          .maybeSingle();

        if (member && (member.role === "company_admin" || member.role === "teacher" || member.role === "instructor")) {
          targetCompanyId = targetCompany.id;
        }
      }
    }
  } else if (orgId) {
    targetCompanyId = orgId;
  }

  if (!targetCompanyId) {
    throw new Error("No active organization or authorized academy selected.");
  }
  
  const updates: any = {};
  if (logoUrl !== null) updates.logo_url = logoUrl;
  if (primaryColor !== null) updates.primary_color = primaryColor;
  if (homeTemplate !== null) updates.home_template = homeTemplate;
  if (homeContent !== null) {
    try {
      updates.home_content = JSON.parse(homeContent);
    } catch (e) {
      // If not valid JSON, ignore or handle
    }
  }

  if (Object.keys(updates).length > 0) {
    const { data: company, error } = await supabase
      .from("companies")
      .update(updates)
      .eq("id", targetCompanyId)
      .select("slug")
      .single();

    if (error) {
      throw new Error(error.message);
    }

    if (company?.slug) {
      revalidatePath(`/academy/${company.slug}`);
      revalidatePath(`/academy/${company.slug}/admin/settings`);
      revalidatePath(`/academy/${company.slug}/admin/settings/site`);
    }
  }

  revalidatePath("/creator/settings");
}
