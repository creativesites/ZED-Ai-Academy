import { createServiceClient } from "@/lib/supabase/server";
import { auth } from "@clerk/nextjs/server";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import {
  Users, GraduationCap, Clock3, CheckCircle2, XCircle,
  Phone, MessageCircle, BookOpen, ShieldCheck,
} from "lucide-react";
import { EnrollmentActions } from "@/components/admin/enrollment-actions";

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
  revoked: { label: "Revoked", cls: "bg-red-100 text-red-700" },
};

export default async function TenantEnrollmentsPage({ params, searchParams }: PageProps) {
  const { domain } = await params;
  const { status: statusFilter = "all", q = "", course: courseFilter = "" } = await searchParams;
  const { userId } = await auth();

  if (!userId) redirect(`/sign-in?redirect_url=/academy/${domain}/admin/enrollments`);

  const supabase = createServiceClient();
  
  // 1. Fetch Company
  const { data: company } = await supabase
    .from("companies")
    .select("id, name, slug")
    .eq("slug", domain)
    .single();

  if (!company) notFound();

  // 2. Security Check
  const { data: membership } = await supabase
    .from("company_members")
    .select("role")
    .eq("company_id", company.id)
    .eq("profile_id", userId)
    .single();

  if (!membership || (membership.role !== "company_admin" && membership.role !== "teacher")) {
    redirect(`/academy/${company.slug}/classroom`);
  }

  // 3. Fetch Stats
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

  // 4. Fetch Enrollments
  let query = supabase
    .from("enrollments")
    .select("id, status, enrolled_at, student_phone, notes, course_id, user_id, courses(id, title, slug), profiles(full_name, email)")
    .eq("company_id", company.id)
    .order("enrolled_at", { ascending: false })
    .limit(200);

  if (statusFilter !== "all") query = query.eq("status", statusFilter as "active" | "pending_payment" | "revoked");

  const { data: rawRows } = await query;
  let rows = (rawRows ?? []) as unknown as EnrollmentRow[];

  // 5. Filtering
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

  // 6. Fetch Courses for filter
  const { data: allCourses } = await supabase
    .from("courses")
    .select("id, title")
    .eq("company_id", company.id)
    .order("title");

  const tabs = [
    { key: "all", label: "All", count: allCount ?? 0 },
    { key: "pending_payment", label: "Pending Payment", count: pendingCount ?? 0 },
    { key: "active", label: "Active", count: activeCount ?? 0 },
    { key: "revoked", label: "Revoked", count: revokedCount ?? 0 },
  ];

  return (
    <div className="container max-w-7xl py-12">
      <div className="space-y-10">
        
        {/* Header */}
        <div>
          <h1 className="text-4xl font-black tracking-tight text-[#062e39] uppercase">Enrollment Management</h1>
          <p className="text-slate-500 font-medium mt-2 text-lg">
            Manage student access and track payments for {company.name}.
          </p>
        </div>

        {/* KPI row */}
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {[
            { label: "Total Students", value: allCount ?? 0, icon: GraduationCap, accent: "bg-[#fff6ee] text-[#fd5523]" },
            { label: "Active Access", value: activeCount ?? 0, icon: CheckCircle2, accent: "bg-green-50 text-green-600" },
            { label: "Pending", value: pendingCount ?? 0, icon: Clock3, accent: "bg-amber-50 text-amber-600" },
            { label: "Revoked", value: revokedCount ?? 0, icon: XCircle, accent: "bg-red-50 text-red-500" },
          ].map((kpi) => (
            <div key={kpi.label} className="bg-white rounded-[2rem] border border-slate-100 p-6 shadow-sm">
              <div className={`mb-4 flex h-10 w-10 items-center justify-center rounded-2xl ${kpi.accent}`}>
                <kpi.icon className="h-5 w-5" />
              </div>
              <p className="text-3xl font-black tracking-tight text-[#062e39]">{kpi.value}</p>
              <p className="mt-1 text-xs font-black uppercase tracking-widest text-slate-400">{kpi.label}</p>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div className="bg-white rounded-[2.5rem] border border-slate-100 p-8 shadow-sm">
          <form method="GET" className="flex flex-col lg:flex-row items-center gap-6">
            <div className="flex flex-wrap gap-2 flex-1">
              {tabs.map((tab) => (
                <Link
                  key={tab.key}
                  href={`/academy/${company.slug}/admin/enrollments?status=${tab.key}${q ? `&q=${encodeURIComponent(q)}` : ""}${courseFilter ? `&course=${courseFilter}` : ""}`}
                  className={`flex items-center gap-2 rounded-xl px-5 py-2.5 text-xs font-black uppercase tracking-widest transition-all ${
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

            <div className="flex flex-col sm:flex-row items-center gap-3 w-full lg:w-auto">
              <input
                name="q"
                defaultValue={q}
                placeholder="Search students..."
                className="h-12 w-full sm:w-64 rounded-xl border border-slate-100 bg-slate-50 px-5 text-sm text-[#062e39] placeholder:text-slate-400 focus:bg-white focus:border-[#fd5523] outline-none transition-all"
              />
              <select
                name="course"
                defaultValue={courseFilter}
                className="h-12 w-full sm:w-48 rounded-xl border border-slate-100 bg-slate-50 px-4 text-sm text-[#062e39] focus:bg-white focus:border-[#fd5523] outline-none transition-all"
              >
                <option value="">All Courses</option>
                {(allCourses ?? []).map((c) => (
                  <option key={c.id} value={c.id}>{c.title}</option>
                ))}
              </select>
              <button
                type="submit"
                className="h-12 w-full sm:w-auto px-8 rounded-xl bg-[#062e39] text-white text-xs font-black uppercase tracking-widest hover:bg-[#0a3a48] transition-all"
              >
                Filter
              </button>
            </div>
          </form>
        </div>

        {/* Table */}
        <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm overflow-hidden">
          {rows.length === 0 ? (
            <div className="py-24 text-center">
              <Users className="mx-auto mb-4 h-16 w-16 text-slate-100" />
              <p className="text-slate-400 font-bold uppercase tracking-widest text-sm">No enrollments found</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-50 bg-slate-50/50">
                    <th className="px-8 py-5 text-left text-[10px] font-black uppercase tracking-widest text-slate-400">Student</th>
                    <th className="px-8 py-5 text-left text-[10px] font-black uppercase tracking-widest text-slate-400">Course</th>
                    <th className="px-8 py-5 text-left text-[10px] font-black uppercase tracking-widest text-slate-400">Status</th>
                    <th className="px-8 py-5 text-left text-[10px] font-black uppercase tracking-widest text-slate-400">Joined</th>
                    <th className="px-8 py-5 text-right text-[10px] font-black uppercase tracking-widest text-slate-400">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {rows.map((row) => {
                    const statusStyle = STATUS_LABEL[row.status] ?? { label: row.status, cls: "bg-slate-100 text-slate-600" };
                    const enrolledDate = new Date(row.enrolled_at).toLocaleDateString("en-ZM", { day: "numeric", month: "short", year: "numeric" });

                    return (
                      <tr key={row.id} className="hover:bg-slate-50/30 transition-colors">
                        <td className="px-8 py-6">
                          <div className="flex items-center gap-4">
                            <div className="h-10 w-10 rounded-xl bg-slate-100 flex items-center justify-center font-black text-slate-400">
                              {(row.profiles?.full_name ?? row.profiles?.email ?? "?")[0]?.toUpperCase()}
                            </div>
                            <div>
                              <p className="font-black text-[#062e39]">{row.profiles?.full_name || "—"}</p>
                              <p className="text-xs text-slate-400">{row.profiles?.email || "—"}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-8 py-6">
                          <div className="flex items-center gap-2">
                             <BookOpen className="h-4 w-4 text-slate-300" />
                             <span className="font-bold text-slate-600 truncate max-w-[200px]">{row.courses?.title || "Unknown Course"}</span>
                          </div>
                        </td>
                        <td className="px-8 py-6">
                          <span className={`inline-flex items-center rounded-lg px-3 py-1 text-[10px] font-black uppercase tracking-widest ${statusStyle.cls}`}>
                            {statusStyle.label}
                          </span>
                        </td>
                        <td className="px-8 py-6 text-slate-400 font-medium">{enrolledDate}</td>
                        <td className="px-8 py-6 text-right">
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
          )}
        </div>

      </div>
    </div>
  );
}
