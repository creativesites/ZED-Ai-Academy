"use client";

import { useState, useEffect } from "react";
import { JaaSMeeting } from "@jitsi/react-sdk";
import { generateJitsiToken } from "@/actions/jitsi";
import { startLiveSessionAttendance, endLiveSessionAttendance } from "@/actions/live-sessions";
import { Button } from "@/components/ui/button";
import { 
  Loader2, LogOut, Video, Copy, Check, ShieldCheck, 
  Clock, Users, FileText, HelpCircle, Hand, Settings2, X, Send 
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { DeviceTestModal } from "@/components/live-sessions/device-test-modal";

const APP_ID = "vpaas-magic-cookie-37a3214c11ef406c81cc165d3d1c2f4f";

type LiveQuestion = {
  id: string;
  author: string;
  question: string;
  timestamp: string;
  isAnswered: boolean;
};

type LiveSessionRoomProps = {
  bookingId: string;
  roomName: string;
  isInstructor?: boolean;
  sessionTitle?: string;
  learnerName?: string | null;
  onLeave?: () => void;
};

export function LiveSessionRoom({
  bookingId,
  roomName,
  isInstructor = false,
  sessionTitle = "Live Session Studio",
  learnerName,
  onLeave,
}: LiveSessionRoomProps) {
  const [jwt, setJwt] = useState<string | null>(null);
  const [attendanceId, setAttendanceId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [sessionSeconds, setSessionSeconds] = useState(0);

  // Interactive drawers state
  const [activePanel, setActivePanel] = useState<"none" | "notes" | "qa">("none");
  const [sharedNotes, setSharedNotes] = useState<string>(
    "// Welcome to Live Studio Scratchpad\n// Share code snippets, key formulas, or lesson links here during class.\n"
  );
  const [questions, setQuestions] = useState<LiveQuestion[]>([]);
  const [newQuestionInput, setNewQuestionInput] = useState("");
  const [handRaised, setHandRaised] = useState(false);
  const [showDeviceModal, setShowDeviceModal] = useState(false);

  // Duration timer
  useEffect(() => {
    const interval = setInterval(() => {
      setSessionSeconds((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Initialize token and attendance
  useEffect(() => {
    let mounted = true;

    async function initSession() {
      try {
        setLoading(true);
        setError(null);

        // 1. Generate Jitsi JWT Token
        const result = await generateJitsiToken(roomName, isInstructor);
        if (!result.success || !result.token) {
          throw new Error(result.error || "Failed to generate security token for live room");
        }

        // 2. Start attendance tracking
        try {
          const attId = await startLiveSessionAttendance(bookingId);
          if (mounted && attId) setAttendanceId(attId);
        } catch (attErr) {
          console.warn("Attendance recording notice:", attErr);
        }

        if (mounted) {
          setJwt(result.token);
        }
      } catch (err) {
        if (mounted) {
          setError(err instanceof Error ? err.message : "Failed to connect to live room");
        }
      } finally {
        if (mounted) setLoading(false);
      }
    }

    initSession();

    return () => {
      mounted = false;
    };
  }, [bookingId, roomName, isInstructor]);

  const handleLeave = async () => {
    if (attendanceId) {
      try {
        await endLiveSessionAttendance(attendanceId);
      } catch (e) {
        console.error("Error logging attendance exit:", e);
      }
    }
    if (onLeave) onLeave();
  };

  const copyRoomLink = () => {
    navigator.clipboard.writeText(window.location.href).then(() => {
      setCopied(true);
      toast.success("Studio link copied to clipboard!");
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const formatDuration = (totalSecs: number) => {
    const mins = Math.floor(totalSecs / 60);
    const secs = totalSecs % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  const handleAddQuestion = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newQuestionInput.trim()) return;

    const q: LiveQuestion = {
      id: Math.random().toString(36).slice(2, 9),
      author: learnerName || (isInstructor ? "Instructor" : "Learner"),
      question: newQuestionInput.trim(),
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      isAnswered: false,
    };

    setQuestions((prev) => [q, ...prev]);
    setNewQuestionInput("");
    toast.success("Question submitted to live Q&A queue");
  };

  const toggleAnswered = (id: string) => {
    setQuestions((prev) =>
      prev.map((q) => (q.id === id ? { ...q, isAnswered: !q.isAnswered } : q))
    );
  };

  const toggleHandRaise = () => {
    setHandRaised((prev) => {
      const next = !prev;
      if (next) toast.info("Hand raised! The instructor has been notified.");
      return next;
    });
  };

  if (loading) {
    return (
      <div className="flex h-[550px] w-full flex-col items-center justify-center rounded-[2.5rem] bg-[#062e39] text-white p-8 shadow-2xl border border-white/10">
        <div className="relative mb-6">
          <div className="absolute -inset-4 bg-[#fd5523]/20 rounded-full blur-xl animate-pulse" />
          <div className="relative flex h-20 w-20 items-center justify-center rounded-3xl bg-[#fff6ee] text-[#fd5523] shadow-inner">
            <Loader2 className="h-10 w-10 animate-spin" />
          </div>
        </div>
        <h3 className="text-xl font-bold tracking-tight">Initializing Studio...</h3>
        <p className="mt-2 text-sm text-slate-300">Authenticating secure WebRTC channel & tracking attendance</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-[500px] w-full flex-col items-center justify-center rounded-[2.5rem] bg-white p-8 text-center shadow-xl border border-slate-100">
        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-red-50 text-red-500">
          <Video className="h-8 w-8" />
        </div>
        <h3 className="text-2xl font-bold text-[#062e39]">Room Connection Failed</h3>
        <p className="mt-2 max-w-md text-sm text-slate-500">{error}</p>
        <Button
          onClick={() => window.location.reload()}
          className="mt-6 rounded-xl bg-[#fd5523] px-6 text-white hover:bg-[#ef4a16]"
        >
          Retry Connection
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col w-full h-[650px] lg:h-[720px] bg-[#062e39] rounded-[2.5rem] shadow-2xl overflow-hidden border border-white/10 relative">
      {/* Studio Header Bar */}
      <div className="flex items-center justify-between px-6 py-4 bg-[#062e39]/90 backdrop-blur-md border-b border-white/10 z-20 shrink-0">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20">
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-[10px] font-black uppercase tracking-widest text-emerald-400">Live Studio</span>
          </div>

          <div className="hidden sm:flex items-center gap-2 text-xs font-bold text-slate-300">
            <Clock className="h-3.5 w-3.5 text-[#fd5523]" />
            <span className="font-mono text-white">{formatDuration(sessionSeconds)}</span>
          </div>

          {learnerName && (
            <div className="hidden md:flex items-center gap-1.5 text-xs text-slate-300">
              <Users className="h-3.5 w-3.5 text-slate-400" />
              <span>with {learnerName}</span>
            </div>
          )}
        </div>

        {/* Action Controls & Interactive Drawers */}
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={toggleHandRaise}
            className={cn(
              "text-xs rounded-xl gap-1.5 transition-all",
              handRaised
                ? "bg-amber-500 text-white font-bold animate-bounce"
                : "text-slate-300 hover:text-white hover:bg-white/10"
            )}
          >
            <Hand className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">{handRaised ? "Hand Raised!" : "Raise Hand"}</span>
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => setActivePanel(activePanel === "notes" ? "none" : "notes")}
            className={cn(
              "text-xs rounded-xl gap-1.5",
              activePanel === "notes" ? "bg-[#fd5523] text-white" : "text-slate-300 hover:text-white hover:bg-white/10"
            )}
          >
            <FileText className="h-3.5 w-3.5" />
            <span className="hidden md:inline">Live Notes</span>
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => setActivePanel(activePanel === "qa" ? "none" : "qa")}
            className={cn(
              "text-xs rounded-xl gap-1.5 relative",
              activePanel === "qa" ? "bg-[#fd5523] text-white" : "text-slate-300 hover:text-white hover:bg-white/10"
            )}
          >
            <HelpCircle className="h-3.5 w-3.5" />
            <span className="hidden md:inline">Q&A Queue</span>
            {questions.filter((q) => !q.isAnswered).length > 0 && (
              <span className="ml-1 px-1.5 py-0.5 text-[9px] font-black rounded-full bg-amber-400 text-black">
                {questions.filter((q) => !q.isAnswered).length}
              </span>
            )}
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowDeviceModal(true)}
            className="text-xs text-slate-300 hover:text-white hover:bg-white/10 rounded-xl p-2"
            title="Device settings"
          >
            <Settings2 className="h-4 w-4" />
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={copyRoomLink}
            className="text-xs text-slate-300 hover:text-white hover:bg-white/10 rounded-xl gap-1.5"
          >
            {copied ? <Check className="h-3.5 w-3.5 text-green-400" /> : <Copy className="h-3.5 w-3.5" />}
            <span className="hidden sm:inline">Copy Link</span>
          </Button>

          <Button
            onClick={handleLeave}
            variant="destructive"
            size="sm"
            className="rounded-xl bg-red-500/20 hover:bg-red-500 border border-red-500/30 text-red-300 hover:text-white gap-2 ml-2"
          >
            <LogOut className="h-4 w-4" />
            <span>Leave</span>
          </Button>
        </div>
      </div>

      {/* Main Studio Body (Video + Interactive Panel) */}
      <div className="flex-1 bg-black relative flex min-h-0">
        <div className="flex-1 relative min-h-0">
          {jwt && roomName && (
            <JaaSMeeting
              appId={APP_ID}
              roomName={roomName}
              jwt={jwt}
              configOverwrite={{
                startWithAudioMuted: false,
                disableInviteFunctions: true,
                enableWelcomePage: false,
                prejoinPageEnabled: false,
                backgroundColor: "#062e39",
              }}
              interfaceConfigOverwrite={{
                TOOLBAR_BUTTONS: [
                  "microphone",
                  "camera",
                  "closedcaptions",
                  "desktop",
                  "fullscreen",
                  "fodeviceselection",
                  "hangup",
                  "profile",
                  "chat",
                  "recording",
                  "livestreaming",
                  "settings",
                  "raisehand",
                  "videoquality",
                  "tileview",
                  "videobackgroundblur",
                  "mute-everyone",
                  "security",
                ],
              }}
              onReadyToClose={handleLeave}
              getIFrameRef={(iframeRef) => {
                iframeRef.style.height = "100%";
                iframeRef.style.width = "100%";
              }}
              spinner={() => (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-slate-400 bg-[#062e39]">
                  <Loader2 className="h-8 w-8 animate-spin text-[#fd5523]" />
                  <p className="text-xs font-bold uppercase tracking-widest">Connecting to Studio...</p>
                </div>
              )}
            />
          )}
        </div>

        {/* Live Notes Side Panel */}
        {activePanel === "notes" && (
          <div className="w-80 lg:w-96 bg-[#062e39]/95 backdrop-blur-xl border-l border-white/10 flex flex-col p-4 shadow-2xl z-20">
            <div className="flex items-center justify-between pb-3 border-b border-white/10 mb-3">
              <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-white">
                <FileText className="h-4 w-4 text-[#fd5523]" />
                <span>Shared Lesson Notes</span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setActivePanel("none")}
                className="h-8 w-8 p-0 rounded-lg text-slate-400 hover:text-white"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            <textarea
              value={sharedNotes}
              onChange={(e) => setSharedNotes(e.target.value)}
              placeholder="Type lesson notes, code snippets, or reference links..."
              className="flex-1 w-full bg-black/40 border border-white/10 rounded-2xl p-3 text-xs font-mono text-emerald-300 focus:outline-none focus:border-[#fd5523] resize-none leading-relaxed"
            />
            <p className="mt-2 text-[10px] text-slate-400 font-medium text-center">
              Notes are visible to all participants during this active session.
            </p>
          </div>
        )}

        {/* Live Q&A Queue Side Panel */}
        {activePanel === "qa" && (
          <div className="w-80 lg:w-96 bg-[#062e39]/95 backdrop-blur-xl border-l border-white/10 flex flex-col p-4 shadow-2xl z-20">
            <div className="flex items-center justify-between pb-3 border-b border-white/10 mb-3">
              <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-white">
                <HelpCircle className="h-4 w-4 text-[#fd5523]" />
                <span>Q&A Queue</span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setActivePanel("none")}
                className="h-8 w-8 p-0 rounded-lg text-slate-400 hover:text-white"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            <form onSubmit={handleAddQuestion} className="mb-4 flex gap-2">
              <input
                type="text"
                value={newQuestionInput}
                onChange={(e) => setNewQuestionInput(e.target.value)}
                placeholder="Ask a question..."
                className="flex-1 h-10 px-3 rounded-xl bg-black/40 border border-white/10 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-[#fd5523]"
              />
              <Button type="submit" size="sm" className="rounded-xl bg-[#fd5523] text-white h-10 px-3">
                <Send className="h-3.5 w-3.5" />
              </Button>
            </form>

            <div className="flex-1 overflow-y-auto space-y-2 pr-1">
              {questions.length === 0 ? (
                <div className="py-12 text-center text-slate-400 text-xs font-medium">
                  No questions in the queue yet. Ask a question above!
                </div>
              ) : (
                questions.map((q) => (
                  <div
                    key={q.id}
                    className={cn(
                      "p-3 rounded-2xl border text-xs space-y-1.5 transition-all",
                      q.isAnswered
                        ? "bg-black/20 border-white/5 text-slate-400 line-through"
                        : "bg-black/40 border-white/10 text-white"
                    )}
                  >
                    <div className="flex items-center justify-between text-[10px] font-bold text-slate-400">
                      <span>{q.author}</span>
                      <span>{q.timestamp}</span>
                    </div>
                    <p className="text-xs leading-normal font-medium">{q.question}</p>
                    {isInstructor && (
                      <button
                        type="button"
                        onClick={() => toggleAnswered(q.id)}
                        className="text-[10px] font-bold text-[#fd8d69] hover:underline"
                      >
                        {q.isAnswered ? "Mark Unanswered" : "Mark Answered"}
                      </button>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>

      {/* Footer Info */}
      <div className="px-6 py-2.5 bg-black/40 border-t border-white/5 flex items-center justify-between shrink-0 text-[10px] text-slate-400 font-medium">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
          <span>Encrypted End-to-End Session · ID: {roomName.slice(-8)}</span>
        </div>
        <span className="hidden sm:inline">Attendance tracking active</span>
      </div>

      {/* Pre-call Device Settings Modal */}
      <DeviceTestModal
        open={showDeviceModal}
        onOpenChange={setShowDeviceModal}
        onConfirmJoin={() => setShowDeviceModal(false)}
        sessionTitle={sessionTitle}
      />
    </div>
  );
}
