import { getUsersList, getTenantsList } from "@/actions/super-admin";
import { UserManagementClient } from "@/components/superadmin/UserManagementClient";
import { Users } from "lucide-react";

export const dynamic = "force-dynamic";
export const metadata = { title: "Users & Roles — Super Admin Control Plane" };

export default async function SuperAdminUsersPage() {
  const [users, tenants] = await Promise.all([
    getUsersList(),
    getTenantsList(),
  ]);

  return (
    <div className="container mx-auto px-4 sm:px-6 py-8 max-w-7xl">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Users className="h-4 w-4 text-blue-400" />
            <span className="text-xs font-bold uppercase tracking-wider text-blue-400">
              Identity & Access Management
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
            Users & Roles
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Manage platform super-administrators and assign multi-tenant memberships and roles for any user.
          </p>
        </div>
      </div>

      <UserManagementClient
        initialUsers={users}
        tenants={tenants.map((t) => ({ id: t.id, name: t.name, slug: t.slug }))}
      />
    </div>
  );
}
