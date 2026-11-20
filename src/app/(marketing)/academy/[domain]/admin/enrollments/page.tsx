import { createServiceClient } from "@/lib/supabase/server";
import Link from "next/link";
import {
  Users, GraduationCap, Clock3, CheckCircle2, XCircle,
  BookOpen, RotateCcw,
} from "lucide-react";
import { EnrollmentActions } from "@/components/admin/enrollment-actions";
import { EnrollmentsToolbarActions } from "@/components/tenant/admin/EnrollmentsToolbarActions";
import { requireTenantAdminPage } from "@/lib/tenants/admin-guard";

export const metadata = { title: "Enrollment Management — Admin Hub" };

type PageProps = {
  params: Promise<{ domain: string }>;
  searchParams: Promise<{ status?: string; q?: string; course?: string }>;
};

type EnrollmentRow = {
  id: string;
  status: string;
  enrolled_at: string;
  student_phone: string | null;
  notes: string | null;
  course_id: string;
  user_id: string;
  courses: { id: string; title: string; slug: string } | null;
  profiles: { full_name: string | null; email: string | null } | null;
};

const STATUS_LABEL: Record<string, { label: string; cls: string }> = {
  active: { label: "Active", cls: "bg-green-100 text-green-700" },
  pending_payment: { label: "Pending Payment", cls: "bg-amber-100 text-amber-700" },
  pending: { label: "Pending", cls: "bg-amber-100 text-amber-700" },
  revoked: { label: "Revoked", cls: "bg-red-100 text-red-700" },
};

