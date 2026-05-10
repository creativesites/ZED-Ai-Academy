"use client";

import { useState, useEffect, useRef } from "react";
import { Video, ShieldCheck, Globe, Users, Loader2, Sparkles, ArrowRight, X } from "lucide-react";
import { Button } from "./ui/button";
import { toast } from "sonner";
import { JaaSMeeting } from '@jitsi/react-sdk';
import { generateJitsiToken } from "@/actions/jitsi";  

const Container = () => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [roomName, setRoomName] = useState<string | null>(null);
  const [jwt, setJwt] = useState<string | null>(null);
  const [swUnregistered, setSwUnregistered] = useState(false);

  const APP_ID = "vpaas-magic-cookie-37a3214c11ef406c81cc165d3d1c2f4f";

  // Clear any existing service workers (like coi-serviceworker) that might be blocking external scripts
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistrations().then(registrations => {
        if (registrations.length > 0) {
          console.log(`Found ${registrations.length} service workers. Unregistering...`);
          Promise.all(registrations.map(r => r.unregister())).then(() => {
            console.log("Service workers unregistered. Reloading to clear state...");
            setSwUnregistered(true);
            window.location.reload();
          });
        } else {
          setSwUnregistered(true);
        }
      });
    } else {
      setSwUnregistered(true);
    }
  }, []);

  const handleCreateMeeting = async () => {
    setIsGenerating(true);
    try {
      const newRoom = `zed-academy-${Math.random().toString(36).slice(2, 12)}`;
      const result = await generateJitsiToken(newRoom);
      
      if (result.success && result.token) {
        setJwt(result.token);
        setRoomName(newRoom);
        toast.success("Studio room initialized with JaaS!");
      } else {
        toast.error(result.error || "Failed to generate meeting token");
      }
    } catch (err) {
      console.error("Error creating meeting:", err);
      toast.error("Failed to initialize studio");
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="h-full w-full">
      {roomName && jwt ? (
        <div className="flex flex-col h-full w-full bg-[#062e39] rounded-3xl shadow-2xl overflow-hidden border border-white/10 animate-in fade-in zoom-in-95 duration-500">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 bg-white/5 border-b border-white/10">
            <div className="flex items-center gap-3">
              <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              <h3 className="text-sm font-black uppercase tracking-widest text-white/70">Live JaaS Studio</h3>
            </div>
            <div className="flex items-center gap-2">
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => {
                  navigator.clipboard.writeText(`https://8x8.vc/${APP_ID}/${roomName}`);
                  toast.success("Invite link copied");
                }}
                className="text-white/50 hover:text-white hover:bg-white/10 text-xs"
              >
                Copy Link
              </Button>
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={() => {
                  setRoomName(null);
                  setJwt(null);
                }}
                className="text-white/50 hover:text-white hover:bg-white/10 h-8 w-8"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Video Area */}
          <div className="flex-1 bg-black relative">
            <JaaSMeeting
              appId={APP_ID}
              roomName={roomName}
              jwt={jwt}
              configOverwrite={{
                startWithAudioMuted: true,
                disableInviteFunctions: true,
                enableWelcomePage: false,
                prejoinPageEnabled: false,
              }}
              interfaceConfigOverwrite={{
                TOOLBAR_BUTTONS: [
                  'microphone', 'camera', 'closedcaptions', 'desktop', 'fullscreen',
                  'fodeviceselection', 'hangup', 'profile', 'chat', 'recording',
                  'livestreaming', 'etherpad', 'sharedvideo', 'settings', 'raisehand',
                  'videoquality', 'filmstrip', 'invite', 'feedback', 'stats', 'shortcuts',
                  'tileview', 'videobackgroundblur', 'download', 'help', 'mute-everyone',
                  'security'
                ],
              }}
              onReadyToClose={() => {
                setRoomName(null);
                setJwt(null);
              }}
              getIFrameRef={(iframeRef) => {
                iframeRef.style.height = '100%';
                iframeRef.style.width = '100%';
              }}
              spinner={() => (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 text-white/50">
                  <Loader2 className="h-8 w-8 animate-spin" />
                  <p className="text-sm font-medium">Connecting to JaaS...</p>
                </div>
              )}
            />
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center h-full w-full bg-white rounded-3xl shadow-xl border border-slate-100 p-8 sm:p-12 text-center overflow-hidden relative">
          <div className="absolute top-0 right-0 p-8 opacity-[0.03] pointer-events-none">
            <Sparkles className="h-64 w-64 rotate-12" />
          </div>

          <div className="h-20 w-20 rounded-3xl bg-indigo-50 flex items-center justify-center mb-8 shadow-inner animate-bounce duration-[3000ms]">
            <Video className="h-10 w-10 text-indigo-600" />
          </div>
          
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-50 text-indigo-700 text-[10px] font-black uppercase tracking-widest mb-4">
            <Sparkles className="h-3 w-3" />
            Premium JaaS Studio
          </div>

          <h2 className="text-4xl font-black text-[#062e39] mb-4 tracking-tighter">AI Teaching Studio</h2>
          <p className="text-slate-500 text-lg max-w-[480px] mb-10 leading-relaxed">
            Secure, high-fidelity video sessions powered by Jitsi as a Service. Professional infrastructure for your academy.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 w-full max-w-2xl mb-12">
            {[
              { icon: ShieldCheck, label: "Authenticated", color: "text-emerald-500" },
              { icon: Users, label: "Global Edge", color: "text-indigo-500" },
              { icon: Globe, label: "Full SDK", color: "text-amber-500" },
            ].map((item, i) => (
              <div key={i} className="flex flex-col items-center gap-2 p-4 rounded-2xl bg-slate-50 border border-slate-100/50">
                <item.icon className={`h-5 w-5 ${item.color}`} />
                <span className="text-xs font-bold text-[#062e39] uppercase tracking-wider">{item.label}</span>
              </div>
            ))}
          </div>

          <Button 
            onClick={handleCreateMeeting} 
            disabled={isGenerating || !swUnregistered}
            size="lg"
            className="h-16 px-12 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xl shadow-2xl shadow-indigo-200 transition-all active:scale-95 disabled:opacity-70 group"
          >
            {isGenerating ? (
              <>
                <Loader2 className="h-6 w-6 animate-spin mr-3" />
                Initializing...
              </>
            ) : (
              <>
                Launch Premium Studio
                <ArrowRight className="ml-3 h-6 w-6 group-hover:translate-x-1 transition-transform" />
              </>
            )}
          </Button>
          
          <p className="mt-8 text-[10px] text-slate-400 uppercase tracking-widest font-black">
            Jitsi as a Service • Secure JWT Auth • Worldwide Infrastructure
          </p>
        </div>
      )}
    </div>
  );
};

export default Container;
