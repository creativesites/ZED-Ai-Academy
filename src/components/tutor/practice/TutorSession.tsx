"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft, Gauge, MessageSquareText, Sparkles, Volume1, Volume2, VolumeX, Wifi } from "lucide-react";
import { toast } from "sonner";
import { saveSessionWordsToDeck } from "@/actions/tutor-learner";
import type { AvatarDriver } from "@/components/tutor/avatar/types";
import type { TeacherStageHandle } from "@/components/tutor/avatar/TeacherStage";
import type { TeacherEngine } from "@/components/tutor/avatar/Teacher";
import type { AvatarEvent, PersonaLook } from "@/components/tutor/avatar/types";
import { EventPlayer, type CardItem, type ClipEvent, type LessonRefEvent, type PlayerUI, type SaySpeechEvent } from "@/components/tutor/EventPlayer";
import { boardFromEvent, choiceReply, revealBoard, type BoardState, type ConfidenceLevel } from "@/lib/tutor/board";
import type { TutorEvent } from "@/lib/tutor/events";
import { SCENE_ARTBOARDS, type SceneArtboard } from "@/lib/tutor/rive-driver";
import { tutorErrorMessage } from "@/lib/tutor/client-errors";
import type { TutorReportContent } from "@/lib/tutor/report-model";
import { shouldSendRecording } from "@/lib/tutor/recording";
import { compareResponseToTarget, type ResponseMatchResult } from "@/lib/tutor/response-match";
import { MAX_SPEAKING_MS, SpeakingTimeAccumulator } from "@/lib/tutor/speaking-time";
import { deriveTurnInteraction } from "@/lib/tutor/turn-interaction";
import { personaLookFromVariant } from "@/lib/tutor/tutor-session-block";
import { VadTracker } from "@/lib/tutor/vad";
import {
  detectMicPermission,
  httpTutorClient,
  measureRttMs,
  syncLiveEvents,
  type MicPermission,
  type SessionOriginInput,
  type TutorApiClient,
  type TutorScenarioBeat,
} from "./api";
import { Composer, type InputMode } from "./Composer";
import { GeminiLiveClient } from "./live-client";
import { LearnerRecorder, RecorderError, type RecordingResult } from "./learner-recorder";
import { ReportCard } from "./ReportCard";
import { SceneBackdrop } from "./SceneBackdrop";
import { playAwardFanfare, playChoiceChime, playMicReadyBlip, playStepTick } from "./sound-fx";
import { SpeakingStage, type Caption } from "./SpeakingStage";
import { StartPanel, type StartInfo } from "./StartPanel";
import { TeachingBoard, type ChoiceState } from "./TeachingBoard";
import { TranscriptDrawer, type TranscriptEntry } from "./TranscriptDrawer";
import { useLiteMode } from "./use-lite-mode";
import styles from "./practice.module.css";
import { TeacherAudio } from "./teacher-audio";
import { useReducedMotion } from "./use-reduced-motion";

// The in-session experience: start screen, the teacher on the stage, Voice (hold to talk) or Text
// turns, captions, flashcards, and the end-of-session report. Reusable: the lesson player can embed
// it with lessonId or assignmentId and no scenario.

export type TutorSessionProps = {
  origin: SessionOriginInput;
  scenarioId?: string;
  lessonId?: string;
  assignmentId?: string;
  sprint?: boolean;
  sprintCourseId?: string;
  focusObjective?: string;
  companyId?: string;
  /** Called with the report when the learner taps Done on the report card. */
  onExit?: (report: TutorReportContent) => void;
  /** Optional fallback navigation href for Back / Done when no onExit callback is passed. */
  doneHref?: string;
  /** Teacher renderer. The Rive teacher is the default; "placeholder" is the SVG fallback. */
  engine?: TeacherEngine;
  /** Backdrop scene for the Rive teacher. Defaults to the tea house. */
  scene?: SceneArtboard;
  /** Teacher look (colours, costume, face). Defaults to the contract default look. */
  look?: Partial<PersonaLook>;
  /** Backend for start, turn and complete. Defaults to the HTTP session API. The showcase injects its own. */
  client?: TutorApiClient;
  /** Start-screen details that the server page already knows. All optional. */
  preview?: {
    teacherName?: string;
    title?: string;
    goal?: string;
    maxMinutes?: number;
    modes?: InputMode[];
  };
};

type Phase = "intro" | "starting" | "live" | "ending" | "report";

type TurnInput =
  | { kind: "text"; text: string }
  | { kind: "audio"; clip: RecordingResult }
  | { kind: "image"; file: File; text?: string };

const ALL_MODES: InputMode[] = ["voice", "text"];
const LEVEL_UPDATE_MS = 100;

