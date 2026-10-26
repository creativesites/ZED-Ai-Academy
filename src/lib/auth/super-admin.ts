import "server-only";
import { auth } from "@clerk/nextjs/server";
import { createServiceClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export async function requireSuperAdmin() {
  const { userId } = await auth();
  if (!userId) {
    redirect("/sign-in?redirect_url=/superadmin");
  }

  const supabase = createServiceClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("id, full_name, role, email")
    .eq("id", userId)
    .single();

  if (profile?.role !== "super_admin") {
    redirect("/dashboard");
  }

  return { userId, profile, supabase };
}
