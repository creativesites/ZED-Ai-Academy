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
  if (!orgId) throw new Error("No active organization selected");

  const logoUrl = formData.get("logo_url") as string | null;
  const primaryColor = formData.get("primary_color") as string | null;
  const homeTemplate = formData.get("home_template") as string | null;
  const homeContent = formData.get("home_content") as string | null;

  const supabase = createClient();
  
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
      .eq("id", orgId)
      .select("slug")
      .single();

    if (error) {
      throw new Error(error.message);
    }

    if (company?.slug) {
      revalidatePath(`/academy/${company.slug}`);
      revalidatePath(`/academy/${company.slug}/admin/settings`);
    }
  }

  revalidatePath("/creator/settings");
}
