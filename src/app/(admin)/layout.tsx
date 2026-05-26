import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { createServiceClient } from "@/lib/supabase/server";
import Header2Wrapper from "@/components/layout/Header2Wrapper";
import Footer1 from "@/components/layout/footer/Footer1";
import { NotificationBellServer } from "@/components/shared/notification-bell-server";
import "../../../public/assets/css/style.css"
import 'swiper/css'
// import "swiper/css/navigation"
import "swiper/css/pagination"
import 'swiper/css/free-mode';
import { dmSans } from '@/lib/font'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const supabase = createServiceClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .single();

    console.log('admin layout - profile', profile)

  if (!["super_admin", "instructor"].includes(profile?.role ?? "")) redirect("/dashboard");

  return (
    <div className="page-wrapper">
      <Header2Wrapper>
        <NotificationBellServer />
      </Header2Wrapper>
      <div id="page-content">{children}</div>
      <Footer1 />
    </div>
  );
}
