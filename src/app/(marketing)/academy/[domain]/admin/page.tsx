import Link from "next/link";
import {
  Building2, Users, BookOpen, Calendar,
  Play, Megaphone, Globe,
  Zap, GraduationCap, ChevronRight,
  Clock, Sparkles, PlusCircle, UserCheck, AlertCircle
} from "lucide-react";
import { TimetableCalendar } from "@/components/tenant/admin/TimetableCalendar";
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

  // 1. Fetch Stats
  const [
    { count: studentCount },
    { count: courseCount },
    { count: pendingCount },
    { data: schedules },
    { data: recentEnrollments }
  ] = await Promise.all([
    supabase.from("company_members").select("*", { count: "exact", head: true }).eq("company_id", company.id).eq("role", "learner"),
    supabase.from("courses").select("*", { count: "exact", head: true }).eq("company_id", company.id),
    supabase.from("enrollments").select("*", { count: "exact", head: true }).eq("company_id", company.id).eq("status", "pending"),
    supabase.from("class_schedules").select("*").eq("company_id", company.id).order("starts_at"),
    supabase.from("enrollments").select("id, status, enrolled_at, profiles(full_name, email)").eq("company_id", company.id).order("enrolled_at", { ascending: false }).limit(5)
  ]);

  const todaysClassCount = countTodaysSchedules(schedules);
  const upcomingClasses = (schedules || []).slice(0, 4);
  const base = `/academy/${company.slug}/admin`;

  return (
    <div className="container max-w-7xl px-4 py-6 md:py-10">
      <div className="mb-8 md:mb-10 flex flex-col gap-6 md:flex-row md:items-center justify-between">
        <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4 sm:gap-6 text-center sm:text-left">
          <div className="flex h-16 w-16 sm:h-24 sm:w-24 shrink-0 items-center justify-center rounded-2xl sm:rounded-[2rem] bg-white shadow-xl border border-slate-100 p-3 sm:p-5">
            {company.logo_url ? (
              <img src={company.logo_url} alt={company.name} className="h-full w-auto object-contain" />
            ) : (
              <Building2 className="h-8 w-8 sm:h-10 sm:w-10 text-[#062e39]" />
            )}
          </div>
          <div className="space-y-1">
            <h1 className="text-2xl sm:text-3xl md:text-5xl font-black text-[#062e39] tracking-tight leading-none uppercase">
              {company.name} <span className="text-[#fd5523]">Hub</span>
            </h1>
            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2.5 mt-3 sm:mt-4">
               <span className="px-3.5 py-1.5 rounded-full bg-[#fd5523]/10 text-[#fd5523] text-[10px] font-black uppercase tracking-[0.2em] border border-[#fd5523]/10">Command Center</span>
               <Link href={`/academy/${company.slug}`} target="_blank" className="px-3.5 py-1.5 rounded-full bg-slate-100 text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 hover:text-[#fd5523] hover:bg-[#fd5523]/5 flex items-center gap-2 transition-all border border-slate-200">
                 <Globe className="h-3 w-3" /> Visit Academy
               </Link>
            </div>
          </div>
        </div>
        <div className="flex items-center justify-center w-full md:w-auto">
           <Link
            href={`${base}/classroom?tab=session&action=start`}
            className="group w-full sm:w-auto justify-center flex items-center gap-3 h-14 sm:h-16 px-8 sm:px-10 rounded-2xl sm:rounded-[2rem] bg-[#fd5523] text-white text-xs font-black uppercase tracking-[0.2em] hover:scale-[1.02] active:scale-95 transition-all shadow-xl shadow-[#fd5523]/25"
          >
            <div className="h-8 w-8 rounded-full bg-white/20 flex items-center justify-center group-hover:scale-110 transition-transform">
              <Play className="h-4 w-4 fill-current" />
            </div>
            Start Live Class
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 md:gap-8">
        
        {/* Left Column: Stats & Timetable */}
        <div className="lg:col-span-8 space-y-6 md:space-y-8">
          
          {/* KPI Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
            {[
              { label: "Active Students", value: studentCount || 0, icon: Users, accent: "bg-blue-50 text-blue-600", href: `${base}/enrollments` },
              { label: "Total Courses", value: courseCount || 0, icon: BookOpen, accent: "bg-emerald-50 text-emerald-600", href: `${base}/courses` },
              { label: "Scheduled Today", value: todaysClassCount === 1 ? "1 Class" : `${todaysClassCount} Classes`, icon: Calendar, accent: "bg-amber-50 text-amber-600", href: `${base}/classroom?tab=timetable` },
              { label: "Pending Approvals", value: pendingCount || 0, icon: AlertCircle, accent: "bg-indigo-50 text-indigo-600", href: `${base}/enrollments?status=pending` },
            ].map((kpi) => (
              <Link
                key={kpi.label}
                href={kpi.href}
                className="bg-white rounded-2xl sm:rounded-[2rem] p-4 sm:p-6 border border-slate-100 shadow-sm hover:shadow-xl transition-all group block"
              >
                <div className={cn("h-10 w-10 sm:h-12 sm:w-12 rounded-xl sm:rounded-2xl flex items-center justify-center mb-4 sm:mb-6 group-hover:scale-110 transition-transform", kpi.accent)}>
                  <kpi.icon className="h-5 w-5 sm:h-6 sm:w-6" />
                </div>
                <div className="text-2xl sm:text-3xl font-black text-[#062e39] tracking-tight">{kpi.value}</div>
                <div className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mt-1.5 sm:mt-2">{kpi.label}</div>
              </Link>
            ))}
          </div>

          {/* School Timetable Calendar */}
          <div className="space-y-6">
            <div className="flex items-center justify-between px-4">
              <h2 className="text-2xl font-black text-[#062e39] uppercase tracking-tight flex items-center gap-4">
                <div className="h-10 w-10 rounded-xl bg-[#fd5523]/10 flex items-center justify-center">
                  <Calendar className="h-5 w-5 text-[#fd5523]" /> 
                </div>
                School Timetable
              </h2>
              <Link href={`/academy/${company.slug}/admin/classroom?tab=timetable`} className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 hover:text-[#fd5523] transition-colors bg-white px-4 py-2 rounded-full border border-slate-100 shadow-sm">
                Edit Schedule
              </Link>
            </div>
            <TimetableCalendar schedules={schedules || []} />
          </div>
        </div>

        {/* Right Column: Quick Actions & Recent Activity */}
        <div className="lg:col-span-4 space-y-8">
          
          {/* Quick Actions */}
          <div className="bg-[#062e39] rounded-3xl sm:rounded-[2.5rem] p-5 sm:p-8 shadow-2xl text-white relative overflow-hidden">
             <div className="absolute top-0 right-0 p-10 opacity-5 pointer-events-none">
                <Sparkles className="h-32 w-32" />
             </div>
             <h3 className="text-lg font-black uppercase tracking-widest mb-5 sm:mb-6 flex items-center gap-2">
               <Zap className="h-5 w-5 text-yellow-400" /> Quick Actions
             </h3>
             <div className="grid grid-cols-2 gap-3">
                {[
                  { label: "New Course", icon: PlusCircle, href: `${base}/courses/new` },
                  { label: "Broadcast", icon: Megaphone, href: `${base}/classroom?tab=announcements` },
                  { label: "Enrollments", icon: UserCheck, href: `${base}/enrollments` },
                  { label: "Staff", icon: GraduationCap, href: `${base}/staff` },
                ].map((action) => (
                  <Link
                    key={action.label}
                    href={action.href}
                    className="flex flex-col items-center justify-center p-4 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/5 transition-all text-center gap-2 group min-h-[84px]"
                  >
                    <div className="h-10 w-10 rounded-full bg-white/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                       <action.icon className="h-4 w-4" />
                    </div>
                    <span className="text-[10px] font-black uppercase tracking-widest">{action.label}</span>
                  </Link>
                ))}
             </div>
          </div>

          {/* Upcoming Classes Sidebar */}
          <div className="bg-white rounded-3xl sm:rounded-[2.5rem] p-5 sm:p-8 border border-slate-100 shadow-sm">
             <h3 className="text-sm font-black uppercase tracking-widest text-[#062e39] mb-5 sm:mb-6 flex items-center gap-2">
               <Clock className="h-4 w-4 text-[#fd5523]" /> Upcoming Classes
             </h3>
             <div className="space-y-4">
                {upcomingClasses.length > 0 ? upcomingClasses.map((item: any) => (
                  <Link
                    key={item.id}
                    href={`${base}/classroom?tab=timetable`}
                    className="flex items-center gap-4 group"
                  >
                    <div className="h-12 w-12 rounded-2xl bg-slate-50 flex flex-col items-center justify-center text-[#fd5523] border border-slate-100 shrink-0 group-hover:bg-[#fd5523] group-hover:text-white transition-all">
                       <span className="text-[10px] font-black">{item.start_time_only?.slice(0, 5) || "TBA"}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                       <p className="text-sm font-black text-[#062e39] truncate">{item.title}</p>
                       <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">
                         {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"][(item.day_of_week ?? 1) - 1] || "TBA"}
                       </p>
                    </div>
                    <ChevronRight className="h-4 w-4 text-slate-200 group-hover:text-[#fd5523] transition-colors" />
                  </Link>
                )) : (
                  <p className="text-xs text-slate-400 font-medium italic">No classes scheduled yet.</p>
                )}
             </div>
          </div>

          {/* Recent Activity */}
          <div className="bg-white rounded-3xl sm:rounded-[2.5rem] p-5 sm:p-8 border border-slate-100 shadow-sm">
             <h3 className="text-sm font-black uppercase tracking-widest text-[#062e39] mb-6 flex items-center gap-2">
               <GraduationCap className="h-4 w-4 text-[#fd5523]" /> New Enrollments
             </h3>
             <div className="space-y-5">
                {(recentEnrollments || []).map((enroll: any) => (
                  <div key={enroll.id} className="flex items-center gap-4">
                    <div className="h-9 w-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-black text-xs">
                       {enroll.profiles?.full_name?.[0] || "U"}
                    </div>
                    <div className="flex-1 min-w-0">
                       <p className="text-xs font-black text-[#062e39] truncate">{enroll.profiles?.full_name || "Unknown User"}</p>
                       <p className="text-[10px] text-slate-400 font-medium">{new Date(enroll.enrolled_at).toLocaleDateString()}</p>
                    </div>
                    <div className={cn(
                      "h-2 w-2 rounded-full",
                      enroll.status === "active" ? "bg-emerald-500" : "bg-amber-500"
                    )} />
                  </div>
                ))}
             </div>
             <Link href={`/academy/${company.slug}/admin/enrollments`} className="mt-8 block text-center py-3 rounded-2xl bg-slate-50 text-slate-400 text-[10px] font-black uppercase tracking-[0.2em] hover:bg-[#fff6ee] hover:text-[#fd5523] transition-all border border-transparent hover:border-[#fd5523]/10">
               View All Students
             </Link>
          </div>
        </div>

      </div>
    </div>
  );
}
