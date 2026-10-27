import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { CalendarDays, ArrowLeft, Building2 } from "lucide-react";
import { LearnerScheduleClient } from "@/components/learner/schedule-client";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Class Schedule & Timetable — Zed AI Academy",
  description: "View your weekly school schedule, recurring classes, live workshops, and sync with your calendar.",
};

export const dynamic = "force-dynamic";

export default async function LearnerSchedulePage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in?redirect_url=/dashboard/schedule");

  const supabase = createClient();

  // 1. Fetch user's active academy memberships
  const { data: memberRows } = await supabase
    .from("company_members")
    .select(`
      company_id,
      companies (
        id,
        name,
        slug,
        is_session_active,
        active_room_name
      )
    `)
    .eq("profile_id", userId)
    .eq("status", "active");

  const companyList: { id: string; name: string; slug: string }[] = [];
  const companyIds: string[] = [];

  (memberRows ?? []).forEach((m: any) => {
    if (m.companies) {
      companyList.push({
        id: m.companies.id,
        name: m.companies.name,
        slug: m.companies.slug,
      });
      companyIds.push(m.companies.id);
    }
  });

  // 2. Fetch all schedules across these companies
  let schedules: any[] = [];
  if (companyIds.length > 0) {
    const { data: scheduleRows } = await supabase
      .from("class_schedules")
      .select(`
        *,
        companies (
          id,
          name,
          slug,
          is_session_active,
          active_room_name
        )
      `)
      .in("company_id", companyIds)
      .order("day_of_week", { ascending: true })
      .order("start_time_only", { ascending: true });

    schedules = scheduleRows ?? [];
  }

  return (
    <div className="min-h-screen bg-slate-50/60 px-4 py-8 sm:py-12">
      <div className="container max-w-7xl mx-auto space-y-8">
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200/60 pb-6">
          <div className="space-y-1">
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-400 hover:text-[#fd5523] transition-colors mb-2"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Back to Dashboard
            </Link>
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#062e39] text-[#fd5523] shadow-md">
                <CalendarDays className="h-6 w-6" />
              </div>
              <div>
                <h1 className="text-2xl sm:text-4xl font-black text-[#062e39] tracking-tight">
                  School Timetable & Live Classes
                </h1>
                <p className="text-xs sm:text-sm font-medium text-slate-500">
                  Weekly recurring live lessons, interactive masterclasses, and class calendar.
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="rounded-full bg-white px-4 py-2 text-xs font-black uppercase tracking-wider text-[#062e39] border border-slate-200 shadow-xs">
              {companyList.length} {companyList.length === 1 ? "Academy" : "Academies"} Connected
            </span>
          </div>
        </div>

        {/* Schedule Client Matrix */}
        <LearnerScheduleClient schedules={schedules} companies={companyList} />
      </div>
    </div>
  );
}
