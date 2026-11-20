"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { AvatarDriver } from "@/components/tutor/avatar/types";
import type { TeacherStageHandle } from "@/components/tutor/avatar/TeacherStage";
import type { TeacherEngine } from "@/components/tutor/avatar/Teacher";
import type { AvatarEvent, PersonaLook } from "@/components/tutor/avatar/types";
import { EventPlayer, type CardItem, type ClipEvent, type LessonRefEvent, type PlayerUI } from "@/components/tutor/EventPlayer";
import { boardFromEvent, choiceReply, revealBoard, type BoardState, type ConfidenceLevel } from "@/lib/tutor/board";
import type { TutorEvent } from "@/lib/tutor/events";
import { SCENE_ARTBOARDS, type SceneArtboard } from "@/lib/tutor/rive-driver";
import { tutorErrorMessage } from "@/lib/tutor/client-errors";
import type { TutorReportContent } from "@/lib/tutor/report-model";
import { shouldSendRecording } from "@/lib/tutor/recording";
import { MAX_SPEAKING_MS, SpeakingTimeAccumulator } from "@/lib/tutor/speaking-time";
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
  /** Called with the report when the learner taps Done on the report card. */
  onExit?: (report: TutorReportContent) => void;
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
  onExit,
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
  const activeScene = sceneOverride ?? scene;

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

  const [report, setReport] = useState<TutorReportContent | null>(null);
  const [words, setWords] = useState<CardItem[]>([]);

  // Refs hold what the event callbacks and the recorder need without re-creating them.
  const avatarRef = useRef<TeacherStageHandle | null>(null);
  const playerRef = useRef<EventPlayer | null>(null);
  const audioRef = useRef<TeacherAudio | null>(null);
  const recorderRef = useRef<LearnerRecorder | null>(null);
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
    // Lite keeps teacher audio off (no downloads) until the learner turns sound on.
    audioRef.current?.setMuted(lite);
    setMuted(lite);
    modeRef.current = data.mode === "text" ? "text" : "voice";
    setMode(modeRef.current);
    setTeacherName(data.persona.displayName ?? data.persona.name);
    setSceneTitle(data.scenario.title);
    setGoal(data.scenario.goal);
    setMaxMinutes(data.scenario.maxMinutes);

    learnerTimeRef.current = new SpeakingTimeAccumulator();
    teacherBaseRef.current = audioRef.current?.getPlayedMs() ?? 0;
    turnsRef.current = 0;
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
  }, [api, client, origin, scenarioId, lessonId, assignmentId, lite, setPhaseBoth, speakEvents, finalize]);

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

  const toggleLite = () => {
    const next = !lite;
    setLite(next);
    if (next) {
      audioRef.current?.setMuted(true);
      setMuted(true);
    }
  };

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
      <div className={`${styles.room} flex min-h-[100dvh] flex-col justify-center px-4 py-8`}>
        {!lite && <SceneBackdrop scene={activeScene} className="absolute inset-0 h-full w-full" />}
        <div className="relative z-10">
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
    return (
      <div className={`${styles.room} flex min-h-[100dvh] flex-col justify-center px-4 py-8`}>
        {!lite && <SceneBackdrop scene={activeScene} className="absolute inset-0 h-full w-full" />}
        <div className="relative z-10">
          <ReportCard
            report={report}
            title={sceneTitle}
            words={words}
            onPractiseAgain={practiseAgain}
            onDone={onExit ? () => onExit(report) : undefined}
          />
        </div>
      </div>
    );
  }

  const ending = phase === "ending";
  const canTalk = phase === "live" && mode === "voice" && !thinking && !micBlocked && !ending;
  const canType = phase === "live" && !thinking && !ending;

  const hasBoard = Boolean(board || choice || confidence || lessonRefs.length || clip || award);

  return (
    <div className={`${styles.room} flex min-h-[100dvh] flex-col`}>
      {!lite && <SceneBackdrop scene={activeScene} className="absolute inset-0 h-full w-full" />}
      <div
        className={`relative z-10 mx-auto flex w-full flex-1 flex-col gap-3 px-3 pb-[max(16px,env(safe-area-inset-bottom))] pt-[max(12px,env(safe-area-inset-top))] sm:px-4 ${
          hasBoard
            ? "max-w-[640px] lg:grid lg:max-w-[1160px] lg:grid-cols-[minmax(0,560px)_minmax(0,1fr)] lg:items-start lg:gap-5"
            : "max-w-[640px]"
        }`}
      >
        <div className={lite ? "mx-auto w-full max-w-[420px] lg:col-start-1 lg:row-start-1" : "lg:col-start-1 lg:row-start-1"}>
          <SpeakingStage
            avatarRef={avatarRef}
            onAvatarEvent={avatarEvent}
            reducedMotion={reducedMotion}
            engine={lite ? "placeholder" : engine}
            scene={activeScene}
            look={look}
            teacherName={teacherName}
            sceneTitle={sceneTitle}
            modeLabel={`${mode === "voice" ? "Voice" : "Text"}${lite ? " · Lite" : ""}`}
            caption={caption}
            card={card}
            onDismissCard={() => setCard(null)}
            whiteboard={whiteboard}
          />
        </div>

        {hasBoard && (
          <div className="lg:col-start-2 lg:row-span-2 lg:row-start-1">
            <TeachingBoard
              board={board}
              choice={choice}
              confidence={confidence}
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

        <div className={`${styles.glass} rounded-[24px] p-4 lg:col-start-1 lg:row-start-2`}>
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
            onEnd={endFromButton}
            ending={ending}
            error={error}
            soundBlocked={soundBlocked}
            onEnableSound={enableSound}
            muted={muted}
            onToggleMute={toggleMute}
            teacherName={teacherName}
          />
          {ending && error && (
            <button
              type="button"
              onClick={() => void finalize(turnsRef.current > 0 ? "completed" : "abandoned")}
              className={`${styles.primaryButton} mt-3 w-full rounded-2xl px-5 py-3 text-sm font-bold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus)]`}
            >
              Try again
            </button>
          )}
          <p className="mt-3 text-center text-[11px] text-[var(--ink-faint)]">
            {goal ? `Goal: ${goal}` : null}
            {goal ? " · " : null}
            Up to {maxMinutes} min
          </p>
          <div className="mt-2 flex justify-center">
            <button
              type="button"
              onClick={toggleLite}
              aria-pressed={lite}
              className="rounded-full border border-[var(--line-strong)] bg-white/80 px-3 py-1.5 text-[12px] font-semibold text-[var(--ink-dim)] hover:bg-[var(--soft-hover)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus)]"
            >
              {lite ? "Data saver on · switch to full stage" : "Use data saver (Lite)"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
