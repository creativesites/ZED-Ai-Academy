"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft, Gauge, Sparkles, Volume1, Volume2, VolumeX, Wifi } from "lucide-react";
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
import { MAX_SPEAKING_MS, SpeakingTimeAccumulator } from "@/lib/tutor/speaking-time";
import { deriveTurnInteraction } from "@/lib/tutor/turn-interaction";
import { personaLookFromVariant } from "@/lib/tutor/tutor-session-block";
import {
  detectMicPermission,
  httpTutorClient,
  measureRttMs,
  type MicPermission,
  type SessionOriginInput,
  type TutorApiClient,
} from "./api";
import { Composer, type InputMode } from "./Composer";
import { LearnerRecorder, RecorderError, type RecordingResult } from "./learner-recorder";
import { ReportCard } from "./ReportCard";
import { SceneBackdrop } from "./SceneBackdrop";
import { SpeakingStage, type Caption } from "./SpeakingStage";
import { StartPanel, type StartInfo } from "./StartPanel";
import { TeachingBoard, type ChoiceState } from "./TeachingBoard";
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

type TurnInput = { kind: "text"; text: string } | { kind: "audio"; clip: RecordingResult };

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
  const [hasReplayLine, setHasReplayLine] = useState(false);
  const [avatarMode, setAvatarMode] = useState<"rive" | "three">(
    engine === "three" || look?.engine === "three" ? "three" : "rive",
  );

  const [report, setReport] = useState<TutorReportContent | null>(null);
  const [words, setWords] = useState<CardItem[]>([]);

  // Refs hold what the event callbacks and the recorder need without re-creating them.
  const avatarRef = useRef<TeacherStageHandle | null>(null);
  const playerRef = useRef<EventPlayer | null>(null);
  const audioRef = useRef<TeacherAudio | null>(null);
  const recorderRef = useRef<LearnerRecorder | null>(null);
  const lastSayEventRef = useRef<SaySpeechEvent | null>(null);
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
      onListen: (expect, hint) => setListenHint({ expect, hint }),
      onMistake: () => undefined,
      onEnd: () => {
        pendingEndRef.current = true;
      },
      onAdvance: () => undefined,
      onBoard: (b) => {
        setBoard(boardFromEvent(b));
        setWhiteboard(null);
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
        avatarRef.current?.celebrate();
      },
    };

    playerRef.current = new EventPlayer({ avatar, ui, speak: teacherAudio.speak });

    recorder.onLevel = (value) => {
      avatarRef.current?.setListening(true, value);
      const now = performance.now();
      if (now - lastLevelAtRef.current >= LEVEL_UPDATE_MS) {
        lastLevelAtRef.current = now;
        setLevel(value);
      }
    };

    const unsubscribeBlocked = teacherAudio.onBlockedChange(setSoundBlocked);
    return () => {
      playerRef.current?.stop();
      playerRef.current = null;
      recorder.cancel();
      teacherAudio.stopPlayback();
      unsubscribeBlocked();
      if (holdTimerRef.current !== undefined) clearInterval(holdTimerRef.current);
    };
  }, []);

  // Teacher speech. A sequence number stops a cancelled line from clearing the speaking state of a newer one.
  const speakEvents = useCallback(async (events: readonly TutorEvent[]) => {
    const player = playerRef.current;
    if (!player || events.length === 0) return;
    const lastSay = [...events].reverse().find((ev): ev is SaySpeechEvent => ev.type === "say");
    if (lastSay) {
      lastSayEventRef.current = lastSay;
      setHasReplayLine(true);
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
      holdingRef.current = false;
      recorderRef.current?.cancel();
      setRecording(false);

      const played = audioRef.current?.getPlayedMs() ?? 0;
      const totals = {
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
      avatarRef.current?.setThinking(true);
      if (input.kind === "audio") learnerTimeRef.current.addLearnerMs(input.clip.durationMs);

      const res = await api.turn(
        sessionId,
        input.kind === "text"
          ? { kind: "text", text: input.text }
          : { kind: "audio", blob: input.clip.blob, mimeType: input.clip.mimeType },
      );

      avatarRef.current?.setThinking(false);
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
      if (res.data.learnerText) setLastSaid(res.data.learnerText);
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

    const res = await api.start({
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
      // Live is not wired in the web client yet. Ask for Voice, or Text when the mic is blocked.
      preferMode: permission === "denied" ? "text" : "voice",
    });

    if (!res.ok) {
      setError(tutorErrorMessage(res.failure, "start"));
      setPhaseBoth("intro");
      return;
    }
    const data = res.data;
    if (data.mode === "live") {
      setError("Live conversation is coming soon. This scenario needs Live, so it cannot start here yet.");
      setPhaseBoth("intro");
      return;
    }

    sessionIdRef.current = data.sessionId;
    audioRef.current?.setLanguage(data.persona.languages?.[0]);
    // Sound starts on, in Lite too: the teacher's voice is the lesson. Lite saves data on the visuals,
    // and the learner can still mute. (Lite used to start muted, which read as "sound is broken".)
    audioRef.current?.setMuted(false);
    setMuted(false);
    modeRef.current = data.mode === "text" ? "text" : "voice";
    setMode(modeRef.current);
    setTeacherName(data.persona.displayName ?? data.persona.name);
    setLookOverride(personaLookFromVariant(data.persona.riveVariant));
    setSceneTitle(data.scenario.title);
    setGoal(data.scenario.goal);
    setMaxMinutes(data.scenario.maxMinutes);

    learnerTimeRef.current = new SpeakingTimeAccumulator();
    teacherBaseRef.current = audioRef.current?.getPlayedMs() ?? 0;
    turnsRef.current = 0;
    setTurnCount(0);
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

    setPhaseBoth("live");
    await speakEvents(data.openingEvents ?? []);
    if (pendingEndRef.current) void finalize("completed");
  }, [api, client, origin, scenarioId, lessonId, assignmentId, sprint, sprintCourseId, focusObjective, companyId, setPhaseBoth, speakEvents, finalize]);

  const changeMode = (next: InputMode) => {
    if (next === modeRef.current) return;
    if (holdingRef.current) {
      holdingRef.current = false;
      recorderRef.current?.cancel();
      setRecording(false);
    }
    modeRef.current = next;
    setMode(next);
    setError(null);
  };

  const handleSendText = (text: string) => {
    audioRef.current?.unlock();
    void submitTurn({ kind: "text", text });
  };

  const handleChoose = (option: string) => {
    setChoice((c) => (c ? { ...c, picked: option } : c));
    handleSendText(choiceReply(option));
  };

  const handleConfidence = (level: ConfidenceLevel) => {
    setConfidence(null);
    handleSendText(level);
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
    setMuted(next);
  };

  const handleVolumeChange = (next: number) => {
    const clamped = Math.max(0, Math.min(1, next));
    setVolume(clamped);
    audioRef.current?.setVolume(clamped);
    if (clamped === 0 && !muted) {
      audioRef.current?.setMuted(true);
      setMuted(true);
    } else if (clamped > 0 && muted) {
      audioRef.current?.setMuted(false);
      setMuted(false);
    }
  };

  const cyclePlaybackRate = () => {
    const next: 0.85 | 1 | 1.15 = playbackRate === 1 ? 0.85 : playbackRate === 0.85 ? 1.15 : 1;
    setPlaybackRate(next);
    audioRef.current?.setPlaybackRate(next);
  };

  const handleReplayLast = useCallback(() => {
    const lastSay = lastSayEventRef.current;
    if (!lastSay || thinking || recording || phaseRef.current !== "live") return;
    audioRef.current?.unlock();
    if (muted) {
      audioRef.current?.setMuted(false);
      setMuted(false);
    }
    playerRef.current?.stop();
    audioRef.current?.stopPlayback();
    void speakEvents([lastSay]);
  }, [muted, recording, speakEvents, thinking]);

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
  const statusText = thinking
    ? `${teacherName} is thinking...`
    : teacherSpeaking
      ? `${teacherName} is speaking...`
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
    caption,
    listenHint,
    turnCount,
  });

  // TeachingBoard displays board content, clips, awards, and lesson references;
  // interactive choice & confidence controls live directly in the sticky bottom dock (no scrolling needed).
  const hasBoardContent = Boolean(board || lessonRefs.length || clip || award);

  return (
    <div className={`${styles.room} flex ${client ? "h-[min(86dvh,760px)]" : "h-[100dvh]"} flex-col overflow-hidden`}>
      {!lite && <SceneBackdrop scene={activeScene} className="absolute inset-0 h-full w-full" />}

      {/* Sticky Slim Top Session HUD — Audio, Volume, Speed, 3D, Lite, End always 1 tap away */}
      <header className="relative z-20 flex shrink-0 items-center justify-between gap-2 border-b border-[var(--line)] bg-white/85 px-2.5 pb-2 pt-[max(0.5rem,env(safe-area-inset-top))] backdrop-blur-md sm:px-4">
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
                Turn {turnCount + 1}
              </span>
              <span>·</span>
              <span>{maxMinutes}m</span>
            </div>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-1 sm:gap-1.5">
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

          {/* 3D / 2D Avatar toggle */}
          {!lite && (
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
              modeLabel={`${mode === "voice" ? "Voice" : "Tap / Type"}${avatarMode === "three" && !lite ? " · 3D" : ""}${lite ? " · Lite" : ""}`}
              caption={caption}
              card={card}
              onDismissCard={() => setCard(null)}
              whiteboard={whiteboard}
              canReplay={hasReplayLine && !thinking && !recording}
              onReplay={handleReplayLast}
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
            onHoldStart={holdStart}
            onHoldEnd={holdEnd}
            onSendText={handleSendText}
            error={error}
            soundBlocked={soundBlocked}
            onEnableSound={enableSound}
            teacherName={teacherName}
            activeChoice={interaction.activeChoice}
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
    </div>
  );
}
