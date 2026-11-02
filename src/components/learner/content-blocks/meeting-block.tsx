"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import { Button } from "@/components/ui/button";
import { Calendar, Loader2, Download, Bell, Video, Check, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";
import { LiveSessionRoom } from "@/components/live-sessions/live-session-room";
import { BookingModal } from "@/components/learner/booking-modal";
import { createPersonalReminder } from "@/actions/notifications";
import { toast } from "sonner";

function getMeetingGoogleCalendarUrl(title: string, startTime?: string) {
  const encTitle = encodeURIComponent(title || "Live Training Session");
  const url = typeof window !== "undefined" ? window.location.href : "";
  const encDetails = encodeURIComponent(`Live training session in your coursework.\n\nJoin link: ${url}`);
  const encLoc = encodeURIComponent("Zed AI Academy Live Studio");

  let startIso = "";
  let endIso = "";
  if (startTime && !isNaN(Date.parse(startTime))) {
    const s = new Date(startTime);
    const e = new Date(s.getTime() + 60 * 60 * 1000);
    startIso = s.toISOString().replace(/-|:|\.\d\d\d/g, "");
    endIso = e.toISOString().replace(/-|:|\.\d\d\d/g, "");
  } else {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    d.setHours(10, 0, 0, 0);
    const end = new Date(d.getTime() + 60 * 60 * 1000);
    startIso = d.toISOString().replace(/-|:|\.\d\d\d/g, "");
    endIso = end.toISOString().replace(/-|:|\.\d\d\d/g, "");
  }
  return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encTitle}&dates=${startIso}/${endIso}&details=${encDetails}&location=${encLoc}`;
}

function downloadMeetingIcs(title: string, startTime?: string) {
  const encTitle = title || "Live Training Session";
  const url = typeof window !== "undefined" ? window.location.href : "";
  let startIso = new Date().toISOString().replace(/-|:|\.\d\d\d/g, "");
  let endIso = new Date(Date.now() + 3600000).toISOString().replace(/-|:|\.\d\d\d/g, "");

  if (startTime && !isNaN(Date.parse(startTime))) {
    const s = new Date(startTime);
    const e = new Date(s.getTime() + 3600000);
    startIso = s.toISOString().replace(/-|:|\.\d\d\d/g, "");
    endIso = e.toISOString().replace(/-|:|\.\d\d\d/g, "");
  }

  const ics = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Zed AI Academy//Live Lesson//EN",
    "CALSCALE:GREGORIAN",
    "BEGIN:VEVENT",
    `SUMMARY:${encTitle}`,
    `DESCRIPTION:Live training session\\nJoin URL: ${url}`,
    `URL:${url}`,
    `DTSTART:${startIso}`,
    `DTEND:${endIso}`,
    "STATUS:CONFIRMED",
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");

  const blob = new Blob([ics], { type: "text/calendar;charset=utf-8" });
  const link = document.createElement("a");
  link.href = window.URL.createObjectURL(blob);
  link.setAttribute("download", `${encTitle.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.ics`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  toast.success("Calendar invite (.ics) downloaded!");
}

function Countdown({ targetDate, onComplete }: { targetDate: string; onComplete?: () => void }) {
  const [timeLeft, setTimeLeft] = useState<{ d: number; h: number; m: number; s: number } | null>(null);

  useEffect(() => {
    const calculateTimeLeft = () => {
      const difference = new Date(targetDate).getTime() - new Date().getTime();
      if (difference <= 0) {
        onComplete?.();
        return null;
      }
      return {
        d: Math.floor(difference / (1000 * 60 * 60 * 24)),
        h: Math.floor((difference / (1000 * 60 * 60)) % 24),
        m: Math.floor((difference / 1000 / 60) % 60),
        s: Math.floor((difference / 1000) % 60),
      };
    };

    setTimeLeft(calculateTimeLeft());
    const timer = setInterval(() => {
      const next = calculateTimeLeft();
      setTimeLeft(next);
      if (!next) clearInterval(timer);
    }, 1000);

    return () => clearInterval(timer);
  }, [targetDate, onComplete]);

  if (!timeLeft) return null;

  return (
    <div className="flex gap-4">
      {[
        { label: "days", value: timeLeft.d },
        { label: "hours", value: timeLeft.h },
        { label: "mins", value: timeLeft.m },
        { label: "secs", value: timeLeft.s },
      ].map((unit) => (
        <div key={unit.label} className="flex flex-col items-center">
          <div className="text-3xl sm:text-4xl font-black text-white">{String(unit.value).padStart(2, '0')}</div>
          <div className="text-[10px] font-black uppercase tracking-widest text-[#fd8d69]">{unit.label}</div>
        </div>
      ))}
    </div>
  );
}

const SESSION_BOOKED_KEY = (serviceId: string) => `zed_booked_${serviceId}`;

export function MeetingBlock({
  content,
  bookings = [],
  courseId,
  lessonId,
  blockId,
  previewMode = false,
}: {
  content: Record<string, unknown>;
  bookings?: any[];
  courseId?: string;
  lessonId?: string;
  blockId?: string;
  previewMode?: boolean;
}) {
  return <MeetingBlockInner content={content} bookings={bookings} courseId={courseId} lessonId={lessonId} blockId={blockId} previewMode={previewMode} />;
}

export function MeetingBlockInner({
  content,
  bookings = [],
  courseId,
  lessonId,
  blockId,
  previewMode = false,
}: {
  content: Record<string, unknown>;
  bookings?: any[];
  courseId?: string;
  lessonId?: string;
  blockId?: string;
  previewMode?: boolean;
}) {
  const router = useRouter();
  const serviceId = content.service_id as string | undefined;
  // Find the most relevant booking for this specific service from server props
  const booking = bookings?.find(b => b.service_id === serviceId);
  const meetingId = content.meeting_id as string;
  const title = (content.title as string) || "Live Training Session";
  const startTime = content.start_time as string | undefined;

  const [joined, setJoined] = useState(false);
  const [joining, setJoining] = useState(false);
  const [reminding, setReminding] = useState(false);
  const [reminded, setReminded] = useState(false);

  // Initialise from sessionStorage so state survives tab-switching and remounts
  const [optimisticBooked, setOptimisticBooked] = useState(() => {
    if (typeof window === "undefined" || !serviceId) return false;
    return sessionStorage.getItem(SESSION_BOOKED_KEY(serviceId)) === "1";
  });
  const { user } = useUser();

  async function handleRemindMe(customTitle: string, customTime?: string) {
    setReminding(true);
    try {
      await createPersonalReminder({
        title: customTitle,
        body: customTime ? `Scheduled for ${customTime}. Don't miss it!` : "Starting soon in your coursework.",
        url: typeof window !== "undefined" ? window.location.href : undefined,
      });
      setReminded(true);
      toast.success("Reminder saved! We'll notify you in your student bell.");
    } catch (err: any) {
      toast.error(err.message || "Failed to set reminder");
    } finally {
      setReminding(false);
    }
  }

  if (previewMode) {
    return (
      <div className="rounded-[2rem] border border-slate-200 bg-white p-6 md:p-8">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#fff6ee] text-[#fd5523] shadow-sm">
            <Calendar className="h-6 w-6" />
          </div>
          <div className="flex-1 space-y-2">
            <p className="text-[10px] font-black uppercase tracking-[0.25em] text-[#fd5523]">Live Session Preview</p>
            <h3 className="text-2xl font-bold tracking-tight text-[#062e39]">{title}</h3>
            <p className="text-sm leading-relaxed text-slate-600">
              {startTime
                ? `Learners will see the schedule, countdown, and join flow for ${new Date(startTime).toLocaleString()}.`
                : "Learners will see the booking or join flow here once session details are configured."}
            </p>
            <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-semibold text-slate-500">
                This preview suppresses live meeting controls and booking actions inside the editor.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  function handleJoin() {
    setJoining(true);
    setJoined(true);
    setJoining(false);
  }
  
  // Use either the real booking or our optimistic state
  const currentBooking = booking || (optimisticBooked ? { status: "requested" } : null);

  if (currentBooking) {
    const isConfirmed = currentBooking.status === "confirmed";
    const isRequested = currentBooking.status === "requested" || currentBooking.status === "reschedule_requested";
    // @ts-ignore - currentBooking might be partial for optimistic state
    const zoomMeeting = currentBooking.zoom_meetings?.[0] || currentBooking.zoom_meetings;
    
    const displayMeetingId = zoomMeeting?.zoom_meeting_id || meetingId;

    if (isRequested) {
      const bookedAt = (currentBooking as any).starts_at
        ? new Date((currentBooking as any).starts_at).toLocaleString([], {
            weekday: "short", month: "short", day: "numeric",
            hour: "2-digit", minute: "2-digit",
          })
        : null;

      return (
        <div className="rounded-[2rem] border border-dashed border-amber-200 bg-amber-50 p-6 md:p-8">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white text-amber-600 shadow-sm">
              <Calendar className="h-6 w-6" />
            </div>
            <div className="space-y-2 flex-1">
              <p className="text-[10px] font-black uppercase tracking-[0.25em] text-amber-700">Booking Status</p>
              <h3 className="text-2xl font-bold tracking-tight text-[#062e39]">Session Requested</h3>
              {bookedAt && (
                <p className="text-sm font-semibold text-amber-800">{bookedAt}</p>
              )}
              <p className="text-sm leading-relaxed text-slate-600">
                Your booking is pending instructor approval. You'll be notified once it's confirmed.
              </p>
              {serviceId && (
                <div className="pt-2">
                  <BookingModal
                    serviceId={serviceId}
                    courseId={courseId}
                    lessonId={lessonId}
                    onSuccess={() => router.refresh()}
                    trigger={
                      <Button
                        variant="outline"
                        size="sm"
                        className="rounded-xl border-amber-300 text-amber-700 hover:bg-amber-100 h-auto px-4 py-2 text-xs font-bold"
                      >
                        <Calendar className="mr-1.5 h-3.5 w-3.5" />
                        Change Booking Time
                      </Button>
                    }
                  />
                </div>
              )}
            </div>
          </div>
        </div>
      );
    }

    if (isConfirmed && displayMeetingId) {
      const confirmedBooking = currentBooking as any;
      const startsAt = confirmedBooking.starts_at ? new Date(confirmedBooking.starts_at).getTime() : 0;
      const endsAt = confirmedBooking.ends_at ? new Date(confirmedBooking.ends_at).getTime() : 0;
      const now = new Date().getTime();
      const isLive = startsAt > 0 && endsAt > 0 && now >= (startsAt - 15 * 60_000) && now <= (endsAt + 30 * 60_000);
      const hasEnded = endsAt > 0 && now > (endsAt + 30 * 60_000);

      if (joined && user) {
        return (
          <div className="space-y-4">
            <LiveSessionRoom
              source={{ kind: "booking", bookingId: confirmedBooking.id }}
              sessionTitle={title}
              onLeave={() => setJoined(false)}
            />
          </div>
        );
      }

      if (hasEnded) {
        return (
          <div className="rounded-[2rem] border border-slate-100 bg-slate-50 p-6 md:p-8 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-slate-400 shadow-sm mb-4">
              <Calendar className="h-6 w-6" />
            </div>
            <h3 className="text-xl font-bold text-[#062e39]">Session Completed</h3>
            <p className="mt-2 text-sm text-slate-500">
              This live session occurred on {confirmedBooking.starts_at ? new Date(confirmedBooking.starts_at).toLocaleDateString() : "a past date"}.
            </p>
            <button
              onClick={handleJoin}
              disabled={joining}
              className="mt-4 text-xs text-slate-400 underline underline-offset-2 hover:text-slate-600 disabled:opacity-50"
            >
              {joining ? "Connecting…" : "🔧 Rejoin room"}
            </button>
          </div>
        );
      }

      return (
        <div className="space-y-3">
          <div className="rounded-[2.5rem] bg-[#062e39] p-6 md:p-10 text-white shadow-2xl relative overflow-hidden group">
            <div className="absolute inset-0 mesh-orange opacity-20 transition-opacity group-hover:opacity-30" />
            <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-10">
              <div className="space-y-6">
                <div className="flex items-center gap-3">
                  <div className={cn(
                    "flex h-10 w-10 items-center justify-center rounded-xl bg-white/10 text-[#fd5523]",
                    isLive && "animate-pulse"
                  )}>
                    {isLive ? <div className="h-2 w-2 rounded-full bg-[#fd5523]" /> : <Calendar className="h-5 w-5" />}
                  </div>
                  <span className="text-[10px] font-bold uppercase tracking-[0.25em] text-[#fd8d69]">
                    {isLive ? "Session is Live" : "Confirmed Session"}
                  </span>
                </div>

                <div>
                  <h3 className="text-3xl text-white font-bold tracking-tight">{title}</h3>
                  <p className="mt-2 text-white/60 font-medium">
                    {confirmedBooking.starts_at
                      ? new Date(confirmedBooking.starts_at).toLocaleString([], { weekday: 'long', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })
                      : "Confirmed"}
                  </p>
                </div>

                {!isLive && confirmedBooking.starts_at && <Countdown targetDate={confirmedBooking.starts_at} />}
              </div>

              <div className="flex flex-col items-center gap-4">
                <Button
                  className={cn(
                    "rounded-2xl px-10 py-8 text-xl font-black text-white shadow-2xl transition-all duration-300",
                    isLive
                      ? "bg-[#fd5523] hover:bg-[#ef4a16] shadow-[#fd5523]/40 hover:scale-105 active:scale-95"
                      : "bg-white/10 hover:bg-white/20 text-white/40 cursor-not-allowed"
                  )}
                  onClick={handleJoin}
                  disabled={joining || !isLive}
                >
                  {joining ? (
                    <><Loader2 className="mr-2 h-6 w-6 animate-spin" />Connecting...</>
                  ) : isLive ? "Join Session Now" : "Ready Soon"}
                </Button>
                {isLive && (
                  <p className="text-xs font-bold text-[#fd8d69] animate-bounce">
                    Instructor is ready for you!
                  </p>
                )}
              </div>
            </div>

            {/* Calendar & Reminder Toolbar */}
            <div className="relative z-10 mt-8 pt-6 border-t border-white/10 flex flex-wrap items-center justify-between gap-3 text-xs">
              <div className="flex flex-wrap items-center gap-2">
                <a
                  href={getMeetingGoogleCalendarUrl(title, confirmedBooking.starts_at)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold transition-all"
                >
                  <Calendar className="h-3.5 w-3.5 text-[#fd8d69]" />
                  Add to Google Calendar
                </a>
                <button
                  type="button"
                  onClick={() => downloadMeetingIcs(title, confirmedBooking.starts_at)}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold transition-all"
                >
                  <Download className="h-3.5 w-3.5 text-slate-300" />
                  Download .ics
                </button>
              </div>

              <button
                type="button"
                onClick={() => handleRemindMe(title, confirmedBooking.starts_at)}
                disabled={reminding || reminded}
                className={cn(
                  "inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl font-bold transition-all",
                  reminded
                    ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                    : "bg-[#fd5523]/20 hover:bg-[#fd5523]/30 text-[#fd8d69] border border-[#fd5523]/30"
                )}
              >
                {reminded ? <Check className="h-3.5 w-3.5" /> : <Bell className="h-3.5 w-3.5" />}
                <span>{reminded ? "Reminder Set" : reminding ? "Saving..." : "Remind Me"}</span>
              </button>
            </div>
          </div>

          <div className="text-center">
            <button
              onClick={handleJoin}
              disabled={joining}
              className="text-xs text-slate-400 underline underline-offset-2 hover:text-slate-600 disabled:opacity-50"
            >
              {joining ? "Connecting…" : "🔧 Test: join room now (bypass schedule)"}
            </button>
          </div>
        </div>
      );
    }
  }

  // Default booking flow — only shown when there is no booking at all (real or optimistic)
  if (serviceId && !currentBooking) {
    return (
      <div className="rounded-[2rem] border border-dashed border-[#fd5523]/30 bg-[#fff6ee] p-6 md:p-8">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white text-[#fd5523] shadow-sm">
            <Calendar className="h-6 w-6" />
          </div>
          <div className="space-y-4 flex-1">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.25em] text-[#fd5523]">Live Session</p>
              <h3 className="mt-2 text-2xl font-bold tracking-tight text-[#062e39]">{title}</h3>
            </div>
            {startTime && <p className="text-sm font-semibold text-slate-600">{startTime}</p>}
            <p className="max-w-2xl text-sm leading-relaxed text-slate-600">
              This session requires booking a specific time slot with the instructor.
            </p>
            <BookingModal
              serviceId={serviceId}
              courseId={courseId}
              lessonId={lessonId}
              onSuccess={() => {
                if (serviceId) sessionStorage.setItem(SESSION_BOOKED_KEY(serviceId), "1");
                setOptimisticBooked(true);
                router.refresh();
              }}
              trigger={
                <Button className="rounded-xl bg-[#fd5523] px-6 py-4 text-white hover:bg-[#ef4a16] h-auto">
                  Book Your Slot
                  <Calendar className="ml-2 h-4 w-4" />
                </Button>
              }
            />
          </div>
        </div>
      </div>
    );
  }

  // Standalone live class in coursework (not tied to 1-on-1 booking service).
  // The server derives the room from this block; it needs the block id.
  if (joined && user && blockId) {
    return (
      <div className="space-y-4">
        <LiveSessionRoom
          source={{ kind: "lesson", blockId }}
          sessionTitle={title}
          onLeave={() => setJoined(false)}
        />
      </div>
    );
  }

  if (meetingId || startTime) {
    return (
      <div className="space-y-3">
        <div className="rounded-[2.5rem] bg-[#062e39] p-6 md:p-10 text-white shadow-2xl relative overflow-hidden group">
          <div className="absolute inset-0 mesh-orange opacity-20 transition-opacity group-hover:opacity-30" />
          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-8">
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/10 text-[#fd5523]">
                  <Video className="h-5 w-5" />
                </div>
                <span className="text-[10px] font-bold uppercase tracking-[0.25em] text-[#fd8d69]">
                  Live Class in Coursework
                </span>
              </div>

              <div>
                <h3 className="text-2xl sm:text-3xl text-white font-bold tracking-tight">{title}</h3>
                <p className="mt-2 text-white/70 font-medium text-sm">
                  {startTime ? `Scheduled for: ${startTime}` : "Live interactive workshop session."}
                </p>
              </div>

              {startTime && !isNaN(Date.parse(startTime)) && (
                <Countdown targetDate={startTime} />
              )}
            </div>

            <div className="flex flex-col items-center sm:items-end gap-3">
              <Button
                className="rounded-2xl px-8 py-7 text-lg font-black bg-[#fd5523] hover:bg-[#ef4a16] text-white shadow-xl shadow-[#fd5523]/30 hover:scale-105 active:scale-95 transition-all"
                onClick={handleJoin}
                disabled={joining || !blockId}
              >
                {joining ? (
                  <><Loader2 className="mr-2 h-5 w-5 animate-spin" />Entering...</>
                ) : (
                  <>
                    <Video className="mr-2 h-5 w-5" />
                    Join Live Class
                  </>
                )}
              </Button>
            </div>
          </div>

          {/* Action Toolbar */}
          <div className="relative z-10 mt-8 pt-6 border-t border-white/10 flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex flex-wrap items-center gap-2">
              <a
                href={getMeetingGoogleCalendarUrl(title, startTime)}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold transition-all"
              >
                <Calendar className="h-3.5 w-3.5 text-[#fd8d69]" />
                Add to Google Calendar
              </a>
              <button
                type="button"
                onClick={() => downloadMeetingIcs(title, startTime)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold transition-all"
              >
                <Download className="h-3.5 w-3.5 text-slate-300" />
                Download .ics
              </button>
            </div>

            <button
              type="button"
              onClick={() => handleRemindMe(title, startTime)}
              disabled={reminding || reminded}
              className={cn(
                "inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl font-bold transition-all",
                reminded
                  ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                  : "bg-[#fd5523]/20 hover:bg-[#fd5523]/30 text-[#fd8d69] border border-[#fd5523]/30"
              )}
            >
              {reminded ? <Check className="h-3.5 w-3.5" /> : <Bell className="h-3.5 w-3.5" />}
              <span>{reminded ? "Reminder Set" : reminding ? "Saving..." : "Remind Me"}</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Graceful fallback for unconfigured meeting block
  return (
    <div className="rounded-[2rem] border border-dashed border-slate-200 bg-slate-50/50 p-6 sm:p-8 text-center">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-slate-400 shadow-sm mb-3">
        <Video className="h-6 w-6" />
      </div>
      <h4 className="text-base font-bold text-[#062e39]">{title || "Live Session"}</h4>
      <p className="mt-1 text-xs text-slate-500 max-w-md mx-auto">
        Live session room and schedule details will be configured by the instructor. Check back soon or visit your School Timetable.
      </p>
    </div>
  );
}
