import {
  CalendarDays,
  Clock3,
  Plus,
  Video,
} from "lucide-react";
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
import { requireTenantAdminPage } from "@/lib/tenants/admin-guard";

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
  const { userId, supabase, company } = await requireTenantAdminPage(domain);

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
    <div className="container max-w-7xl px-4 py-6 sm:py-8">
      <div className="mb-6 sm:mb-8 flex flex-col justify-between gap-3 md:flex-row md:items-center">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-[#062e39]">Live Sessions Studio</h1>
          <p className="mt-1 text-slate-500 text-xs sm:text-sm">
            Manage your bookable sessions and availability for {company.name}.
          </p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-12">
        <div className="lg:col-span-7 space-y-6">
          {/* Create Session Type */}
          <section className="bg-white rounded-2xl p-5 sm:p-6 border border-slate-200/80 shadow-xs">
            <div className="mb-6 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#fff6ee] text-[#fd5523]">
                <Plus className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-base sm:text-lg font-bold text-[#062e39]">New Session Type</h2>
                <p className="text-xs text-slate-400">Create a new bookable class or coaching session.</p>
              </div>
            </div>

            <form action={createLiveSessionService} className="grid gap-4 md:grid-cols-2">
              <div className="space-y-1.5 md:col-span-2">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Title</label>
                <input name="title" required placeholder="e.g. 1-on-1 Code Review" className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 text-sm outline-none focus:bg-white focus:border-[#fd5523] transition-all" />
              </div>
              <div className="space-y-1.5 md:col-span-2">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Description</label>
                <textarea name="description" rows={3} placeholder="What will happen during this session?" className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm outline-none focus:bg-white focus:border-[#fd5523] transition-all resize-none" />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Related Course</label>
                <select name="course_id" className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm outline-none focus:bg-white focus:border-[#fd5523] transition-all">
                  <option value="">General Session</option>
                  {courses.map((course) => (
                    <option key={course.id} value={course.id}>{course.title}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Duration (Min)</label>
                <input name="duration_minutes" type="number" min={15} max={240} defaultValue={45} className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 text-sm outline-none focus:bg-white focus:border-[#fd5523] transition-all" />
              </div>
              <Button type="submit" className="md:col-span-2 h-10 rounded-xl bg-[#fd5523] hover:bg-[#e0481d] text-white text-xs font-semibold transition-all shadow-xs">
                Create Session Type
              </Button>
            </form>
          </section>

          {/* Availability Rules */}
          <section className="bg-white rounded-2xl p-5 sm:p-6 border border-slate-200/80 shadow-xs">
            <div className="mb-6 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
                <Clock3 className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-base sm:text-lg font-bold text-[#062e39]">Weekly Availability</h2>
                <p className="text-xs text-slate-400">Set your recurring teaching hours.</p>
              </div>
            </div>

            <form action={createAvailabilityRule} className="grid gap-3 sm:grid-cols-4">
              <select name="weekday" required className="h-10 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm outline-none focus:bg-white focus:border-[#fd5523] transition-all">
                {WEEKDAYS.map((day, idx) => <option key={day} value={idx}>{day}</option>)}
              </select>
              <input name="start_time" type="time" required defaultValue="09:00" className="h-10 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm outline-none focus:bg-white focus:border-[#fd5523] transition-all" />
              <input name="end_time" type="time" required defaultValue="17:00" className="h-10 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm outline-none focus:bg-white focus:border-[#fd5523] transition-all" />
              <Button type="submit" className="h-10 rounded-xl bg-[#062e39] text-white text-xs font-semibold">Add Slot</Button>
              <input type="hidden" name="timezone" defaultValue="Africa/Lusaka" />
            </form>

            <div className="mt-6 grid gap-2.5">
              {rules.length === 0 ? (
                <div className="p-8 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                   <p className="text-slate-400 font-semibold text-xs">No slots added yet.</p>
                </div>
              ) : rules.map((rule) => (
                <div key={rule.id} className="flex items-center justify-between p-4 rounded-xl border border-slate-200/70 hover:border-[#fd5523]/30 transition-all group">
                  <div>
                    <p className="font-semibold text-[#062e39] text-sm">{WEEKDAYS[rule.weekday]}</p>
                    <p className="text-xs text-slate-400">{rule.start_time.slice(0, 5)} - {rule.end_time.slice(0, 5)}</p>
                  </div>
                  <form action={deleteAvailabilityRule.bind(null, rule.id)}>
                    <Button variant="ghost" className="h-9 rounded-lg text-red-500 hover:text-red-700 hover:bg-red-50 text-xs font-semibold">Remove</Button>
                  </form>
                </div>
              ))}
            </div>
          </section>
        </div>

        <div className="lg:col-span-5 space-y-6">
          {/* Active Services */}
          <section className="bg-white rounded-2xl p-5 sm:p-6 border border-slate-200/80 shadow-xs">
            <h3 className="text-xs font-bold uppercase tracking-wider text-[#062e39] mb-4 flex items-center gap-2">
              <Video className="h-4 w-4 text-[#fd5523]" /> Published Services
            </h3>
            <div className="space-y-3">
              {services.map((service) => (
                <div key={service.id} className="p-4 rounded-xl border border-slate-200/70 group">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h4 className="font-semibold text-sm text-[#062e39]">{service.title}</h4>
                      <p className="text-[11px] font-medium text-slate-400 mt-0.5">{service.duration_minutes} min session</p>
                    </div>
                    <form action={updateLiveSessionServiceStatus.bind(null, service.id, !service.is_active)}>
                       <button className={cn(
                         "px-3 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all",
                         service.is_active ? "bg-emerald-50 text-emerald-600" : "bg-slate-100 text-slate-400"
                       )}>
                         {service.is_active ? "Active" : "Paused"}
                       </button>
                    </form>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Pending Requests */}
          <section className="bg-white rounded-2xl p-5 sm:p-6 border border-slate-200/80 shadow-xs">
             <h3 className="text-xs font-bold uppercase tracking-wider text-[#062e39] mb-4 flex items-center gap-2">
               <CalendarDays className="h-4 w-4 text-[#fd5523]" /> Session Requests
             </h3>
             <div className="space-y-4">
               {pendingBookings.length === 0 ? (
                 <p className="text-slate-400 font-medium text-xs text-center py-8">No pending requests.</p>
               ) : pendingBookings.map((booking) => (
                 <div key={booking.id} className="p-4 rounded-xl bg-[#fff6ee]/60 border border-[#fd5523]/15">
                    <p className="font-semibold text-sm text-[#062e39]">{booking.live_session_services?.title}</p>
                    <div className="flex items-center gap-2 mt-1.5 text-xs text-slate-500">
                       <Clock3 className="h-3 w-3 text-[#fd5523]" />
                       {formatSessionTime(booking.starts_at, booking.ends_at, booking.timezone)}
                    </div>
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mt-3">Learner</p>
                    <p className="text-xs font-semibold text-[#062e39]">{booking.profiles?.full_name || booking.profiles?.email}</p>
                    <div className="mt-4 flex gap-2">
                       <form action={confirmLiveSessionBooking.bind(null, booking.id)} className="flex-1">
                         <Button className="w-full h-9 rounded-xl bg-[#fd5523] text-white text-xs font-semibold">Confirm</Button>
                       </form>
                       <form action={declineLiveSessionBooking.bind(null, booking.id)}>
                         <Button variant="ghost" className="h-9 rounded-xl text-red-500 hover:text-red-700 hover:bg-red-50 text-xs font-semibold">Decline</Button>
                       </form>
                    </div>
                 </div>
               ))}
             </div>
          </section>

          {/* Upcoming Sessions */}
          <section className="bg-white rounded-2xl p-5 sm:p-6 border border-slate-200/80 shadow-xs">
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
