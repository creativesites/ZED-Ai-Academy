import { auth } from "@clerk/nextjs/server";
import { redirect, unstable_rethrow } from "next/navigation";
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
  } catch (error) {
    // redirect() works by throwing: let Next.js handle it instead of swallowing it.
    unstable_rethrow(error);
    console.error("[layout] onboarding check failed:", error);
  }

  const supabase = createServiceClient();
  const [{ data: profile }, { data: teachingMembership }] = await Promise.all([
    supabase.from("profiles").select("role").eq("id", userId).single(),
    // Academy staff are authorized by company_members (the source of truth), not
    // profiles.role: a teacher of an academy can open its courses in the builder.
    supabase
      .from("company_members")
      .select("company_id")
      .eq("profile_id", userId)
      .eq("status", "active")
      .in("role", ["company_admin", "instructor", "teacher"])
      .limit(1)
      .maybeSingle(),
  ]);

  const hasPlatformRole = !!profile && ["instructor", "super_admin", "company_admin"].includes(profile.role);
  if (!hasPlatformRole && !teachingMembership) {
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
