import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { ensureProfile } from "@/lib/supabase/ensure-profile";
import { requireOnboarding } from "@/lib/require-onboarding";
import Header2Wrapper from "@/components/layout/Header2Wrapper";
import Footer1 from "@/components/layout/footer/Footer1";
import { NotificationBellServer } from "@/components/shared/notification-bell-server";
import "../../../public/assets/css/style.css"
import 'swiper/css'
// import "swiper/css/navigation"
import "swiper/css/pagination"
import 'swiper/css/free-mode';

export default async function LearnerLayout({ children }: { children: React.ReactNode }) {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  try {
    await ensureProfile(userId);
  } catch {
    // Non-fatal — continue rendering even if profile sync fails
  }

  // Enforce onboarding on all learner routes (the onboarding page itself
  // lives under (learner)/onboarding and handles its own skip logic).
  try {
    await requireOnboarding(userId);
  } catch {
    // redirect() throws — this catch only fires on unexpected errors
  }

  return (
    <div className="page-wrapper">
      <Header2Wrapper />
      {/* Notification bell — fixed top-right on authenticated pages */}
      {/* <div style={{ position: "fixed", top: "38px", right: "80px", zIndex: 9999 }}>
        <NotificationBellServer />
      </div> */}
      <div id="page-content">
        {children}
      </div>
      <Footer1 />
    </div>
  );
}
