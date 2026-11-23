import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { companyAdminNeedsAcademySetup } from "@/lib/company-admin-setup";
import Header2Wrapper from "@/components/layout/Header2Wrapper";
import Footer1 from "@/components/layout/footer/Footer1";
import { NotificationBellServer } from "@/components/shared/notification-bell-server";


export default async function CompanyLayout({ children }: { children: React.ReactNode }) {
  const { userId, orgId } = await auth();
  if (!userId) redirect("/sign-in");

  const supabase = createClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .single();

  if (!profile || !["company_admin", "super_admin"].includes(profile.role)) {
    redirect("/dashboard");
  }

  if (profile?.role === "company_admin") {
    const needsLaunch = await companyAdminNeedsAcademySetup(userId, orgId);
    if (needsLaunch) {
      redirect("/launch-your-academy");
    }
  }

  return (
    <div className="min-h-screen bg-background">
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
