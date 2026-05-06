"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import { Button } from "@/components/ui/button";
import { Calendar, CheckCircle, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { ZoomMeeting } from "@/components/shared/zoom-meeting";
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

export function MeetingBlock({ content, bookings }: { content: Record<string, unknown>, bookings: any[] }) {
  const router = useRouter();
  const serviceId = content.service_id as string | undefined;
  
  // Find the most relevant booking for this specific service
  const booking = bookings?.find(b => b.service_id === serviceId);
  const meetingId = content.meeting_id as string;
  const title = (content.title as string) || "Live Training Session";
  const passWord = content.password as string | undefined;
  const startTime = content.start_time as string | undefined;
  const sdkKey = process.env.NEXT_PUBLIC_ZOOM_MEETING_SDK_KEY ?? process.env.NEXT_PUBLIC_ZOOM_CLIENT_ID;
  
  const [joined, setJoined] = useState(false);
  const [joining, setJoining] = useState(false);
  const [signature, setSignature] = useState<string | null>(null);
  const { user } = useUser();

  async function handleJoin(idOverride?: string) {
    const targetId = idOverride || meetingId;
    setJoining(true);
    try {
      const resp = await fetch("/api/zoom/signature", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ meetingNumber: targetId, role: 0 }),
      });
      
      if (!resp.ok) {
        const errorData = await resp.json();
        throw new Error(errorData.error || "Failed to get signature");
      }

      const data = await resp.json();
      if (data.signature) {
        setSignature(data.signature);
        setJoined(true);
      } else {
        throw new Error("Invalid signature received");
      }
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Failed to connect to Zoom");
    } finally {
      setJoining(false);
    }
  }

  if (booking) {
    const isConfirmed = booking.status === "confirmed";
    const isRequested = booking.status === "requested" || booking.status === "reschedule_requested";
    const zoomMeeting = booking.zoom_meetings?.[0] || booking.zoom_meetings;
    
    const displayMeetingId = zoomMeeting?.zoom_meeting_id || meetingId;
    const displayPassword = zoomMeeting?.zoom_password || passWord;

    if (isRequested) {
      return (
        <div className="rounded-[2rem] border border-dashed border-amber-200 bg-amber-50 p-6 md:p-8">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white text-amber-600 shadow-sm">
              <Calendar className="h-6 w-6" />
            </div>
            <div className="space-y-2 flex-1">
              <p className="text-[10px] font-black uppercase tracking-[0.25em] text-amber-700">Booking Status</p>
              <h3 className="text-2xl font-bold tracking-tight text-[#062e39]">Requested</h3>
              <p className="text-sm leading-relaxed text-slate-600">
                Your booking request for this session is pending instructor approval. You'll receive a notification once it's confirmed.
              </p>
            </div>
          </div>
        </div>
      );
    }

    if (isConfirmed && displayMeetingId) {
      const startsAt = new Date(booking.starts_at).getTime();
      const endsAt = new Date(booking.ends_at).getTime();
      const now = new Date().getTime();
      
      const isLive = now >= (startsAt - 15 * 60_000) && now <= (endsAt + 30 * 60_000);
      const hasEnded = now > (endsAt + 30 * 60_000);

      if (joined && signature && user && isLive) {
        return (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-bold text-[#062e39] tracking-tight">{title}</h3>
              <Button variant="ghost" size="sm" onClick={() => setJoined(false)} className="text-slate-400">
                Exit Session
              </Button>
            </div>
            <ZoomMeeting
              meetingNumber={displayMeetingId}
              passWord={displayPassword}
              signature={signature}
              sdkKey={sdkKey as string}
              userName={user.fullName || user.username || "Learner"}
              userEmail={user.primaryEmailAddress?.emailAddress || ""}
            />
          </div>
        );
      }

      if (hasEnded) {
        return (
          <div className="rounded-[2rem] border border-slate-100 bg-slate-50 p-6 md:p-8 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-slate-400 shadow-sm mb-4">
              <CheckCircle className="h-6 w-6" />
            </div>
            <h3 className="text-xl font-bold text-[#062e39]">Session Completed</h3>
            <p className="mt-2 text-sm text-slate-500">This live session occurred on {new Date(booking.starts_at).toLocaleDateString()}.</p>
          </div>
        );
      }

      return (
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
                  {new Date(booking.starts_at).toLocaleString([], { weekday: 'long', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>

              {!isLive && <Countdown targetDate={booking.starts_at} />}
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
                  <>
                    <Loader2 className="mr-2 h-6 w-6 animate-spin" />
                    Connecting...
                  </>
                ) : (
                  isLive ? "Join Session Now" : "Ready Soon"
                )}
              </Button>
              {isLive && (
                <p className="text-xs font-bold text-[#fd8d69] animate-bounce">
                  Instructor is ready for you!
                </p>
              )}
            </div>
          </div>
        </div>
      );
    }
  }

  // Default booking flow
  if (serviceId && !booking) {
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
              onSuccess={() => router.refresh()}
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