export default async function TenantEnrollmentsPage({ params, searchParams }: PageProps) {
  const { domain } = await params;
  const { status: rawStatusFilter = "all", q = "", course: courseFilter = "" } = await searchParams;
  const statusFilter = rawStatusFilter === "pending" ? "pending_payment" : rawStatusFilter;

  const { company } = await requireTenantAdminPage(domain);
  const supabase = createServiceClient();

  // 1. Fetch Stats
  const [
    { count: activeCount },
    { count: pendingCount },
    { count: revokedCount },
    { count: allCount },
  ] = await Promise.all([
    supabase.from("enrollments").select("*", { head: true, count: "exact" }).eq("company_id", company.id).eq("status", "active"),
    supabase.from("enrollments").select("*", { head: true, count: "exact" }).eq("company_id", company.id).eq("status", "pending_payment"),
    supabase.from("enrollments").select("*", { head: true, count: "exact" }).eq("company_id", company.id).eq("status", "revoked"),
    supabase.from("enrollments").select("*", { head: true, count: "exact" }).eq("company_id", company.id),
  ]);

  // 2. Fetch Enrollments
  let query = supabase
    .from("enrollments")
    .select("id, status, enrolled_at, student_phone, notes, course_id, user_id, courses(id, title, slug), profiles(full_name, email)")
    .eq("company_id", company.id)
    .order("enrolled_at", { ascending: false })
    .limit(200);

  if (statusFilter !== "all") {
    query = query.eq("status", statusFilter as "active" | "pending_payment" | "revoked");
  }

  const { data: rawRows } = await query;
  let rows = (rawRows ?? []) as unknown as EnrollmentRow[];

  // 3. Filtering
  if (q) {
    const lower = q.toLowerCase();
    rows = rows.filter(
      (r) =>
        r.profiles?.full_name?.toLowerCase().includes(lower) ||
        r.profiles?.email?.toLowerCase().includes(lower) ||
        r.courses?.title?.toLowerCase().includes(lower) ||
        r.student_phone?.includes(lower)
    );
  }

  if (courseFilter) {
    rows = rows.filter((r) => r.course_id === courseFilter);
  }

  // 4. Fetch Courses and Cohorts for filter & invite modal
  const [{ data: allCourses }, { data: allCohorts }] = await Promise.all([
    supabase
      .from("courses")
      .select("id, title")
      .eq("company_id", company.id)
      .order("title"),
    supabase
      .from("classroom_groups")
      .select("id, name")
      .eq("company_id", company.id)
      .order("name"),
  ]);

  const tabs = [
    { key: "all", label: "All", count: allCount ?? 0 },
    { key: "pending_payment", label: "Pending", count: pendingCount ?? 0 },
    { key: "active", label: "Active", count: activeCount ?? 0 },
    { key: "revoked", label: "Revoked", count: revokedCount ?? 0 },
  ];

  const hasActiveFilter = statusFilter !== "all" || Boolean(q) || Boolean(courseFilter);

  return (
    <div className="container max-w-7xl px-4 py-6 sm:py-10">
      <div className="space-y-6 sm:space-y-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-[#062e39] uppercase">
              Enrollment Management
            </h1>
            <p className="text-slate-500 font-medium mt-1 text-sm sm:text-base">
              Manage student access, self-enroll, or bulk-register learners for {company.name}.
            </p>
          </div>

          <EnrollmentsToolbarActions
            companyId={company.id}
            companySlug={company.slug}
            courses={allCourses ?? []}
            cohorts={allCohorts ?? []}
          />
        </div>

        {/* KPI row */}
        <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-4">
          {[
            { label: "Total Students", value: allCount ?? 0, icon: GraduationCap, accent: "bg-[#fff6ee] text-[#fd5523]" },
            { label: "Active Access", value: activeCount ?? 0, icon: CheckCircle2, accent: "bg-green-50 text-green-600" },
            { label: "Pending", value: pendingCount ?? 0, icon: Clock3, accent: "bg-amber-50 text-amber-600" },
            { label: "Revoked", value: revokedCount ?? 0, icon: XCircle, accent: "bg-red-50 text-red-500" },
          ].map((kpi) => (
            <div key={kpi.label} className="bg-white rounded-2xl sm:rounded-[2rem] border border-slate-100 p-4 sm:p-6 shadow-sm">
              <div className={`mb-3 sm:mb-4 flex h-9 w-9 sm:h-10 sm:w-10 items-center justify-center rounded-xl sm:rounded-2xl ${kpi.accent}`}>
                <kpi.icon className="h-4 w-4 sm:h-5 sm:w-5" />
              </div>
              <p className="text-2xl sm:text-3xl font-black tracking-tight text-[#062e39]">{kpi.value}</p>
              <p className="mt-1 text-[10px] sm:text-xs font-black uppercase tracking-widest text-slate-400">{kpi.label}</p>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div className="bg-white rounded-2xl sm:rounded-[2.5rem] border border-slate-100 p-4 sm:p-6 lg:p-8 shadow-sm">
          <form method="GET" className="flex flex-col lg:flex-row lg:items-center gap-4 sm:gap-6">
            <input type="hidden" name="status" value={statusFilter} />
            <div className="flex flex-wrap gap-2 flex-1">
              {tabs.map((tab) => (
                <Link
                  key={tab.key}
                  href={`/academy/${company.slug}/admin/enrollments?status=${tab.key}${q ? `&q=${encodeURIComponent(q)}` : ""}${courseFilter ? `&course=${courseFilter}` : ""}`}
                  className={`flex items-center gap-2 rounded-xl px-3.5 sm:px-5 py-2 sm:py-2.5 text-[11px] sm:text-xs font-black uppercase tracking-widest transition-all ${
                    statusFilter === tab.key
                      ? "bg-[#062e39] text-white"
                      : "bg-slate-50 text-slate-500 hover:bg-slate-100"
                  }`}
                >
                  {tab.label}
                  <span className={`rounded-lg px-2 py-0.5 text-[10px] font-black ${
                    statusFilter === tab.key ? "bg-white/20 text-white" : "bg-white text-slate-400"
                  }`}>
                    {tab.count}
                  </span>
                </Link>
              ))}
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 sm:gap-3 w-full lg:w-auto">
              <input
                name="q"
                defaultValue={q}
                placeholder="Search students..."
                className="h-11 sm:h-12 w-full sm:w-56 rounded-xl border border-slate-100 bg-slate-50 px-4 text-sm text-[#062e39] placeholder:text-slate-400 focus:bg-white focus:border-[#fd5523] outline-none transition-all"
              />
              <select
                name="course"
                defaultValue={courseFilter}
                className="h-11 sm:h-12 w-full sm:w-44 rounded-xl border border-slate-100 bg-slate-50 px-3.5 text-sm text-[#062e39] focus:bg-white focus:border-[#fd5523] outline-none transition-all"
              >
                <option value="">All Courses</option>
                {(allCourses ?? []).map((c) => (
                  <option key={c.id} value={c.id}>{c.title}</option>
                ))}
              </select>
              <div className="flex items-center gap-2">
                <button
                  type="submit"
                  className="h-11 sm:h-12 flex-1 sm:flex-none px-6 sm:px-8 rounded-xl bg-[#062e39] text-white text-xs font-black uppercase tracking-widest hover:bg-[#0a3a48] transition-all"
                >
                  Filter
                </button>
                {hasActiveFilter && (
                  <Link
                    href={`/academy/${company.slug}/admin/enrollments`}
                    title="Reset filters"
                    className="h-11 sm:h-12 px-3.5 rounded-xl border border-slate-200 bg-slate-50 text-slate-500 hover:text-[#fd5523] flex items-center justify-center transition-colors"
                  >
                    <RotateCcw className="h-4 w-4" />
                  </Link>
                )}
              </div>
            </div>
          </form>
        </div>

        {/* Enrollments List */}
        <div className="bg-white rounded-2xl sm:rounded-[2.5rem] border border-slate-100 shadow-sm overflow-hidden">
          {rows.length === 0 ? (
            <div className="py-16 sm:py-24 text-center px-4">
              <Users className="mx-auto mb-4 h-12 w-12 sm:h-16 sm:w-16 text-slate-200" />
              <p className="text-slate-400 font-bold uppercase tracking-widest text-xs sm:text-sm">
                No enrollments found
              </p>
            </div>
          ) : (
            <>
              {/* Mobile-First Card View */}
              <div className="md:hidden divide-y divide-slate-100">
                {rows.map((row) => {
                  const statusStyle = STATUS_LABEL[row.status] ?? { label: row.status, cls: "bg-slate-100 text-slate-600" };
                  const enrolledDate = new Date(row.enrolled_at).toLocaleDateString("en-ZM", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  });

                  return (
                    <div key={row.id} className="p-4 space-y-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="h-10 w-10 shrink-0 rounded-xl bg-slate-100 flex items-center justify-center font-black text-slate-500">
                            {(row.profiles?.full_name ?? row.profiles?.email ?? "?")[0]?.toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <p className="font-black text-sm text-[#062e39] truncate">
                              {row.profiles?.full_name || "—"}
                            </p>
                            <p className="text-xs text-slate-400 truncate">
                              {row.profiles?.email || "—"}
                            </p>
                          </div>
                        </div>
                        <span className={`shrink-0 inline-flex items-center rounded-lg px-2.5 py-1 text-[10px] font-black uppercase tracking-widest ${statusStyle.cls}`}>
                          {statusStyle.label}
                        </span>
                      </div>

                      <div className="flex items-center justify-between text-xs text-slate-500 bg-slate-50/80 rounded-xl px-3 py-2 gap-2">
                        <span className="font-bold truncate flex items-center gap-1.5">
                          <BookOpen className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                          {row.courses?.title || "Unknown Course"}
                        </span>
                        <span className="shrink-0 text-[11px] text-slate-400 font-medium">
                          {enrolledDate}
                        </span>
                      </div>

                      <div className="flex justify-end pt-1">
                        <EnrollmentActions enrollmentId={row.id} status={row.status} />
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Desktop Table View */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-50 bg-slate-50/50">
                      <th className="px-6 lg:px-8 py-5 text-left text-[10px] font-black uppercase tracking-widest text-slate-400">Student</th>
                      <th className="px-6 lg:px-8 py-5 text-left text-[10px] font-black uppercase tracking-widest text-slate-400">Course</th>
                      <th className="px-6 lg:px-8 py-5 text-left text-[10px] font-black uppercase tracking-widest text-slate-400">Status</th>
                      <th className="px-6 lg:px-8 py-5 text-left text-[10px] font-black uppercase tracking-widest text-slate-400">Joined</th>
                      <th className="px-6 lg:px-8 py-5 text-right text-[10px] font-black uppercase tracking-widest text-slate-400">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {rows.map((row) => {
                      const statusStyle = STATUS_LABEL[row.status] ?? { label: row.status, cls: "bg-slate-100 text-slate-600" };
                      const enrolledDate = new Date(row.enrolled_at).toLocaleDateString("en-ZM", { day: "numeric", month: "short", year: "numeric" });

                      return (
                        <tr key={row.id} className="hover:bg-slate-50/30 transition-colors">
                          <td className="px-6 lg:px-8 py-5">
                            <div className="flex items-center gap-4">
                              <div className="h-10 w-10 rounded-xl bg-slate-100 flex items-center justify-center font-black text-slate-400 shrink-0">
                                {(row.profiles?.full_name ?? row.profiles?.email ?? "?")[0]?.toUpperCase()}
                              </div>
                              <div>
                                <p className="font-black text-[#062e39]">{row.profiles?.full_name || "—"}</p>
                                <p className="text-xs text-slate-400">{row.profiles?.email || "—"}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 lg:px-8 py-5">
                            <div className="flex items-center gap-2">
                              <BookOpen className="h-4 w-4 text-slate-300 shrink-0" />
                              <span className="font-bold text-slate-600 truncate max-w-[200px]">{row.courses?.title || "Unknown Course"}</span>
                            </div>
                          </td>
                          <td className="px-6 lg:px-8 py-5">
                            <span className={`inline-flex items-center rounded-lg px-3 py-1 text-[10px] font-black uppercase tracking-widest ${statusStyle.cls}`}>
                              {statusStyle.label}
                            </span>
                          </td>
                          <td className="px-6 lg:px-8 py-5 text-slate-400 font-medium">{enrolledDate}</td>
                          <td className="px-6 lg:px-8 py-5 text-right">
                            <div className="flex justify-end">
                              <EnrollmentActions enrollmentId={row.id} status={row.status} />
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
