"use client";

import type { LiveServerMessage, Session } from "@google/genai";
import type { AvatarDriver } from "@/components/tutor/avatar/types";
import type { TutorEvent } from "@/lib/tutor/events";
import { parsePcmSampleRate } from "@/lib/tutor/audio";
import {
  float32ToInt16Pcm,
  int16ToBase64,
  LiveTurnAccumulator,
  liveToolCallToTutorEvent,
  pcm16Base64ToFloat32,
  rmsFromFloat32,
  type LiveTurnBatchItem,
} from "@/lib/tutor/live-session";
import { visemeFromSpectrum } from "@/lib/tutor/visemes";
import type { VisemeValue } from "@/lib/tutor/contract.generated";

// Browser client for Gemini Live bidirectional audio + tool-call sessions.
// Dynamically imports @google/genai on connect so Voice/Text/Lite sessions pay zero extra bundle cost.

const OPENING_PROMPT =
  "The learner has just joined the live session. Greet them warmly in character and begin the first step.";

export type LiveSessionCallbacks = {
  onStatusChange: (status: "connecting" | "connected" | "closed" | "error") => void;
  onTeacherSpeakingChange: (speaking: boolean) => void;
  onLearnerLevel: (level: number) => void;
  onLiveCaption: (text: string) => void;
  onLearnerTranscript: (text: string) => void;
  onToolEvent: (event: TutorEvent) => void;
  onTurnCommitted: (turn: LiveTurnBatchItem) => void;
  onEndRequested: (summary?: string) => void;
  onFlushTurns: (turns: LiveTurnBatchItem[]) => Promise<boolean>;
  onError: (message: string) => void;
};

export class GeminiLiveClient {
  private session: Session | null = null;
  private playbackCtx: AudioContext | null = null;
  private playbackGain: GainNode | null = null;
  private playbackAnalyser: AnalyserNode | null = null;
  private activeSources = new Set<AudioBufferSourceNode>();
  private nextPlayTime = 0;
  private visemeTimer: ReturnType<typeof setInterval> | null = null;
  private prevViseme: VisemeValue | undefined;
  private teacherSpeaking = false;

  private captureCtx: AudioContext | null = null;
  private captureStream: MediaStream | null = null;
  private captureProcessor: ScriptProcessorNode | null = null;
  private captureSource: MediaStreamAudioSourceNode | null = null;
  private micActive = false;

  private readonly accumulator = new LiveTurnAccumulator();
  private flushTimer: ReturnType<typeof setInterval> | null = null;
  private flushing = false;
  private closed = false;
  private openingSent = false;
  private muted = false;
  private volume = 1;
  private learnerSpeakingMs = 0;
  private teacherSpeakingMs = 0;

  private readonly avatar: AvatarDriver;
  private readonly callbacks: LiveSessionCallbacks;

  constructor(avatar: AvatarDriver, callbacks: LiveSessionCallbacks) {
    this.avatar = avatar;
    this.callbacks = callbacks;
  }

