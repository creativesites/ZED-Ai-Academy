import { requireSuperAdmin } from "@/lib/auth/super-admin";
import { AvatarLab } from "@/components/tutor/avatar/AvatarLab";

export const dynamic = "force-dynamic";
export const metadata = { title: "Avatar Lab — Super Admin Control Plane" };

export default async function AvatarLabPage() {
  await requireSuperAdmin();

  return (
    <div className="container mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <AvatarLab />
    </div>
  );
}
