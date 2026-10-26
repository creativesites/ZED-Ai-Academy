import Link from "next/link";
import { getSuperAdminOverview } from "@/actions/super-admin";
import {
  Building2,
  Users,
  BookOpen,
  GraduationCap,
  ShieldAlert,
  ArrowRight,
  ExternalLink,
  PlusCircle,
  AlertTriangle,
  Sparkles,
} from "lucide-react";

export const dynamic = "force-dynamic";

export default async function SuperAdminOverviewPage() {
  const stats = await getSuperAdminOverview();

  return (
    <div className="container mx-auto px-4 sm:px-6 py-8 max-w-7xl">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8 pb-6 border-b border-slate-800/80">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-bold uppercase tracking-wider text-amber-400">
              Platform Command Center
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
            Super Admin Overview
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Monitor, inspect, and manage all academies, multi-tenant roles, and system operations.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/superadmin/tenants"
            className="flex items-center gap-2 bg-[#fd5523] hover:bg-[#ea4817] text-white text-xs font-bold uppercase tracking-wider px-4 py-2.5 rounded-xl shadow-lg shadow-[#fd5523]/20 transition-all hover:scale-105 active:scale-95"
          >
            <Building2 className="h-4 w-4" />
            <span>Manage Academies</span>
          </Link>
          <Link
            href="/superadmin/users"
            className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold uppercase tracking-wider px-4 py-2.5 rounded-xl border border-slate-700 transition-all hover:scale-105 active:scale-95"
          >
            <Users className="h-4 w-4" />
            <span>Manage Users</span>
          </Link>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
        
        {/* Academies */}
        <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-5 hover:border-slate-700 transition-colors">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Total Academies
            </span>
            <div className="h-8 w-8 rounded-lg bg-orange-500/10 text-orange-400 flex items-center justify-center">
              <Building2 className="h-4 w-4" />
            </div>
          </div>
          <div className="text-3xl font-black text-white mb-1">
            {stats.totalTenants}
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <span className="text-emerald-400 font-semibold">{stats.activeTenants} active</span>
            {stats.suspendedTenants > 0 && (
              <span className="text-rose-400 font-semibold">({stats.suspendedTenants} suspended)</span>
            )}
          </div>
        </div>

        {/* Registered Users */}
        <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-5 hover:border-slate-700 transition-colors">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Platform Users
            </span>
            <div className="h-8 w-8 rounded-lg bg-blue-500/10 text-blue-400 flex items-center justify-center">
              <Users className="h-4 w-4" />
            </div>
          </div>
          <div className="text-3xl font-black text-white mb-1">
            {stats.totalUsers}
          </div>
          <div className="text-xs text-slate-400">
            <span>{stats.superAdminsCount} super admin(s)</span>
          </div>
        </div>

        {/* Global Courses */}
        <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-5 hover:border-slate-700 transition-colors">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Total Courses
            </span>
            <div className="h-8 w-8 rounded-lg bg-purple-500/10 text-purple-400 flex items-center justify-center">
              <BookOpen className="h-4 w-4" />
            </div>
          </div>
          <div className="text-3xl font-black text-white mb-1">
            {stats.totalCourses}
          </div>
          <div className="text-xs text-slate-400">
            <span>Across all tenant catalogs</span>
          </div>
        </div>

        {/* Enrollments */}
        <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-5 hover:border-slate-700 transition-colors">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Enrollments
            </span>
            <div className="h-8 w-8 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
              <GraduationCap className="h-4 w-4" />
            </div>
          </div>
          <div className="text-3xl font-black text-white mb-1">
            {stats.totalEnrollments}
          </div>
          <div className="text-xs text-slate-400">
            <span>Active learning records</span>
          </div>
        </div>

      </div>

      {/* Main Grid: Recent Academies & Recent Users */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        {/* Recent Academies Card */}
        <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <Building2 className="h-4 w-4 text-orange-400" />
              <h2 className="text-base font-bold text-white tracking-tight">
                Tenant Academies
              </h2>
            </div>
            <Link
              href="/superadmin/tenants"
              className="text-xs font-semibold text-orange-400 hover:text-orange-300 flex items-center gap-1 transition-colors"
            >
              <span>View all ({stats.totalTenants})</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>

          <div className="divide-y divide-slate-800/60">
            {stats.recentTenants.map((t) => (
              <div key={t.id} className="py-3.5 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-sm text-slate-200 truncate">
                      {t.name}
                    </span>
                    {t.slug === "zedai" && (
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400 border border-amber-500/30">
                        Platform
                      </span>
                    )}
                    <span
                      className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                        t.status === "active"
                          ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                          : "bg-rose-500/10 text-rose-400 border border-rose-500/20"
                      }`}
                    >
                      {t.status}
                    </span>
                  </div>
                  <div className="text-xs text-slate-500 truncate mt-0.5">
                    slug: <span className="font-mono text-slate-400">{t.slug}</span>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <Link
                    href={`/academy/${t.slug}/admin`}
                    target="_blank"
                    className="text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 px-2.5 py-1.5 rounded-lg border border-slate-700 flex items-center gap-1 transition-colors"
                    title="Impersonate / Jump to Academy Admin"
                  >
                    <span>Admin</span>
                    <ExternalLink className="h-3 w-3 opacity-60" />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Recent Users Card */}
        <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-blue-400" />
              <h2 className="text-base font-bold text-white tracking-tight">
                Platform Users
              </h2>
            </div>
            <Link
              href="/superadmin/users"
              className="text-xs font-semibold text-blue-400 hover:text-blue-300 flex items-center gap-1 transition-colors"
            >
              <span>View all ({stats.totalUsers})</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>

          <div className="divide-y divide-slate-800/60">
            {stats.recentUsers.map((u) => (
              <div key={u.id} className="py-3.5 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-sm text-slate-200 truncate">
                      {u.full_name || "Unnamed User"}
                    </span>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        u.role === "super_admin"
                          ? "bg-red-500/20 text-red-400 border border-red-500/30"
                          : u.role === "company_admin"
                          ? "bg-orange-500/20 text-orange-400 border border-orange-500/30"
                          : "bg-slate-800 text-slate-400"
                      }`}
                    >
                      {u.role}
                    </span>
                  </div>
                  <div className="text-xs text-slate-500 truncate mt-0.5">
                    {u.email || u.id}
                  </div>
                </div>

                <div className="text-xs text-slate-500 font-mono shrink-0">
                  {new Date(u.created_at).toLocaleDateString()}
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}
