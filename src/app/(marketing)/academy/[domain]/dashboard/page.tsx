import { auth } from "@clerk/nextjs/server";
import { createClient } from "@/lib/supabase/server";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { 
  ArrowRight, Award, BookOpen, Clock3, GraduationCap, 
  Play, Sparkles, Trophy, Users, Layout, Building2
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { Enrollment, Course } from "@/types/database";

export const metadata = { title: "Student Dashboard" };

type EnrollmentWithCourse = Enrollment & {
  courses: Pick<Course, "id" | "slug" | "title" | "thumbnail_url" | "category"> | null;
};

import { TenantNavbar } from "@/components/tenant/TenantNavbar";

export default async function TenantStudentDashboardPage({
  params,
}: {
  params: Promise<{ domain: string }>;
}) {
  const { domain } = await params;
  const { userId } = await auth();
  if (!userId) redirect(`/sign-in?redirect_url=/academy/${domain}/dashboard`);

  const supabase = createClient();
  
  // 1. Fetch Company
  const { data: company } = await supabase
    .from("companies")
    .select("id, name, slug, logo_url, primary_color")
    .eq("slug", domain)
    .single();

  if (!company) notFound();

  // 2. Fetch User Profile
  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("id", userId)
    .single();

  const firstName = profile?.full_name?.split(" ")[0] ?? "there";

  // 3. Fetch Enrollments for THIS company
  const { data: enrollmentsData } = await supabase
    .from("enrollments")
    .select("*, courses(id, slug, title, thumbnail_url, category)")
    .eq("user_id", userId)
    .eq("company_id", company.id)
    .in("status", ["active", "pending_payment"])
    .order("enrolled_at", { ascending: false });

  const enrollments = (enrollmentsData ?? []) as EnrollmentWithCourse[];

  const completedCount = enrollments.filter((e) => e.completed_at).length;
  const inProgressCount = enrollments.length - completedCount;

  return (
    <div className="bg-slate-50 min-h-screen">
      <TenantNavbar tenant={company} />
      
      <div className="py-12">
        <div className="container max-w-7xl space-y-12">

        
        {/* Hero Section */}
        <section className="relative overflow-hidden rounded-[4rem] bg-[#062e39] p-10 md:p-24 text-white shadow-2xl">
          <div className="absolute top-0 right-0 p-12 opacity-10 pointer-events-none">
             <GraduationCap className="h-64 w-64" />
          </div>
          <div className="absolute bottom-[-100px] left-[-100px] w-80 h-80 bg-[#fd5523] rounded-full blur-[120px] opacity-20" />
          
          <div className="relative z-10 max-w-3xl">
            <div className="inline-flex items-center gap-3 px-6 py-2.5 rounded-full bg-white/10 text-white text-[10px] font-black uppercase tracking-[0.3em] border border-white/10 mb-10">
              <Sparkles className="h-4 w-4 text-yellow-400" /> Student Dashboard
            </div>
            <h1 className="text-4xl md:text-7xl font-black tracking-tighter mb-8 uppercase leading-[0.9]">
              Welcome back, <br/>
              <span className="text-[#fd5523]">{firstName}</span>
            </h1>
            <p className="text-white/60 text-lg md:text-xl font-medium leading-relaxed mb-12 max-w-lg">
              Continue your journey at {company.name}. You have {inProgressCount} course{inProgressCount !== 1 ? "s" : ""} active.
            </p>
            <div className="flex flex-wrap gap-4">
              <Link
                href={`/academy/${company.slug}/classroom`}
                className="group h-20 px-12 rounded-[2rem] bg-[#fd5523] text-white text-xs font-black uppercase tracking-[0.2em] flex items-center gap-4 hover:scale-[1.02] active:scale-95 transition-all shadow-2xl shadow-[#fd5523]/30"
              >
                Enter Classroom 
                <div className="h-8 w-8 rounded-full bg-white/20 flex items-center justify-center group-hover:rotate-12 transition-transform">
                  <Layout className="h-4 w-4" />
                </div>
              </Link>
            </div>
          </div>
        </section>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: "Active Courses", value: inProgressCount, icon: Clock3, accent: "bg-[#fff6ee] text-[#fd5523]" },
            { label: "Completed", value: completedCount, icon: Award, accent: "bg-emerald-50 text-emerald-600" },
            { label: "Certificates", value: 0, icon: Trophy, accent: "bg-amber-50 text-amber-600" },
            { label: "Total Library", value: enrollments.length, icon: BookOpen, accent: "bg-blue-50 text-blue-600" },
          ].map((stat) => (
            <div key={stat.label} className="bg-white rounded-[2.5rem] p-6 border border-slate-100 shadow-sm">
              <div className={cn("h-10 w-10 rounded-2xl flex items-center justify-center mb-4 shadow-inner", stat.accent)}>
                <stat.icon className="h-5 w-5" />
              </div>
              <div className="text-3xl font-black text-[#062e39] tracking-tight">{stat.value}</div>
              <div className="text-[10px] font-black uppercase tracking-widest text-slate-400 mt-1">{stat.label}</div>
            </div>
          ))}
        </div>

        {/* Course List */}
        <section className="space-y-8">
           <div className="flex items-center justify-between px-2">
              <h2 className="text-2xl font-black text-[#062e39] uppercase tracking-tight flex items-center gap-3">
                <BookOpen className="h-6 w-6 text-[#fd5523]" /> 
                My Learning
              </h2>
              <Link href={`/academy/${company.slug}#courses`} className="text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-[#fd5523] transition-colors">
                Browse More
              </Link>
           </div>

           {enrollments.length > 0 ? (
             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {enrollments.map((enrollment) => {
                  const course = enrollment.courses;
                  if (!course) return null;
                  const isPending = enrollment.status === "pending_payment";

                  return (
                    <Card key={enrollment.id} className="group bg-white rounded-[2.5rem] border border-slate-100 shadow-sm hover:shadow-2xl hover:border-[#fd5523]/20 transition-all overflow-hidden flex flex-col h-full">
                      <div className="aspect-[16/10] bg-slate-50 relative overflow-hidden">
                        {course.thumbnail_url ? (
                          <img src={course.thumbnail_url} alt="" className="h-full w-full object-cover group-hover:scale-110 transition-transform duration-700" />
                        ) : (
                          <div className="h-full w-full flex items-center justify-center bg-slate-100/50">
                             <BookOpen className="h-16 w-16 text-slate-200" />
                          </div>
                        )}
                        <div className="absolute top-6 left-6">
                           <div className="px-4 py-1.5 rounded-full bg-white/90 backdrop-blur-md text-[10px] font-black uppercase tracking-[0.2em] text-[#062e39] shadow-xl border border-white">
                             {course.category || "General"}
                           </div>
                        </div>
                      </div>
                      <CardContent className="p-8 flex flex-col flex-1">
                        <h3 className="text-2xl font-black text-[#062e39] leading-tight group-hover:text-[#fd5523] transition-colors mb-6">{course.title}</h3>
                        
                        <div className="mt-auto space-y-6">
                           {isPending ? (
                             <div className="p-6 rounded-[2rem] bg-amber-50 border border-amber-100 flex flex-col gap-4">
                                <div className="flex items-center gap-2">
                                  <div className="h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
                                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-amber-700">Awaiting Confirmation</p>
                                </div>
                                <a 
                                  href={`https://wa.me/260979046745?text=Hi, I have enrolled in ${course.title} and would like to confirm my payment.`}
                                  target="_blank"
                                  className="h-12 rounded-xl bg-[#25D366] text-white text-[10px] font-black uppercase tracking-[0.2em] flex items-center justify-center gap-2 hover:scale-[1.02] active:scale-95 transition-all shadow-lg shadow-[#25D366]/20"
                                >
                                  Confirm on WhatsApp
                                </a>
                             </div>
                           ) : (
                             <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                   <div className="h-2.5 w-2.5 rounded-full bg-[#fd5523] animate-pulse shadow-[0_0_8px_rgba(253,85,35,0.5)]" />
                                   <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">In Progress</span>
                                </div>
                                <Link 
                                  href={`/courses/${course.slug}/learn`}
                                  className="h-12 px-8 rounded-xl bg-[#062e39] text-white text-[10px] font-black uppercase tracking-[0.2em] hover:bg-[#fd5523] transition-all flex items-center gap-3 shadow-xl shadow-[#062e39]/10"
                                >
                                  Continue <ArrowRight className="h-4 w-4" />
                                </Link>
                             </div>
                           )}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
             </div>
           ) : (
             <div className="py-24 text-center bg-white rounded-[4rem] border-2 border-dashed border-slate-100">
                <BookOpen className="h-20 w-20 text-slate-50 mx-auto mb-6" />
                <h3 className="text-2xl font-black text-[#062e39]">No active courses</h3>
                <p className="text-slate-400 font-medium mt-2 max-w-xs mx-auto">Explore {company.name}'s curriculum to start learning.</p>
                <Link href={`/academy/${company.slug}#courses`} className="mt-8 inline-flex h-14 px-8 rounded-2xl bg-[#062e39] text-white text-[10px] font-black uppercase tracking-widest hover:bg-[#fd5523] transition-all">
                   Browse Courses
                </Link>
             </div>
           )}
        </section>
      </div>
    </div>
  </div>
);
}
