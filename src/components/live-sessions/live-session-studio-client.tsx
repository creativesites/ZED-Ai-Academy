"use client";

import { useState, useTransition } from "react";
import { Loader2, LogOut, Video } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ZoomMeeting } from "@/components/shared/zoom-meeting";
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

export function LiveSessionStudioClient({
  bookingId,
  canJoin,
}: {
  bookingId: string;
  canJoin: boolean;
}) {
  const [joinPayload, setJoinPayload] = useState<JoinPayload | null>(null);
  const [attendanceId, setAttendanceId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function joinStudio() {
    setError(null);
    startTransition(async () => {
      try {
        const response = await fetch(`/api/live-sessions/${bookingId}/zoom-signature`, {
          method: "POST",
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Failed to join studio");
        const attendance = await startLiveSessionAttendance(bookingId);
        setAttendanceId(attendance);
        setJoinPayload(data as JoinPayload);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to join studio");
      }
    });
  }

  function leaveStudio() {
    startTransition(async () => {
      if (attendanceId) await endLiveSessionAttendance(attendanceId);
      setAttendanceId(null);
      setJoinPayload(null);
    });
  }

  if (joinPayload) {
    return (
      <div className="space-y-5">
        <div className="flex items-center justify-between rounded-2xl bg-white p-4 shadow-sm">
          <div>
            <p className="text-xs font-black uppercase tracking-widest text-green-600">In studio</p>
            <p className="text-sm font-semibold text-slate-500">Attendance is being tracked for this browser session.</p>
          </div>
          <Button onClick={leaveStudio} variant="outline" className="rounded-xl text-red-600">
            <LogOut className="mr-2 h-4 w-4" />
            Leave
          </Button>
        </div>
        <ZoomMeeting
          meetingNumber={joinPayload.meetingNumber}
          passWord={joinPayload.password}
          signature={joinPayload.signature}
          sdkKey={joinPayload.sdkKey}
          userName={joinPayload.displayName}
          userEmail={joinPayload.email}
        />
      </div>
    );
  }

  return (
    <div className="rounded-[2rem] border border-slate-100 bg-white p-8 text-center shadow-xl shadow-slate-200/50">
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-[#fff6ee] text-[#fd5523]">
        <Video className="h-8 w-8" />
      </div>
      <h2 className="mt-5 text-2xl font-bold text-[#062e39]">Ready to Join</h2>
      <p className="mx-auto mt-2 max-w-xl text-sm leading-relaxed text-slate-500">
        Join opens the embedded Zoom session and records your attendance for this live session.
      </p>
      {error && <p className="mt-4 rounded-xl bg-red-50 p-3 text-sm font-semibold text-red-700">{error}</p>}
      <Button
        onClick={joinStudio}
        disabled={!canJoin || pending}
        className="mt-6 rounded-xl bg-[#fd5523] px-8 py-6 text-white"
      >
        {pending && <Loader2 className="mr-2 h-5 w-5 animate-spin" />}
        {canJoin ? "Join Live Studio" : "Studio opens near session time"}
      </Button>
    </div>
  );
}
