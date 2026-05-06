import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { CalendarDays, CheckCircle, Clock3, Video } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getLiveSessionSlots } from "@/lib/live-sessions/slots";
import { requestLiveSessionBooking } from "@/actions/live-sessions";
import { Button } from "@/components/ui/button";
import type { LiveSessionBooking } from "@/types/database";
import { LiveSessionBookingUI } from "@/components/learner/booking-ui";

export const metadata = { title: "Book Live Session" };

type PageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ timezone?: string; from?: string; to?: string }>;
};

function formatExistingBooking(booking: LiveSessionBooking) {
  const date = new Intl.DateTimeFormat("en", {
    timeZone: booking.timezone,
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(booking.starts_at));

  return `${date} · ${booking.status.replace(/_/g, " ")}`;
}

export default async function BookLiveSessionPage({ params, searchParams }: PageProps) {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const { id } = await params;
  const query = await searchParams;
  const timezone = query.timezone ?? "Africa/Lusaka";
  const supabase = createClient();

  const [{ service, days }, { data: existingBookings }] = await Promise.all([
    getLiveSessionSlots(supabase, id, {
      timezone,
      from: query.from,
      to: query.to,
    }),
    supabase
      .from("live_session_bookings")
      .select("*")
      .eq("learner_id", userId)
      .eq("service_id", id)
      .in("status", ["requested", "confirmed", "reschedule_requested"])
      .order("starts_at", { ascending: true }),
  ]);

  const activeBookings = (existingBookings ?? []) as LiveSessionBooking[];
  const slotCount = days.reduce((count, day) => count + day.slots.length, 0);

  return (
    <main className="container" style={{ paddingTop: "60px", paddingBottom: "120px" }}>
      <div className="grid gap-8 lg:grid-cols-[0.85fr_1.15fr]">
        <aside className="space-y-6">
          <div className="rounded-[2rem] bg-[#062e39] p-8 text-white shadow-2xl">
            <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-white/10 text-[#fd5523]">
              <Video className="h-7 w-7" />
            </div>
            <p className="text-xs font-black uppercase tracking-[0.25em] text-[#fd8d69]">Live Session</p>
            <h1 className="mt-3 text-4xl font-bold tracking-tight">{service.title}</h1>
            {service.description && <p className="mt-4 text-base leading-relaxed text-white/70">{service.description}</p>}

            <div className="mt-8 grid gap-3">
              <div className="flex items-center gap-3 rounded-2xl bg-white/10 px-4 py-3">
                <Clock3 className="h-5 w-5 text-[#fd5523]" />
                <span className="text-sm font-bold">{service.duration_minutes} minutes</span>
              </div>
              <div className="flex items-center gap-3 rounded-2xl bg-white/10 px-4 py-3">
                <CalendarDays className="h-5 w-5 text-[#fd5523]" />
                <span className="text-sm font-bold">{slotCount} available slot{slotCount !== 1 ? "s" : ""}</span>
              </div>
            </div>
          </div>

          <div className="rounded-[2rem] border border-slate-100 bg-white p-6 shadow-xl shadow-slate-200/50">
            <h2 className="text-lg font-bold text-[#062e39]">Your Current Requests</h2>
            <div className="mt-4 space-y-3">
              {activeBookings.length === 0 ? (
                <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500">You have no active booking for this session type.</p>
              ) : activeBookings.map((booking) => (
                <div key={booking.id} className="rounded-xl border border-slate-100 p-4">
                  <div className="flex items-start gap-3">
                    <CheckCircle className="mt-0.5 h-5 w-5 text-green-600" />
                    <div>
                      <p className="text-sm font-bold text-[#062e39]">{formatExistingBooking(booking)}</p>
                      <p className="mt-1 text-xs text-slate-500">
                        {booking.status === "requested"
                          ? "Waiting for instructor confirmation."
                          : "Your session is confirmed."}
                      </p>
                      {booking.status === "confirmed" && (
                        <Link href={`/live-sessions/${booking.id}/studio`} className="mt-3 inline-flex text-sm font-bold text-[#fd5523]">
                          Open live studio
                        </Link>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <Link href="/dashboard" className="inline-flex text-sm font-bold text-[#062e39] hover:text-[#fd5523]">
            Back to dashboard
          </Link>
        </aside>

        <section className="rounded-[3rem] border-2 border-slate-100 bg-white shadow-2xl shadow-slate-200/50 overflow-hidden">
          <LiveSessionBookingUI serviceId={id} />
        </section>
      </div>
    </main>
  );
}
