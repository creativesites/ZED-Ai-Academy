import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { ensureProfile } from "@/lib/supabase/ensure-profile";
import { requireOnboarding } from "@/lib/require-onboarding";
import Header2Wrapper from "@/components/layout/Header2Wrapper";
import Footer1 from "@/components/layout/footer/Footer1";
import "../../../public/assets/css/style.css"
import 'swiper/css'
import "swiper/css/pagination"
import 'swiper/css/free-mode';

import { syncActiveOrganization } from "@/actions/company";
import { createClient } from "@/lib/supabase/server";
import { companyAdminNeedsAcademySetup } from "@/lib/company-admin-setup";
import { MobileBottomNav } from "@/components/layout/MobileBottomNav";

export default async function LearnerLayout({ children }: { children: React.ReactNode }) {
  const { userId, orgId } = await auth();
  if (!userId) redirect("/sign-in");

  const supabase = createClient();

  // 1. Fetch Profile and Role
  const { data: profile } = await supabase
    .from("profiles")
    .select("role, onboarding_completed")
    .eq("id", userId)
    .single();

  // 2. Sync Active Org if present
  if (orgId) {
    try {
      await syncActiveOrganization();
    } catch (error) {
      console.error("Failed to sync organization:", error);
    }
  }

  // 3. COMPANY ADMIN GUARD: Redirect to academy launch if missing org / company
  if (profile?.role === "company_admin" && profile.onboarding_completed) {
    const needsLaunch = await companyAdminNeedsAcademySetup(userId, orgId);
    if (needsLaunch) {
      redirect("/launch-your-academy");
    }
  }

  try {
    await ensureProfile(userId);
  } catch {
    // Non-fatal
  }

  try {
    await requireOnboarding(userId);
  } catch {
    // redirect() handled
  }

  return (
    <div className="page-wrapper">
      <Header2Wrapper />
      <div id="page-content" className="pb-[calc(4.5rem+env(safe-area-inset-bottom))] md:pb-0">
        {children}
      </div>
      <Footer1 />
      <MobileBottomNav />
    </div>
  );
}
