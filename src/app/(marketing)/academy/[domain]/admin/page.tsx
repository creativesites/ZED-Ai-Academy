import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import Link from "next/link";
import { 
  Building2, Users, BookOpen, Calendar, Video, 
  UserPlus, Play, Megaphone, TrendingUp, Globe, 
  LayoutDashboard, Zap, GraduationCap, ChevronRight,
  Clock, Sparkles
} from "lucide-react";
import { TimetableCalendar } from "@/components/tenant/admin/TimetableCalendar";
import { cn } from "@/lib/utils";

export const metadata = {
  title: "Admin Hub",
};

export default async function AdminTenantHubPage({
  params,
}: {
  params: Promise<{ domain: string }>;
}) {
  const { domain } = await params;
  const supabase = createClient();

  const { data: company } = await supabase
    .from("companies")
    .select("*")
    .eq("slug", domain)
    .single();

  if (!company) notFound();

  // 1. Fetch Stats
  const [
    { count: studentCount },
    { count: courseCount },
    { data: schedules },
    { data: recentEnrollments }
  ] = await Promise.all([
    supabase.from("company_members").select("*", { count: "exact", head: true }).eq("company_id", company.id).eq("role", "learner"),
    supabase.from("courses").select("*", { count: "exact", head: true }).eq("company_id", company.id),
    supabase.from("class_schedules").select("*").eq("company_id", company.id).order("start_time"),
    supabase.from("enrollments").select("id, status, enrolled_at, profiles(full_name, email)").eq("company_id", company.id).order("enrolled_at", { ascending: false }).limit(5)
  ]);

  const upcomingClasses = (schedules || []).slice(0, 4);

  return (
    <div className="container max-w-7xl py-12">
      <div className="mb-12 flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex items-center gap-6">
          <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-white shadow-xl border border-slate-100 p-4">
            {company.logo_url ? (
              <img src={company.logo_url} alt="" className="h-full w-auto object-contain" />
            ) : (
              <Building2 className="h-10 w-10 text-[#062e39]" />
            )}
          </div>
          <div>
            <h1 className="text-4xl font-black text-[#062e39] tracking-tight uppercase">{company.name} Hub</h1>
            <div className="flex items-center gap-3 mt-2">
               <span className="px-3 py-1 rounded-lg bg-[#fd5523]/10 text-[#fd5523] text-[10px] font-black uppercase tracking-widest border border-[#fd5523]/10">Command Center</span>
               <Link href={`/academy/${company.slug}`} target="_blank" className="text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-[#fd5523] flex items-center gap-1 transition-colors">
                 <Globe className="h-3 w-3" /> zedai.academy/academy/{company.slug}
               </Link>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
           <Link 
            href={`/academy/${company.slug}/admin/classroom?tab=session&action=start`}
            className="flex items-center gap-2 h-14 px-8 rounded-2xl bg-[#fd5523] text-white text-xs font-black uppercase tracking-widest hover:scale-[1.02] active:scale-95 transition-all shadow-xl shadow-[#fd5523]/20"
          >
            <Play className="h-4 w-4" /> Start Live Class
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Left Column: Stats & Timetable */}
        <div className="lg:col-span-8 space-y-8">
          
          {/* KPI Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: "Active Students", value: studentCount || 0, icon: Users, accent: "bg-blue-50 text-blue-600" },
              { label: "Total Courses", value: courseCount || 0, icon: BookOpen, accent: "bg-emerald-50 text-emerald-600" },
              { label: "Scheduled Today", value: (schedules || []).length > 0 ? "3 Classes" : "0", icon: Calendar, accent: "bg-amber-50 text-amber-600" },
              { label: "Server Status", value: "Live", icon: Zap, accent: "bg-indigo-50 text-indigo-600" },
            ].map((kpi) => (
              <div key={kpi.label} className="bg-white rounded-[2rem] p-6 border border-slate-100 shadow-sm">
                <div className={cn("h-10 w-10 rounded-2xl flex items-center justify-center mb-4", kpi.accent)}>
                  <kpi.icon className="h-5 w-5" />
                </div>
                <div className="text-3xl font-black text-[#062e39] tracking-tight">{kpi.value}</div>
                <div className="text-[10px] font-black uppercase tracking-widest text-slate-400 mt-1">{kpi.label}</div>
              </div>
            ))}
          </div>

          {/* School Timetable Calendar */}
          <div className="space-y-6">
            <div className="flex items-center justify-between px-2">
              <h2 className="text-xl font-black text-[#062e39] uppercase tracking-tight flex items-center gap-3">
                <Calendar className="h-5 w-5 text-[#fd5523]" /> 
                School Timetable
              </h2>
              <Link href={`/academy/${company.slug}/admin/classroom?tab=timetable`} className="text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-[#fd5523] transition-colors">
                Edit Schedule
              </Link>
            </div>
            <TimetableCalendar schedules={schedules || []} />
          </div>
        </div>

        {/* Right Column: Quick Actions & Recent Activity */}
        <div className="lg:col-span-4 space-y-8">
          
          {/* Quick Actions */}
          <div className="bg-[#062e39] rounded-[2.5rem] p-8 shadow-2xl text-white relative overflow-hidden">
             <div className="absolute top-0 right-0 p-10 opacity-5 pointer-events-none">
                <Sparkles className="h-32 w-32" />
             </div>
             <h3 className="text-lg font-black uppercase tracking-widest mb-6 flex items-center gap-2">
               <Zap className="h-5 w-5 text-yellow-400" /> Quick Actions
             </h3>
             <div className="grid grid-cols-2 gap-3">
                {[
                  { label: "New Class", icon: UserPlus, href: `?action=add-student` },
                  { label: "Broadcast", icon: Megaphone, href: `?action=notice` },
                  { label: "Materials", icon: BookOpen, href: `/creator/courses` },
                  { label: "Staff", icon: GraduationCap, href: `?action=staff` },
                ].map((action) => (
                  <Link 
                    key={action.label}
                    href={action.href}
                    className="flex flex-col items-center justify-center p-4 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/5 transition-all text-center gap-2 group"
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
          <div className="bg-white rounded-[2.5rem] p-8 border border-slate-100 shadow-sm">
             <h3 className="text-sm font-black uppercase tracking-widest text-[#062e39] mb-6 flex items-center gap-2">
               <Clock className="h-4 w-4 text-[#fd5523]" /> Upcoming Classes
             </h3>
             <div className="space-y-4">
                {upcomingClasses.length > 0 ? upcomingClasses.map((item: any) => (
                  <div key={item.id} className="flex items-center gap-4 group cursor-pointer">
                    <div className="h-12 w-12 rounded-2xl bg-slate-50 flex flex-col items-center justify-center text-[#fd5523] border border-slate-100 shrink-0 group-hover:bg-[#fd5523] group-hover:text-white transition-all">
                       <span className="text-[10px] font-black">{item.start_time_only.slice(0, 5)}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                       <p className="text-sm font-black text-[#062e39] truncate">{item.title}</p>
                       <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">
                         {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"][item.day_of_week - 1]}
                       </p>
                    </div>
                    <ChevronRight className="h-4 w-4 text-slate-200 group-hover:text-[#fd5523] transition-colors" />
                  </div>
                )) : (
                  <p className="text-xs text-slate-400 font-medium italic">No classes scheduled yet.</p>
                )}
             </div>
          </div>

          {/* Recent Activity */}
          <div className="bg-white rounded-[2.5rem] p-8 border border-slate-100 shadow-sm">
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