export function TutorSession({
  origin,
  scenarioId,
  lessonId,
  assignmentId,
  sprint,
  sprintCourseId,
  focusObjective,
  companyId,
  onExit,
  doneHref,
  preview,
  engine,
  scene,
  look,
  client,
}: TutorSessionProps) {
  const reducedMotion = useReducedMotion();
  const api = client ?? httpTutorClient;
  const [lite, setLite] = useLiteMode();
  // switch_scene (v2) can change the backdrop mid-session; it starts at the page's scene.
  const [sceneOverride, setSceneOverride] = useState<SceneArtboard | null>(null);
  const [lookOverride, setLookOverride] = useState<Partial<PersonaLook> | undefined>(undefined);
  const activeScene = sceneOverride ?? scene;
  const activeLook = lookOverride ?? look;

  const [phase, setPhase] = useState<Phase>("intro");
  const [error, setError] = useState<string | null>(null);
  const [micPermission, setMicPermission] = useState<MicPermission>("prompt");
  const [micBlocked, setMicBlocked] = useState(false);

  const [teacherName, setTeacherName] = useState(preview?.teacherName ?? "Your teacher");
  const [sceneTitle, setSceneTitle] = useState(preview?.title ?? "Practice session");
  const [goal, setGoal] = useState(preview?.goal ?? "");
  const [maxMinutes, setMaxMinutes] = useState(preview?.maxMinutes ?? 8);
  const [modes] = useState<InputMode[]>(preview?.modes?.length ? preview.modes : ALL_MODES);
  const [mode, setMode] = useState<InputMode>("voice");

  const [caption, setCaption] = useState<Caption | null>(null);
  const [card, setCard] = useState<CardItem | null>(null);
  const [whiteboard, setWhiteboard] = useState<string | null>(null);
  // Teaching surface (event contract v2).
  const [board, setBoard] = useState<BoardState | null>(null);
  const [choice, setChoice] = useState<ChoiceState | null>(null);
  const [confidence, setConfidence] = useState<{ prompt?: string } | null>(null);
  const [lessonRefs, setLessonRefs] = useState<LessonRefEvent[]>([]);
  const [clip, setClip] = useState<ClipEvent | null>(null);
  const [award, setAward] = useState<{ title: string; detail?: string } | null>(null);
  const [listenHint, setListenHint] = useState<{ expect?: string; hint?: string } | null>(null);
  const [lastSaid, setLastSaid] = useState<string | null>(null);
  const [thinking, setThinking] = useState(false);
  const [teacherSpeaking, setTeacherSpeaking] = useState(false);
  const [recording, setRecording] = useState(false);
  const [level, setLevel] = useState(0);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [soundBlocked, setSoundBlocked] = useState(false);
  const [muted, setMuted] = useState(false);
  const [volume, setVolume] = useState(1);
  const [audioMenuOpen, setAudioMenuOpen] = useState(false);
  const [playbackRate, setPlaybackRate] = useState<0.85 | 1 | 1.15>(1);
  const [turnCount, setTurnCount] = useState(0);
  const [stepsCompleted, setStepsCompleted] = useState(0);
  const [currentStepLabel, setCurrentStepLabel] = useState<string | null>(null);
  const [scenarioBeats, setScenarioBeats] = useState<TutorScenarioBeat[]>([]);
  const [activeBeatIdx, setActiveBeatIdx] = useState(0);
  const [celebratePulse, setCelebratePulse] = useState(0);
  const [hasReplayLine, setHasReplayLine] = useState(false);
  const [transcriptOpen, setTranscriptOpen] = useState(false);
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([]);
  const [savedDeckKeys, setSavedDeckKeys] = useState<Set<string>>(() => new Set());
  const [responseMatch, setResponseMatch] = useState<ResponseMatchResult | null>(null);
  const [handsFree, setHandsFree] = useState(false);
  const [handsFreeListening, setHandsFreeListening] = useState(false);
  const [handsFreeSpeechDetected, setHandsFreeSpeechDetected] = useState(false);
  const [liveActive, setLiveActive] = useState(false);
  const [liveMicOn, setLiveMicOn] = useState(false);
  const [thinkingSlow, setThinkingSlow] = useState(false);
  const [lastLearnerAudioUrl, setLastLearnerAudioUrl] = useState<string | null>(null);
  const [avatarMode, setAvatarMode] = useState<"rive" | "three">(
    engine === "three" || look?.engine === "three" ? "three" : "rive",
  );

  const [report, setReport] = useState<TutorReportContent | null>(null);
  const [words, setWords] = useState<CardItem[]>([]);

  // Refs hold what the event callbacks and the recorder need without re-creating them.
  const avatarRef = useRef<TeacherStageHandle | null>(null);
  const playerRef = useRef<EventPlayer | null>(null);
  const audioRef = useRef<TeacherAudio | null>(null);
  const liveClientRef = useRef<GeminiLiveClient | null>(null);
  const recorderRef = useRef<LearnerRecorder | null>(null);
  const learnerAudioUrlRef = useRef<string | null>(null);
  const thinkingTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const lastSayEventRef = useRef<SaySpeechEvent | null>(null);
  const scenarioBeatsRef = useRef<TutorScenarioBeat[]>([]);
  const lastTargetRef = useRef<string | null>(null);
  const personaLangRef = useRef<string>("en");
  const mutedRef = useRef(false);
  const volumeRef = useRef(1);
  const playbackRateRef = useRef<0.85 | 1 | 1.15>(1);
  const handsFreeRef = useRef(false);
  const handsFreeActiveRef = useRef(false);
  const vadRef = useRef<VadTracker>(new VadTracker());
  const vadCommitRef = useRef<() => void>(() => undefined);
  const entrySeqRef = useRef(0);
  const sessionIdRef = useRef<string | null>(null);
  const modeRef = useRef<InputMode>("voice");
  const phaseRef = useRef<Phase>("intro");
  const busyRef = useRef(false);
  const endingRef = useRef(false);
  const pendingEndRef = useRef(false);
  const holdingRef = useRef(false);
  const holdStartedAtRef = useRef(0);
  const holdTimerRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined);
  const speakSeqRef = useRef(0);
  const turnsRef = useRef(0);
  const wordsRef = useRef<CardItem[]>([]);
  const learnerTimeRef = useRef<SpeakingTimeAccumulator>(new SpeakingTimeAccumulator());
  const teacherBaseRef = useRef(0);
  const lastLevelAtRef = useRef(0);

  const setPhaseBoth = useCallback((next: Phase) => {
    phaseRef.current = next;
    setPhase(next);
  }, []);

  // Build the player, audio and recorder once, after mount. Cleanup cancels every timer and stream.
  useEffect(() => {
    const teacherAudio = new TeacherAudio();
    const recorder = new LearnerRecorder();
    audioRef.current = teacherAudio;
    recorderRef.current = recorder;

    const avatar: AvatarDriver = {
      playGesture: (name, opts) => avatarRef.current?.playGesture(name, opts),
      setMood: (mood, intensity) => avatarRef.current?.setMood(mood, intensity),
      setViseme: (v) => avatarRef.current?.setViseme(v),
      setSpeaking: (on) => avatarRef.current?.setSpeaking(on),
      setListening: (on, voiceLevel) => avatarRef.current?.setListening(on, voiceLevel),
      setThinking: (on) => avatarRef.current?.setThinking(on),
      lookAt: (x, y) => avatarRef.current?.lookAt(x, y),
    };

    const ui: PlayerUI = {
      onCaption: (native, roman, translation) => setCaption({ native, roman, translation }),
      onCard: (item) => {
        setCard(item);
        if (!wordsRef.current.some((w) => w.text === item.text)) {
          wordsRef.current = [...wordsRef.current, item];
        }
      },
      onText: (text) => setWhiteboard(text),
      onListen: (expect, hint) => {
        setListenHint({ expect, hint });
        lastTargetRef.current = expect?.trim() || null;
      },
      onMistake: () => undefined,
      onEnd: () => {
        pendingEndRef.current = true;
      },
      onAdvance: (step) => {
        setStepsCompleted((n) => n + 1);
        setCurrentStepLabel(step.replace(/[_-]+/g, " ").trim());
        setActiveBeatIdx((prev) => {
          const beats = scenarioBeatsRef.current;
          const idx = beats.findIndex((b) => b.id.toLowerCase() === step.toLowerCase());
          return idx >= 0 ? idx : Math.min(Math.max(0, beats.length - 1), prev + 1);
        });
        playStepTick({ muted: mutedRef.current, volume: volumeRef.current });
      },
      onBoard: (b) => {
        setBoard(boardFromEvent(b));
        setWhiteboard(null);
        // Teacher briefly glances toward the TeachingBoard when putting new content up.
        avatarRef.current?.lookAt(38, -8);
        setTimeout(() => avatarRef.current?.lookAt(0, 0), 1400);
        const summary =
          b.text?.trim() ||
          b.items?.join(" · ") ||
          b.rows?.map((r) => r.join(": ")).join(" | ") ||
          "";
        if (summary) {
          const id = `note-${++entrySeqRef.current}`;
          setTranscript((prev) => [
            ...prev,
            { id, role: "note", title: b.title, text: summary },
          ]);
        }
      },
      onReveal: (index) => setBoard((b) => (b ? revealBoard(b, index) : b)),
      onChoice: (question, options) => setChoice({ question, options }),
      onConfidence: (prompt) => setConfidence({ prompt }),
      onLessonRef: (ref) => setLessonRefs((refs) => [...refs.filter((r) => r.label !== ref.label), ref].slice(-3)),
      onClip: (c) => setClip(c),
      onEvidence: () => undefined,
      onScene: (name) => {
        if ((SCENE_ARTBOARDS as readonly string[]).includes(name)) setSceneOverride(name as SceneArtboard);
      },
      onAward: (title, detail) => {
        setAward({ title, detail });
        setCelebratePulse((p) => p + 1);
        playAwardFanfare({ muted: mutedRef.current, volume: volumeRef.current });
        avatarRef.current?.celebrate();
      },
    };

    playerRef.current = new EventPlayer({ avatar, ui, speak: teacherAudio.speak });

    recorder.onLevel = (value) => {
      avatarRef.current?.setListening(true, value);
      const now = performance.now();
      if (handsFreeActiveRef.current) {
        const vadStatus = vadRef.current.update(value, now);
        if (vadStatus === "speaking") {
          setHandsFreeSpeechDetected(true);
        } else if (vadStatus === "commit") {
          vadCommitRef.current();
          return;
        }
      }
      if (now - lastLevelAtRef.current >= LEVEL_UPDATE_MS) {
        lastLevelAtRef.current = now;
        setLevel(value);
      }
    };

    const unsubscribeBlocked = teacherAudio.onBlockedChange(setSoundBlocked);
    return () => {
      void liveClientRef.current?.disconnect();
      liveClientRef.current = null;
      playerRef.current?.stop();
      playerRef.current = null;
      recorder.cancel();
      teacherAudio.stopPlayback();
      unsubscribeBlocked();
      if (holdTimerRef.current !== undefined) clearInterval(holdTimerRef.current);
      if (thinkingTimerRef.current !== undefined) clearTimeout(thinkingTimerRef.current);
      if (learnerAudioUrlRef.current) {
        URL.revokeObjectURL(learnerAudioUrlRef.current);
        learnerAudioUrlRef.current = null;
      }
    };
  }, []);

  // Teacher speech. A sequence number stops a cancelled line from clearing the speaking state of a newer one.
  const speakEvents = useCallback(async (events: readonly TutorEvent[], opts?: { recordTranscript?: boolean }) => {
    const player = playerRef.current;
    if (!player || events.length === 0) return;
    const sayEvents = events.filter((ev): ev is SaySpeechEvent => ev.type === "say");
    if (sayEvents.length > 0) {
      audioRef.current?.prefetch(
        sayEvents.filter((ev) => !ev.audioUrl).map((ev) => ev.text),
      );
    }
    const lastSay = sayEvents[sayEvents.length - 1];
    if (lastSay) {
      lastSayEventRef.current = lastSay;
      setHasReplayLine(true);
    }
    if (opts?.recordTranscript !== false && sayEvents.length > 0) {
      setTranscript((prev) => [
        ...prev,
        ...sayEvents.map((ev) => ({
          id: `teacher-${++entrySeqRef.current}`,
          role: "teacher" as const,
          text: ev.text,
          roman: ev.romanization,
          translation: ev.translation,
          sayEvent: ev,
        })),
      ]);
    }
    const seq = ++speakSeqRef.current;
    setTeacherSpeaking(true);
    try {
      await player.play(events);
    } finally {
      if (seq === speakSeqRef.current) setTeacherSpeaking(false);
    }
  }, []);

  // Ends the session on the server and shows the report. Idempotent on the server, so a retry is safe.
  const finalize = useCallback(
    async (status: "completed" | "abandoned" = "completed") => {
      const sessionId = sessionIdRef.current;
      if (!sessionId || endingRef.current) return;
      endingRef.current = true;
      setError(null);
      setPhaseBoth("ending");

      playerRef.current?.stop();
      audioRef.current?.stopPlayback();
      if (thinkingTimerRef.current !== undefined) {
        clearTimeout(thinkingTimerRef.current);
        thinkingTimerRef.current = undefined;
      }
      setThinkingSlow(false);
      holdingRef.current = false;
      handsFreeRef.current = false;
      handsFreeActiveRef.current = false;
      setHandsFree(false);
      setHandsFreeListening(false);
      setHandsFreeSpeechDetected(false);
      recorderRef.current?.cancel();
      setRecording(false);

      let liveTotals: { learnerSpeakingMs: number; teacherSpeakingMs: number } | null = null;
      if (liveClientRef.current) {
        liveTotals = liveClientRef.current.getSpeakingTotals();
        await liveClientRef.current.disconnect();
        liveClientRef.current = null;
        setLiveActive(false);
        setLiveMicOn(false);
      }

      const played = audioRef.current?.getPlayedMs() ?? 0;
      const totals = liveTotals
        ? {
            learnerSpeakingMs: Math.min(MAX_SPEAKING_MS, Math.max(0, liveTotals.learnerSpeakingMs)),
            teacherSpeakingMs: Math.min(MAX_SPEAKING_MS, Math.max(0, liveTotals.teacherSpeakingMs)),
          }
        : {
            learnerSpeakingMs: learnerTimeRef.current.totals().learnerSpeakingMs,
            teacherSpeakingMs: Math.min(MAX_SPEAKING_MS, Math.max(0, Math.round(played - teacherBaseRef.current))),
          };
      const res = await api.complete(sessionId, totals, turnsRef.current > 0 ? status : "abandoned");
      if (!res.ok) {
        endingRef.current = false;
        setError(tutorErrorMessage(res.failure, "complete"));
        return;
      }
      setWords(wordsRef.current);
      setReport(res.data.report);
      setPhaseBoth("report");
    },
    [api, setPhaseBoth],
  );

  // One exchange: send the learner's turn, then play the teacher's reply.
  const submitTurn = useCallback(
    async (input: TurnInput) => {
      const sessionId = sessionIdRef.current;
      if (!sessionId || busyRef.current || endingRef.current) return;
      busyRef.current = true;

      // The learner moved on: stop any teacher speech still playing.
      playerRef.current?.stop();
      audioRef.current?.stopPlayback();
      setTeacherSpeaking(false);
      setListenHint(null);
      setChoice(null);
      setConfidence(null);
      setError(null);
      setThinking(true);
      setThinkingSlow(false);
      avatarRef.current?.setThinking(true);
      avatarRef.current?.setMood("curious", 70);
      avatarRef.current?.lookAt(0.24, 0.14);
      if (thinkingTimerRef.current !== undefined) clearTimeout(thinkingTimerRef.current);
      thinkingTimerRef.current = setTimeout(() => {
        setThinkingSlow(true);
        avatarRef.current?.playGesture("think");
      }, 900);
      const expectedTarget = lastTargetRef.current;
      lastTargetRef.current = null;
      if (input.kind === "text") {
        setTranscript((prev) => [
          ...prev,
          { id: `learner-${++entrySeqRef.current}`, role: "learner", text: input.text },
        ]);
        setResponseMatch(expectedTarget ? compareResponseToTarget(input.text, expectedTarget) : null);
      } else if (input.kind === "image") {
        setResponseMatch(null);
        const label = input.text ? `[Photo] ${input.text}` : "[Shared work photo]";
        setLastSaid(label);
        setTranscript((prev) => [
          ...prev,
          { id: `learner-${++entrySeqRef.current}`, role: "learner", text: label },
        ]);
      } else {
        setResponseMatch(null);
        learnerTimeRef.current.addLearnerMs(input.clip.durationMs);
        if (learnerAudioUrlRef.current) {
          URL.revokeObjectURL(learnerAudioUrlRef.current);
        }
        const nextUrl = URL.createObjectURL(input.clip.blob);
        learnerAudioUrlRef.current = nextUrl;
        setLastLearnerAudioUrl(nextUrl);
      }

      const res = await api.turn(
        sessionId,
        input.kind === "text"
          ? { kind: "text", text: input.text }
          : input.kind === "image"
            ? { kind: "image", file: input.file, text: input.text }
            : { kind: "audio", blob: input.clip.blob, mimeType: input.clip.mimeType },
      );

      if (thinkingTimerRef.current !== undefined) {
        clearTimeout(thinkingTimerRef.current);
        thinkingTimerRef.current = undefined;
      }
      setThinkingSlow(false);
      avatarRef.current?.setThinking(false);
      avatarRef.current?.lookAt(0, 0);
      setThinking(false);
      busyRef.current = false;

      if (!res.ok) {
        const ended =
          res.failure.kind === "http" && res.failure.status === 409 && /not active/i.test(res.failure.error ?? "");
        if (ended) {
          // The server already closed the session: finish it so the learner gets their report.
          void finalize("completed");
          return;
        }
        setError(tutorErrorMessage(res.failure, "turn"));
        return;
      }

      turnsRef.current += 1;
      setTurnCount(turnsRef.current);
      if (res.data.learnerText) {
        setLastSaid(res.data.learnerText);
        if (input.kind === "audio") {
          setTranscript((prev) => [
            ...prev,
            { id: `learner-${++entrySeqRef.current}`, role: "learner", text: res.data.learnerText! },
          ]);
          if (expectedTarget) {
            setResponseMatch(compareResponseToTarget(res.data.learnerText, expectedTarget));
          }
        }
      }
      if (res.data.ended) pendingEndRef.current = true;
      await speakEvents(res.data.events);
      if (pendingEndRef.current) void finalize("completed");
    },
    [api, speakEvents, finalize],
  );

  const handleClip = useCallback(
    (clip: RecordingResult | null) => {
      if (!clip) return;
      if (!shouldSendRecording(clip.durationMs)) {
        setError("Hold a little longer to talk.");
        return;
      }
      void submitTurn({ kind: "audio", clip });
    },
    [submitTurn],
  );

  const endHold = useCallback(async () => {
    if (!holdingRef.current) return;
    holdingRef.current = false;
    if (holdTimerRef.current !== undefined) {
      clearInterval(holdTimerRef.current);
      holdTimerRef.current = undefined;
    }
    setRecording(false);
    setLevel(0);
    avatarRef.current?.setListening(false);
    const recorder = recorderRef.current;
    // If the recorder has not started yet (the mic prompt is open), beginHold stops it once it starts.
    if (!recorder || !recorder.isRecording) return;
    handleClip(await recorder.stop());
  }, [handleClip]);

  const beginHold = useCallback(async () => {
    const recorder = recorderRef.current;
    if (!recorder || holdingRef.current || recorder.isRecording) return;
    if (modeRef.current !== "voice" || phaseRef.current !== "live" || busyRef.current || micBlocked) return;

    audioRef.current?.unlock();
    // Talking over the teacher is allowed: stop her line first.
    playerRef.current?.stop();
    audioRef.current?.stopPlayback();
    setTeacherSpeaking(false);
    setError(null);

    holdingRef.current = true;
    setRecording(true);
    recorder.onCap = () => void endHold();
    try {
      await recorder.start();
    } catch (err) {
      holdingRef.current = false;
      setRecording(false);
      if (err instanceof RecorderError && err.kind === "denied") {
        setMicBlocked(true);
        setMicPermission("denied");
        setError("Microphone access is blocked. Switch to Text to keep going.");
      } else {
        setError(err instanceof Error ? err.message : "The microphone could not be started.");
      }
      return;
    }

    holdStartedAtRef.current = performance.now();
    setElapsedMs(0);
    holdTimerRef.current = setInterval(() => {
      setElapsedMs(performance.now() - holdStartedAtRef.current);
    }, 200);

    // Released while the mic prompt was open: finish the clip right away.
    if (!holdingRef.current) {
      if (holdTimerRef.current !== undefined) clearInterval(holdTimerRef.current);
      holdTimerRef.current = undefined;
      handleClip(await recorder.stop());
    }
  }, [endHold, handleClip, micBlocked]);

  // Start: user gesture, so teacher audio is unlocked here. Then mic check, RTT, session, opening turn.
  const handleStart = useCallback(async () => {
    audioRef.current?.unlock();
    setError(null);
    setPhaseBoth("starting");

    const permission = await detectMicPermission();
    setMicPermission(permission);
    setMicBlocked(permission === "denied");
    // A custom client (the showcase) makes no network calls, so skip the round-trip probe.
    const rttMs = client ? undefined : await measureRttMs();

    const startRequest = {
      origin,
      scenarioId,
      lessonId,
      assignmentId,
      sprint,
      sprintCourseId,
      focusObjective,
      companyId,
      micPermission: permission,
      rttMs,
      // Let the server's mode policy pick Gemini Live when allowed (unless Lite mode, showcase client, or mic denied).
      preferMode:
        permission === "denied"
          ? ("text" as const)
          : lite || client
            ? ("voice" as const)
            : undefined,
    };

    let res = await api.start(startRequest);

    if (!res.ok) {
      setError(tutorErrorMessage(res.failure, "start"));
      setPhaseBoth("intro");
      return;
    }
    let data = res.data;

    // Reset any prior Live client before starting a new session.
    if (liveClientRef.current) {
      await liveClientRef.current.disconnect();
      liveClientRef.current = null;
    }
    setLiveActive(false);
    setLiveMicOn(false);

    if (learnerAudioUrlRef.current) {
      URL.revokeObjectURL(learnerAudioUrlRef.current);
      learnerAudioUrlRef.current = null;
    }
    setLastLearnerAudioUrl(null);

    const setupSessionUi = (started: typeof data) => {
      sessionIdRef.current = started.sessionId;
      personaLangRef.current = started.persona.languages?.[0] ?? "en";
      audioRef.current?.setLanguage(started.persona.languages?.[0]);
      audioRef.current?.setTtsVoice(client ? null : started.persona.voiceName ?? null);
      audioRef.current?.setMuted(false);
      mutedRef.current = false;
      setMuted(false);
      modeRef.current = started.mode === "text" ? "text" : "voice";
      setMode(modeRef.current);
      setTeacherName(started.persona.displayName ?? started.persona.name);
      setLookOverride(personaLookFromVariant(started.persona.riveVariant));
      setSceneTitle(started.scenario.title);
      setGoal(started.scenario.goal);
      setMaxMinutes(started.scenario.maxMinutes);
      const beats = started.scenario.beats ?? [];
      scenarioBeatsRef.current = beats;
      setScenarioBeats(beats);
      setActiveBeatIdx(0);

      learnerTimeRef.current = new SpeakingTimeAccumulator();
      teacherBaseRef.current = audioRef.current?.getPlayedMs() ?? 0;
      turnsRef.current = 0;
      setTurnCount(0);
      setStepsCompleted(0);
      setCurrentStepLabel(null);
      setCelebratePulse(0);
      setTranscript([]);
      setSavedDeckKeys(new Set());
      setResponseMatch(null);
      lastTargetRef.current = null;
      lastSayEventRef.current = null;
      setHasReplayLine(false);
      wordsRef.current = [];
      endingRef.current = false;
      pendingEndRef.current = false;
      busyRef.current = false;
      setWords([]);
      setReport(null);
      setCaption(null);
      setCard(null);
      setWhiteboard(null);
      setSceneOverride(null);
      setBoard(null);
      setChoice(null);
      setConfidence(null);
      setLessonRefs([]);
      setClip(null);
      setAward(null);
      setListenHint(null);
      setLastSaid(null);
    };

    if (data.mode === "live" && data.liveToken && data.liveModel) {
      setupSessionUi(data);
      const liveAvatar: AvatarDriver = {
        playGesture: (name, opts) => avatarRef.current?.playGesture(name, opts),
        setMood: (mood, intensity) => avatarRef.current?.setMood(mood, intensity),
        setViseme: (v) => avatarRef.current?.setViseme(v),
        setSpeaking: (on) => avatarRef.current?.setSpeaking(on),
        setListening: (on, voiceLevel) => avatarRef.current?.setListening(on, voiceLevel),
        setThinking: (on) => avatarRef.current?.setThinking(on),
        lookAt: (x, y) => avatarRef.current?.lookAt(x, y),
      };

      const liveSessionId = data.sessionId;
      const liveClient = new GeminiLiveClient(liveAvatar, {
        onStatusChange: (status) => {
          if (status === "connected") setLiveActive(true);
          if (status === "closed") {
            setLiveActive(false);
            setLiveMicOn(false);
          }
        },
        onTeacherSpeakingChange: (speaking) => setTeacherSpeaking(speaking),
        onLearnerLevel: (val) => {
          const now = performance.now();
          if (now - lastLevelAtRef.current >= LEVEL_UPDATE_MS) {
            lastLevelAtRef.current = now;
            setLevel(val);
          }
        },
        onLiveCaption: (text) => setCaption({ native: text }),
        onLearnerTranscript: (text) => setLastSaid(text),
        onToolEvent: (ev) => {
          void playerRef.current?.play([ev]);
        },
        onTurnCommitted: (turn) => {
          turnsRef.current += 1;
          setTurnCount(turnsRef.current);
          if (turn.learnerText) {
            setTranscript((prev) => [
              ...prev,
              { id: `learner-${++entrySeqRef.current}`, role: "learner", text: turn.learnerText! },
            ]);
          }
          const sayEv = turn.events.find((e): e is SaySpeechEvent => e.type === "say");
          if (sayEv) {
            lastSayEventRef.current = sayEv;
            setHasReplayLine(true);
            setTranscript((prev) => [
              ...prev,
              { id: `teacher-${++entrySeqRef.current}`, role: "teacher", text: sayEv.text, sayEvent: sayEv },
            ]);
          }
        },
        onEndRequested: () => {
          pendingEndRef.current = true;
          void finalize("completed");
        },
        onFlushTurns: async (batch) => {
          const synced = await syncLiveEvents(liveSessionId, batch);
          return synced.ok;
        },
        onError: (msg) => setError(msg),
      });

      try {
        await liveClient.connect({
          liveToken: data.liveToken,
          liveModel: data.liveModel,
          startMic: permission !== "denied",
        });
        liveClientRef.current = liveClient;
        setLiveActive(true);
        setLiveMicOn(permission !== "denied");
        setPhaseBoth("live");
        return;
      } catch (liveErr) {
        console.warn("[tutor] Live connection failed, falling back to turn-based Voice:", liveErr);
        await liveClient.disconnect().catch(() => undefined);
        // Cleanly retry starting in standard Voice mode so the learner never hits a dead end.
        res = await api.start({ ...startRequest, preferMode: "voice" });
        if (!res.ok || res.data.mode === "live") {
          setError("Live audio could not connect. Please try again.");
          setPhaseBoth("intro");
          return;
        }
        data = res.data;
      }
    }

    setupSessionUi(data);
    setPhaseBoth("live");
    await speakEvents(data.openingEvents ?? []);
    if (pendingEndRef.current) void finalize("completed");
  }, [api, client, lite, origin, scenarioId, lessonId, assignmentId, sprint, sprintCourseId, focusObjective, companyId, setPhaseBoth, speakEvents, finalize]);

  const changeMode = (next: InputMode) => {
    if (next === modeRef.current) return;
    if (holdingRef.current || handsFreeActiveRef.current) {
      holdingRef.current = false;
      handsFreeActiveRef.current = false;
      setHandsFreeListening(false);
      setHandsFreeSpeechDetected(false);
      if (holdTimerRef.current !== undefined) {
        clearInterval(holdTimerRef.current);
        holdTimerRef.current = undefined;
      }
      recorderRef.current?.cancel();
      setRecording(false);
    }
    if (next === "text" && handsFreeRef.current) {
      handsFreeRef.current = false;
      setHandsFree(false);
    }
    modeRef.current = next;
    setMode(next);
    setError(null);
  };

  const handleSendText = (text: string) => {
    audioRef.current?.unlock();
    if (liveClientRef.current && liveActive) {
      setChoice(null);
      setConfidence(null);
      liveClientRef.current.sendText(text);
      return;
    }
    if (handsFreeActiveRef.current) {
      handsFreeActiveRef.current = false;
      setHandsFreeListening(false);
      setHandsFreeSpeechDetected(false);
      if (holdTimerRef.current !== undefined) {
        clearInterval(holdTimerRef.current);
        holdTimerRef.current = undefined;
      }
      recorderRef.current?.cancel();
      setRecording(false);
    }
    void submitTurn({ kind: "text", text });
  };

  const handleSendImage = (file: File, text?: string) => {
    audioRef.current?.unlock();
    void submitTurn({ kind: "image", file, text });
  };

  const toggleLiveMic = () => {
    const live = liveClientRef.current;
    if (!live) return;
    void live.setMicEnabled(!liveMicOn).then((active) => setLiveMicOn(active));
  };

  const handleChoose = (option: string) => {
    playChoiceChime({ muted: mutedRef.current, volume: volumeRef.current });
    setChoice((c) => (c ? { ...c, picked: option } : c));
    handleSendText(choiceReply(option));
  };

  const handleConfidence = (level: ConfidenceLevel) => {
    playChoiceChime({ muted: mutedRef.current, volume: volumeRef.current });
    setConfidence(null);
    handleSendText(level);
  };

  // Universal Study Deck bookmarking (works for any subject: concepts, tips, formulas, or phrases)
  const handleSaveStudyItem = useCallback(
    (item: { key: string; term: string; pron?: string; meaning: string }) => {
      if (savedDeckKeys.has(item.key)) return;
      setSavedDeckKeys((prev) => new Set(prev).add(item.key));
      playStepTick({ muted: mutedRef.current, volume: volumeRef.current });
      void saveSessionWordsToDeck(
        [{ text: item.term, pron: item.pron, meaning: item.meaning }],
        personaLangRef.current || "en",
        companyId,
      )
        .then(() => {
          toast.success("Saved to your Study Deck");
        })
        .catch(() => {
          // Even in public demo/unauthenticated showcase, keep the visual checkmark quietly
          if (!client) {
            toast.error("Sign in to save cards to your Study Deck");
            setSavedDeckKeys((prev) => {
              const next = new Set(prev);
              next.delete(item.key);
              return next;
            });
          }
        });
    },
    [client, companyId, savedDeckKeys],
  );

  const commitHandsFree = useCallback(async () => {
    if (!handsFreeActiveRef.current) return;
    handsFreeActiveRef.current = false;
    setHandsFreeListening(false);
    setHandsFreeSpeechDetected(false);
    if (holdTimerRef.current !== undefined) {
      clearInterval(holdTimerRef.current);
      holdTimerRef.current = undefined;
    }
    setRecording(false);
    setLevel(0);
    avatarRef.current?.setListening(false);
    const recorder = recorderRef.current;
    if (!recorder || !recorder.isRecording) return;
    const clip = await recorder.stop();
    if (!clip) return;
    if (!shouldSendRecording(clip.durationMs)) return;
    void submitTurn({ kind: "audio", clip });
  }, [submitTurn]);

  useEffect(() => {
    vadCommitRef.current = () => void commitHandsFree();
  }, [commitHandsFree]);

  // Hands-Free Auto-VAD lifecycle: opens mic cleanly whenever the teacher finishes speaking.
  useEffect(() => {
    if (
      !handsFree ||
      phase !== "live" ||
      teacherSpeaking ||
      thinking ||
      recording ||
      micBlocked ||
      mode !== "voice"
    ) {
      return;
    }

    let cancelled = false;
    const timer = setTimeout(async () => {
      if (cancelled || !handsFreeRef.current || busyRef.current || endingRef.current) return;
      const recorder = recorderRef.current;
      if (!recorder || recorder.isRecording) return;

      vadRef.current.reset();
      handsFreeActiveRef.current = true;
      setHandsFreeListening(true);
      setHandsFreeSpeechDetected(false);
      setRecording(true);
      recorder.onCap = () => void commitHandsFree();

      try {
        await recorder.start();
      } catch (err) {
        handsFreeActiveRef.current = false;
        handsFreeRef.current = false;
        setHandsFree(false);
        setHandsFreeListening(false);
        setRecording(false);
        if (err instanceof RecorderError && err.kind === "denied") {
          setMicBlocked(true);
          setMicPermission("denied");
          setError("Microphone access is blocked. Switched to typing.");
        }
        return;
      }

      if (cancelled || !handsFreeRef.current) {
        handsFreeActiveRef.current = false;
        setHandsFreeListening(false);
        setRecording(false);
        recorder.cancel();
        return;
      }

      playMicReadyBlip({ muted: mutedRef.current, volume: volumeRef.current });
      holdStartedAtRef.current = performance.now();
      setElapsedMs(0);
      holdTimerRef.current = setInterval(() => {
        setElapsedMs(performance.now() - holdStartedAtRef.current);
      }, 200);
    }, 380);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [handsFree, phase, teacherSpeaking, thinking, recording, micBlocked, mode, commitHandsFree]);

  const toggleHandsFree = () => {
    audioRef.current?.unlock();
    const next = !handsFree;
    handsFreeRef.current = next;
    setHandsFree(next);
    if (!next && handsFreeActiveRef.current) {
      handsFreeActiveRef.current = false;
      setHandsFreeListening(false);
      setHandsFreeSpeechDetected(false);
      if (holdTimerRef.current !== undefined) {
        clearInterval(holdTimerRef.current);
        holdTimerRef.current = undefined;
      }
      recorderRef.current?.cancel();
      setRecording(false);
    } else if (next && modeRef.current !== "voice") {
      modeRef.current = "voice";
      setMode("voice");
    }
  };

  const toggleLite = () => setLite(!lite);

  const practiseAgain = () => {
    sessionIdRef.current = null;
    setReport(null);
    setWords([]);
    void handleStart();
  };

  const toggleMute = () => {
    const next = !muted;
    audioRef.current?.unlock();
    audioRef.current?.setMuted(next);
    liveClientRef.current?.setMuted(next);
    mutedRef.current = next;
    setMuted(next);
  };

  const handleVolumeChange = (next: number) => {
    const clamped = Math.max(0, Math.min(1, next));
    setVolume(clamped);
    volumeRef.current = clamped;
    audioRef.current?.setVolume(clamped);
    liveClientRef.current?.setVolume(clamped);
    if (clamped === 0 && !muted) {
      audioRef.current?.setMuted(true);
      liveClientRef.current?.setMuted(true);
      mutedRef.current = true;
      setMuted(true);
    } else if (clamped > 0 && muted) {
      audioRef.current?.setMuted(false);
      liveClientRef.current?.setMuted(false);
      mutedRef.current = false;
      setMuted(false);
    }
  };

  const cyclePlaybackRate = () => {
    const next: 0.85 | 1 | 1.15 = playbackRate === 1 ? 0.85 : playbackRate === 0.85 ? 1.15 : 1;
    setPlaybackRate(next);
    playbackRateRef.current = next;
    audioRef.current?.setPlaybackRate(next);
  };

  const replaySayEvent = useCallback(
    async (sayEv: SaySpeechEvent, slow = false) => {
      if (thinking || recording || phaseRef.current !== "live") return;
      audioRef.current?.unlock();
      if (mutedRef.current) {
        audioRef.current?.setMuted(false);
        mutedRef.current = false;
        setMuted(false);
      }
      playerRef.current?.stop();
      audioRef.current?.stopPlayback();
      const prevRate = playbackRateRef.current;
      if (slow) audioRef.current?.setPlaybackRate(0.75);
      try {
        await speakEvents([sayEv], { recordTranscript: false });
      } finally {
        if (slow) audioRef.current?.setPlaybackRate(prevRate);
      }
    },
    [recording, speakEvents, thinking],
  );

  const handleReplayLast = useCallback(() => {
    if (lastSayEventRef.current) void replaySayEvent(lastSayEventRef.current, false);
  }, [replaySayEvent]);

  const handleReplaySlow = useCallback(() => {
    if (lastSayEventRef.current) void replaySayEvent(lastSayEventRef.current, true);
  }, [replaySayEvent]);

  const enableSound = () => {
    audioRef.current?.unlock();
    audioRef.current?.clearBlocked();
  };

  const endFromButton = () => {
    void finalize(turnsRef.current > 0 ? "completed" : "abandoned");
  };

  // Stable wrappers so the Space key listener in Composer is not re-bound on every render.
  const holdStart = useCallback(() => void beginHold(), [beginHold]);
  const holdEnd = useCallback(() => void endHold(), [endHold]);

  const avatarEvent = useCallback((e: AvatarEvent) => {
    playerRef.current?.notify(e);
  }, []);

  const navigateToSprint = useCallback(
    (objectiveText?: string) => {
      if (typeof window === "undefined") return;
      const match = /^\/academy\/([^/]+)/.exec(window.location.pathname);
      const base = match ? `/academy/${match[1]}` : "";
      const params = new URLSearchParams();
      if (objectiveText) params.set("focus", objectiveText);
      if (sprintCourseId) params.set("courseId", sprintCourseId);
      const qs = params.toString();
      window.location.assign(`${base}/practice/sprint${qs ? `?${qs}` : ""}`);
    },
    [sprintCourseId],
  );

  const info: StartInfo = { teacherName, title: sceneTitle, goal, maxMinutes, modes };
  const thinkingPhrases = [
    `${teacherName} is listening closely...`,
    `${teacherName} is preparing the next step...`,
    `${teacherName} is updating the board...`,
  ];
  const statusText = thinking
    ? thinkingSlow
      ? `${teacherName} is putting together your feedback...`
      : thinkingPhrases[turnCount % thinkingPhrases.length]
    : teacherSpeaking
      ? `${teacherName} is speaking...`
      : liveActive
        ? liveMicOn
          ? "Live — speak or interrupt anytime."
          : "Live mic paused."
        : recording
          ? "Listening..."
          : phase === "ending"
            ? "Saving your session..."
            : listenHint
              ? "Your turn."
              : mode === "voice"
                ? "Hold to talk when you are ready."
                : "Type a reply when you are ready.";

  if (phase === "intro" || phase === "starting") {
    return (
      <div className={`${styles.room} flex min-h-[100dvh] flex-col justify-center px-3 py-5 sm:px-4 sm:py-8`}>
        {!lite && <SceneBackdrop scene={activeScene} className="absolute inset-0 h-full w-full" />}
        <div className="relative z-10 mx-auto w-full max-w-[500px] space-y-2.5 sm:space-y-3">
          {doneHref && (
            <a
              href={doneHref}
              className="inline-flex items-center gap-1.5 rounded-full border border-[var(--line)] bg-white/85 px-3 py-1 text-xs font-semibold text-[var(--ink)] backdrop-blur hover:bg-white"
            >
              ← Back
            </a>
          )}
          <StartPanel
            info={info}
            micPermission={micPermission}
            starting={phase === "starting"}
            error={error}
            onStart={() => void handleStart()}
          />
        </div>
      </div>
    );
  }

  if (phase === "report" && report) {
    const handleDone = onExit
      ? () => onExit(report)
      : doneHref
        ? () => window.location.assign(doneHref)
        : undefined;
    return (
      <div className={`${styles.room} flex min-h-[100dvh] flex-col justify-center px-4 py-8`}>
        {!lite && <SceneBackdrop scene={activeScene} className="absolute inset-0 h-full w-full" />}
        <div className="relative z-10">
          <ReportCard
            report={report}
            title={sceneTitle}
            words={words}
            onPractiseAgain={practiseAgain}
            onPractiseObjective={client ? undefined : (obj) => navigateToSprint(obj)}
            onStartSprint={client ? undefined : () => navigateToSprint()}
            onDone={handleDone}
          />
        </div>
      </div>
    );
  }

  const ending = phase === "ending";
  const canTalk = phase === "live" && mode === "voice" && !thinking && !micBlocked && !ending;
  const canType = phase === "live" && !thinking && !ending;

  const interaction = deriveTurnInteraction({
    choice,
    confidence,
    board,
    whiteboard,
    caption,
    listenHint,
    turnCount,
  });

  // TeachingBoard displays board content, clips, awards, and lesson references;
  // interactive choice, order, fill-in-the-blank & confidence controls live directly in the sticky bottom dock.
  const hasBoardContent = Boolean(board || lessonRefs.length || clip || award);
  const progressPct = Math.min(100, Math.max(8, Math.round(((stepsCompleted * 1.5 + turnCount) / 8) * 100)));

  return (
    <div className={`${styles.room} flex ${client ? "h-[min(86dvh,760px)]" : "h-[100dvh]"} flex-col overflow-hidden`}>
      {!lite && <SceneBackdrop scene={activeScene} className="absolute inset-0 h-full w-full" />}

      {/* Sticky Slim Top Session HUD — Progress, Notes, Audio, Volume, Speed, 3D, Lite, End always 1 tap away */}
      <header className="relative z-20 shrink-0 border-b border-[var(--line)] bg-white/85 backdrop-blur-md">
        <div className="flex items-center justify-between gap-2 px-2.5 pb-2 pt-[max(0.5rem,env(safe-area-inset-top))] sm:px-4">
          <div className="flex min-w-0 items-center gap-2">
            {doneHref && (
              <a
                href={doneHref}
                aria-label="Leave session"
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[var(--line-strong)] bg-white text-[var(--ink)] transition hover:bg-[var(--soft-hover)]"
              >
                <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              </a>
            )}
            <div className="min-w-0">
              <p className="truncate text-xs font-bold text-[var(--ink)] sm:text-sm">{sceneTitle}</p>
              <div className="flex items-center gap-1.5 text-[10px] font-semibold text-[var(--ink-dim)]">
                <span className="inline-flex items-center gap-0.5 text-[#fd5523]">
                  <Sparkles className="h-2.5 w-2.5" aria-hidden="true" />
                  {currentStepLabel ? currentStepLabel : `Turn ${turnCount + 1}`}
                </span>
                <span>·</span>
                <span>{maxMinutes}m</span>
              </div>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-1 sm:gap-1.5">
            {/* Transcript & Study Notes drawer button */}
            <button
              type="button"
              onClick={() => setTranscriptOpen(true)}
              title="Open transcript & study notes"
              aria-label="Open transcript and study notes"
              className="inline-flex h-8 items-center gap-1 rounded-full border border-[var(--line-strong)] bg-white px-2 text-[11px] font-bold text-[var(--ink)] transition hover:border-[#fd5523]/40 hover:bg-[#fff2e9] hover:text-[#fd5523] sm:px-2.5"
            >
              <MessageSquareText className="h-3.5 w-3.5 text-[#fd5523]" aria-hidden="true" />
              <span className="hidden md:inline">Notes</span>
              {transcript.length > 0 && (
                <span className="rounded-full bg-[#fff2e9] px-1.5 text-[10px] font-extrabold text-[#c83a10]">
                  {transcript.length}
                </span>
              )}
            </button>

            {/* Speed toggle (0.85x / 1x / 1.15x) */}
            <button
              type="button"
              onClick={cyclePlaybackRate}
              title="Teacher speaking speed"
              aria-label={`Speaking speed ${playbackRate}x. Tap to change.`}
              className="inline-flex h-8 items-center gap-1 rounded-full border border-[var(--line-strong)] bg-white px-2 text-[11px] font-bold text-[var(--ink)] transition hover:bg-[var(--soft-hover)] sm:px-2.5"
            >
              <Gauge className="h-3.5 w-3.5 text-[#fd5523]" aria-hidden="true" />
              <span>{playbackRate === 1 ? "1×" : `${playbackRate}×`}</span>
            </button>

            {/* Mute + Volume slider (inline on sm+, popover on mobile) */}
            <div className="relative flex h-8 items-center gap-1 rounded-full border border-[var(--line-strong)] bg-white px-2">
              <button
                type="button"
                onClick={toggleMute}
                aria-pressed={muted}
                aria-label={muted ? `Unmute ${teacherName}` : `Mute ${teacherName}`}
                className="flex h-6 w-6 items-center justify-center rounded-full text-[var(--ink)] transition hover:bg-[var(--soft-hover)]"
              >
                {muted || volume === 0 ? (
                  <VolumeX className="h-3.5 w-3.5 text-rose-600" aria-hidden="true" />
                ) : volume < 0.5 ? (
                  <Volume1 className="h-3.5 w-3.5 text-[var(--ink)]" aria-hidden="true" />
                ) : (
                  <Volume2 className="h-3.5 w-3.5 text-[var(--ink)]" aria-hidden="true" />
                )}
              </button>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={muted ? 0 : volume}
                onChange={(e) => handleVolumeChange(Number(e.target.value))}
                aria-label="Teacher volume"
                className="hidden h-1.5 w-16 cursor-pointer accent-[#fd5523] sm:block"
              />
              <button
                type="button"
                onClick={() => setAudioMenuOpen((o) => !o)}
                aria-expanded={audioMenuOpen}
                aria-label="Adjust volume"
                className="text-[10px] font-bold text-[var(--ink-dim)] sm:hidden"
              >
                {muted ? "0%" : `${Math.round(volume * 100)}%`}
              </button>
              {audioMenuOpen && (
                <div className="absolute right-0 top-10 z-30 flex w-44 items-center gap-2 rounded-2xl border border-[var(--line-strong)] bg-white p-2.5 shadow-xl sm:hidden">
                  <Volume1 className="h-3.5 w-3.5 shrink-0 text-[var(--ink-dim)]" aria-hidden="true" />
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.05}
                    value={muted ? 0 : volume}
                    onChange={(e) => handleVolumeChange(Number(e.target.value))}
                    aria-label="Teacher volume"
                    className="h-1.5 flex-1 cursor-pointer accent-[#fd5523]"
                  />
                  <Volume2 className="h-3.5 w-3.5 shrink-0 text-[var(--ink)]" aria-hidden="true" />
                </div>
              )}
            </div>

            {/* 3D / 2D Avatar toggle — shown only when this persona has a custom 3D model or 3D mode configured */}
            {!lite && (Boolean(activeLook?.glbUrl) || engine === "three" || activeLook?.engine === "three") && (
              <button
                type="button"
                onClick={() => setAvatarMode((m) => (m === "three" ? "rive" : "three"))}
                title="Switch between 3D WebGL and 2D animated teacher"
                className={`h-8 rounded-full border px-2.5 text-[11px] font-bold transition ${
                  avatarMode === "three"
                    ? "border-[#fd5523]/40 bg-[#fff2e9] text-[#c83a10]"
                    : "border-[var(--line-strong)] bg-white text-[var(--ink)] hover:bg-[var(--soft-hover)]"
                }`}
              >
                {avatarMode === "three" ? "3D On" : "3D"}
              </button>
            )}

            {/* Lite (Data Saver) toggle */}
            <button
              type="button"
              onClick={toggleLite}
              aria-pressed={lite}
              title={lite ? "Switch to full animated stage" : "Enable data saver (Lite)"}
              className={`hidden h-8 items-center gap-1 rounded-full border px-2.5 text-[11px] font-semibold transition sm:inline-flex ${
                lite
                  ? "border-emerald-300 bg-emerald-50 text-emerald-800"
                  : "border-[var(--line-strong)] bg-white text-[var(--ink-dim)] hover:bg-[var(--soft-hover)]"
              }`}
            >
              <Wifi className="h-3 w-3" aria-hidden="true" />
              {lite ? "Lite" : "HD"}
            </button>

            {/* End session */}
            <button
              type="button"
              onClick={endFromButton}
              disabled={ending}
              className="h-8 rounded-full border border-[var(--line-strong)] bg-white px-3 text-xs font-bold text-[var(--ink)] transition hover:border-rose-200 hover:bg-rose-50 hover:text-rose-700 disabled:opacity-50"
            >
              {ending ? "Saving..." : "End"}
            </button>
          </div>
        </div>
        {/* Live Step & Beat Progress Stepper */}
        {scenarioBeats.length > 1 ? (
          <div
            aria-label="Lesson progress steps"
            className="flex items-center gap-1 border-t border-slate-100/80 bg-white/70 px-3 py-1 sm:px-4"
          >
            {scenarioBeats.map((beat, idx) => {
              const done = idx < activeBeatIdx;
              const current = idx === activeBeatIdx;
              return (
                <div
                  key={beat.id}
                  title={beat.goal}
                  className="flex min-w-0 flex-1 items-center gap-1"
                >
                  <div
                    className={`h-1.5 w-full rounded-full transition-colors duration-300 ${
                      done
                        ? "bg-[#15805f]"
                        : current
                          ? "bg-[#fd5523]"
                          : "bg-slate-200"
                    }`}
                  />
                </div>
              );
            })}
            <span className="ml-1 shrink-0 text-[10px] font-bold tabular-nums text-[var(--ink-dim)]">
              {Math.min(activeBeatIdx + 1, scenarioBeats.length)}/{scenarioBeats.length}
            </span>
          </div>
        ) : (
          <div className="h-1 w-full bg-slate-200/70" aria-hidden="true">
            <div
              className="h-full bg-gradient-to-r from-[#fd5523] to-[#15805f] transition-[width] duration-500 ease-out"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        )}
      </header>

      {/* Middle Scrollable Stage + Teaching Board */}
      <main className="relative z-10 min-h-0 flex-1 overflow-y-auto overscroll-contain px-2.5 py-2 sm:px-4 sm:py-3">
        <div
          className={`mx-auto flex w-full flex-col gap-2.5 ${
            hasBoardContent
              ? "max-w-[640px] lg:grid lg:max-w-[1140px] lg:grid-cols-[minmax(0,540px)_minmax(0,1fr)] lg:items-start lg:gap-4"
              : "max-w-[580px]"
          }`}
        >
          <div className={lite ? "mx-auto w-full max-w-[420px]" : "w-full"}>
            <SpeakingStage
              avatarRef={avatarRef}
              onAvatarEvent={avatarEvent}
              reducedMotion={reducedMotion}
              engine={lite ? "placeholder" : engine === "placeholder" ? "placeholder" : avatarMode}
              scene={activeScene}
              look={activeLook}
              teacherName={teacherName}
              sceneTitle={sceneTitle}
              modeLabel={`${liveActive ? "Live" : handsFree ? "Hands-Free" : mode === "voice" ? "Voice" : "Tap / Type"}${avatarMode === "three" && !lite ? " · 3D" : ""}${lite ? " · Lite" : ""}`}
              caption={caption}
              card={card}
              onDismissCard={() => setCard(null)}
              whiteboard={whiteboard}
              canReplay={hasReplayLine && !thinking && !recording}
              onReplay={handleReplayLast}
              onReplaySlow={handleReplaySlow}
              celebratePulse={celebratePulse}
            />
          </div>

          {hasBoardContent && (
            <div className="w-full">
              <TeachingBoard
                board={board}
                choice={null}
                confidence={null}
                lessonRefs={lessonRefs}
                clip={clip}
                award={award}
                lite={lite}
                disabled={thinking || phase !== "live"}
                onChoose={handleChoose}
                onConfidence={handleConfidence}
                onDismissAward={() => setAward(null)}
                savedKeys={savedDeckKeys}
                onSaveTakeaway={handleSaveStudyItem}
                onInteract={handleSendText}
              />
            </div>
          )}
        </div>
      </main>

      {/* Bottom Sticky Dynamic Action Dock — NEVER requires scrolling to access */}
      <footer className="relative z-20 shrink-0 border-t border-[var(--line)] bg-white/92 px-3 pb-[max(10px,env(safe-area-inset-bottom))] pt-2.5 shadow-[0_-8px_28px_rgba(6,46,57,0.08)] backdrop-blur-md sm:px-4">
        <div className="mx-auto w-full max-w-[760px]">
          <Composer
            mode={mode}
            modes={modes}
            onModeChange={changeMode}
            status={statusText}
            canTalk={canTalk}
            canType={canType}
            micBlocked={micBlocked}
            recording={recording}
            level={level}
            elapsedMs={elapsedMs}
            listenHint={listenHint}
            lastSaid={lastSaid}
            responseMatch={responseMatch}
            onHoldStart={holdStart}
            onHoldEnd={holdEnd}
            onSendText={handleSendText}
            onSendImage={!client && !liveActive ? handleSendImage : undefined}
            error={error}
            soundBlocked={soundBlocked}
            onEnableSound={enableSound}
            teacherName={teacherName}
            handsFree={handsFree}
            handsFreeListening={handsFreeListening}
            handsFreeSpeechDetected={handsFreeSpeechDetected}
            onToggleHandsFree={!liveActive && modes.includes("voice") && !micBlocked ? toggleHandsFree : undefined}
            onCommitHandsFreeNow={() => void commitHandsFree()}
            liveActive={liveActive}
            liveMicOn={liveMicOn}
            onToggleLiveMic={toggleLiveMic}
            lastLearnerAudioUrl={lastLearnerAudioUrl}
            canReplayTeacher={hasReplayLine && !thinking && !recording}
            onReplayTeacher={handleReplayLast}
            activeChoice={interaction.activeChoice}
            activeOrderChallenge={interaction.activeOrderChallenge}
            activeFillBlank={interaction.activeFillBlank}
            showConfidence={interaction.showConfidence}
            confidencePrompt={confidence?.prompt}
            preferTextInput={interaction.preferTextInput}
            quickActions={interaction.quickActions}
            onChoose={handleChoose}
            onConfidence={handleConfidence}
          />
          {ending && error && (
            <button
              type="button"
              onClick={() => void finalize(turnsRef.current > 0 ? "completed" : "abandoned")}
              className={`${styles.primaryButton} mt-2 w-full rounded-xl px-4 py-2.5 text-sm font-bold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus)]`}
            >
              Try again
            </button>
          )}
        </div>
      </footer>

      {/* Slide-over Transcript & Universal Study Notes Drawer */}
      <TranscriptDrawer
        open={transcriptOpen}
        onClose={() => setTranscriptOpen(false)}
        teacherName={teacherName}
        entries={transcript}
        savedKeys={savedDeckKeys}
        onSaveItem={handleSaveStudyItem}
        onReplayEvent={(ev, slow) => void replaySayEvent(ev, slow)}
      />
    </div>
  );
}
