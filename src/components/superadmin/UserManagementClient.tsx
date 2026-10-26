"use client";

import { useState } from "react";
import {
  Users,
  Search,
  ShieldCheck,
  ShieldAlert,
  Building2,
  Trash2,
  Plus,
  Edit2,
  MoreVertical,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import {
  updateUserPlatformRole,
  upsertUserTenantMembership,
  removeUserTenantMembership,
  type UserWithMemberships,
} from "@/actions/super-admin";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { CompanyMemberRole, UserRole } from "@/types/database";

type TenantOption = {
  id: string;
  name: string;
  slug: string;
};

export function UserManagementClient({
  initialUsers,
  tenants,
}: {
  initialUsers: UserWithMemberships[];
  tenants: TenantOption[];
}) {
  const [users, setUsers] = useState<UserWithMemberships[]>(initialUsers);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [tenantFilter, setTenantFilter] = useState<string>("all");

  // Manage Memberships Dialog State
  const [selectedUser, setSelectedUser] = useState<UserWithMemberships | null>(null);
  const [addTenantId, setAddTenantId] = useState<string>("");
  const [addRole, setAddRole] = useState<CompanyMemberRole>("learner");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const filtered = users.filter((u) => {
    const matchesSearch =
      (u.full_name && u.full_name.toLowerCase().includes(search.toLowerCase())) ||
      (u.email && u.email.toLowerCase().includes(search.toLowerCase())) ||
      u.id.toLowerCase().includes(search.toLowerCase());

    const matchesRole =
      roleFilter === "all" ? true : u.role === roleFilter;

    const matchesTenant =
      tenantFilter === "all"
        ? true
        : u.memberships.some((m) => m.company_id === tenantFilter);

    return matchesSearch && matchesRole && matchesTenant;
  });

  async function handleToggleSuperAdmin(target: UserWithMemberships) {
    const newRole: UserRole = target.role === "super_admin" ? "learner" : "super_admin";
    try {
      await updateUserPlatformRole(target.id, newRole);
      setUsers((prev) =>
        prev.map((u) => (u.id === target.id ? { ...u, role: newRole } : u))
      );
      toast.success(
        newRole === "super_admin"
          ? `Granted Super Admin permissions to ${target.full_name || target.email}`
          : `Removed Super Admin permissions from ${target.full_name || target.email}`
      );
    } catch (err: any) {
      toast.error(err.message || "Failed to update role");
    }
  }

  async function handleAddMembership() {
    if (!selectedUser || !addTenantId) {
      toast.error("Please choose an academy");
      return;
    }

    setIsSubmitting(true);
    try {
      await upsertUserTenantMembership(addTenantId, selectedUser.id, addRole, "active");
      const tenant = tenants.find((t) => t.id === addTenantId);

      const newMembership = {
        company_id: addTenantId,
        company_name: tenant?.name || "Academy",
        company_slug: tenant?.slug || "",
        role: addRole,
        status: "active" as const,
      };

      setUsers((prev) =>
        prev.map((u) => {
          if (u.id !== selectedUser.id) return u;
          const exists = u.memberships.some((m) => m.company_id === addTenantId);
          const nextMemberships = exists
            ? u.memberships.map((m) => (m.company_id === addTenantId ? newMembership : m))
            : [...u.memberships, newMembership];
          return { ...u, memberships: nextMemberships };
        })
      );

      // Update current modal state
      setSelectedUser((prev) => {
        if (!prev) return null;
        const exists = prev.memberships.some((m) => m.company_id === addTenantId);
        const next = exists
          ? prev.memberships.map((m) => (m.company_id === addTenantId ? newMembership : m))
          : [...prev.memberships, newMembership];
        return { ...prev, memberships: next };
      });

      toast.success("Membership added successfully.");
      setAddTenantId("");
    } catch (err: any) {
      toast.error(err.message || "Failed to add membership");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleRemoveMembership(companyId: string) {
    if (!selectedUser) return;
    try {
      await removeUserTenantMembership(companyId, selectedUser.id);

      setUsers((prev) =>
        prev.map((u) => {
          if (u.id !== selectedUser.id) return u;
          return {
            ...u,
            memberships: u.memberships.filter((m) => m.company_id !== companyId),
          };
        })
      );

      setSelectedUser((prev) => {
        if (!prev) return null;
        return {
          ...prev,
          memberships: prev.memberships.filter((m) => m.company_id !== companyId),
        };
      });

      toast.success("Membership removed.");
    } catch (err: any) {
      toast.error(err.message || "Failed to remove membership");
    }
  }

  return (
    <div>
      {/* Controls: Search and Filters */}
      <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4 mb-6">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
          <input
            type="text"
            placeholder="Search by name, email, or user ID..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-slate-900/80 border border-slate-800 rounded-xl pl-10 pr-4 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-slate-700 focus:ring-1 focus:ring-slate-700"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Role selector */}
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-xs font-semibold text-slate-300 focus:outline-none focus:border-slate-700"
          >
            <option value="all">All Platform Roles</option>
            <option value="super_admin">Super Admins</option>
            <option value="company_admin">Company Admins</option>
            <option value="teacher">Teachers</option>
            <option value="learner">Learners</option>
          </select>

          {/* Tenant selector */}
          <select
            value={tenantFilter}
            onChange={(e) => setTenantFilter(e.target.value)}
            className="bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-xs font-semibold text-slate-300 focus:outline-none focus:border-slate-700"
          >
            <option value="all">All Academies</option>
            {tenants.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Users Table */}
      <div className="bg-slate-900/40 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-950/60 border-b border-slate-800/80 text-xs font-bold text-slate-400 uppercase tracking-wider">
              <tr>
                <th className="py-3.5 px-4 sm:px-6">User</th>
                <th className="py-3.5 px-4">Platform Role</th>
                <th className="py-3.5 px-4">Academy Memberships</th>
                <th className="py-3.5 px-4">Joined</th>
                <th className="py-3.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-slate-300">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-slate-500 text-sm">
                    No users found matching your filters.
                  </td>
                </tr>
              ) : (
                filtered.map((u) => (
                  <tr key={u.id} className="hover:bg-slate-800/30 transition-colors">
                    
                    {/* User Profile */}
                    <td className="py-4 px-4 sm:px-6">
                      <div>
                        <div className="font-bold text-white text-sm">
                          {u.full_name || "Unnamed User"}
                        </div>
                        <div className="text-xs text-slate-400">
                          {u.email || u.id}
                        </div>
                        <div className="text-[10px] text-slate-500 font-mono mt-0.5">
                          {u.id}
                        </div>
                      </div>
                    </td>

                    {/* Platform Role */}
                    <td className="py-4 px-4">
                      <span
                        className={`text-[11px] font-bold px-2.5 py-1 rounded-full inline-flex items-center gap-1.5 ${
                          u.role === "super_admin"
                            ? "bg-red-500/20 text-red-400 border border-red-500/30"
                            : u.role === "company_admin"
                            ? "bg-orange-500/20 text-orange-400 border border-orange-500/30"
                            : "bg-slate-800 text-slate-400"
                        }`}
                      >
                        {u.role === "super_admin" && <ShieldAlert className="h-3 w-3" />}
                        <span>{u.role}</span>
                      </span>
                    </td>

                    {/* Memberships in Academies */}
                    <td className="py-4 px-4">
                      <div className="flex flex-wrap gap-1.5 max-w-md">
                        {u.memberships.length === 0 ? (
                          <span className="text-xs text-slate-500 italic">No academy memberships</span>
                        ) : (
                          u.memberships.map((m) => (
                            <span
                              key={m.company_id}
                              className="text-xs px-2 py-0.5 rounded-lg bg-slate-800/90 border border-slate-700/60 text-slate-300 flex items-center gap-1.5"
                            >
                              <span className="font-medium text-white">{m.company_name}</span>
                              <span className="text-[10px] font-semibold text-amber-400/90 uppercase">
                                ({m.role})
                              </span>
                            </span>
                          ))
                        )}
                      </div>
                    </td>

                    {/* Joined Date */}
                    <td className="py-4 px-4 text-xs text-slate-500 font-mono">
                      {new Date(u.created_at).toLocaleDateString()}
                    </td>

                    {/* Actions */}
                    <td className="py-4 px-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {/* Manage Memberships Button */}
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setSelectedUser(u)}
                          className="bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-200 text-xs font-semibold h-8 px-2.5 rounded-lg"
                        >
                          <Building2 className="h-3.5 w-3.5 mr-1 text-orange-400" />
                          <span>Memberships</span>
                        </Button>

                        {/* Grant/Revoke Super Admin */}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleToggleSuperAdmin(u)}
                          className={`h-8 px-2.5 text-xs font-semibold rounded-lg ${
                            u.role === "super_admin"
                              ? "text-red-400 hover:bg-red-500/10"
                              : "text-slate-400 hover:text-white hover:bg-slate-800"
                          }`}
                          title={u.role === "super_admin" ? "Revoke Super Admin" : "Grant Super Admin"}
                        >
                          <ShieldCheck className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </td>

                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Memberships Modal Dialog */}
      <Dialog open={!!selectedUser} onOpenChange={(open) => !open && setSelectedUser(null)}>
        <DialogContent className="bg-slate-900 border-slate-800 text-slate-100 max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-white flex items-center gap-2">
              <Building2 className="h-5 w-5 text-orange-400" />
              <span>Manage Academy Memberships</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-400">
              For: <strong className="text-white">{selectedUser?.full_name || selectedUser?.email}</strong>
            </DialogDescription>
          </DialogHeader>

          {/* Existing Memberships */}
          <div className="py-3">
            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
              Active Memberships
            </h4>

            {selectedUser?.memberships.length === 0 ? (
              <p className="text-xs text-slate-500 italic py-2">
                This user is not enrolled in any academies yet.
              </p>
            ) : (
              <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                {selectedUser?.memberships.map((m) => (
                  <div
                    key={m.company_id}
                    className="flex items-center justify-between p-2.5 rounded-xl bg-slate-950/70 border border-slate-800 text-xs"
                  >
                    <div>
                      <div className="font-semibold text-slate-200">
                        {m.company_name}
                      </div>
                      <div className="text-[11px] text-slate-400 capitalize">
                        Role: <span className="text-amber-400 font-semibold">{m.role}</span> • Status: {m.status}
                      </div>
                    </div>

                    <button
                      onClick={() => handleRemoveMembership(m.company_id)}
                      className="p-1.5 text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors"
                      title="Remove from academy"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Add New Membership */}
          <div className="pt-3 border-t border-slate-800/80">
            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
              Assign to Academy
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-3">
              <div>
                <label className="text-[11px] text-slate-400 block mb-1">Select Academy</label>
                <select
                  value={addTenantId}
                  onChange={(e) => setAddTenantId(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-200"
                >
                  <option value="">Choose Academy...</option>
                  {tenants.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[11px] text-slate-400 block mb-1">Member Role</label>
                <select
                  value={addRole}
                  onChange={(e) => setAddRole(e.target.value as CompanyMemberRole)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-200"
                >
                  <option value="learner">Learner</option>
                  <option value="teacher">Teacher</option>
                  <option value="company_admin">Company Admin</option>
                </select>
              </div>
            </div>

            <Button
              size="sm"
              onClick={handleAddMembership}
              disabled={isSubmitting || !addTenantId}
              className="w-full bg-[#fd5523] hover:bg-[#ea4817] text-white text-xs font-bold"
            >
              <Plus className="h-3.5 w-3.5 mr-1" />
              <span>Assign Membership</span>
            </Button>
          </div>

          <DialogFooter className="mt-4">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSelectedUser(null)}
              className="border-slate-800 text-slate-400 hover:text-white"
            >
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
