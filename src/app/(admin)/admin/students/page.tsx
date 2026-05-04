import { createServiceClient } from "@/lib/supabase/server";
import Link from "next/link";
import {
  Users, GraduationCap, Clock3, CheckCircle2, XCircle,
  Phone, MessageCircle, BookOpen, ShieldCheck,
} from "lucide-react";
import { EnrollmentActions } from "@/components/admin/enrollment-actions";

export const metadata = { title: "Student Management — Zed AI Academy Admin" };

type PageProps = {
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
  revoked: { label: "Revoked", cls: "bg-red-100 text-red-700" },
};

export default async function StudentsPage({ searchParams }: PageProps) {
  const { status: statusFilter = "all", q = "", course: courseFilter = "" } =
    await searchParams;

  const supabase = createServiceClient();

  // Counts by status for tab badges
  const [
    { count: activeCount },
    { count: pendingCount },
    { count: revokedCount },
    { count: allCount },
  ] = await Promise.all([
    supabase.from("enrollments").select("*", { head: true, count: "exact" }).eq("status", "active"),
    supabase.from("enrollments").select("*", { head: true, count: "exact" }).eq("status", "pending_payment"),
    supabase.from("enrollments").select("*", { head: true, count: "exact" }).eq("status", "revoked"),
    supabase.from("enrollments").select("*", { head: true, count: "exact" }),
  ]);

  // Fetch enrollments with profiles + courses
  let query = supabase
    .from("enrollments")
    .select("id, status, enrolled_at, student_phone, notes, course_id, user_id, courses(id, title, slug), profiles(full_name, email)")
    .order("enrolled_at", { ascending: false })
    .limit(200);

  if (statusFilter !== "all") query = query.eq("status", statusFilter as "active" | "pending_payment" | "revoked");

  const { data: rawRows } = await query;
  let rows = (rawRows ?? []) as unknown as EnrollmentRow[];

  // Client-side filter by search query
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

  // Fetch all courses for the filter dropdown
  const { data: allCourses } = await supabase
    .from("courses")
    .select("id, title")
    .order("title");

  const tabs = [
    { key: "all", label: "All", count: allCount ?? 0 },
    { key: "pending_payment", label: "Pending Payment", count: pendingCount ?? 0 },
    { key: "active", label: "Active", count: activeCount ?? 0 },
    { key: "revoked", label: "Revoked", count: revokedCount ?? 0 },
  ];

  return (
    <div className="container" style={{ paddingTop: "60px", paddingBottom: "80px" }}>
      <div className="space-y-8">

        {/* Header */}
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div
              className="marketing-kicker bg-[#fff6ee] text-[#fd5523]"
              style={{ display: "inline-flex", marginBottom: "16px" }}
            >
              <ShieldCheck style={{ width: "14px", height: "14px", marginRight: "8px" }} />
              Admin · LMS
            </div>
            <h1 className="text-4xl font-bold tracking-tight text-[#062e39]">
              Student Management
            </h1>
            <p className="mt-2 text-slate-500">
              Activate payments, manage access, and track learner progress.
            </p>
          </div>
          <Link
            href="/admin"
            className="rounded-full border border-slate-200 px-5 py-2.5 text-sm font-bold text-slate-500 hover:bg-slate-50 transition-colors"
          >
            ← Back to Dashboard
          </Link>
        </div>

        {/* KPI row */}
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {[
            { label: "Total Enrollments", value: allCount ?? 0, icon: GraduationCap, accent: "bg-[#fff6ee] text-[#fd5523]" },
            { label: "Active", value: activeCount ?? 0, icon: CheckCircle2, accent: "bg-green-50 text-green-600" },
            { label: "Pending Payment", value: pendingCount ?? 0, icon: Clock3, accent: "bg-amber-50 text-amber-600" },
            { label: "Revoked", value: revokedCount ?? 0, icon: XCircle, accent: "bg-red-50 text-red-500" },
          ].map((kpi) => (
            <div key={kpi.label} className="marketing-outline-card rounded-[2rem] border-0 p-5">
              <div className={`mb-3 flex h-10 w-10 items-center justify-center rounded-2xl ${kpi.accent}`}>
                <kpi.icon className="h-5 w-5" />
              </div>
              <p className="text-3xl font-bold tracking-tight text-[#062e39]">{kpi.value}</p>
              <p className="mt-1 text-xs font-bold uppercase tracking-widest text-slate-400">{kpi.label}</p>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div className="marketing-card rounded-[2rem] border-0 p-5">
          <form method="GET" className="flex flex-wrap items-end gap-4">
            {/* Status tabs */}
            <div className="flex flex-wrap gap-2">
              {tabs.map((tab) => (
                <Link
                  key={tab.key}
                  href={`/admin/students?status=${tab.key}${q ? `&q=${encodeURIComponent(q)}` : ""}${courseFilter ? `&course=${courseFilter}` : ""}`}
                  className={`flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-bold transition-colors ${
                    statusFilter === tab.key
                      ? "bg-[#062e39] text-white"
                      : "border border-slate-200 text-slate-500 hover:bg-slate-50"
                  }`}
                >
                  {tab.label}
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                    statusFilter === tab.key ? "bg-white/20 text-white" : "bg-slate-100 text-slate-500"
                  }`}>
                    {tab.count}
                  </span>
                </Link>
              ))}
            </div>

            {/* Search */}
            <input
              name="q"
              defaultValue={q}
              placeholder="Search name, email, phone…"
              className="h-10 flex-1 min-w-[200px] rounded-xl border border-slate-200 bg-white px-4 text-sm text-[#062e39] placeholder:text-slate-400 focus:border-[#fd5523] focus:outline-none"
            />

            {/* Course filter */}
            <select
              name="course"
              defaultValue={courseFilter}
              className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm text-[#062e39] focus:border-[#fd5523] focus:outline-none"
            >
              <option value="">All Courses</option>
              {(allCourses ?? []).map((c) => (
                <option key={c.id} value={c.id}>{c.title}</option>
              ))}
            </select>

            {/* Preserve status in form submit */}
            <input type="hidden" name="status" value={statusFilter} />

            <button
              type="submit"
              className="h-10 rounded-xl bg-[#062e39] px-5 text-sm font-bold text-white hover:bg-[#0a4055] transition-colors"
            >
              Search
            </button>
          </form>
        </div>

        {/* Enrollments table */}
        <div className="marketing-card overflow-hidden rounded-[2rem] border-0">
          {rows.length === 0 ? (
            <div className="py-20 text-center">
              <Users className="mx-auto mb-4 h-12 w-12 text-slate-200" />
              <p className="text-slate-400 font-medium">No enrollments found</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[700px] text-sm">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/60">
                    <th className="px-5 py-3.5 text-left text-[10px] font-bold uppercase tracking-widest text-slate-400">Student</th>
                    <th className="px-5 py-3.5 text-left text-[10px] font-bold uppercase tracking-widest text-slate-400">Course</th>
                    <th className="px-5 py-3.5 text-left text-[10px] font-bold uppercase tracking-widest text-slate-400">Status</th>
                    <th className="px-5 py-3.5 text-left text-[10px] font-bold uppercase tracking-widest text-slate-400">Phone</th>
                    <th className="px-5 py-3.5 text-left text-[10px] font-bold uppercase tracking-widest text-slate-400">Enrolled</th>
                    <th className="px-5 py-3.5 text-left text-[10px] font-bold uppercase tracking-widest text-slate-400">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {rows.map((row) => {
                    const statusStyle = STATUS_LABEL[row.status] ?? { label: row.status, cls: "bg-slate-100 text-slate-600" };
                    const enrolledDate = new Date(row.enrolled_at).toLocaleDateString("en-ZM", { day: "numeric", month: "short", year: "numeric" });

                    return (
                      <tr key={row.id} className="hover:bg-slate-50/50 transition-colors">
                        {/* Student */}
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-3">
                            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#fff6ee] text-sm font-bold text-[#fd5523]">
                              {(row.profiles?.full_name ?? row.profiles?.email ?? "?")[0]?.toUpperCase()}
                            </div>
                            <div className="min-w-0">
                              <p className="font-semibold text-[#062e39] truncate max-w-[160px]">
                                {row.profiles?.full_name ?? "—"}
                              </p>
                              <p className="text-xs text-slate-400 truncate max-w-[160px]">
                                {row.profiles?.email ?? "—"}
                              </p>
                            </div>
                          </div>
                        </td>

                        {/* Course */}
                        <td className="px-5 py-4">
                          {row.courses ? (
                            <Link
                              href={`/creator/courses`}
                              className="flex items-center gap-1.5 font-medium text-[#062e39] hover:text-[#fd5523] transition-colors"
                            >
                              <BookOpen className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                              <span className="truncate max-w-[160px]">{row.courses.title}</span>
                            </Link>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </td>

                        {/* Status */}
                        <td className="px-5 py-4">
                          <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${statusStyle.cls}`}>
                            {statusStyle.label}
                          </span>
                        </td>

                        {/* Phone */}
                        <td className="px-5 py-4">
                          {row.student_phone ? (
                            <div className="flex items-center gap-2">
                              <Phone className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                              <span className="text-slate-600">{row.student_phone}</span>
                              {row.status === "pending_payment" && (
                                <a
                                  href={`https://wa.me/${row.student_phone.replace(/\D/g, "")}?text=${encodeURIComponent(`Hi! Your enrollment for "${row.courses?.title ?? "the course"}" has been confirmed. You now have full access. Welcome aboard! 🎓`)}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  title="Message on WhatsApp"
                                  className="flex h-6 w-6 items-center justify-center rounded-full bg-[#25D366] text-white hover:bg-[#20bd5a] transition-colors"
                                >
                                  <MessageCircle className="h-3 w-3" />
                                </a>
                              )}
                            </div>
                          ) : (
                            <span className="text-slate-300">—</span>
                          )}
                        </td>

                        {/* Date */}
                        <td className="px-5 py-4 text-slate-500">{enrolledDate}</td>

                        {/* Actions */}
                        <td className="px-5 py-4">
                          <EnrollmentActions
                            enrollmentId={row.id}
                            status={row.status}
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          {rows.length > 0 && (
            <div className="border-t border-slate-100 px-5 py-3">
              <p className="text-xs text-slate-400">{rows.length} enrollment{rows.length !== 1 ? "s" : ""} shown</p>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
