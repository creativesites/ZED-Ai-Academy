"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { AvatarDriver } from "@/components/tutor/avatar/types";
import type { SpeakOutcome } from "@/components/tutor/EventPlayer";
import { TeacherVoice } from "./teacher-voice";

// One-line playback with the teacher's voice for surfaces that are not a full session: the lesson dock, the
// cards deck and the report card. Same TeacherVoice (server TTS, persona voice, no browser voice) as the
// Teaching Room. Call speak() from a tap: it unlocks audio first.

const SILENT_DRIVER: AvatarDriver = {
  playGesture: () => undefined,
  setMood: () => undefined,
  setViseme: () => undefined,
  setSpeaking: () => undefined,
  setListening: () => undefined,
  setThinking: () => undefined,
  lookAt: () => undefined,
};

export type TeacherVoiceSpeakOptions = {
  /** Drives the mouth while the line plays. */
  avatar?: AvatarDriver | null;
  /** Identifies what is playing (a message index, a card id) so the UI can show a stop button. */
  key?: string | number;
  /** Overrides the hook's voice for this line (e.g. the deck's per-language teacher). */
  voice?: string | null;
  language?: string | null;
  /** Playback speed, 0.75..1.35 (TeacherVoice clamps). */
  rate?: number;
  /** Pre-rendered audio for this line, if any; otherwise the voice is synthesised by /api/tutor/tts. */
  audioUrl?: string | null;
};

export function useTeacherVoice(options: { voice: string | null; language?: string | null }) {
  const voiceRef = useRef<TeacherVoice | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const [speakingKey, setSpeakingKey] = useState<string | number | null>(null);
  const defaults = useRef(options);
  useEffect(() => {
    defaults.current = { voice: options.voice, language: options.language };
  }, [options.voice, options.language]);

  useEffect(() => {
    const voice = new TeacherVoice();
    voiceRef.current = voice;
    return () => {
      abortRef.current?.abort();
      voice.stopPlayback();
      voiceRef.current = null;
    };
  }, []);

  const stop = useCallback((avatar?: AvatarDriver | null) => {
    abortRef.current?.abort();
    abortRef.current = null;
    voiceRef.current?.stopPlayback();
    avatar?.setSpeaking(false);
    avatar?.setViseme(0);
    setSpeakingKey(null);
  }, []);

  const speak = useCallback(
    async (text: string, opts: TeacherVoiceSpeakOptions = {}): Promise<SpeakOutcome> => {
      const voice = voiceRef.current;
      const line = text.trim();
      if (!voice || !line) return "unavailable";
      stop(opts.avatar);
      voice.unlock();
      voice.setTtsVoice(opts.voice ?? defaults.current.voice);
      voice.setLanguage(opts.language ?? defaults.current.language ?? null);
      const previousRate = voice.getPlaybackRate();
      if (typeof opts.rate === "number") voice.setPlaybackRate(opts.rate);

      const controller = new AbortController();
      abortRef.current = controller;
      setSpeakingKey(opts.key ?? line);
      const avatar = opts.avatar ?? null;
      avatar?.setSpeaking(true);
      try {
        return await voice.speak(
          { type: "say", text: line, ...(opts.audioUrl ? { audioUrl: opts.audioUrl } : {}) },
          avatar ?? SILENT_DRIVER,
          controller.signal,
        );
      } finally {
        voice.setPlaybackRate(previousRate);
        if (abortRef.current === controller) {
          abortRef.current = null;
          setSpeakingKey(null);
          avatar?.setSpeaking(false);
          avatar?.setViseme(0);
        }
      }
    },
    [stop],
  );

  /** Call from a tap before speaking outside a speak() call (e.g. a "tap to hear" control). */
  const unlock = useCallback(() => voiceRef.current?.unlock(), []);

  return { speak, stop, unlock, speakingKey };
}
