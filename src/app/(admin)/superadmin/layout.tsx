import { requireSuperAdmin } from "@/lib/auth/super-admin";
import { SuperAdminNav } from "@/components/superadmin/SuperAdminNav";
import { Toaster } from "@/components/ui/sonner";

export const metadata = {
  title: "Super Admin Control Plane — Zed AI Academy",
  description: "Global tenant and user management for platform administrators",
};

export default async function SuperAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { profile } = await requireSuperAdmin();

  return (
    <div className="min-h-screen bg-[#070b12] text-slate-100 flex flex-col font-sans selection:bg-[#fd5523]/30 selection:text-white">
      <SuperAdminNav adminName={profile.full_name || "Super Admin"} />
      <main className="flex-1 pb-16">{children}</main>
      <Toaster position="bottom-right" richColors />
    </div>
  );
}
