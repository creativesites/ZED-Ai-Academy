"use server";

import { createClient } from "@/lib/supabase/server";
import { UserRole } from "@/types/database";
import { auth } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import { resolveHome } from "@/lib/tenants/resolve-home";

export async function getProfileContext(userId: string) {
  // Single parallel lookup shared with the post-sign-in redirect (see resolveHome).
  const home = await resolveHome(userId);
  if (!home.platformRole) return null;

  // Prefer the tenant the user administers, else their default / first membership.
  const tenant =
    home.memberships.find((m) => m.role === "company_admin") ??
    home.defaultTenant ??
    home.memberships[0] ??
    null;

  // Role shown in nav is the per-tenant role (membership), falling back to the platform role.
  const role = (tenant?.role ?? home.platformRole) as UserRole;

  return {
    role,
    companyId: tenant?.companyId ?? null,
    onboardingCompleted: home.onboardingCompleted,
    tenantSlug: tenant?.slug ?? null,
  };
}

export async function completeOnboarding(formData: FormData) {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const fullName = formData.get("full_name") as string;
  
  const supabase = createClient();
  const { error } = await supabase
    .from("profiles")
    .update({
      full_name: fullName,
      onboarding_completed: true,
      updated_at: new Date().toISOString(),
    })
    .eq("id", userId);

  if (error) throw new Error(error.message);

  revalidatePath("/");
  return { success: true };
}
