import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { createServiceClient } from "@/lib/supabase/server";
import { ensureProfile } from "@/lib/supabase/ensure-profile";
import { requireOnboarding } from "@/lib/require-onboarding";
import { syncActiveOrganization } from "@/actions/company";
import { companyAdminNeedsAcademySetup } from "@/lib/company-admin-setup";
import Header2Wrapper from "@/components/layout/Header2Wrapper";
import Footer1 from "@/components/layout/footer/Footer1";
import { NotificationBellServer } from "@/components/shared/notification-bell-server";
import "../../../public/assets/css/style.css"
import 'swiper/css'
// import "swiper/css/navigation"
import "swiper/css/pagination"
import 'swiper/css/free-mode';
import { dmSans } from '@/lib/font'

export default async function CreatorLayout({ children }: { children: React.ReactNode }) {
  const { userId, orgId } = await auth();
  if (!userId) redirect("/sign-in");

  if (orgId) {
    try {
      await syncActiveOrganization();
    } catch {
      // non-fatal
    }
  }

  try {
    await ensureProfile(userId);
  } catch {
    // Non-fatal — continue rendering even if profile sync fails
  }

  try {
    await requireOnboarding(userId);
  } catch {
    // redirect() throws
  }

  const supabase = createServiceClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .single();

  if (!profile || !["instructor", "super_admin", "company_admin"].includes(profile.role)) {
    redirect("/dashboard");
  }

  if (profile?.role === "company_admin") {
    const needsLaunch = await companyAdminNeedsAcademySetup(userId, orgId);
    if (needsLaunch) {
      redirect("/launch-your-academy");
    }
  }

  return (
    <div className="page-wrapper">
      <Header2Wrapper>
        <NotificationBellServer />
      </Header2Wrapper>
      <div id="page-content">
        {children}
      </div>
      <Footer1 />
    </div>
  );
}
