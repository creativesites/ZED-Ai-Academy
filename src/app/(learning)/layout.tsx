import { auth } from "@clerk/nextjs/server";
import { ensureProfile } from "@/lib/supabase/ensure-profile";
import { requireOnboarding } from "@/lib/require-onboarding";
import { NotificationBellServer } from "@/components/shared/notification-bell-server";
import "../../../public/assets/css/style.css"
import 'swiper/css'
import "swiper/css/pagination"
import 'swiper/css/free-mode';

export default async function LearningLayout({ children }: { children: React.ReactNode }) {
  const { userId } = await auth();

  // Signed-out visitors are allowed through: the learn page decides what a guest may see (published, free
  // courses and their preview lessons only; anything else sends them to sign-in). Redirecting here blocked the
  // zero-login showcase entirely.
  if (userId) {
    try {
      await ensureProfile(userId);
    } catch {
      // Non-fatal
    }

    try {
      await requireOnboarding(userId);
    } catch {
      // redirect() throws
    }
  }

  return (
    <div className="min-h-screen bg-[#f8fafc]">
      {/* <div style={{ position: "fixed", top: "18px", right: "24px", zIndex: 9999 }}>
        <NotificationBellServer />
      </div> */}
      <main>
        {children}
      </main>
    </div>
  );
}
