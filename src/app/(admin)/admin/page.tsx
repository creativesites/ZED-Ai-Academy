import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { createServiceClient } from "@/lib/supabase/server";
import Link from "next/link";
import { Users, BookOpen, GraduationCap, DollarSign, Star, TrendingUp, Layers, ShieldCheck, Image as ImageIcon, UserCheck, MessageSquare } from "lucide-react";

type AdminUser = { id: string; full_name: string | null; email: string | null; role: string; created_at: string };
type AdminCourse = { id: string; title: string; status: string; instructor_id: string; created_at: string; profiles: { full_name: string | null } | null };

export const metadata = { title: "Admin Dashboard — Zed AI Academy" };

export default async function AdminPage() {
  const { userId } = await auth();
  const supabase = createServiceClient();

  if (userId) {
    const { data: p } = await supabase.from("profiles").select("role").eq("id", userId).single();
    if (p?.role !== "super_admin") redirect("/dashboard");
  }

  const [
    { count: totalUsers },
    { count: totalCourses },
    { count: publishedCourses },
    { count: totalEnrollments },
    { count: totalCertificates },
    { data: revenueData },
    { data: recentUsers },
    { data: recentCourses },
    { data: reviewData },
  ] = await Promise.all([
    supabase.from("profiles").select("*", { head: true, count: "exact" }),
    supabase.from("courses").select("*", { head: true, count: "exact" }),
    supabase.from("courses").select("*", { head: true, count: "exact" }).eq("status", "published"),
    supabase.from("enrollments").select("*", { head: true, count: "exact" }),
    supabase.from("certificates").select("*", { head: true, count: "exact" }),
    supabase.from("orders").select("amount").eq("status", "paid"),
    supabase.from("profiles").select("id, full_name, email, role, created_at").order("created_at", { ascending: false }).limit(10),
    supabase.from("courses").select("id, title, status, instructor_id, created_at, profiles(full_name)").order("created_at", { ascending: false }).limit(8),
    supabase.from("reviews").select("rating"),
  ]);

  const users = (recentUsers ?? []) as AdminUser[];
  const courses = (recentCourses ?? []) as AdminCourse[];
  const totalRevenue = (revenueData ?? []).reduce((sum, o) => sum + (o.amount ?? 0), 0);
  const avgRating = (reviewData ?? []).length > 0
    ? ((reviewData ?? []).reduce((s, r) => s + r.rating, 0) / (reviewData ?? []).length).toFixed(1)
    : "–";

  const kpis = [
    { label: "Total Users", value: totalUsers ?? 0, icon: Users, accent: "bg-blue-50 text-blue-600" },
    { label: "Published Courses", value: publishedCourses ?? 0, icon: BookOpen, accent: "bg-[#fff6ee] text-[#fd5523]" },
    { label: "Enrollments", value: totalEnrollments ?? 0, icon: GraduationCap, accent: "bg-[#fff6ee] text-[#fd5523]" },
    { label: "Certificates Issued", value: totalCertificates ?? 0, icon: ShieldCheck, accent: "bg-green-50 text-green-600" },
    { label: "Revenue (ZMW)", value: totalRevenue > 0 ? totalRevenue.toLocaleString() : "–", icon: DollarSign, accent: "bg-amber-50 text-amber-600" },
    { label: "Avg. Rating", value: avgRating, icon: Star, accent: "bg-amber-50 text-amber-600" },
    { label: "Total Courses", value: totalCourses ?? 0, icon: Layers, accent: "bg-slate-50 text-slate-600" },
    { label: "Growth", value: `${totalEnrollments && totalUsers ? Math.round(((totalEnrollments ?? 0) / (totalUsers ?? 1)) * 100) : 0}%`, icon: TrendingUp, accent: "bg-green-50 text-green-600" },
  ];

  const roleColors: Record<string, string> = {
    super_admin: "#fee2e2",
    instructor: "#fff7ed",
    company_admin: "#eff6ff",
    learner: "#f0fdf4",
  };

  return (
    <div className="container" style={{ paddingTop: "60px", paddingBottom: "80px" }}>
      <div className="space-y-10">

        {/* Header */}
        <div>
          <div className="marketing-kicker bg-[#fff6ee] text-[#fd5523]" style={{ display: "inline-flex", marginBottom: "16px" }}>
            <ShieldCheck style={{ width: "14px", height: "14px", marginRight: "8px" }} />
            Super Admin
          </div>
          <h1 className="text-4xl font-bold tracking-tight text-[#062e39]">Platform Dashboard</h1>
          <p className="mt-2 text-slate-500">Real-time overview of Zed AI Academy.</p>
        </div>

        {/* KPI grid */}
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {kpis.map((kpi) => (
            <div key={kpi.label} className="marketing-outline-card rounded-[2rem] border-0 p-5">
              <div className={`mb-4 flex h-10 w-10 items-center justify-center rounded-2xl ${kpi.accent}`}>
                <kpi.icon className="h-5 w-5" />
              </div>
              <p className="text-3xl font-bold tracking-tight text-[#062e39]">{kpi.value}</p>
              <p className="mt-1 text-xs font-bold uppercase tracking-widest text-slate-400">{kpi.label}</p>
            </div>
          ))}
        </div>

        <div className="grid gap-8 lg:grid-cols-2">

          {/* Recent users */}
          <div className="marketing-card rounded-[2.5rem] border-0 p-8">
            <div className="mb-6 flex items-center justify-between">
              <h2 className="text-lg font-bold text-[#062e39]">Recent Signups</h2>
              <span className="text-xs font-bold uppercase tracking-widest text-slate-400">{totalUsers} total</span>
            </div>
            <div className="space-y-3">
              {users.map((user) => (
                <div key={user.id} className="flex items-center gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl font-bold text-sm" style={{ background: roleColors[user.role] ?? "#f5f5f5", color: "#062e39" }}>
                    {(user.full_name ?? user.email ?? "?")[0]?.toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-[#062e39] truncate">{user.full_name ?? user.email ?? "Unknown"}</p>
                    <p className="text-xs text-slate-400">{user.email}</p>
                  </div>
                  <span className="text-xs font-bold uppercase tracking-wider px-2 py-0.5 rounded-full" style={{ background: roleColors[user.role] ?? "#f5f5f5", color: "#555" }}>
                    {user.role}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Recent courses */}
          <div className="marketing-card rounded-[2.5rem] border-0 p-8">
            <div className="mb-6 flex items-center justify-between">
              <h2 className="text-lg font-bold text-[#062e39]">Recent Courses</h2>
              <span className="text-xs font-bold uppercase tracking-widest text-slate-400">{totalCourses} total</span>
            </div>
            <div className="space-y-3">
              {courses.map((course) => {
                const statusColors: Record<string, string> = {
                  published: "bg-green-100 text-green-700",
                  draft: "bg-amber-100 text-amber-700",
                  archived: "bg-slate-100 text-slate-600",
                };
                return (
                  <div key={course.id} className="flex items-center gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#fff6ee] text-[#fd5523]">
                      <BookOpen className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <Link href={`/creator/courses/${course.id}`} className="text-sm font-semibold text-[#062e39] hover:text-[#fd5523] truncate block">
                        {course.title}
                      </Link>
                      <p className="text-xs text-slate-400">
                        {course.profiles?.full_name ?? "Unknown instructor"}
                      </p>
                    </div>
                    <span className={`text-xs font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${statusColors[course.status] ?? "bg-slate-100 text-slate-600"}`}>
                      {course.status}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

        </div>

        {/* Quick actions */}
        <div className="marketing-outline-card rounded-[2.5rem] border-0 p-8">
          <h2 className="mb-6 text-lg font-bold text-[#062e39]">Quick Actions</h2>
          <div className="flex flex-wrap gap-4">
            {[
              { label: "View All Courses", href: "/creator/courses", icon: BookOpen },
              { label: "Student Management", href: "/admin/students", icon: UserCheck },
              { label: "Manage Users", href: "/admin/users", icon: Users },
              { label: "Manage Contacts", href: "/admin/contacts", icon: MessageSquare },
              { label: "Manage Images", href: "/admin/images", icon: ImageIcon },
              { label: "Create Coupon", href: "/admin/coupons", icon: DollarSign },
            ].map(({ label, href, icon: Icon }) => (
              <Link
                key={label}
                href={href}
                className="flex items-center gap-2 rounded-full border border-slate-200 px-5 py-3 text-sm font-bold text-[#062e39] hover:bg-[#fff6ee] hover:border-[#fd5523] hover:text-[#fd5523] transition-all"
              >
                <Icon className="h-4 w-4" />
                {label}
              </Link>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}