  async connect(input: { liveToken: string; liveModel: string; startMic?: boolean }): Promise<void> {
    this.closed = false;
    this.openingSent = false;
    this.callbacks.onStatusChange("connecting");

    this.ensurePlaybackContext();

    const { GoogleGenAI } = await import("@google/genai");
    const ai = new GoogleGenAI({
      apiKey: input.liveToken,
      httpOptions: { apiVersion: "v1alpha" },
    });

    await new Promise<void>((resolve, reject) => {
      let settled = false;
      const timeout = setTimeout(() => {
        if (!settled) {
          settled = true;
          reject(new Error("Live connection timed out"));
        }
      }, 9000);

      ai.live
        .connect({
          model: input.liveModel,
          callbacks: {
            onopen: () => {
              // Wait for setupComplete (or settle shortly after open) before sending opening prompt.
              this.callbacks.onStatusChange("connected");
              if (!settled) {
                settled = true;
                clearTimeout(timeout);
                resolve();
              }
            },
            onmessage: (msg: LiveServerMessage) => {
              this.handleServerMessage(msg);
            },
            onerror: (err: ErrorEvent) => {
              const detail = err?.message || "Live audio connection error";
              if (!settled) {
                settled = true;
                clearTimeout(timeout);
                reject(new Error(detail));
              } else if (!this.closed) {
                this.callbacks.onStatusChange("error");
                this.callbacks.onError(detail);
              }
            },
            onclose: () => {
              if (!settled) {
                settled = true;
                clearTimeout(timeout);
                reject(new Error("Live session closed before connecting"));
              } else if (!this.closed) {
                this.callbacks.onStatusChange("closed");
              }
            },
          },
        })
        .then((session) => {
          this.session = session;
          this.sendOpeningIfNeeded();
        })
        .catch((err: unknown) => {
          if (!settled) {
            settled = true;
            clearTimeout(timeout);
            reject(err instanceof Error ? err : new Error("Could not start live session"));
          }
        });
    });

    this.flushTimer = setInterval(() => {
      void this.flush();
    }, 6000);

    if (input.startMic !== false) {
      await this.setMicEnabled(true);
    }
  }

  private sendOpeningIfNeeded(): void {
    if (this.openingSent || !this.session || this.closed) return;
    this.openingSent = true;
    try {
      this.session.sendClientContent({
        turns: OPENING_PROMPT,
        turnComplete: true,
      });
    } catch {
      // Ignore if socket closed simultaneously.
    }
  }

  sendText(text: string): void {
    const trimmed = text.trim();
    if (!trimmed || !this.session || this.closed) return;
    this.stopAudioPlayback();
    this.accumulator.addLearnerTranscript(trimmed);
    this.callbacks.onLearnerTranscript(trimmed);
    try {
      this.session.sendClientContent({
        turns: trimmed,
        turnComplete: true,
      });
    } catch {
      this.callbacks.onError("Could not send message to live teacher.");
    }
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    if (this.playbackGain) {
      this.playbackGain.gain.value = muted ? 0 : this.volume;
    }
    if (muted) this.stopAudioPlayback();
  }

  setVolume(volume: number): void {
    this.volume = Math.max(0, Math.min(1, Number.isFinite(volume) ? volume : 1));
    if (this.playbackGain && !this.muted) {
      this.playbackGain.gain.value = this.volume;
    }
  }

