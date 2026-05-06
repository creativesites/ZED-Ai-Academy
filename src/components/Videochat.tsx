"use client";

import { CSSProperties, useState, type Dispatch, type SetStateAction } from "react";
import { Mic, MicOff, Video, VideoOff, PhoneOff, Loader2 } from "lucide-react";
import {
  useSession,
  useSessionUsers,
  VideoPlayerComponent,
  VideoPlayerContainerComponent,
  useVideoState,
  useAudioState,
} from "@zoom/videosdk-react";
import { Button } from "./ui/button";
import { getVideoToken } from "@/actions/zoom";
import { toast } from "sonner";

// Random user name for demo purposes
const randomUserName = `User-${Math.random().toString(36).slice(2, 8)}`;

const Container = () => {
  const [inCall, setInCall] = useState(false);
  const [sessionName, setSessionName] = useState("");
  const [jwt, setJwt] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [debugData, setDebugData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const startSession = async () => {
    setIsGenerating(true);
    setError(null);
    // Generate a unique session name
    const newSessionName = `zed-test-${Math.random().toString(36).slice(2, 10)}`;
    
    try {
      const result = await getVideoToken(newSessionName);
      setDebugData(result.debugInfo);
      
      if (result.error || !result.token) {
        setError(result.error || "Failed to generate session token");
        toast.error(result.error || "Failed to generate session token");
        return;
      }
      
      setSessionName(newSessionName);
      setJwt(result.token);
      setInCall(true);
    } catch (err: any) {
      const errMsg = err.message || "An unexpected error occurred";
      setError(errMsg);
      toast.error(errMsg);
      console.error(err);
    } finally {
      setIsGenerating(false);
    }
  };

  const endSession = () => {
    setInCall(false);
    setSessionName("");
    setJwt("");
    setError(null);
  };

  if (!inCall) {
    return (
      <div className="flex flex-col gap-6 h-full w-full max-w-2xl mx-auto py-12">
        <div className="flex flex-col items-center justify-center bg-white rounded-3xl shadow-xl border border-slate-100 p-10 text-center">
          <div className="h-16 w-16 rounded-2xl bg-blue-50 flex items-center justify-center mb-6">
            <Video className="h-8 w-8 text-blue-600" />
          </div>
          <h2 className="text-2xl font-black text-[#062e39] mb-3 tracking-tight">Zoom Video Studio</h2>
          <p className="text-slate-500 text-sm max-w-[320px] mb-8 leading-relaxed">
            Initialize a fresh session to test your custom video implementation.
          </p>
          
          <Button 
            onClick={startSession} 
            disabled={isGenerating}
            size="lg" 
            className="h-12 px-8 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold shadow-lg shadow-blue-200 transition-all active:scale-95 disabled:opacity-70"
          >
            {isGenerating ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Generating Token...
              </>
            ) : (
              "Create New Session"
            )}
          </Button>

          {error && (
            <div className="mt-6 w-full p-4 rounded-xl bg-red-50 border border-red-100 text-left">
              <p className="text-xs font-black uppercase tracking-widest text-red-600 mb-1">Error Detected</p>
              <p className="text-sm font-medium text-red-800">{error}</p>
            </div>
          )}
        </div>

        {/* Debug View */}
        <div className="bg-slate-900 rounded-2xl p-6 shadow-2xl overflow-hidden">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              <h3 className="text-xs font-black uppercase tracking-widest text-white/50">System Debugger</h3>
            </div>
            {debugData && (
              <span className="text-[10px] font-mono text-white/30">{debugData.timestamp}</span>
            )}
          </div>
          
          <div className="space-y-3 font-mono text-xs">
            <div className="flex justify-between border-b border-white/5 pb-2">
              <span className="text-white/40">ZOOM_CLIENT_ID</span>
              <span className={debugData?.hasClientId ? "text-emerald-400" : "text-red-400"}>
                {debugData ? (debugData.hasClientId ? "PRESENT" : "MISSING") : "WAITING..."}
              </span>
            </div>
            <div className="flex justify-between border-b border-white/5 pb-2">
              <span className="text-white/40">ZOOM_CLIENT_SECRET</span>
              <span className={debugData?.hasClientSecret ? "text-emerald-400" : "text-red-400"}>
                {debugData ? (debugData.hasClientSecret ? "PRESENT" : "MISSING") : "WAITING..."}
              </span>
            </div>
            <div className="flex justify-between border-b border-white/5 pb-2">
              <span className="text-white/40">Session Name</span>
              <span className="text-blue-400">{debugData?.sessionName || "NONE"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-white/40">JWT Status</span>
              <span className={jwt ? "text-emerald-400" : "text-white/20"}>
                {jwt ? "GENERATED" : (error ? "FAILED" : "NOT STARTED")}
              </span>
            </div>
          </div>

          {!debugData && !isGenerating && (
            <p className="mt-4 text-[10px] text-white/20 italic text-center">
              Click "Create New Session" to run a system check.
            </p>
          )}
        </div>
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