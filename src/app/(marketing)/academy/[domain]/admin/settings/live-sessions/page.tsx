import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import {
  CalendarDays,
  CheckCircle,
  Clock3,
  Plus,
  Video,
  XCircle,
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

export const metadata = { title: "Live Sessions" };

const WEEKDAYS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

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

export default async function CreatorLiveSessionsPage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const supabase = createClient();
  const [
    { data: coursesData },
    { data: servicesData },
    { data: rulesData },
    { data: bookingsData },
  ] = await Promise.all([
    supabase
      .from("courses")
      .select("id, title, status")
      .eq("instructor_id", userId)
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
    <main className="container" style={{ paddingTop: "60px", paddingBottom: "120px" }}>
      <div className="mb-10 flex flex-col justify-between gap-5 md:flex-row md:items-end">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.25em] text-[#fd5523]">Creator Studio</p>
          <h1 className="mt-3 text-4xl font-bold tracking-tight text-[#062e39]">Live Sessions</h1>
          <p className="mt-3 max-w-2xl text-slate-500">
            Set your availability, publish bookable session types, and confirm learner requests.
          </p>
        </div>
        <Link href="/creator/courses" className="text-sm font-bold text-[#062e39] hover:text-[#fd5523]">
          Back to courses
        </Link>
      </div>

      <div className="grid gap-8 xl:grid-cols-[1.1fr_0.9fr]">
        <section className="space-y-8">
          <div className="rounded-[2rem] border border-slate-100 bg-white p-6 shadow-xl shadow-slate-200/50">
            <div className="mb-6 flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#fff6ee] text-[#fd5523]">
                <Plus className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-[#062e39]">Bookable Session Type</h2>
                <p className="text-sm text-slate-500">Create options like Q&A, project review, or coaching.</p>
              </div>
            </div>

            <form action={createLiveSessionService} className="grid gap-4 md:grid-cols-2">
              <label className="space-y-1.5 md:col-span-2">
                <span className="text-xs font-bold uppercase tracking-widest text-slate-400">Title</span>
                <input name="title" required placeholder="30-minute live Q&A" className="h-12 w-full rounded-xl border border-slate-200 px-4 outline-none focus:border-[#fd5523]" />
              </label>
              <label className="space-y-1.5 md:col-span-2">
                <span className="text-xs font-bold uppercase tracking-widest text-slate-400">Description</span>
                <textarea name="description" rows={3} placeholder="What learners should use this session for..." className="w-full rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-[#fd5523]" />
              </label>
              <label className="space-y-1.5">
                <span className="text-xs font-bold uppercase tracking-widest text-slate-400">Course</span>
                <select name="course_id" className="h-12 w-full rounded-xl border border-slate-200 px-4 outline-none focus:border-[#fd5523]">
                  <option value="">General session</option>
                  {courses.map((course) => (
                    <option key={course.id} value={course.id}>{course.title}</option>
                  ))}
                </select>
              </label>
              <label className="space-y-1.5">
                <span className="text-xs font-bold uppercase tracking-widest text-slate-400">Duration</span>
                <input name="duration_minutes" type="number" min={15} max={240} defaultValue={30} className="h-12 w-full rounded-xl border border-slate-200 px-4 outline-none focus:border-[#fd5523]" />
              </label>
              <label className="space-y-1.5">
                <span className="text-xs font-bold uppercase tracking-widest text-slate-400">Min notice hours</span>
                <input name="min_notice_hours" type="number" min={0} defaultValue={12} className="h-12 w-full rounded-xl border border-slate-200 px-4 outline-none focus:border-[#fd5523]" />
              </label>
              <label className="space-y-1.5">
                <span className="text-xs font-bold uppercase tracking-widest text-slate-400">Booking window days</span>
                <input name="max_booking_days" type="number" min={1} defaultValue={30} className="h-12 w-full rounded-xl border border-slate-200 px-4 outline-none focus:border-[#fd5523]" />
              </label>
              <Button type="submit" className="md:col-span-2 rounded-xl bg-[#fd5523] py-6 text-white">
                Create session type
              </Button>
            </form>
          </div>

          <div className="rounded-[2rem] border border-slate-100 bg-white p-6 shadow-xl shadow-slate-200/50">
            <div className="mb-6 flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
                <Clock3 className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-[#062e39]">Weekly Availability</h2>
                <p className="text-sm text-slate-500">Slots are generated from these recurring windows.</p>
              </div>
            </div>

            <form action={createAvailabilityRule} className="grid gap-4 md:grid-cols-[1fr_1fr_1fr_1fr_auto]">
              <select name="weekday" required className="h-12 rounded-xl border border-slate-200 px-4 outline-none focus:border-[#fd5523]">
                {WEEKDAYS.map((day, idx) => <option key={day} value={idx}>{day}</option>)}
              </select>
              <input name="start_time" type="time" required defaultValue="09:00" className="h-12 rounded-xl border border-slate-200 px-4 outline-none focus:border-[#fd5523]" />
              <input name="end_time" type="time" required defaultValue="12:00" className="h-12 rounded-xl border border-slate-200 px-4 outline-none focus:border-[#fd5523]" />
              <input name="timezone" defaultValue="Africa/Lusaka" className="h-12 rounded-xl border border-slate-200 px-4 outline-none focus:border-[#fd5523]" />
              <Button type="submit" className="rounded-xl bg-[#062e39] px-6 text-white">Add</Button>
            </form>

            <div className="mt-6 grid gap-3">
              {rules.length === 0 ? (
                <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500">No availability yet.</p>
              ) : rules.map((rule) => (
                <div key={rule.id} className="flex items-center justify-between rounded-xl border border-slate-100 p-4">
                  <div>
                    <p className="font-bold text-[#062e39]">{WEEKDAYS[rule.weekday]}</p>
                    <p className="text-sm text-slate-500">{rule.start_time.slice(0, 5)} - {rule.end_time.slice(0, 5)} · {rule.timezone}</p>
                  </div>
                  <form action={deleteAvailabilityRule.bind(null, rule.id)}>
                    <Button variant="ghost" className="text-red-500 hover:bg-red-50">Remove</Button>
                  </form>
                </div>
              ))}
            </div>
          </div>
        </section>

        <aside className="space-y-8">
          <div className="rounded-[2rem] border border-slate-100 bg-white p-6 shadow-xl shadow-slate-200/50">
            <div className="mb-6 flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-green-50 text-green-600">
                <Video className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-[#062e39]">Published Services</h2>
                <p className="text-sm text-slate-500">{services.length} session type{services.length !== 1 ? "s" : ""}</p>
              </div>
            </div>

            <div className="space-y-4">
              {services.length === 0 ? (
                <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500">Create your first session type to get a booking link.</p>
              ) : services.map((service) => (
                <div key={service.id} className="rounded-2xl border border-slate-100 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="font-bold text-[#062e39]">{service.title}</h3>
                      <p className="mt-1 text-sm text-slate-500">{service.duration_minutes} min · {service.is_active ? "Active" : "Paused"}</p>
                    </div>
                    <form action={updateLiveSessionServiceStatus.bind(null, service.id, !service.is_active)}>
                      <Button type="submit" variant="outline" className="rounded-xl">
                        {service.is_active ? "Pause" : "Activate"}
                      </Button>
                    </form>
                  </div>
                  <Link href={`/live-sessions/${service.id}/book`} className="mt-4 inline-flex text-sm font-bold text-[#fd5523]">
                    View learner booking page
                  </Link>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-[2rem] border border-slate-100 bg-white p-6 shadow-xl shadow-slate-200/50">
            <div className="mb-6 flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#fff6ee] text-[#fd5523]">
                <CalendarDays className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-[#062e39]">Requests</h2>
                <p className="text-sm text-slate-500">{pendingBookings.length} pending confirmation</p>
              </div>
            </div>

            <div className="space-y-4">
              {pendingBookings.length === 0 ? (
                <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500">No pending requests.</p>
              ) : pendingBookings.map((booking) => (
                <div key={booking.id} className="rounded-2xl border border-[#fd5523]/20 bg-[#fff6ee]/40 p-4">
                  <p className="font-bold text-[#062e39]">{booking.live_session_services?.title ?? "Live Session"}</p>
                  <p className="mt-1 text-sm text-slate-600">{formatSessionTime(booking.starts_at, booking.ends_at, booking.timezone)}</p>
                  <p className="mt-1 text-xs text-slate-500">{booking.profiles?.full_name ?? booking.profiles?.email ?? "Learner"}</p>
                  {booking.learner_notes && <p className="mt-3 text-sm text-slate-600">{booking.learner_notes}</p>}
                  <div className="mt-4 flex gap-2">
                    <form action={confirmLiveSessionBooking.bind(null, booking.id)}>
                      <Button type="submit" className="rounded-xl bg-green-600 text-white">
                        <CheckCircle className="mr-2 h-4 w-4" />
                        Confirm
                      </Button>
                    </form>
                    <form action={declineLiveSessionBooking.bind(null, booking.id)}>
                      <Button type="submit" variant="outline" className="rounded-xl text-red-600">
                        <XCircle className="mr-2 h-4 w-4" />
                        Decline
                      </Button>
                    </form>
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
          </div>

          <div className="rounded-[2rem] border border-slate-100 bg-white p-6 shadow-xl shadow-slate-200/50">
            <h2 className="text-xl font-bold text-[#062e39]">Upcoming</h2>
            <div className="mt-5 space-y-3">
              {upcomingBookings.length === 0 ? (
                <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500">No confirmed sessions yet.</p>
              ) : upcomingBookings.map((booking) => (
                <div key={booking.id} className="rounded-xl border border-slate-100 p-4">
                  <p className="font-bold text-[#062e39]">{booking.live_session_services?.title ?? "Live Session"}</p>
                  <p className="mt-1 text-sm text-slate-500">{formatSessionTime(booking.starts_at, booking.ends_at, booking.timezone)}</p>
                  <p className="mt-1 text-xs font-bold uppercase tracking-widest text-green-600">{booking.status.replace(/_/g, " ")}</p>
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
          </div>
        </aside>
      </div>
    </main>
  );
}
