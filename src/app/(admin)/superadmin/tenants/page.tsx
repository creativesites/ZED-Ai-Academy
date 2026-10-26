import { getTenantsList } from "@/actions/super-admin";
import { TenantManagementClient } from "@/components/superadmin/TenantManagementClient";
import { Building2, Plus } from "lucide-react";
import Link from "next/link";

export const dynamic = "force-dynamic";
export const metadata = { title: "Academies & Tenants — Super Admin Control Plane" };

export default async function SuperAdminTenantsPage() {
  const tenants = await getTenantsList();

  return (
    <div className="container mx-auto px-4 sm:px-6 py-8 max-w-7xl">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Building2 className="h-4 w-4 text-orange-400" />
            <span className="text-xs font-bold uppercase tracking-wider text-orange-400">
              Tenant Management
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
            Academies & Tenants
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            View, audit, suspend, and jump into the administrative consoles of all tenants on the platform.
          </p>
        </div>

        <Link
          href="/launch-your-academy"
          target="_blank"
          className="flex items-center gap-2 bg-[#fd5523] hover:bg-[#ea4817] text-white text-xs font-bold uppercase tracking-wider px-4 py-2.5 rounded-xl shadow-lg shadow-[#fd5523]/20 transition-all hover:scale-105 active:scale-95"
        >
          <Plus className="h-4 w-4" />
          <span>Create New Academy</span>
        </Link>
      </div>

      <TenantManagementClient initialTenants={tenants} />
    </div>
  );
}
