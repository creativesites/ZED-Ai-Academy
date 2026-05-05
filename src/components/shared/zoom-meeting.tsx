"use client";

import { useEffect, useRef, useState } from "react";
import type { ZoomMtgEmbedded as ZoomMtgEmbeddedType } from "@zoom/meetingsdk/embedded";

interface ZoomMeetingProps {
  meetingNumber: string;
  passWord?: string;
  userName: string;
  userEmail: string;
  signature: string;
  sdkKey: string;
}

export function ZoomMeeting({
  meetingNumber,
  passWord,
  userName,
  userEmail,
  signature,
  sdkKey,
}: ZoomMeetingProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const { type, payload } = event.data;

      if (type === "ZOOM_BRIDGE_READY") {
        if (iframeRef.current?.contentWindow) {
          iframeRef.current.contentWindow.postMessage({
            type: "JOIN_MEETING",
            payload: {
              meetingNumber,
              passWord,
              userName,
              userEmail,
              signature,
              sdkKey,
            },
          }, "*");
        }
      }

      if (type === "ZOOM_JOIN_SUCCESS") {
        setLoading(false);
      }

      if (type === "ZOOM_JOIN_ERROR") {
        setError(payload || "Failed to join the live session.");
        setLoading(false);
      }
    };

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [meetingNumber, passWord, userName, userEmail, signature, sdkKey]);

  return (
    <div className="space-y-4">
      <div className="relative w-full aspect-video rounded-[2.5rem] overflow-hidden bg-black shadow-2xl border-4 border-slate-900 group">
        <iframe
          ref={iframeRef}
          src="/zoom-bridge.html"
          className="absolute inset-0 w-full h-full border-0"
          allow="camera; microphone; fullscreen; speaker; display-capture"
        />
        
        {loading && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-900 z-10 pointer-events-none">
            <div className="h-12 w-12 rounded-2xl bg-[#fd5523]/10 flex items-center justify-center mb-4">
              <div className="h-6 w-6 border-4 border-[#fd5523] border-t-transparent rounded-full animate-spin" />
            </div>
            <p className="text-sm font-bold text-white tracking-widest uppercase">Initializing Live Stream...</p>
          </div>
        )}

        {error && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-900/90 backdrop-blur-sm z-20 p-8 text-center">
            <div className="h-16 w-16 rounded-3xl bg-red-500/10 flex items-center justify-center mb-6">
              <svg className="h-8 w-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <h4 className="text-xl font-bold text-white mb-2">Connection Error</h4>
            <p className="text-slate-400 text-sm max-w-md mb-8 leading-relaxed">
              {error}
            </p>
            <button 
              onClick={() => window.location.reload()}
              className="px-8 py-3 rounded-2xl bg-white/10 hover:bg-white/20 text-white text-sm font-bold transition-all"
            >
              Retry Connection
            </button>
          </div>
        )}
      </div>
      <div className="flex items-center justify-between px-4">
        <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">
          Secure Live Stream · ID: {meetingNumber}
        </p>
        <div className="flex items-center gap-2">
          <div className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse" />
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Encypted</span>
        </div>
      </div>
    </div>
  );
}
