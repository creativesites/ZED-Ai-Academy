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

const Container = (props: { slug: string; JWT: string }) => {
  const { slug, JWT } = props;
  const [inCall, setInCall] = useState(false);

  const startSession = () => {
    setInCall(true);
  };

  const endSession = () => {
    setInCall(false);
  };

  if (!inCall) {
    return (
      <div className="flex flex-col items-center gap-4 p-8 bg-white rounded-2xl shadow-sm border border-slate-100">
        <div className="h-12 w-12 rounded-full bg-blue-50 flex items-center justify-center mb-2">
          <Video className="h-6 w-6 text-blue-600" />
        </div>
        <h2 className="text-xl font-bold text-slate-900">Ready to join?</h2>
        <p className="text-sm text-slate-500 text-center max-w-[240px]">
          You are about to join session: <span className="font-mono font-bold text-slate-900">{slug}</span>
        </p>
        <Button onClick={startSession} size="lg" className="mt-2 px-8 rounded-xl bg-blue-600 hover:bg-blue-700">
          Join Session
        </Button>
      </div>
    );
  }

  return (
    <Videochat
      sessionName={slug}
      JWT={JWT}
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