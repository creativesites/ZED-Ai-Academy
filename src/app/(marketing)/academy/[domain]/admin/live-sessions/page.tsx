import { auth } from "@clerk/nextjs/server";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import {
  CalendarDays,
  CheckCircle,
  Clock3,
  Plus,
  Video,
  XCircle,
  ChevronLeft
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import {
  confirmLiveSessionBooking,
  createAvailabilityRule,
  createLiveSessionService,
  declineLiveSessionBooking,
  deleteAvailabilityRule,
  updateLiveSessionServiceStatus,
} from "@/actions/live-sessions";
import type {
  Course,
  InstructorAvailabilityRule,
  LiveSessionBooking,
  LiveSessionService,
} from "@/types/database";
import { InstructorJoinButton } from "@/components/creator/instructor-join-button";
import { cn } from "@/lib/utils";

export const metadata = { title: "Live Sessions Studio — Admin Hub" };

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

type BookingWithRelations = LiveSessionBooking & {
  profiles: { full_name: string | null; email: string | null } | null;
  courses: { title: string } | null;
  live_session_services: { title: string } | null;
};

function formatSessionTime(startsAt: string, endsAt: string, timezone: string) {
  const formatter = new Intl.DateTimeFormat("en", {
    timeZone: timezone,
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
  const endFormatter = new Intl.DateTimeFormat("en", {
    timeZone: timezone,
    hour: "2-digit",
    minute: "2-digit",
  });
  return `${formatter.format(new Date(startsAt))} - ${endFormatter.format(new Date(endsAt))}`;
}

export default async function TenantAdminLiveSessionsPage({
  params,
}: {
  params: Promise<{ domain: string }>;
}) {
  const { domain } = await params;
  const { userId } = await auth();
  if (!userId) redirect(`/sign-in?redirect_url=/academy/${domain}/admin/live-sessions`);

  const supabase = createClient();
  
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

  const [
    { data: coursesData },
    { data: servicesData },
    { data: rulesData },
    { data: bookingsData },
  ] = await Promise.all([
    supabase
      .from("courses")
      .select("id, title, status")
      .eq("company_id", company.id)
      .order("title"),
    supabase
      .from("live_session_services")
      .select("*")
      .eq("instructor_id", userId)
      .order("created_at", { ascending: false }),
    supabase
      .from("instructor_availability_rules")
      .select("*")
      .eq("instructor_id", userId)
      .order("weekday")
      .order("start_time"),
    supabase
      .from("live_session_bookings")
      .select("*, profiles!live_session_bookings_learner_id_fkey(full_name, email), courses(title), live_session_services(title), zoom_meetings(zoom_meeting_id)")
      .eq("instructor_id", userId)
      .in("status", ["requested", "confirmed", "reschedule_requested"])
      .order("starts_at", { ascending: true }),
  ]);

  const courses = (coursesData ?? []) as Pick<Course, "id" | "title" | "status">[];
  const services = (servicesData ?? []) as LiveSessionService[];
  const rules = (rulesData ?? []) as InstructorAvailabilityRule[];
  const bookings = (bookingsData ?? []) as unknown as BookingWithRelations[];
  const pendingBookings = bookings.filter((booking) => booking.status === "requested");
  const upcomingBookings = bookings.filter((booking) => booking.status !== "requested");

  return (
    <div className="container max-w-7xl py-12">
      <div className="mb-10 flex flex-col justify-between gap-5 md:flex-row md:items-center">
        <div>
          <h1 className="text-4xl font-black tracking-tight text-[#062e39] uppercase">Live Sessions Studio</h1>
          <p className="mt-2 text-slate-500 font-medium text-lg">
            Manage your bookable sessions and availability for {company.name}.
          </p>
        </div>
      </div>

      <div className="grid gap-10 lg:grid-cols-12">
        <div className="lg:col-span-7 space-y-10">
          {/* Create Session Type */}
          <section className="bg-white rounded-[2.5rem] p-10 border border-slate-100 shadow-sm">
            <div className="mb-8 flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#fff6ee] text-[#fd5523]">
                <Plus className="h-6 w-6" />
              </div>
              <div>
                <h2 className="text-xl font-black text-[#062e39] uppercase">New Session Type</h2>
                <p className="text-sm text-slate-400 font-medium">Create a new bookable class or coaching session.</p>
              </div>
            </div>

            <form action={createLiveSessionService} className="grid gap-6 md:grid-cols-2">
              <div className="space-y-2 md:col-span-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Title</label>
                <input name="title" required placeholder="e.g. 1-on-1 Code Review" className="h-14 w-full rounded-2xl border border-slate-100 bg-slate-50 px-5 outline-none focus:bg-white focus:border-[#fd5523] transition-all" />
              </div>
              <div className="space-y-2 md:col-span-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Description</label>
                <textarea name="description" rows={3} placeholder="What will happen during this session?" className="w-full rounded-2xl border border-slate-100 bg-slate-50 px-5 py-4 outline-none focus:bg-white focus:border-[#fd5523] transition-all resize-none" />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Related Course</label>
                <select name="course_id" className="h-14 w-full rounded-2xl border border-slate-100 bg-slate-50 px-4 outline-none focus:bg-white focus:border-[#fd5523] transition-all">
                  <option value="">General Session</option>
                  {courses.map((course) => (
                    <option key={course.id} value={course.id}>{course.title}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Duration (Min)</label>
                <input name="duration_minutes" type="number" min={15} max={240} defaultValue={45} className="h-14 w-full rounded-2xl border border-slate-100 bg-slate-50 px-5 outline-none focus:bg-white focus:border-[#fd5523] transition-all" />
              </div>
              <Button type="submit" className="md:col-span-2 h-16 rounded-2xl bg-[#fd5523] text-white text-sm font-black uppercase tracking-widest hover:scale-[1.02] active:scale-95 transition-all shadow-xl shadow-[#fd5523]/20">
                Create Session Type
              </Button>
            </form>
          </section>

          {/* Availability Rules */}
          <section className="bg-white rounded-[2.5rem] p-10 border border-slate-100 shadow-sm">
            <div className="mb-8 flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600">
                <Clock3 className="h-6 w-6" />
              </div>
              <div>
                <h2 className="text-xl font-black text-[#062e39] uppercase">Weekly Availability</h2>
                <p className="text-sm text-slate-400 font-medium">Set your recurring teaching hours.</p>
              </div>
            </div>

            <form action={createAvailabilityRule} className="grid gap-4 md:grid-cols-4">
              <select name="weekday" required className="h-14 rounded-2xl border border-slate-100 bg-slate-50 px-4 outline-none focus:bg-white focus:border-[#fd5523] transition-all">
                {WEEKDAYS.map((day, idx) => <option key={day} value={idx}>{day}</option>)}
              </select>
              <input name="start_time" type="time" required defaultValue="09:00" className="h-14 rounded-2xl border border-slate-100 bg-slate-50 px-4 outline-none focus:bg-white focus:border-[#fd5523] transition-all" />
              <input name="end_time" type="time" required defaultValue="17:00" className="h-14 rounded-2xl border border-slate-100 bg-slate-50 px-4 outline-none focus:bg-white focus:border-[#fd5523] transition-all" />
              <Button type="submit" className="h-14 rounded-2xl bg-[#062e39] text-white text-[10px] font-black uppercase tracking-widest">Add Slot</Button>
              <input type="hidden" name="timezone" defaultValue="Africa/Lusaka" />
            </form>

            <div className="mt-8 grid gap-3">
              {rules.length === 0 ? (
                <div className="p-10 text-center bg-slate-50 rounded-3xl border border-dashed border-slate-200">
                   <p className="text-slate-400 font-bold uppercase tracking-widest text-xs">No slots added yet.</p>
                </div>
              ) : rules.map((rule) => (
                <div key={rule.id} className="flex items-center justify-between p-5 rounded-2xl border border-slate-100 hover:border-[#fd5523]/30 transition-all group">
                  <div>
                    <p className="font-black text-[#062e39] uppercase text-sm tracking-tight">{WEEKDAYS[rule.weekday]}</p>
                    <p className="text-xs text-slate-400 font-medium">{rule.start_time.slice(0, 5)} - {rule.end_time.slice(0, 5)}</p>
                  </div>
                  <form action={deleteAvailabilityRule.bind(null, rule.id)}>
                    <Button variant="ghost" className="h-10 rounded-xl text-red-400 hover:text-red-600 hover:bg-red-50 text-[10px] font-black uppercase tracking-widest">Remove</Button>
                  </form>
                </div>
              ))}
            </div>
          </section>
        </div>

        <div className="lg:col-span-5 space-y-10">
          {/* Active Services */}
          <section className="bg-white rounded-[2.5rem] p-10 border border-slate-100 shadow-sm">
            <h3 className="text-sm font-black uppercase tracking-widest text-[#062e39] mb-8 flex items-center gap-3">
              <Video className="h-5 w-5 text-[#fd5523]" /> Published Services
            </h3>
            <div className="space-y-4">
              {services.map((service) => (
                <div key={service.id} className="p-6 rounded-3xl border border-slate-100 group">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h4 className="font-black text-[#062e39] uppercase tracking-tight">{service.title}</h4>
                      <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mt-1">{service.duration_minutes} MIN SESSION</p>
                    </div>
                    <form action={updateLiveSessionServiceStatus.bind(null, service.id, !service.is_active)}>
                       <button className={cn(
                         "px-4 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all",
                         service.is_active ? "bg-emerald-50 text-emerald-600" : "bg-slate-100 text-slate-400"
                       )}>
                         {service.is_active ? "ACTIVE" : "PAUSED"}
                       </button>
                    </form>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Pending Requests */}
          <section className="bg-white rounded-[2.5rem] p-10 border border-slate-100 shadow-sm">
             <h3 className="text-sm font-black uppercase tracking-widest text-[#062e39] mb-8 flex items-center gap-3">
               <CalendarDays className="h-5 w-5 text-[#fd5523]" /> Session Requests
             </h3>
             <div className="space-y-6">
               {pendingBookings.length === 0 ? (
                 <p className="text-slate-400 font-bold uppercase tracking-widest text-[10px] text-center py-10">No pending requests.</p>
               ) : pendingBookings.map((booking) => (
                 <div key={booking.id} className="p-6 rounded-[2rem] bg-[#fff6ee]/50 border border-[#fd5523]/10">
                    <p className="font-black text-[#062e39] uppercase tracking-tight">{booking.live_session_services?.title}</p>
                    <div className="flex items-center gap-2 mt-2 text-xs font-bold text-slate-500">
                       <Clock3 className="h-3 w-3 text-[#fd5523]" />
                       {formatSessionTime(booking.starts_at, booking.ends_at, booking.timezone)}
                    </div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mt-4">Learner</p>
                    <p className="text-sm font-bold text-[#062e39]">{booking.profiles?.full_name || booking.profiles?.email}</p>
                    <div className="mt-6 flex gap-2">
                       <form action={confirmLiveSessionBooking.bind(null, booking.id)} className="flex-1">
                         <Button className="w-full h-12 rounded-xl bg-[#fd5523] text-white text-[10px] font-black uppercase tracking-widest">Confirm</Button>
                       </form>
                       <form action={declineLiveSessionBooking.bind(null, booking.id)}>
                         <Button variant="ghost" className="h-12 rounded-xl text-red-400 hover:text-red-600 hover:bg-red-50 text-[10px] font-black uppercase tracking-widest">Decline</Button>
                       </form>
                    </div>
                 </div>
               ))}
             </div>
          </section>

          {/* Upcoming Sessions */}
          <section className="bg-white rounded-[2.5rem] p-10 border border-slate-100 shadow-sm">
             <h3 className="text-sm font-black uppercase tracking-widest text-[#062e39] mb-8">Confirmed Sessions</h3>
             <div className="space-y-4">
                {upcomingBookings.map((booking) => (
                  <div key={booking.id} className="p-5 rounded-2xl border border-slate-100 flex items-center justify-between">
                     <div>
                        <p className="font-black text-[#062e39] text-sm uppercase tracking-tight">{booking.live_session_services?.title}</p>
                        <p className="text-[10px] font-bold text-slate-400 mt-0.5">{new Date(booking.starts_at).toLocaleDateString()}</p>
                     </div>
                     <InstructorJoinButton
                        bookingId={booking.id}
                        roomName={(booking as any).zoom_meetings?.[0]?.zoom_meeting_id || (booking as any).zoom_meetings?.zoom_meeting_id || booking.id}
                        sessionTitle={(booking as any).live_session_services?.title ?? "Live Session"}
                        learnerName={(booking as any).profiles?.full_name ?? (booking as any).profiles?.email ?? null}
                        startsAt={booking.starts_at}
                        status={booking.status}
                      />
                  </div>
                ))}
             </div>
          </section>
        </div>
      </div>
    </div>
  );
}
