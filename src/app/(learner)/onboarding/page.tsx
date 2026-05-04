import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { OnboardingForm } from "@/components/learner/onboarding-form";

export const metadata = { title: "Welcome — Set up your profile" };

export default async function OnboardingPage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const supabase = createClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("onboarding_completed, role")
    .eq("id", userId)
    .single();

  // Only skip if onboarding is explicitly completed — no full_name fallback
  if (profile?.onboarding_completed) {
    if (profile.role === "instructor" || profile.role === "super_admin") redirect("/creator/courses");
    if (profile.role === "company_admin") redirect("/company");
    redirect("/dashboard");
  }

  return (
    <div className="container" style={{ paddingTop: "80px", paddingBottom: "80px" }}>
      <OnboardingForm />
    </div>
  );
}
