"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Loader2, Video, Copy, Check } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { LiveSessionRoom } from "@/components/live-sessions/live-session-room";

type Props = {
  bookingId: string;
  roomName: string;
  sessionTitle: string;
  learnerName?: string | null;
  startsAt?: string | null;
  status?: string;
};

export function InstructorJoinButton({
  bookingId,
  roomName,
  sessionTitle,
  learnerName,
  startsAt,
  status = "confirmed",
}: Props) {
  const [joined, setJoined] = useState(false);
  const [copied, setCopied] = useState(false);

  // Canonical room name matching learner studio
  const effectiveRoomName =
    roomName && roomName !== bookingId
      ? roomName
      : `zed-session-${bookingId}`;

  function copyRoomId() {
    navigator.clipboard.writeText(effectiveRoomName).then(() => {
      setCopied(true);
      toast.success("Room ID copied — share with learner if needed");
      setTimeout(() => setCopied(false), 2000);
    });
  }

  const isConfirmed = status === "confirmed";

  if (joined) {
    return (
      <div className="fixed inset-0 z-50 flex flex-col bg-[#062e39]">
        <LiveSessionRoom
          source={{ kind: "booking", bookingId }}
          sessionTitle={`${sessionTitle} (Moderator)`}
          learnerName={learnerName}
          onLeave={() => setJoined(false)}
        />
      </div>
    );
  }

  return (
    <div className="mt-3 flex flex-wrap items-center gap-2">
      <Button
        size="sm"
        onClick={() => setJoined(true)}
        className={cn(
          "rounded-xl gap-2 h-auto px-4 py-2 text-xs font-bold text-white transition-all active:scale-95",
          isConfirmed
            ? "bg-[#fd5523] hover:bg-[#ef4a16] shadow-lg shadow-[#fd5523]/20"
            : "bg-slate-600 hover:bg-slate-500"
        )}
      >
        <Video className="h-3.5 w-3.5" />
        {isConfirmed ? "Join Session Room" : "Test Join (Pending)"}
      </Button>

      <button
        onClick={copyRoomId}
        title="Copy room ID — learner joins this room"
        className="flex items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-1.5 text-xs text-slate-500 hover:text-slate-700 hover:border-slate-300 transition-all h-auto"
      >
        {copied ? <Check className="h-3 w-3 text-green-600" /> : <Copy className="h-3 w-3" />}
        Copy Room ID
      </button>
    </div>
  );
}
