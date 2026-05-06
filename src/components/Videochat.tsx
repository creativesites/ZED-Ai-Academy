"use client";

import { CSSProperties, useState, type Dispatch, type SetStateAction } from "react";
import { Mic, MicOff, Video, VideoOff, PhoneOff } from "lucide-react";
import {
  useSession,
  useSessionUsers,
  VideoPlayerComponent,
  VideoPlayerContainerComponent,
  useVideoState,
  useAudioState,
} from "@zoom/videosdk-react";
import { Button } from "./ui/button";

// Generates a unique session name for each new call
const generateSessionName = () => `test-session-${Date.now()}`;

// Random user name for demo purposes
const randomUserName = `User-${Math.random().toString(36).slice(2, 8)}`;

import { getVideoToken } from "@/actions/zoom";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

const Container = () => {
  const [inCall, setInCall] = useState(false);
  const [sessionName, setSessionName] = useState("");
  const [jwt, setJwt] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);

  const startSession = async () => {
    setIsGenerating(true);
    // Generate a unique session name
    const newSessionName = `zed-academy-${Math.random().toString(36).slice(2, 10)}`;
    
    try {
      const result = await getVideoToken(newSessionName);
      if (result.error || !result.token) {
        toast.error(result.error || "Failed to generate session token");
        return;
      }
      
      setSessionName(newSessionName);
      setJwt(result.token);
      setInCall(true);
    } catch (err) {
      toast.error("An unexpected error occurred while starting the session");
      console.error(err);
    } finally {
      setIsGenerating(false);
    }
  };

  const endSession = () => {
    setInCall(false);
    setSessionName("");
    setJwt("");
  };

  if (!inCall) {
    return (
      <div className="flex flex-col items-center justify-center h-full w-full bg-white rounded-3xl shadow-xl border border-slate-100 p-12 text-center">
        <div className="h-20 w-20 rounded-3xl bg-blue-50 flex items-center justify-center mb-6 animate-pulse">
          <Video className="h-10 w-10 text-blue-600" />
        </div>
        <h2 className="text-3xl font-black text-[#062e39] mb-4 tracking-tight">AI Teaching Studio</h2>
        <p className="text-slate-500 text-lg max-w-[400px] mb-8 leading-relaxed">
          Create a private, high-fidelity video session to test your AI teaching workflows.
        </p>
        <Button 
          onClick={startSession} 
          disabled={isGenerating}
          size="lg" 
          className="h-14 px-10 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-lg shadow-lg shadow-blue-200 transition-all active:scale-95 disabled:opacity-70"
        >
          {isGenerating ? (
            <>
              <Loader2 className="h-5 w-5 animate-spin mr-3" />
              Initializing...
            </>
          ) : (
            "Start New Meeting Session"
          )}
        </Button>
        <p className="mt-6 text-xs text-slate-400 uppercase tracking-widest font-bold">
          Powered by Zoom Video SDK
        </p>
      </div>
    );
  }

  return (
    <Videochat
      sessionName={sessionName}
      JWT={jwt}
      userName={randomUserName}
      onLeave={endSession}
    />
  );
};

// ─── Video Chat Component ─────────────────────────────────────────────────────

const Videochat = ({
  sessionName,
  JWT,
  userName,
  onLeave,
}: {
  sessionName: string;
  JWT: string;
  userName: string;
  onLeave: () => void;
}) => {
  const { isLoading, isError, isInSession, error } = useSession(
    sessionName,
    JWT,
    userName
  );
  const participants = useSessionUsers();
  const { isVideoOn, toggleVideo } = useVideoState();
  const { isAudioMuted, toggleMute } = useAudioState();

  if (isLoading) return <div className="p-8 text-center">Connecting…</div>;
  if (isError)
    return (
      <div className="p-8 text-center text-red-500">
        Error: {error?.reason ?? "Unknown error"}
        <br />
        <Button onClick={onLeave} variant="outline" className="mt-4">
          Go back
        </Button>
      </div>
    );

  return (
    <div className="flex h-full w-full flex-1 flex-col">
      <h1 className="text-center text-2xl font-bold mb-2">
        Session: {sessionName}
      </h1>
      <p className="text-center text-sm text-gray-500 mb-4">
        Participants: {participants.length}
      </p>

      <div className="flex-1 min-h-0">
        {isInSession && (
          <VideoPlayerContainerComponent style={videoPlayerStyle}>
            {participants.map((participant) => (
              <VideoPlayerComponent
                key={participant.userId}
                user={participant}
              />
            ))}
          </VideoPlayerContainerComponent>
        )}
      </div>

      <div className="flex w-full justify-center py-4">
        <div className="flex gap-4 rounded-xl bg-white p-3 shadow">
          <Button onClick={() => void toggleVideo()} title="Toggle camera">
            {isVideoOn ? <Video /> : <VideoOff />}
          </Button>
          <Button onClick={() => void toggleMute()} title="Toggle microphone">
            {isAudioMuted ? <MicOff /> : <Mic />}
          </Button>
          <Button onClick={() => onLeave()} title="Leave session">
            <PhoneOff />
          </Button>
        </div>
      </div>
    </div>
  );
};

export default Container;

const videoPlayerStyle: CSSProperties = {
  width: "100%",
  height: "70vh",
  minHeight: "300px",
  background: "#000",
  borderRadius: "12px",
  overflow: "hidden",
  margin: "0 auto",
};