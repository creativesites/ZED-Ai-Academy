"use client";

import { useState } from "react";
import { JaaSMeeting } from "@jitsi/react-sdk";
import { generateJitsiToken } from "@/actions/jitsi";
import { Button } from "@/components/ui/button";
import { Loader2, Video, X, Copy, Check } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const APP_ID = "vpaas-magic-cookie-37a3214c11ef406c81cc165d3d1c2f4f";

type Props = {
  bookingId: string;
  roomName: string;
  sessionTitle: string;
  learnerName?: string | null;
  startsAt?: string | null;
  status?: string;
};

export function InstructorJoinButton({ bookingId, roomName, sessionTitle, learnerName, startsAt, status = "confirmed" }: Props) {
  const [joined, setJoined] = useState(false);
  const [joining, setJoining] = useState(false);
  const [jwt, setJwt] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function handleJoin() {
    setJoining(true);
    try {
      const result = await generateJitsiToken(roomName, true);
      if (result.success && result.token) {
        setJwt(result.token);
        setJoined(true);
      } else {
        throw new Error(result.error || "Failed to generate session token");
      }
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Failed to connect");
    } finally {
      setJoining(false);
    }
  }

  function copyRoomId() {
    navigator.clipboard.writeText(roomName).then(() => {
      setCopied(true);
      toast.success("Room ID copied — share with the learner to verify they join the same room");
      setTimeout(() => setCopied(false), 2000);
    });
  }

  const isConfirmed = status === "confirmed";

  if (joined && jwt) {
    return (
      <div className="fixed inset-0 z-50 flex flex-col bg-[#062e39]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 shrink-0">
          <div className="flex items-center gap-4">
            <div>
              <p className="text-xs font-black uppercase tracking-widest text-[#fd8d69]">Instructor Studio — Moderator</p>
              <h2 className="text-lg font-bold text-white leading-tight">{sessionTitle}</h2>
              {learnerName && <p className="text-sm text-white/40">with {learnerName}</p>}
            </div>
            {/* Room ID chip */}
            <button
              onClick={copyRoomId}
              className="hidden md:flex items-center gap-2 rounded-xl bg-white/5 border border-white/10 px-3 py-1.5 text-xs text-white/50 hover:text-white hover:bg-white/10 transition-all"
            >
              {copied ? <Check className="h-3 w-3 text-green-400" /> : <Copy className="h-3 w-3" />}
              <span className="font-mono">{roomName.length > 20 ? roomName.slice(0, 20) + "…" : roomName}</span>
            </button>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => { setJoined(false); setJwt(null); }}
            className="text-white/60 hover:text-white hover:bg-white/10 gap-2 rounded-xl"
          >
            <X className="h-4 w-4" />
            Exit Studio
          </Button>
        </div>

        {/* Meeting iframe */}
        <div className="flex-1 relative min-h-0">
          <JaaSMeeting
            appId={APP_ID}
            roomName={roomName}
            jwt={jwt}
            configOverwrite={{
              startWithAudioMuted: false,
              disableInviteFunctions: true,
              enableWelcomePage: false,
              prejoinPageEnabled: false,
            }}
            interfaceConfigOverwrite={{
              TOOLBAR_BUTTONS: [
                'microphone', 'camera', 'desktop', 'fullscreen', 'fodeviceselection',
                'hangup', 'chat', 'recording', 'settings', 'raisehand',
                'tileview', 'mute-everyone', 'security', 'stats', 'closedcaptions',
              ],
            }}
            onReadyToClose={() => { setJoined(false); setJwt(null); }}
            getIFrameRef={(ref) => {
              ref.style.height = '100%';
              ref.style.width = '100%';
            }}
            spinner={() => (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-[#062e39]">
                <Loader2 className="h-10 w-10 animate-spin text-[#fd5523]" />
                <p className="text-sm font-medium text-white/50">Connecting to session room...</p>
              </div>
            )}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="mt-3 flex flex-wrap items-center gap-2">
      <Button
        size="sm"
        onClick={handleJoin}
        disabled={joining}
        className={cn(
          "rounded-xl gap-2 h-auto px-4 py-2 text-xs font-bold text-white",
          isConfirmed
            ? "bg-[#fd5523] hover:bg-[#ef4a16]"
            : "bg-slate-600 hover:bg-slate-500"
        )}
      >
        {joining ? (
          <><Loader2 className="h-3.5 w-3.5 animate-spin" />Connecting...</>
        ) : (
          <><Video className="h-3.5 w-3.5" />{isConfirmed ? "Join Session Room" : "Test Join (Pending)"}</>
        )}
      </Button>

      {/* Copy room ID for coordinating with learner */}
      <button
        onClick={copyRoomId}
        title="Copy room ID — the learner will join the same room"
        className="flex items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-1.5 text-xs text-slate-500 hover:text-slate-700 hover:border-slate-300 transition-all h-auto"
      >
        {copied ? <Check className="h-3 w-3 text-green-600" /> : <Copy className="h-3 w-3" />}
        Copy Room ID
      </button>
    </div>
  );
}
