"use client";

import { useState, useTransition } from "react";
import { Loader2, LogOut, Video, Sparkles, ShieldCheck, Calendar, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ZoomMeeting } from "@/components/shared/zoom-meeting";
import { LiveSessionRoom } from "@/components/live-sessions/live-session-room";
import { DeviceTestModal } from "@/components/live-sessions/device-test-modal";
import { downloadIcsFile, getGoogleCalendarUrl } from "@/lib/calendar/calendar-export";
import {
  endLiveSessionAttendance,
  startLiveSessionAttendance,
} from "@/actions/live-sessions";

type JoinPayload = {
  signature: string;
  meetingNumber: string;
  password: string;
  sdkKey: string;
  displayName: string;
  email: string;
};

type LiveSessionStudioClientProps = {
  bookingId: string;
  canJoin: boolean;
  zoomMeetingId?: string | null;
  startsAt?: string;
  endsAt?: string;
  title?: string;
};

export function LiveSessionStudioClient({
  bookingId,
  canJoin,
  zoomMeetingId,
  startsAt,
  endsAt,
  title = "Live Session Studio",
}: LiveSessionStudioClientProps) {
  const [useZoom, setUseZoom] = useState(false);
  const [zoomPayload, setZoomPayload] = useState<JoinPayload | null>(null);
  const [inJaasStudio, setInJaasStudio] = useState(false);
  const [attendanceId, setAttendanceId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showDeviceModal, setShowDeviceModal] = useState(false);
  const [pending, startTransition] = useTransition();

  // Primary room identifier matching Instructor join room
  const canonicalRoomName = zoomMeetingId || `zed-session-${bookingId}`;

  function handleStartJoinFlow() {
    // Trigger pre-call device test modal
    setShowDeviceModal(true);
  }

  function executeJoinStudio() {
    setError(null);
    startTransition(async () => {
      // First attempt Zoom signature if a zoom meeting ID was passed
      if (zoomMeetingId) {
        try {
          const response = await fetch(`/api/live-sessions/${bookingId}/zoom-signature`, {
            method: "POST",
          });
          if (response.ok) {
            const data = await response.json();
            const attendance = await startLiveSessionAttendance(bookingId);
            setAttendanceId(attendance);
            setZoomPayload(data as JoinPayload);
            setUseZoom(true);
            return;
          }
        } catch (err) {
          console.warn("Zoom connection attempt failed, falling back to JaaS studio:", err);
        }
      }

      // Fallback or default: Enter JaaS Live Session Room
      setInJaasStudio(true);
    });
  }

  function leaveZoomStudio() {
    startTransition(async () => {
      if (attendanceId) await endLiveSessionAttendance(attendanceId);
      setAttendanceId(null);
      setZoomPayload(null);
      setUseZoom(false);
    });
  }

  const handleGoogleCalendar = () => {
    if (!startsAt || !endsAt) return;
    const url = getGoogleCalendarUrl({
      title,
      startsAt,
      endsAt,
      description: "Zed AI Academy Live Interactive Studio Session",
    });
    window.open(url, "_blank");
  };

  const handleDownloadIcs = () => {
    if (!startsAt || !endsAt) return;
    downloadIcsFile({
      title,
      startsAt,
      endsAt,
      description: "Zed AI Academy Live Interactive Studio Session",
    });
  };

  if (useZoom && zoomPayload) {
    return (
      <div className="space-y-5">
        <div className="flex items-center justify-between rounded-2xl bg-white p-4 shadow-sm">
          <div>
            <p className="text-xs font-black uppercase tracking-widest text-green-600">In Zoom Studio</p>
            <p className="text-sm font-semibold text-slate-500">Attendance is being tracked for this session.</p>
          </div>
          <Button onClick={leaveZoomStudio} variant="outline" className="rounded-xl text-red-600">
            <LogOut className="mr-2 h-4 w-4" />
            Leave Studio
          </Button>
        </div>
        <ZoomMeeting
          meetingNumber={zoomPayload.meetingNumber}
          passWord={zoomPayload.password}
          signature={zoomPayload.signature}
          sdkKey={zoomPayload.sdkKey}
          userName={zoomPayload.displayName}
          userEmail={zoomPayload.email}
        />
      </div>
    );
  }

  if (inJaasStudio) {
    return (
      <LiveSessionRoom
        bookingId={bookingId}
        roomName={canonicalRoomName}
        isInstructor={false}
        sessionTitle={title}
        onLeave={() => setInJaasStudio(false)}
      />
    );
  }

  return (
    <div className="rounded-[2.5rem] border border-slate-100 bg-white p-8 lg:p-12 text-center shadow-xl shadow-slate-200/50 relative overflow-hidden">
      <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-3xl bg-[#fff6ee] text-[#fd5523] shadow-inner mb-6">
        <Video className="h-10 w-10" />
      </div>

      <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-orange-50 text-[#fd5523] text-xs font-bold uppercase tracking-wider mb-4">
        <Sparkles className="h-3.5 w-3.5" />
        Encrypted HD Studio
      </div>

      <h2 className="text-3xl font-black text-[#062e39]">Ready for Your Session</h2>
      <p className="mx-auto mt-3 max-w-xl text-slate-500 leading-relaxed text-base">
        Click below to run a quick device check and enter the live studio. Audio, video, live notes, and automated attendance logging will be enabled once you join.
      </p>

      <div className="my-8 grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-lg mx-auto">
        <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-100 text-xs font-bold text-slate-700 flex flex-col items-center gap-1.5">
          <ShieldCheck className="h-5 w-5 text-emerald-500" />
          <span>Secure WebRTC</span>
        </div>
        <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-100 text-xs font-bold text-slate-700 flex flex-col items-center gap-1.5">
          <Video className="h-5 w-5 text-indigo-500" />
          <span>HD Audio & Video</span>
        </div>
        <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-100 text-xs font-bold text-slate-700 flex flex-col items-center gap-1.5">
          <Sparkles className="h-5 w-5 text-amber-500" />
          <span>Auto Attendance</span>
        </div>
      </div>

      {startsAt && endsAt && (
        <div className="mb-8 flex flex-wrap items-center justify-center gap-3">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleGoogleCalendar}
            className="rounded-xl border-slate-200 text-slate-700 hover:border-[#fd5523] text-xs font-bold gap-2"
          >
            <Calendar className="h-4 w-4 text-[#fd5523]" />
            Add to Google Calendar
          </Button>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleDownloadIcs}
            className="rounded-xl border-slate-200 text-slate-700 hover:border-[#fd5523] text-xs font-bold gap-2"
          >
            <Download className="h-4 w-4 text-[#fd5523]" />
            Download .ics Calendar File
          </Button>
        </div>
      )}

      {error && <p className="mb-6 rounded-xl bg-red-50 p-3 text-sm font-semibold text-red-700 max-w-md mx-auto">{error}</p>}

      <Button
        onClick={handleStartJoinFlow}
        disabled={!canJoin || pending}
        className="rounded-2xl bg-[#fd5523] hover:bg-[#ef4a16] px-10 py-7 text-white font-black text-lg shadow-xl shadow-[#fd5523]/20 transition-all active:scale-95"
      >
        {pending ? (
          <>
            <Loader2 className="mr-3 h-5 w-5 animate-spin" />
            Connecting to Studio...
          </>
        ) : canJoin ? (
          "Test Devices & Enter Studio"
        ) : (
          "Studio Opens Near Session Time"
        )}
      </Button>

      {!canJoin && (
        <p className="mt-4 text-xs font-semibold text-slate-400">
          Sessions can be entered 15 minutes before the scheduled start time.
        </p>
      )}

      {/* Pre-Call Device Test Modal */}
      <DeviceTestModal
        open={showDeviceModal}
        onOpenChange={setShowDeviceModal}
        onConfirmJoin={executeJoinStudio}
        sessionTitle={title}
      />
    </div>
  );
}