  async setMicEnabled(enabled: boolean): Promise<boolean> {
    if (enabled === this.micActive) return this.micActive;
    if (!enabled) {
      this.stopMicCapture();
      try {
        this.session?.sendRealtimeInput({ audioStreamEnd: true });
      } catch {
        // Ignore if closed.
      }
      return false;
    }

    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      return false;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          channelCount: 1,
        },
      });
      if (this.closed) {
        stream.getTracks().forEach((t) => t.stop());
        return false;
      }

      const Ctor =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) {
        stream.getTracks().forEach((t) => t.stop());
        return false;
      }

      const ctx = new Ctor();
      await ctx.resume().catch(() => undefined);
      const source = ctx.createMediaStreamSource(stream);
      const processor = ctx.createScriptProcessor(2048, 1, 1);

      processor.onaudioprocess = (ev) => {
        if (this.closed || !this.micActive || !this.session) return;
        const input = ev.inputBuffer.getChannelData(0);
        const level = rmsFromFloat32(input);
        this.callbacks.onLearnerLevel(level);
        if (level > 0.14) {
          this.learnerSpeakingMs += Math.round((input.length / ctx.sampleRate) * 1000);
        }
        this.avatar.setListening(!this.teacherSpeaking, level);

        const pcm = float32ToInt16Pcm(input, ctx.sampleRate, 16_000);
        if (pcm.length === 0) return;
        const data = int16ToBase64(pcm);
        try {
          this.session.sendRealtimeInput({
            audio: { data, mimeType: "audio/pcm;rate=16000" },
          });
        } catch {
          // Socket may be closing.
        }
      };

      source.connect(processor);
      // Connect to destination through a zero-gain node so ScriptProcessor runs without local echo.
      const silentGain = ctx.createGain();
      silentGain.gain.value = 0;
      processor.connect(silentGain);
      silentGain.connect(ctx.destination);

      this.captureStream = stream;
      this.captureCtx = ctx;
      this.captureSource = source;
      this.captureProcessor = processor;
      this.micActive = true;
      return true;
    } catch {
      this.stopMicCapture();
      return false;
    }
  }

  getSpeakingTotals(): { learnerSpeakingMs: number; teacherSpeakingMs: number } {
    return {
      learnerSpeakingMs: Math.round(this.learnerSpeakingMs),
      teacherSpeakingMs: Math.round(this.teacherSpeakingMs),
    };
  }

  async flush(): Promise<void> {
    if (this.flushing) return;
    const batch = this.accumulator.drain(20);
    if (batch.length === 0) return;
    this.flushing = true;
    try {
      const ok = await this.callbacks.onFlushTurns(batch);
      if (!ok) this.accumulator.requeue(batch);
    } catch {
      this.accumulator.requeue(batch);
    } finally {
      this.flushing = false;
    }
  }

  async disconnect(): Promise<void> {
    if (this.closed) return;
    this.closed = true;
    if (this.flushTimer !== null) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }
    this.stopMicCapture();
    this.stopAudioPlayback();
    this.accumulator.commitTurn();
    await this.flush();

    try {
      this.session?.close();
    } catch {
      // Ignore close errors.
    }
    this.session = null;
    if (this.playbackCtx) {
      void this.playbackCtx.close().catch(() => undefined);
      this.playbackCtx = null;
      this.playbackGain = null;
      this.playbackAnalyser = null;
    }
    this.callbacks.onStatusChange("closed");
  }

  private handleServerMessage(msg: LiveServerMessage): void {
    if (this.closed) return;

    if (msg.setupComplete) {
      this.sendOpeningIfNeeded();
    }

    if (msg.toolCall?.functionCalls?.length) {
      const responses = msg.toolCall.functionCalls.map((call) => {
        const event = liveToolCallToTutorEvent({
          id: call.id,
          name: call.name,
          args: call.args as Record<string, unknown> | undefined,
        });
        if (event) {
          this.accumulator.addEvent(event);
          this.callbacks.onToolEvent(event);
          if (event.type === "end_session") {
            this.callbacks.onEndRequested(event.summary);
          }
        }
        return {
          id: call.id,
          name: call.name,
          response: { ok: Boolean(event) },
        };
      });

      try {
        this.session?.sendToolResponse({ functionResponses: responses });
      } catch {
        // Ignore if socket closed.
      }
    }

    const content = msg.serverContent;
    if (!content) return;

    if (content.interrupted) {
      this.stopAudioPlayback();
    }

    if (content.inputTranscription?.text) {
      this.accumulator.addLearnerTranscript(content.inputTranscription.text);
      const current = this.accumulator.currentLearnerText();
      if (current) this.callbacks.onLearnerTranscript(current);
    }

    if (content.outputTranscription?.text) {
      this.accumulator.addTeacherTranscript(content.outputTranscription.text);
      const current = this.accumulator.currentTeacherText();
      if (current) this.callbacks.onLiveCaption(current);
    }

    const parts = content.modelTurn?.parts ?? [];
    for (const part of parts) {
      const inline = part.inlineData;
      if (inline?.data && (!inline.mimeType || inline.mimeType.startsWith("audio/"))) {
        const rate = parsePcmSampleRate(inline.mimeType);
        this.enqueuePcmAudio(inline.data, rate);
      }
    }

    if (content.turnComplete || content.interrupted) {
      const committed = this.accumulator.commitTurn();
      if (committed) {
        this.callbacks.onTurnCommitted(committed);
        if (this.accumulator.pendingCount() >= 2) {
          void this.flush();
        }
      }
    }
  }

  private ensurePlaybackContext(): void {
    if (this.playbackCtx || typeof window === "undefined") return;
    const Ctor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return;
    const ctx = new Ctor();
    const gain = ctx.createGain();
    gain.gain.value = this.muted ? 0 : this.volume;
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 512;
    gain.connect(analyser);
    analyser.connect(ctx.destination);
    this.playbackCtx = ctx;
    this.playbackGain = gain;
    this.playbackAnalyser = analyser;
    this.nextPlayTime = ctx.currentTime;
  }

  private enqueuePcmAudio(base64: string, sampleRate: number): void {
    if (this.muted) return;
    this.ensurePlaybackContext();
    const ctx = this.playbackCtx;
    const gain = this.playbackGain;
    if (!ctx || !gain) return;
    if (ctx.state === "suspended") void ctx.resume().catch(() => undefined);

    const float32 = pcm16Base64ToFloat32(base64);
    if (float32.length === 0) return;

    const buffer = ctx.createBuffer(1, float32.length, sampleRate);
    buffer.copyToChannel(new Float32Array(float32), 0);
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(gain);

    const now = ctx.currentTime;
    const startAt = Math.max(now + 0.015, this.nextPlayTime);
    this.nextPlayTime = startAt + buffer.duration;
    this.teacherSpeakingMs += Math.round(buffer.duration * 1000);

    this.activeSources.add(source);
    this.setTeacherSpeaking(true);

    source.onended = () => {
      this.activeSources.delete(source);
      if (this.activeSources.size === 0) {
        this.setTeacherSpeaking(false);
      }
    };
    source.start(startAt);
  }

  private setTeacherSpeaking(speaking: boolean): void {
    if (this.teacherSpeaking === speaking) return;
    this.teacherSpeaking = speaking;
    this.avatar.setSpeaking(speaking);
    if (speaking) this.avatar.setListening(false);
    this.callbacks.onTeacherSpeakingChange(speaking);

    if (speaking && this.visemeTimer === null) {
      this.visemeTimer = setInterval(() => {
        if (!this.playbackAnalyser || !this.playbackCtx) return;
        const bins = new Uint8Array(this.playbackAnalyser.frequencyBinCount);
        this.playbackAnalyser.getByteFrequencyData(bins);
        this.prevViseme = visemeFromSpectrum(bins, this.playbackCtx.sampleRate, this.prevViseme);
        this.avatar.setViseme(this.prevViseme);
      }, 28);
    } else if (!speaking && this.visemeTimer !== null) {
      clearInterval(this.visemeTimer);
      this.visemeTimer = null;
      this.prevViseme = undefined;
      this.avatar.setViseme(0);
    }
  }

  private stopAudioPlayback(): void {
    for (const src of this.activeSources) {
      try {
        src.onended = null;
        src.stop();
      } catch {
        // Already stopped.
      }
    }
    this.activeSources.clear();
    if (this.playbackCtx) this.nextPlayTime = this.playbackCtx.currentTime;
    this.setTeacherSpeaking(false);
  }

  private stopMicCapture(): void {
    this.micActive = false;
    if (this.captureProcessor) {
      this.captureProcessor.onaudioprocess = null;
      try {
        this.captureProcessor.disconnect();
      } catch {
        // Ignore.
      }
      this.captureProcessor = null;
    }
    if (this.captureSource) {
      try {
        this.captureSource.disconnect();
      } catch {
        // Ignore.
      }
      this.captureSource = null;
    }
    if (this.captureStream) {
      this.captureStream.getTracks().forEach((t) => t.stop());
      this.captureStream = null;
    }
    if (this.captureCtx) {
      void this.captureCtx.close().catch(() => undefined);
      this.captureCtx = null;
    }
    this.avatar.setListening(false);
  }
}
