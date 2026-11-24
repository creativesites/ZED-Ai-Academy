import Link from "next/link";
import {
  Building2, Users, BookOpen, Calendar,
  Play, Megaphone, Globe,
  Zap, GraduationCap, ChevronRight,
  Clock, Sparkles, PlusCircle, UserCheck, AlertCircle
} from "lucide-react";
import { TimetableCalendar } from "@/components/tenant/admin/TimetableCalendar";
import { LaunchChecklistCard } from "@/components/tenant/admin/LaunchChecklistCard";
import { cn } from "@/lib/utils";
import { requireTenantAdminPage } from "@/lib/tenants/admin-guard";
import { countTodaysSchedules } from "@/lib/tenants/admin-helpers";

export const metadata = {
  title: "Admin Hub",
};

export default async function AdminTenantHubPage({
  params,
}: {
  params: Promise<{ domain: string }>;
}) {
  const { domain } = await params;
  const { supabase, company } = await requireTenantAdminPage(domain);

  // 1. Fetch Stats & Launch Readiness Signals
  const [
    { count: studentCount },
    { count: courseCount },
    { count: publishedCourseCount },
    { count: groupsCount },
    { count: pendingCount },
    { count: pendingGradingCount },
    { data: companyBrand },
    { data: schedules },
    { data: recentEnrollments },
  ] = await Promise.all([
    supabase.from("company_members").select("*", { count: "exact", head: true }).eq("company_id", company.id).eq("role", "learner"),
    supabase.from("courses").select("*", { count: "exact", head: true }).eq("company_id", company.id),
    supabase.from("courses").select("*", { count: "exact", head: true }).eq("company_id", company.id).eq("status", "published"),
    supabase.from("classroom_groups").select("*", { count: "exact", head: true }).eq("company_id", company.id),
    supabase.from("enrollments").select("*", { count: "exact", head: true }).eq("company_id", company.id).eq("status", "pending_payment"),
    supabase.from("classroom_assignment_submissions").select("*", { count: "exact", head: true }).eq("company_id", company.id).eq("status", "submitted"),
    supabase.from("companies").select("logo_url, home_content").eq("id", company.id).maybeSingle(),
    supabase.from("class_schedules").select("*").eq("company_id", company.id).order("starts_at"),
    supabase.from("enrollments").select("id, status, enrolled_at, profiles(full_name, email)").eq("company_id", company.id).order("enrolled_at", { ascending: false }).limit(5),
  ]);

  const todaysClassCount = countTodaysSchedules(schedules);
  const upcomingClasses = (schedules || []).slice(0, 4);
  const base = `/academy/${company.slug}/admin`;

  const hasCustomBrand = Boolean(
    companyBrand?.logo_url ||
      (companyBrand?.home_content &&
        typeof companyBrand.home_content === "object" &&
        Object.keys(companyBrand.home_content as Record<string, unknown>).length > 0)
  );

  const launchItems = [
    {
      id: "brand",
      title: "Customize Brand & Homepage",
      description: "Upload your logo, pick a template, and publish your storefront.",
      href: `${base}/settings/site`,
      cta: "Open Site Studio",
      done: hasCustomBrand,
    },
    {
      id: "course",
      title: "Publish Your First Course",
      description: "Build lessons, quizzes, and publish to your academy catalog.",
      href: (courseCount || 0) > 0 ? `${base}/courses` : `${base}/courses/new`,
      cta: (courseCount || 0) > 0 ? "Review Courses" : "Create Course",
      done: (publishedCourseCount || 0) > 0,
    },
    {
      id: "classroom",
      title: "Set Up Classes & Timetable",
      description: "Create a cohort/subject or schedule your first live session.",
      href: `${base}/classroom?tab=groups`,
      cta: "Configure Classroom",
      done: (groupsCount || 0) > 0 || (schedules?.length || 0) > 0,
    },
    {
      id: "learners",
      title: "Invite Your First Learner",
      description: "Send invites or import students via CSV to start teaching.",
      href: `${base}/enrollments`,
      cta: "Invite Students",
      done: (studentCount || 0) > 0,
    },
  ];

  return (
    <div className="container max-w-7xl px-4 py-6 md:py-8">
      <div className="mb-6 md:mb-8 flex flex-col gap-4 md:flex-row md:items-center justify-between">
        <div className="flex flex-col sm:flex-row items-center sm:items-center gap-4 text-center sm:text-left">
          <div className="flex h-14 w-14 sm:h-16 sm:w-16 shrink-0 items-center justify-center rounded-2xl bg-white shadow-sm border border-slate-200/80 p-2.5 sm:p-3">
            {company.logo_url ? (
              <img src={company.logo_url} alt={company.name} className="h-full w-auto object-contain" />
            ) : (
              <Building2 className="h-7 w-7 text-[#062e39]" />
            )}
          </div>
          <div className="space-y-1.5">
            <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-[#062e39] tracking-tight leading-tight">
              {company.name} <span className="text-[#fd5523]">Hub</span>
            </h1>
            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
               <span className="px-2.5 py-1 rounded-full bg-[#fd5523]/10 text-[#fd5523] text-[10px] font-bold uppercase tracking-wider">Command Center</span>
               <Link href={`/academy/${company.slug}`} target="_blank" className="px-2.5 py-1 rounded-full bg-slate-100 text-[10px] font-bold uppercase tracking-wider text-slate-600 hover:text-[#fd5523] hover:bg-[#fd5523]/5 flex items-center gap-1.5 transition-all border border-slate-200">
                 <Globe className="h-3 w-3" /> Visit Academy
               </Link>
            </div>
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-2.5 w-full md:w-auto">
           <Link
            href={`${base}/ai-teachers`}
            className="w-full sm:w-auto justify-center flex items-center gap-2 h-10 px-4 rounded-xl bg-[#062e39] text-white text-xs font-semibold hover:bg-[#0a4352] transition-all shadow-xs"
          >
            <Sparkles className="h-3.5 w-3.5 text-amber-300" />
            AI Teachers
          </Link>
           <Link
            href={`${base}/classroom?tab=session&action=start`}
            className="group w-full sm:w-auto justify-center flex items-center gap-2 h-10 px-4 rounded-xl bg-[#fd5523] hover:bg-[#e0481d] text-white text-xs font-semibold transition-all shadow-xs"
          >
            <div className="h-5 w-5 rounded-full bg-white/20 flex items-center justify-center group-hover:scale-105 transition-transform">
              <Play className="h-3 w-3 fill-current" />
            </div>
            Start Live Class
          </Link>
        </div>
      </div>

      <LaunchChecklistCard companySlug={company.slug} items={launchItems} />

      {(pendingGradingCount || 0) > 0 && (
        <Link
          href={`${base}/classroom?tab=assignments`}
          className="mb-6 flex items-center justify-between gap-3 px-4 py-3 rounded-2xl bg-amber-50 border border-amber-200/80 text-amber-900 hover:bg-amber-100/70 transition-colors"
        >
          <div className="flex items-center gap-2.5 text-xs font-bold">
            <AlertCircle className="h-4 w-4 text-amber-600 shrink-0" />
            <span>
              {pendingGradingCount}{" "}
              {pendingGradingCount === 1 ? "assignment submission is" : "assignment submissions are"}{" "}
              waiting for your review.
            </span>
          </div>
          <span className="text-[11px] font-black uppercase tracking-wider text-amber-800 flex items-center gap-1 shrink-0">
            Grade Now <ChevronRight className="h-3.5 w-3.5" />
          </span>
        </Link>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 md:gap-6">
        
        {/* Left Column: Stats & Timetable */}
        <div className="lg:col-span-8 space-y-6">
          
          {/* KPI Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: "Active Students", value: studentCount || 0, icon: Users, accent: "bg-blue-50 text-blue-600", href: `${base}/enrollments` },
              { label: "Total Courses", value: courseCount || 0, icon: BookOpen, accent: "bg-emerald-50 text-emerald-600", href: `${base}/courses` },
              { label: "Scheduled Today", value: todaysClassCount === 1 ? "1 Class" : `${todaysClassCount} Classes`, icon: Calendar, accent: "bg-amber-50 text-amber-600", href: `${base}/classroom?tab=timetable` },
              { label: "Pending Approvals", value: pendingCount || 0, icon: AlertCircle, accent: "bg-indigo-50 text-indigo-600", href: `${base}/enrollments?status=pending_payment` },
            ].map((kpi) => (
              <Link
                key={kpi.label}
                href={kpi.href}
                className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200/80 shadow-xs hover:shadow-md hover:border-slate-300 transition-all group block"
              >
                <div className={cn("h-9 w-9 rounded-xl flex items-center justify-center mb-3 group-hover:scale-105 transition-transform", kpi.accent)}>
                  <kpi.icon className="h-4.5 w-4.5" />
                </div>
                <div className="text-xl sm:text-2xl font-bold text-[#062e39] tracking-tight">{kpi.value}</div>
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mt-1">{kpi.label}</div>
              </Link>
            ))}
          </div>

          {/* School Timetable Calendar */}
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-lg sm:text-xl font-bold text-[#062e39] tracking-tight flex items-center gap-2.5">
                <div className="h-8 w-8 rounded-xl bg-[#fd5523]/10 flex items-center justify-center shrink-0">
                  <Calendar className="h-4 w-4 text-[#fd5523]" />
                </div>
                School Timetable
              </h2>
              <Link href={`/academy/${company.slug}/admin/classroom?tab=timetable`} className="text-xs font-semibold text-slate-600 hover:text-[#fd5523] transition-colors bg-white px-3.5 py-1.5 rounded-xl border border-slate-200/80 shadow-xs">
                Edit Schedule
              </Link>
            </div>
            <TimetableCalendar schedules={schedules || []} companySlug={company.slug} />
          </div>
        </div>

        {/* Right Column: Quick Actions & Recent Activity */}
        <div className="lg:col-span-4 space-y-6">
          
          {/* Quick Actions */}
          <div className="bg-[#062e39] rounded-2xl p-5 sm:p-6 shadow-sm text-white relative overflow-hidden">
             <div className="absolute top-0 right-0 p-8 opacity-5 pointer-events-none">
                <Sparkles className="h-28 w-28" />
             </div>
             <h3 className="text-sm font-bold uppercase tracking-wider mb-4 flex items-center gap-2">
               <Zap className="h-4 w-4 text-yellow-400" /> Quick Actions
             </h3>
             <div className="grid grid-cols-2 gap-2.5">
                {[
                  { label: "New Course", icon: PlusCircle, href: `${base}/courses/new` },
                  { label: "Broadcast", icon: Megaphone, href: `${base}/classroom?tab=noticeboard` },
                  { label: "Enrollments", icon: UserCheck, href: `${base}/enrollments` },
                  { label: "Staff", icon: GraduationCap, href: `${base}/staff` },
                ].map((action) => (
                  <Link
                    key={action.label}
                    href={action.href}
                    className="flex flex-col items-center justify-center p-3.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 transition-all text-center gap-2 group min-h-[76px]"
                  >
                    <div className="h-9 w-9 rounded-full bg-white/10 flex items-center justify-center group-hover:scale-105 transition-transform">
                       <action.icon className="h-4 w-4" />
                    </div>
                    <span className="text-xs font-semibold">{action.label}</span>
                  </Link>
                ))}
             </div>
          </div>

          {/* Upcoming Classes Sidebar */}
          <div className="bg-white rounded-2xl p-5 sm:p-6 border border-slate-200/80 shadow-xs">
             <h3 className="text-xs font-bold uppercase tracking-wider text-[#062e39] mb-4 flex items-center gap-2">
               <Clock className="h-4 w-4 text-[#fd5523]" /> Upcoming Classes
             </h3>
             <div className="space-y-3.5">
                {upcomingClasses.length > 0 ? upcomingClasses.map((item: any) => (
                  <Link
                    key={item.id}
                    href={`${base}/classroom?tab=timetable`}
                    className="flex items-center gap-3 group"
                  >
                    <div className="h-10 w-10 rounded-xl bg-slate-50 flex flex-col items-center justify-center text-[#fd5523] border border-slate-200/80 shrink-0 group-hover:bg-[#fd5523] group-hover:text-white transition-all">
                       <span className="text-[10px] font-bold">{item.start_time_only?.slice(0, 5) || "TBA"}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                       <p className="text-xs sm:text-sm font-semibold text-[#062e39] truncate">{item.title}</p>
                       <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">
                         {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"][(item.day_of_week ?? 1) - 1] || "TBA"}
                       </p>
                    </div>
                    <ChevronRight className="h-4 w-4 text-slate-300 group-hover:text-[#fd5523] transition-colors" />
                  </Link>
                )) : (
                  <p className="text-xs text-slate-400 font-medium italic">No classes scheduled yet.</p>
                )}
             </div>
          </div>

          {/* Recent Activity */}
          <div className="bg-white rounded-2xl p-5 sm:p-6 border border-slate-200/80 shadow-xs">
             <h3 className="text-xs font-bold uppercase tracking-wider text-[#062e39] mb-4 flex items-center gap-2">
               <GraduationCap className="h-4 w-4 text-[#fd5523]" /> New Enrollments
             </h3>
             <div className="space-y-3.5">
                {(recentEnrollments || []).map((enroll: any) => (
                  <div key={enroll.id} className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold text-xs">
                       {enroll.profiles?.full_name?.[0] || "U"}
                    </div>
                    <div className="flex-1 min-w-0">
                       <p className="text-xs font-semibold text-[#062e39] truncate">{enroll.profiles?.full_name || "Unknown User"}</p>
                       <p className="text-[10px] text-slate-400">{new Date(enroll.enrolled_at).toLocaleDateString()}</p>
                    </div>
                    <div className={cn(
                      "h-2 w-2 rounded-full",
                      enroll.status === "active" ? "bg-emerald-500" : "bg-amber-500"
                    )} />
                  </div>
                ))}
             </div>
             <Link href={`/academy/${company.slug}/admin/enrollments`} className="mt-5 block text-center py-2.5 rounded-xl bg-slate-50 text-slate-600 text-xs font-semibold hover:bg-[#fff6ee] hover:text-[#fd5523] transition-all border border-slate-200/70">
               View All Students
             </Link>
          </div>
        </div>

      </div>
    </div>
  );
}
