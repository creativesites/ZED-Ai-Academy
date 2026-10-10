"use client";

import { useState, useEffect, useRef } from "react";
import { 
  Video, Mic, Volume2, ShieldCheck, Check, 
  Settings2, Loader2, AlertCircle, CameraOff, MicOff 
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

type DeviceTestModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirmJoin: () => void;
  sessionTitle?: string;
};

export function DeviceTestModal({
  open,
  onOpenChange,
  onConfirmJoin,
  sessionTitle = "Live Studio Session",
}: DeviceTestModalProps) {
  const [audioDevices, setAudioDevices] = useState<MediaDeviceInfo[]>([]);
  const [videoDevices, setVideoDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedAudioInput, setSelectedAudioInput] = useState<string>("");
  const [selectedVideoInput, setSelectedVideoInput] = useState<string>("");

  const [cameraEnabled, setCameraEnabled] = useState(true);
  const [micEnabled, setMicEnabled] = useState(true);
  const [audioLevel, setAudioLevel] = useState(0);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [initializing, setInitializing] = useState(true);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animFrameRef = useRef<number | null>(null);

  // Initialize devices and default stream
  useEffect(() => {
    if (!open) {
      stopCurrentStream();
      return;
    }

    let isMounted = true;

    async function initMedia() {
      try {
        setInitializing(true);
        setError(null);

        // Initial permission request
        const initialStream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: true,
        });

        if (!isMounted) {
          initialStream.getTracks().forEach((track) => track.stop());
          return;
        }

        // Get list of all media devices
        const devices = await navigator.mediaDevices.enumerateDevices();
        const mics = devices.filter((d) => d.kind === "audioinput");
        const cams = devices.filter((d) => d.kind === "videoinput");

        setAudioDevices(mics);
        setVideoDevices(cams);

        if (mics.length > 0 && !selectedAudioInput) setSelectedAudioInput(mics[0].deviceId);
        if (cams.length > 0 && !selectedVideoInput) setSelectedVideoInput(cams[0].deviceId);

        attachStream(initialStream);
      } catch (err: any) {
        if (isMounted) {
          console.warn("Media device access notice:", err);
          setError("Microphone or camera access denied. You can still join with media disabled.");
        }
      } finally {
        if (isMounted) setInitializing(false);
      }
    }

    initMedia();

    return () => {
      isMounted = false;
      stopCurrentStream();
    };
  }, [open]);

  // Handle track or device changes
  useEffect(() => {
    if (!open || initializing) return;

    let isMounted = true;

    async function updateStream() {
      try {
        stopCurrentStream();

        const constraints: MediaStreamConstraints = {
          audio: selectedAudioInput ? { deviceId: { exact: selectedAudioInput } } : true,
          video: selectedVideoInput ? { deviceId: { exact: selectedVideoInput } } : true,
        };

        const newStream = await navigator.mediaDevices.getUserMedia(constraints);
        if (isMounted) {
          attachStream(newStream);
        } else {
          newStream.getTracks().forEach((t) => t.stop());
        }
      } catch (err) {
        if (isMounted) {
          console.warn("Stream update error:", err);
        }
      }
    }

    updateStream();

    return () => {
      isMounted = false;
    };
  }, [selectedAudioInput, selectedVideoInput]);

  function stopCurrentStream() {
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    if (audioContextRef.current) audioContextRef.current.close().catch(() => {});
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      setStream(null);
    }
    setAudioLevel(0);
  }

  function attachStream(newStream: MediaStream) {
    setStream(newStream);

    if (videoRef.current) {
      videoRef.current.srcObject = newStream;
    }

    // Audio level meter setup
    const audioTrack = newStream.getAudioTracks()[0];
    if (audioTrack) {
      try {
        const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
        const analyser = audioCtx.createAnalyser();
        analyser.fftSize = 256;
        const source = audioCtx.createMediaStreamSource(newStream);
        source.connect(analyser);

        audioContextRef.current = audioCtx;
        analyserRef.current = analyser;

        const dataArray = new Uint8Array(analyser.frequencyBinCount);

        const updateLevel = () => {
          if (!analyserRef.current) return;
          analyserRef.current.getByteFrequencyData(dataArray);
          let sum = 0;
          for (let i = 0; i < dataArray.length; i++) {
            sum += dataArray[i];
          }
          const average = sum / dataArray.length;
          setAudioLevel(Math.min(100, Math.round((average / 128) * 100)));
          animFrameRef.current = requestAnimationFrame(updateLevel);
        };

        updateLevel();
      } catch (e) {
        console.warn("Audio meter init notice:", e);
      }
    }
  }

  function toggleCamera() {
    if (!stream) return;
    const videoTrack = stream.getVideoTracks()[0];
    if (videoTrack) {
      videoTrack.enabled = !cameraEnabled;
      setCameraEnabled(!cameraEnabled);
    }
  }

  function toggleMic() {
    if (!stream) return;
    const audioTrack = stream.getAudioTracks()[0];
    if (audioTrack) {
      audioTrack.enabled = !micEnabled;
      setMicEnabled(!micEnabled);
    }
  }

  function handleJoin() {
    stopCurrentStream();
    onOpenChange(false);
    onConfirmJoin();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl rounded-[2.5rem] bg-[#062e39] text-white border border-white/10 p-6 md:p-8 shadow-2xl">
        <DialogHeader>
          <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-[#fd5523]/10 border border-[#fd5523]/20 w-fit mb-2">
            <ShieldCheck className="h-3.5 w-3.5 text-[#fd5523]" />
            <span className="text-[10px] font-black uppercase tracking-widest text-[#fd8d69]">Pre-Call Setup</span>
          </div>
          <DialogTitle className="text-2xl font-black text-white tracking-tight">
            Check Your Camera & Microphone
          </DialogTitle>
          <DialogDescription className="text-slate-300 text-sm">
            Verify your devices and audio input levels before entering <span className="font-bold text-white">{sessionTitle}</span>.
          </DialogDescription>
        </DialogHeader>

        <div className="my-4 space-y-6">
          {/* Video Preview Box */}
          <div className="relative aspect-video w-full overflow-hidden rounded-3xl bg-black/60 border border-white/10 shadow-inner flex items-center justify-center">
            {initializing ? (
              <div className="flex flex-col items-center gap-2 text-slate-400">
                <Loader2 className="h-8 w-8 animate-spin text-[#fd5523]" />
                <p className="text-xs font-bold uppercase tracking-widest">Initializing devices...</p>
              </div>
            ) : cameraEnabled && stream ? (
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="h-full w-full object-cover -scale-x-100"
              />
            ) : (
              <div className="flex flex-col items-center gap-3 text-slate-400">
                <CameraOff className="h-12 w-12 text-slate-500" />
                <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Camera Off</p>
              </div>
            )}

            {/* Overlaid Toggle Controls */}
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-3 bg-black/60 backdrop-blur-md px-4 py-2 rounded-2xl border border-white/10">
              <Button
                type="button"
                size="sm"
                variant={micEnabled ? "default" : "destructive"}
                onClick={toggleMic}
                className="rounded-xl h-10 w-10 p-0"
              >
                {micEnabled ? <Mic className="h-4 w-4" /> : <MicOff className="h-4 w-4" />}
              </Button>
              <Button
                type="button"
                size="sm"
                variant={cameraEnabled ? "default" : "destructive"}
                onClick={toggleCamera}
                className="rounded-xl h-10 w-10 p-0"
              >
                {cameraEnabled ? <Video className="h-4 w-4" /> : <CameraOff className="h-4 w-4" />}
              </Button>
            </div>
          </div>

          {/* Audio Level Indicator */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs font-bold text-slate-300">
              <span className="flex items-center gap-2">
                <Volume2 className="h-4 w-4 text-[#fd5523]" />
                Microphone Input Test
              </span>
              <span className="font-mono text-emerald-400">{micEnabled ? `${audioLevel}%` : "Muted"}</span>
            </div>
            <div className="h-3 w-full overflow-hidden rounded-full bg-black/40 p-0.5 border border-white/10">
              <div
                className="h-full rounded-full bg-gradient-to-r from-emerald-500 via-amber-400 to-red-500 transition-all duration-75"
                style={{ width: `${micEnabled ? audioLevel : 0}%` }}
              />
            </div>
          </div>

          {/* Device Selection Dropdowns */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <label className="space-y-1.5">
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-1.5">
                <Mic className="h-3.5 w-3.5 text-[#fd5523]" />
                Microphone
              </span>
              <select
                value={selectedAudioInput}
                onChange={(e) => setSelectedAudioInput(e.target.value)}
                className="h-11 w-full rounded-xl bg-black/40 border border-white/10 px-3 text-xs text-white focus:outline-none focus:border-[#fd5523]"
              >
                {audioDevices.map((device) => (
                  <option key={device.deviceId} value={device.deviceId} className="bg-[#062e39] text-white">
                    {device.label || `Microphone (${device.deviceId.slice(0, 5)})`}
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-1.5">
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-1.5">
                <Video className="h-3.5 w-3.5 text-[#fd5523]" />
                Camera
              </span>
              <select
                value={selectedVideoInput}
                onChange={(e) => setSelectedVideoInput(e.target.value)}
                className="h-11 w-full rounded-xl bg-black/40 border border-white/10 px-3 text-xs text-white focus:outline-none focus:border-[#fd5523]"
              >
                {videoDevices.map((device) => (
                  <option key={device.deviceId} value={device.deviceId} className="bg-[#062e39] text-white">
                    {device.label || `Camera (${device.deviceId.slice(0, 5)})`}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {error && (
            <div className="flex items-center gap-2 rounded-xl bg-amber-500/10 border border-amber-500/20 p-3 text-xs text-amber-300">
              <AlertCircle className="h-4 w-4 shrink-0 text-amber-400" />
              <span>{error}</span>
            </div>
          )}
        </div>

        <DialogFooter className="flex-row items-center justify-between gap-3 pt-2">
          <Button
            type="button"
            variant="ghost"
            onClick={() => {
              stopCurrentStream();
              onOpenChange(false);
            }}
            className="rounded-xl text-slate-400 hover:text-white hover:bg-white/5"
          >
            Cancel
          </Button>

          <Button
            type="button"
            onClick={handleJoin}
            className="rounded-xl bg-[#fd5523] hover:bg-[#ef4a16] px-8 text-white font-bold text-sm shadow-xl shadow-[#fd5523]/20"
          >
            <Check className="mr-2 h-4 w-4" />
            Enter Live Studio
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
