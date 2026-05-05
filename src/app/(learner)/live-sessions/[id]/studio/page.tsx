import { auth } from "@clerk/nextjs/server";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { CalendarDays, Clock3, Users, Video } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { LiveSessionStudioClient } from "@/components/live-sessions/live-session-studio-client";
import type { LiveSessionBooking } from "@/types/database";

export const metadata = { title: "Live Session Studio" };

type PageProps = {
  params: Promise<{ id: string }>;
};

type BookingWithRelations = LiveSessionBooking & {
  live_session_services: { title: string; description: string | null } | null;
  profiles_live_session_bookings_learner_id_fkey?: { full_name: string | null; email: string | null } | null;
};

function formatDateTime(startsAt: string, endsAt: string, timezone: string) {
  const start = new Intl.DateTimeFormat("en", {
    timeZone: timezone,
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(startsAt));
  const end = new Intl.DateTimeFormat("en", {
    timeZone: timezone,
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(endsAt));
  return `${start} - ${end}`;
}

export default async function LiveSessionStudioPage({ params }: PageProps) {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const { id } = await params;
  const supabase = createClient();
  const { data: bookingRaw } = await supabase
    .from("live_session_bookings")
    .select("*, live_session_services(title, description)")
    .eq("id", id)
    .single();

  const booking = bookingRaw as unknown as BookingWithRelations | null;
  if (!booking) notFound();
  if (booking.learner_id !== userId && booking.instructor_id !== userId) notFound();

  const { data: zoomMeeting } = await supabase
    .from("zoom_meetings")
    .select("id")
    .eq("booking_id", booking.id)
    .maybeSingle();

  const canJoin = Boolean(
    booking.status === "confirmed"
      && zoomMeeting
  );

  return (
    <main className="container" style={{ paddingTop: "60px", paddingBottom: "120px" }}>
      <div className="mb-8 flex flex-col justify-between gap-5 md:flex-row md:items-end">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.25em] text-[#fd5523]">Live Session Studio</p>
          <h1 className="mt-3 text-4xl font-bold tracking-tight text-[#062e39]">
            {booking.live_session_services?.title ?? "Live Session"}
          </h1>
          {booking.live_session_services?.description && (
            <p className="mt-3 max-w-2xl text-slate-500">{booking.live_session_services.description}</p>
          )}
        </div>
        <Link href="/dashboard" className="text-sm font-bold text-[#062e39] hover:text-[#fd5523]">
          Back to dashboard
        </Link>
      </div>

      <div className="grid gap-8 lg:grid-cols-[0.75fr_1.25fr]">
        <aside className="space-y-5">
          <div className="rounded-[2rem] bg-[#062e39] p-6 text-white shadow-xl">
            <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10 text-[#fd5523]">
              <Video className="h-6 w-6" />
            </div>
            <p className="text-xs font-black uppercase tracking-widest text-[#fd8d69]">Status</p>
            <p className="mt-2 text-2xl font-bold capitalize">{booking.status.replace(/_/g, " ")}</p>
          </div>

          <div className="rounded-[2rem] border border-slate-100 bg-white p-6 shadow-xl shadow-slate-200/50">
            <div className="space-y-4">
              <div className="flex gap-3">
                <CalendarDays className="mt-0.5 h-5 w-5 text-[#fd5523]" />
                <p className="text-sm font-semibold text-slate-700">{formatDateTime(booking.starts_at, booking.ends_at, booking.timezone)}</p>
              </div>
              <div className="flex gap-3">
                <Clock3 className="mt-0.5 h-5 w-5 text-[#fd5523]" />
                <p className="text-sm font-semibold text-slate-700">{booking.timezone}</p>
              </div>
              <div className="flex gap-3">
                <Users className="mt-0.5 h-5 w-5 text-[#fd5523]" />
                <p className="text-sm font-semibold text-slate-700">Learner and instructor only</p>
              </div>
            </div>
          </div>

          {booking.learner_notes && (
            <div className="rounded-[2rem] border border-slate-100 bg-white p-6 shadow-xl shadow-slate-200/50">
              <p className="text-xs font-black uppercase tracking-widest text-slate-400">Learner goals</p>
              <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-slate-700">{booking.learner_notes}</p>
            </div>
          )}
        </aside>

        <section>
          {!zoomMeeting && (
            <div className="mb-5 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-900">
              This booking is confirmed, but a Zoom meeting has not been created yet. Confirm again after Zoom REST credentials are configured.
            </div>
          )}
          <LiveSessionStudioClient bookingId={booking.id} canJoin={canJoin} />
        </section>
      </div>
    </main>
  );
}
