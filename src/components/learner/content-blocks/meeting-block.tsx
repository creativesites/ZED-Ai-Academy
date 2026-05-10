"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import { Button } from "@/components/ui/button";
import { Calendar, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { JaaSMeeting } from "@jitsi/react-sdk";
import { generateJitsiToken } from "@/actions/jitsi";
import { BookingModal } from "@/components/learner/booking-modal";
import { toast } from "sonner";

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

export function MeetingBlock({ content, bookings = [], courseId, lessonId }: { content: Record<string, unknown>, bookings?: any[], courseId?: string, lessonId?: string }) {
  const router = useRouter();
  const serviceId = content.service_id as string | undefined;
  // Find the most relevant booking for this specific service from server props
  const booking = bookings?.find(b => b.service_id === serviceId);
  const meetingId = content.meeting_id as string;
  const title = (content.title as string) || "Live Training Session";
  const startTime = content.start_time as string | undefined;
  const APP_ID = "vpaas-magic-cookie-37a3214c11ef406c81cc165d3d1c2f4f";

  const [joined, setJoined] = useState(false);
  const [joining, setJoining] = useState(false);
  const [jwt, setJwt] = useState<string | null>(null);
  // Initialise from sessionStorage so state survives tab-switching and remounts
  const [optimisticBooked, setOptimisticBooked] = useState(() => {
    if (typeof window === "undefined" || !serviceId) return false;
    return sessionStorage.getItem(SESSION_BOOKED_KEY(serviceId)) === "1";
  });
  const { user } = useUser();

  async function handleJoin(idOverride?: string) {
    const targetRoom = idOverride || meetingId || `zed-academy-room-${Math.random().toString(36).slice(2, 7)}`;
    setJoining(true);
    try {
      const result = await generateJitsiToken(targetRoom, false);
      
      if (result.success && result.token) {
        setJwt(result.token);
        setJoined(true);
        toast.success("Connected to Live Studio!");
      } else {
        throw new Error(result.error || "Failed to generate session token");
      }
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Failed to connect to Jitsi");
    } finally {
      setJoining(false);
    }
  }
  
  // Use either the real booking or our optimistic state
  const currentBooking = booking || (optimisticBooked ? { status: "requested" } : null);

  if (currentBooking) {
    const isConfirmed = currentBooking.status === "confirmed";
    const isRequested = currentBooking.status === "requested" || currentBooking.status === "reschedule_requested";
    // @ts-ignore - currentBooking might be partial for optimistic state
    const zoomMeeting = currentBooking.zoom_meetings?.[0] || currentBooking.zoom_meetings;
    
    const displayMeetingId = zoomMeeting?.zoom_meeting_id || meetingId;
    const displayPassword = zoomMeeting?.zoom_password || (content.password as string | undefined);

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

      if (joined && jwt && user) {
        return (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-bold text-[#062e39] tracking-tight">{title}</h3>
              <Button variant="ghost" size="sm" onClick={() => setJoined(false)} className="text-slate-400">
                Exit Session
              </Button>
            </div>
            <div className="rounded-[2rem] overflow-hidden bg-black h-[600px] border border-slate-100 shadow-xl relative">
              <JaaSMeeting
                appId={APP_ID}
                roomName={displayMeetingId}
                jwt={jwt}
                configOverwrite={{
                  startWithAudioMuted: true,
                  disableInviteFunctions: true,
                  enableWelcomePage: false,
                  prejoinPageEnabled: false,
                }}
                interfaceConfigOverwrite={{
                  TOOLBAR_BUTTONS: [
                    'microphone', 'camera', 'closedcaptions', 'desktop', 'fullscreen',
                    'fodeviceselection', 'hangup', 'profile', 'chat', 'recording',
                    'livestreaming', 'etherpad', 'sharedvideo', 'settings', 'raisehand',
                    'videoquality', 'filmstrip', 'invite', 'feedback', 'stats', 'shortcuts',
                    'tileview', 'videobackgroundblur', 'download', 'help', 'mute-everyone',
                    'security'
                  ],
                }}
                onReadyToClose={() => setJoined(false)}
                getIFrameRef={(iframeRef) => {
                  iframeRef.style.height = '100%';
                  iframeRef.style.width = '100%';
                }}
                spinner={() => (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 text-white/50 bg-[#062e39]">
                    <Loader2 className="h-8 w-8 animate-spin" />
                    <p className="text-sm font-medium">Connecting to Jitsi Studio...</p>
                  </div>
                )}
              />
            </div>
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
            {/* TEMP TEST — remove before launch */}
            <button
              onClick={() => handleJoin(displayMeetingId)}
              disabled={joining}
              className="mt-4 text-xs text-slate-400 underline underline-offset-2 hover:text-slate-600 disabled:opacity-50"
            >
              {joining ? "Connecting…" : "🔧 Test: rejoin room"}
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
                  onClick={() => handleJoin(displayMeetingId)}
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
          </div>

          {/* TEMP TEST — remove before launch */}
          <div className="text-center">
            <button
              onClick={() => handleJoin(displayMeetingId)}
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

  return null;
}
