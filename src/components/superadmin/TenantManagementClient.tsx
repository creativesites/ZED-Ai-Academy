"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Building2,
  Search,
  ExternalLink,
  ShieldCheck,
  AlertTriangle,
  Users,
  BookOpen,
  Filter,
  CheckCircle2,
  XCircle,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { toggleTenantStatus } from "@/actions/super-admin";
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

type TenantRow = {
  id: string;
  name: string;
  slug: string;
  status: "active" | "suspended";
  logo_url: string | null;
  primary_color: string | null;
  admin_id: string | null;
  teacher_code: string | null;
  suspended_reason: string | null;
  suspended_at: string | null;
  created_at: string;
  admin: { id: string; full_name: string | null; email: string | null } | null;
  membersCount: number;
  coursesCount: number;
  isPlatformTenant: boolean;
};

export function TenantManagementClient({ initialTenants }: { initialTenants: TenantRow[] }) {
  const [tenants, setTenants] = useState<TenantRow[]>(initialTenants);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "suspended">("all");

  // Suspend Dialog State
  const [suspendTarget, setSuspendTarget] = useState<TenantRow | null>(null);
  const [suspendReason, setSuspendReason] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const filtered = tenants.filter((t) => {
    const matchesSearch =
      t.name.toLowerCase().includes(search.toLowerCase()) ||
      t.slug.toLowerCase().includes(search.toLowerCase()) ||
      (t.admin?.full_name && t.admin.full_name.toLowerCase().includes(search.toLowerCase())) ||
      (t.admin?.email && t.admin.email.toLowerCase().includes(search.toLowerCase()));

    const matchesStatus =
      statusFilter === "all" ? true : t.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  async function handleToggleStatus() {
    if (!suspendTarget) return;

    const nextStatus = suspendTarget.status === "active" ? "suspended" : "active";
    setIsSubmitting(true);

    try {
      await toggleTenantStatus(suspendTarget.id, nextStatus, suspendReason);
      
      setTenants((prev) =>
        prev.map((t) =>
          t.id === suspendTarget.id
            ? {
                ...t,
                status: nextStatus,
                suspended_reason: nextStatus === "suspended" ? suspendReason : null,
              }
            : t
        )
      );

      toast.success(
        nextStatus === "suspended"
          ? `${suspendTarget.name} has been suspended.`
          : `${suspendTarget.name} has been reactivated.`
      );

      setSuspendTarget(null);
      setSuspendReason("");
    } catch (err: any) {
      toast.error(err.message || "Failed to update tenant status");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div>
      {/* Controls: Search and Filters */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 mb-6">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
          <input
            type="text"
            placeholder="Search by academy name, slug, or owner..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-slate-900/80 border border-slate-800 rounded-xl pl-10 pr-4 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-slate-700 focus:ring-1 focus:ring-slate-700"
          />
        </div>

        <div className="flex items-center gap-2">
          {(["all", "active", "suspended"] as const).map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold capitalize transition-all ${
                statusFilter === s
                  ? "bg-slate-800 text-white border border-slate-700 shadow-sm"
                  : "text-slate-400 hover:text-slate-200 hover:bg-slate-900"
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* Tenants Table */}
      <div className="bg-slate-900/40 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-950/60 border-b border-slate-800/80 text-xs font-bold text-slate-400 uppercase tracking-wider">
              <tr>
                <th className="py-3.5 px-4 sm:px-6">Academy</th>
                <th className="py-3.5 px-4">Owner / Admin</th>
                <th className="py-3.5 px-4">Members</th>
                <th className="py-3.5 px-4">Courses</th>
                <th className="py-3.5 px-4">Status</th>
                <th className="py-3.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-slate-300">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-500 text-sm">
                    No academies found matching your search.
                  </td>
                </tr>
              ) : (
                filtered.map((t) => (
                  <tr key={t.id} className="hover:bg-slate-800/30 transition-colors">
                    
                    {/* Academy Name & Details */}
                    <td className="py-4 px-4 sm:px-6">
                      <div className="flex items-center gap-3">
                        <div
                          className="h-10 w-10 rounded-xl flex items-center justify-center text-white font-bold text-base shadow-sm shrink-0"
                          style={{ backgroundColor: t.primary_color || "#fd5523" }}
                        >
                          {t.logo_url ? (
                            <img src={t.logo_url} alt={t.name} className="h-full w-full object-cover rounded-xl" />
                          ) : (
                            t.name.charAt(0)
                          )}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-white text-sm">
                              {t.name}
                            </span>
                            {t.isPlatformTenant && (
                              <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-400 border border-amber-500/30">
                                Platform
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-slate-500 font-mono mt-0.5">
                            /{t.slug}
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Owner */}
                    <td className="py-4 px-4">
                      {t.admin ? (
                        <div>
                          <div className="text-sm font-medium text-slate-200">
                            {t.admin.full_name || "Admin"}
                          </div>
                          <div className="text-xs text-slate-500">
                            {t.admin.email || t.admin.id}
                          </div>
                        </div>
                      ) : (
                        <span className="text-xs text-slate-500 italic">No primary owner</span>
                      )}
                    </td>

                    {/* Members Count */}
                    <td className="py-4 px-4">
                      <div className="flex items-center gap-1.5 text-xs text-slate-300">
                        <Users className="h-3.5 w-3.5 text-slate-500" />
                        <span>{t.membersCount}</span>
                      </div>
                    </td>

                    {/* Courses Count */}
                    <td className="py-4 px-4">
                      <div className="flex items-center gap-1.5 text-xs text-slate-300">
                        <BookOpen className="h-3.5 w-3.5 text-slate-500" />
                        <span>{t.coursesCount}</span>
                      </div>
                    </td>

                    {/* Status */}
                    <td className="py-4 px-4">
                      <span
                        className={`text-[11px] font-semibold px-2.5 py-1 rounded-full inline-flex items-center gap-1.5 ${
                          t.status === "active"
                            ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                            : "bg-rose-500/10 text-rose-400 border border-rose-500/20"
                        }`}
                      >
                        <span className={`h-1.5 w-1.5 rounded-full ${t.status === "active" ? "bg-emerald-400" : "bg-rose-400"}`} />
                        <span className="capitalize">{t.status}</span>
                      </span>
                    </td>

                    {/* Actions */}
                    <td className="py-4 px-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        
                        {/* 1-Click Jump In As Admin */}
                        <Link
                          href={`/academy/${t.slug}/admin`}
                          target="_blank"
                          className="bg-slate-800 hover:bg-slate-700 text-slate-100 hover:text-white px-2.5 py-1.5 rounded-lg text-xs font-semibold border border-slate-700 flex items-center gap-1.5 transition-colors shadow-sm"
                          title="Jump into Academy Admin Panel"
                        >
                          <ShieldCheck className="h-3.5 w-3.5 text-amber-400" />
                          <span>Admin Console</span>
                          <ExternalLink className="h-3 w-3 opacity-50" />
                        </Link>

                        {/* Public Link */}
                        <Link
                          href={`/academy/${t.slug}`}
                          target="_blank"
                          className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
                          title="View Public Page"
                        >
                          <ExternalLink className="h-4 w-4" />
                        </Link>

                        {/* Suspend / Reactivate */}
                        {!t.isPlatformTenant && (
                          <button
                            onClick={() => {
                              setSuspendTarget(t);
                              setSuspendReason(t.suspended_reason || "");
                            }}
                            className={`p-1.5 rounded-lg transition-colors ${
                              t.status === "active"
                                ? "text-slate-500 hover:text-rose-400 hover:bg-rose-500/10"
                                : "text-emerald-400 hover:bg-emerald-500/10"
                            }`}
                            title={t.status === "active" ? "Suspend Academy" : "Reactivate Academy"}
                          >
                            <AlertTriangle className="h-4 w-4" />
                          </button>
                        )}

                      </div>
                    </td>

                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Suspend Confirmation Dialog */}
      <Dialog open={!!suspendTarget} onOpenChange={(open) => !open && setSuspendTarget(null)}>
        <DialogContent className="bg-slate-900 border-slate-800 text-slate-100 max-w-md">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-white flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-400" />
              <span>
                {suspendTarget?.status === "active"
                  ? `Suspend ${suspendTarget?.name}?`
                  : `Reactivate ${suspendTarget?.name}?`}
              </span>
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-400">
              {suspendTarget?.status === "active"
                ? "Suspending an academy prevents learners and tutors from logging into or viewing this academy until it is reactivated."
                : "Reactivating this academy will immediately restore access for all enrolled learners and administrators."}
            </DialogDescription>
          </DialogHeader>

          {suspendTarget?.status === "active" && (
            <div className="py-2">
              <label className="text-xs font-semibold text-slate-300 block mb-1.5">
                Reason for suspension (optional, visible to owner):
              </label>
              <Input
                placeholder="e.g. Terms violation, payment dispute, owner request"
                value={suspendReason}
                onChange={(e) => setSuspendReason(e.target.value)}
                className="bg-slate-950 border-slate-800 text-sm text-slate-100"
              />
            </div>
          )}

          <DialogFooter className="mt-4 gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSuspendTarget(null)}
              className="border-slate-800 text-slate-400 hover:text-white"
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleToggleStatus}
              disabled={isSubmitting}
              className={
                suspendTarget?.status === "active"
                  ? "bg-rose-600 hover:bg-rose-500 text-white"
                  : "bg-emerald-600 hover:bg-emerald-500 text-white"
              }
            >
              {isSubmitting
                ? "Processing..."
                : suspendTarget?.status === "active"
                ? "Confirm Suspension"
                : "Reactivate Academy"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
