"use server";

import { auth } from "@clerk/nextjs/server";
import { createServiceClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

async function requireAdmin() {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");
  
  const supabase = createServiceClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .single();
    
  if (profile?.role !== "super_admin") throw new Error("Unauthorized");
  
  return { userId, supabase };
}

export async function updateOnboardingCourse(courseId: string) {
  const { supabase } = await requireAdmin();
  
  const { error } = await supabase
    .from("site_settings")
    .upsert({ 
      key: "onboarding_course_id", 
      value: JSON.stringify(courseId),
      updated_at: new Date().toISOString()
    });
    
  if (error) throw new Error(error.message);
  revalidatePath("/admin/settings");
  return { success: true };
}
