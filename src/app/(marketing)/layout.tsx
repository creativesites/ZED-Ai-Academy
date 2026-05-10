import "../../../public/assets/css/style.css"
import 'swiper/css'
// import "swiper/css/navigation"
import "swiper/css/pagination"
import 'swiper/css/free-mode';
import { MobileBottomNav } from "@/components/layout/MobileBottomNav";

export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="marketing-shell flex min-h-screen flex-col">
      <main className="flex-1">{children}</main>
      <MobileBottomNav />
    </div>
  );
}
