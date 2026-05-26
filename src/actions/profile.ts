"use server";

import { createClient } from "@/lib/supabase/server";
import { UserRole } from "@/types/database";
import { auth } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";

export async function getProfileContext(userId: string) {
  const supabase = createClient();
  
  const { data: profile, error } = await supabase
    .from("profiles")
    .select("role, company_id, onboarding_completed")
    .eq("id", userId)
    .single();

    // console.log('get profile context - profile', profile)

  if (error || !profile) {
    return null;
  }

  // Fetch tenant slug if they have a company
  let tenantSlug: string | null = null;
  if (profile.company_id) {
    const { data: company } = await supabase
      .from("companies")
      .select("slug")
      .eq("id", profile.company_id)
      .maybeSingle();
    
    tenantSlug = company?.slug ?? null;
  }

  return {
    role: profile.role as UserRole,
    companyId: profile.company_id,
    onboardingCompleted: !!profile.onboarding_completed,
    tenantSlug,
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
