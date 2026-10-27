import { auth } from "@clerk/nextjs/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import {
  Building2,
  GraduationCap,
  ShieldCheck,
  ShieldAlert,
  ArrowRight,
  PlusCircle,
  ExternalLink,
  BookOpen,
  Calendar,
  Sparkles,
  Users,
  Video,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { CompanyMemberRole, UserRole } from "@/types/database";
import { getUpcomingUserClasses } from "@/actions/classroom";

export const metadata = { title: "Your Academies — Zed AI Academy" };
export const dynamic = "force-dynamic";

type AcademyCardData = {
  companyId: string;
  name: string;
  slug: string;
  logoUrl: string | null;
  primaryColor: string | null;
  role: CompanyMemberRole;
  status: string;
  enrolledCoursesCount: number;
  totalCoursesCount: number;
};

export default async function DashboardPage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const supabase = createClient();

  // 1. Fetch user profile
  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, role, onboarding_completed")
    .eq("id", userId)
    .single();

  if (!profile?.onboarding_completed) {
    redirect("/onboarding");
  }

  const isSuperAdmin = profile.role === "super_admin";
  const firstName = profile.full_name?.split(" ")[0] ?? "there";

  // 2. Fetch all tenant memberships with company details
  const { data: memberRows } = await supabase
    .from("company_members")
    .select(`
      company_id,
      role,
      status,
      joined_at,
      companies (
        id,
        name,
        slug,
        logo_url,
        primary_color,
        status
      )
    `)
    .eq("profile_id", userId)
    .eq("status", "active")
    .order("joined_at", { ascending: false });

  // 3. For each company, fetch course / enrollment stats
  const companyIds = (memberRows ?? [])
    .map((m: any) => m.company_id)
    .filter(Boolean);

  const [coursesRes, enrollmentsRes, upcomingClasses] = await Promise.all([
    companyIds.length > 0
      ? supabase.from("courses").select("id, company_id").in("company_id", companyIds)
      : Promise.resolve({ data: [] }),
    companyIds.length > 0
      ? supabase
          .from("enrollments")
          .select("id, company_id")
          .eq("user_id", userId)
          .in("company_id", companyIds)
      : Promise.resolve({ data: [] }),
    getUpcomingUserClasses(),
  ]);

  const activeLiveClass = upcomingClasses.find((c: any) => c.companies?.is_session_active);

  const courseCountMap = new Map<string, number>();
  (coursesRes.data ?? []).forEach((c: any) => {
    courseCountMap.set(c.company_id, (courseCountMap.get(c.company_id) ?? 0) + 1);
  });

  const enrollCountMap = new Map<string, number>();
  (enrollmentsRes.data ?? []).forEach((e: any) => {
    enrollCountMap.set(e.company_id, (enrollCountMap.get(e.company_id) ?? 0) + 1);
  });

  const academies: AcademyCardData[] = (memberRows ?? [])
    .map((m: any) => {
      const comp = Array.isArray(m.companies) ? m.companies[0] : m.companies;
      if (!comp) return null;
      return {
        companyId: comp.id,
        name: comp.name,
        slug: comp.slug,
        logoUrl: comp.logo_url,
        primaryColor: comp.primary_color,
        role: m.role as CompanyMemberRole,
        status: comp.status,
        enrolledCoursesCount: enrollCountMap.get(comp.id) ?? 0,
        totalCoursesCount: courseCountMap.get(comp.id) ?? 0,
      };
    })
    .filter(Boolean) as AcademyCardData[];

  return (
    <div className="min-h-screen bg-slate-50/70 pb-20 pt-8">
      <div className="container mx-auto px-4 sm:px-6 max-w-6xl">

        {/* Welcome Header */}
        <div className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
              Welcome back, {firstName} 👋
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              Select an academy to enter your classroom, review lessons, or manage courses.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Link
              href="/dashboard/schedule"
              className="flex items-center gap-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200/90 text-xs font-bold uppercase tracking-wider px-4 py-2.5 rounded-xl shadow-sm transition-all hover:scale-105 active:scale-95"
            >
              <Calendar className="h-4 w-4 text-[#fd5523]" />
              <span>School Timetable</span>
            </Link>

            {isSuperAdmin && (
              <Link
                href="/superadmin"
                className="flex items-center gap-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold uppercase tracking-wider px-4 py-2.5 rounded-xl shadow-md transition-all hover:scale-105 active:scale-95"
              >
                <ShieldAlert className="h-4 w-4 text-red-400" />
                <span>Super Admin Console</span>
              </Link>
            )}

            <Link
              href="/launch-your-academy"
              className="flex items-center gap-2 bg-[#fd5523] hover:bg-[#ea4817] text-white text-xs font-bold uppercase tracking-wider px-4 py-2.5 rounded-xl shadow-md shadow-[#fd5523]/20 transition-all hover:scale-105 active:scale-95"
            >
              <PlusCircle className="h-4 w-4" />
              <span>Launch an Academy</span>
            </Link>
          </div>
        </div>

        {/* Active Live Session Banner */}
        {activeLiveClass && (
          <div className="mb-8 p-4 sm:p-5 rounded-2xl sm:rounded-3xl bg-gradient-to-r from-red-600 via-[#fd5523] to-orange-500 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xl shadow-red-500/20">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 sm:h-12 sm:w-12 rounded-2xl bg-white/20 text-white flex items-center justify-center shrink-0">
                <Video className="h-5 w-5 sm:h-6 sm:w-6" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-white animate-ping" />
                  <span className="text-[10px] font-black uppercase tracking-widest text-white/90">Live Class in Session</span>
                </div>
                <h3 className="font-bold text-base sm:text-lg text-white">
                  {activeLiveClass.title} · {activeLiveClass.companies?.name}
                </h3>
              </div>
            </div>
            <Link
              href={`/academy/${activeLiveClass.companies?.slug}/classroom?tab=session&scheduleId=${activeLiveClass.id}`}
              className="shrink-0 bg-white hover:bg-slate-100 text-red-600 font-black text-xs uppercase tracking-wider px-5 py-3 rounded-xl transition-all shadow-md flex items-center justify-center gap-1.5"
            >
              <Video className="h-4 w-4 text-red-600" />
              <span>Join Live Class Now</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        )}

        {/* Super Admin Notice if applicable */}
        {isSuperAdmin && (
          <div className="mb-8 p-4 rounded-2xl bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xl border border-slate-700/60">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-red-500/20 text-red-400 flex items-center justify-center shrink-0 border border-red-500/30">
                <ShieldAlert className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-bold text-sm text-white">Platform Super Administrator</h3>
                <p className="text-xs text-slate-300">
                  You have platform-wide access to inspect and manage all academies, suspend tenants, and assign roles.
                </p>
              </div>
            </div>
            <Link
              href="/superadmin"
              className="shrink-0 bg-white/10 hover:bg-white/20 text-white text-xs font-bold px-3.5 py-2 rounded-xl transition-colors border border-white/10 flex items-center gap-1.5"
            >
              <span>Open Control Plane</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        )}

        {/* Academies Section */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
              <Building2 className="h-4 w-4 text-[#fd5523]" />
              <span>Your Academies ({academies.length})</span>
            </h2>
          </div>

          {academies.length === 0 ? (
            <div className="bg-white rounded-3xl border border-slate-200/80 p-10 text-center shadow-sm">
              <div className="h-16 w-16 rounded-2xl bg-orange-50 text-[#fd5523] mx-auto flex items-center justify-center mb-4">
                <Building2 className="h-8 w-8" />
              </div>
              <h3 className="text-lg font-bold text-slate-900 mb-1">
                You haven&apos;t joined any academies yet
              </h3>
              <p className="text-sm text-slate-500 max-w-md mx-auto mb-6">
                Explore available courses in Zed AI Academy or create your own custom-branded teaching platform.
              </p>
              <div className="flex items-center justify-center gap-3">
                <Link
                  href="/academy/zedai"
                  className="bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold uppercase tracking-wider px-5 py-2.5 rounded-xl transition-all"
                >
                  Visit Zed AI Academy
                </Link>
                <Link
                  href="/launch-your-academy"
                  className="bg-[#fd5523] hover:bg-[#ea4817] text-white text-xs font-bold uppercase tracking-wider px-5 py-2.5 rounded-xl transition-all shadow-md shadow-[#fd5523]/20"
                >
                  Create Your Academy
                </Link>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {academies.map((academy) => {
                const isAdmin = academy.role === "company_admin";
                const isTeacher = academy.role === "teacher";
                const brandColor = academy.primaryColor || "#fd5523";

                return (
                  <div
                    key={academy.companyId}
                    className="bg-white rounded-3xl border border-slate-200/80 p-6 shadow-sm hover:shadow-md transition-all flex flex-col justify-between group"
                  >
                    <div>
                      {/* Top Header & Role Badge */}
                      <div className="flex items-start justify-between gap-3 mb-4">
                        <div
                          className="h-12 w-12 rounded-2xl flex items-center justify-center text-white font-bold text-lg shadow-md shrink-0"
                          style={{ backgroundColor: brandColor }}
                        >
                          {academy.logoUrl ? (
                            <img
                              src={academy.logoUrl}
                              alt={academy.name}
                              className="h-full w-full object-cover rounded-2xl"
                            />
                          ) : (
                            academy.name.charAt(0)
                          )}
                        </div>

                        <span
                          className={`text-[11px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wider ${
                            isAdmin
                              ? "bg-orange-50 text-orange-700 border border-orange-200/60"
                              : isTeacher
                              ? "bg-purple-50 text-purple-700 border border-purple-200/60"
                              : "bg-emerald-50 text-emerald-700 border border-emerald-200/60"
                          }`}
                        >
                          {isAdmin ? "Admin" : isTeacher ? "Instructor" : "Student"}
                        </span>
                      </div>

                      {/* Title & Slug */}
                      <h3 className="text-lg font-black text-slate-900 tracking-tight group-hover:text-[#fd5523] transition-colors">
                        {academy.name}
                      </h3>
                      <p className="text-xs text-slate-400 font-mono mt-0.5">
                        /{academy.slug}
                      </p>

                      {/* Academy Stats */}
                      <div className="mt-4 pt-4 border-t border-slate-100 flex items-center gap-4 text-xs text-slate-500">
                        <div className="flex items-center gap-1.5">
                          <BookOpen className="h-3.5 w-3.5 text-slate-400" />
                          <span>{academy.totalCoursesCount} Course(s)</span>
                        </div>
                        {academy.enrolledCoursesCount > 0 && (
                          <div className="flex items-center gap-1.5 text-emerald-600 font-medium">
                            <GraduationCap className="h-3.5 w-3.5" />
                            <span>{academy.enrolledCoursesCount} Enrolled</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="mt-6 pt-4 border-t border-slate-100 space-y-2">
                      {isAdmin ? (
                        <>
                          <Link
                            href={`/academy/${academy.slug}/admin`}
                            className="w-full flex items-center justify-center gap-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold uppercase tracking-wider py-2.5 rounded-xl transition-all"
                          >
                            <ShieldCheck className="h-4 w-4 text-orange-400" />
                            <span>Admin Console</span>
                          </Link>
                          <div className="grid grid-cols-2 gap-2">
                            <Link
                              href={`/academy/${academy.slug}/classroom`}
                              className="flex items-center justify-center gap-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold uppercase tracking-wider py-2 rounded-xl transition-all"
                            >
                              <GraduationCap className="h-3.5 w-3.5 text-slate-500" />
                              <span>Classroom</span>
                            </Link>
                            <Link
                              href={`/academy/${academy.slug}/classroom?tab=timetable`}
                              className="flex items-center justify-center gap-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold uppercase tracking-wider py-2 rounded-xl transition-all"
                            >
                              <Calendar className="h-3.5 w-3.5 text-[#fd5523]" />
                              <span>Timetable</span>
                            </Link>
                          </div>
                        </>
                      ) : (
                        <div className="space-y-2">
                          <Link
                            href={`/academy/${academy.slug}/classroom`}
                            className="w-full flex items-center justify-center gap-2 text-white text-xs font-bold uppercase tracking-wider py-2.5 rounded-xl transition-all shadow-md shadow-orange-500/10"
                            style={{ backgroundColor: brandColor }}
                          >
                            <GraduationCap className="h-4 w-4" />
                            <span>Enter Classroom</span>
                            <ArrowRight className="h-3.5 w-3.5 ml-1" />
                          </Link>
                          <Link
                            href={`/academy/${academy.slug}/classroom?tab=timetable`}
                            className="w-full flex items-center justify-center gap-2 bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200/80 text-xs font-bold uppercase tracking-wider py-2 rounded-xl transition-all"
                          >
                            <Calendar className="h-3.5 w-3.5 text-[#fd5523]" />
                            <span>View School Timetable</span>
                          </Link>
                        </div>
                      )}
                    </div>

                  </div>
                );
              })}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
