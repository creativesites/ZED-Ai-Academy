"use server";

import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createServiceClient } from "@/lib/supabase/server";
import { ensureTenantMembership } from "@/lib/tenants/membership";

/**
 * Server action to join a tenant from the public landing page.
 * If signed out, redirects to sign-up with tenant context.
 *
 * Signed-in users always join as learners. Staff roles require the academy's
 * teacher code, which is verified during onboarding — never trust a role sent
 * from the form.
 */
export async function joinTenantBySlug(formData: FormData) {
  const slug = String(formData.get("tenantSlug") ?? "");
  const requestedRole = String(formData.get("role") ?? "student");
  const next = String(formData.get("next") ?? "");

  const { userId } = await auth();

  if (!userId) {
    const params = new URLSearchParams({
      role: requestedRole === "teacher" ? "teacher" : "student",
      tenant: slug,
    });
    redirect(`/sign-up?${params.toString()}`);
  }

  const supabase = createServiceClient();
  const { data: company } = await supabase
    .from("companies")
    .select("id, slug")
    .eq("slug", slug)
    .maybeSingle();

  if (!company) {
    throw new Error("Academy not found.");
  }

  await ensureTenantMembership(userId, company.id, "learner");

  revalidatePath(`/academy/${company.slug}`);
  revalidatePath("/dashboard");

  redirect(safeNextPath(next) ?? `/academy/${company.slug}/classroom`);
}

/** Only allow same-site relative redirects. */
function safeNextPath(next: string): string | null {
  if (!next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return null;
  return next;
}
