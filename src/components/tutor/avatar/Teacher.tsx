"use client";

import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import type { Gesture, Mood, ToneShape, VisemeValue } from "@/lib/tutor/contract.generated";
import type { SceneArtboard } from "@/lib/tutor/rive-driver";
import { PlaceholderTeacher } from "./PlaceholderTeacher";
import { RiveTeacher } from "./RiveTeacher";
import type { RiveTeacherProps } from "./RiveTeacher";
import { ThreeTeacher } from "./ThreeTeacher";
import type { AvatarDriver } from "./types";

// Unified renderer for Rive 2.5D, Three.js 3D WebGL, and SVG placeholder.
// Switching between 3D WebGL and Rive is seamless:
// 1. Outgoing engine stays mounted & animated underneath while the incoming engine boots.
// 2. A persistent AvatarDriver proxy mirrors all live state (mood, speaking, viseme, gaze) to both
//    layers and replays the full snapshot onto the incoming engine the instant it reports ready.
// 3. Once ready, the incoming engine cross-fades in cleanly (300 ms) before unmounting the old one.

export type TeacherEngine = "rive" | "three" | "placeholder";

export type TeacherProps = RiveTeacherProps & {
  engine?: TeacherEngine;
  glbUrl?: string | null;
  sceneName?: SceneArtboard | null;
  /** Optional per-engine container classes so TeacherStage can keep exact framing during cross-fades. */
  getLayerClassName?: (engine: TeacherEngine) => string;
  /** Fires whenever a specific engine finishes loading and becomes visible. */
  onEngineReady?: (engine: TeacherEngine) => void;
};

type DriverSnapshot = {
  mood: Mood;
  moodIntensity: number;
  viseme: VisemeValue;
  speaking: boolean;
  listening: boolean;
  voiceLevel: number;
  thinking: boolean;
  lookX: number;
  lookY: number;
};

const warnedEngines = new Set<TeacherEngine>();

function replayDriverState(target: AvatarDriver | null, snap: DriverSnapshot) {
  if (!target) return;
  target.setMood(snap.mood, snap.moodIntensity);
  target.setSpeaking(snap.speaking);
  target.setViseme(snap.viseme);
  target.setListening(snap.listening, snap.voiceLevel);
  target.setThinking(snap.thinking);
  target.lookAt(snap.lookX, snap.lookY);
}

export const Teacher = forwardRef<AvatarDriver, TeacherProps>(function Teacher(props, ref) {
  const {
    engine,
    glbUrl,
    sceneName,
    variant,
    onReady,
    onEngineReady,
    onLowPerformance,
    onFps,
    onLoadError,
    label,
    persona,
    reducedMotion,
    onEvent,
    className,
    getLayerClassName,
  } = props;

  const [failedEngines, setFailedEngines] = useState<Partial<Record<TeacherEngine, boolean>>>({});

  const requestedEngine: TeacherEngine = engine ?? persona?.engine ?? "rive";
  const resolvedGlbUrl = glbUrl ?? persona?.glbUrl ?? null;

  const effectiveEngine: TeacherEngine =
    requestedEngine !== "placeholder" && failedEngines[requestedEngine] ? "placeholder" : requestedEngine;

  // Track smooth cross-fade when switching between engines (e.g. Rive <-> Three.js WebGL)
  const [displayedEngine, setDisplayedEngine] = useState<TeacherEngine>(effectiveEngine);
  const [outgoingEngine, setOutgoingEngine] = useState<TeacherEngine | null>(null);
  const [incomingReady, setIncomingReady] = useState(effectiveEngine === "placeholder");
  const clearOutgoingTimer = useRef<number | null>(null);

  if (effectiveEngine !== displayedEngine) {
    setOutgoingEngine(displayedEngine);
    setDisplayedEngine(effectiveEngine);
    setIncomingReady(effectiveEngine === "placeholder");
  }

  useEffect(() => {
    return () => {
      if (clearOutgoingTimer.current !== null) {
        window.clearTimeout(clearOutgoingTimer.current);
      }
    };
  }, []);

  // Placeholder is synchronous, so finish any transition immediately.
  useEffect(() => {
    if (displayedEngine === "placeholder") {
      onEngineReady?.("placeholder");
      if (outgoingEngine) {
        const t = window.setTimeout(() => setOutgoingEngine(null), 260);
        return () => window.clearTimeout(t);
      }
    }
  }, [displayedEngine, outgoingEngine, onEngineReady]);

  const primaryRef = useRef<AvatarDriver | null>(null);
  const outgoingRef = useRef<AvatarDriver | null>(null);

  const snapshotRef = useRef<DriverSnapshot>({
    mood: "warm",
    moodIntensity: 70,
    viseme: 0,
    speaking: false,
    listening: false,
    voiceLevel: 0,
    thinking: false,
    lookX: 0,
    lookY: 0,
  });

  // Persistent proxy forwards live driver commands to both the active and cross-fading layers.
  const proxyDriver = useMemo<AvatarDriver>(
    () => ({
      playGesture(name: Gesture, opts?: { toneShape?: ToneShape; countTo?: number }) {
        primaryRef.current?.playGesture(name, opts);
        outgoingRef.current?.playGesture(name, opts);
      },
      setMood(mood: Mood, intensity = 70) {
        snapshotRef.current.mood = mood;
        snapshotRef.current.moodIntensity = intensity;
        primaryRef.current?.setMood(mood, intensity);
        outgoingRef.current?.setMood(mood, intensity);
      },
      setViseme(v: VisemeValue) {
        snapshotRef.current.viseme = v;
        primaryRef.current?.setViseme(v);
        outgoingRef.current?.setViseme(v);
      },
      setSpeaking(on: boolean) {
        snapshotRef.current.speaking = on;
        if (!on) snapshotRef.current.viseme = 0;
        primaryRef.current?.setSpeaking(on);
        outgoingRef.current?.setSpeaking(on);
      },
      setListening(on: boolean, voiceLevel = 0) {
        snapshotRef.current.listening = on;
        snapshotRef.current.voiceLevel = voiceLevel;
        primaryRef.current?.setListening(on, voiceLevel);
        outgoingRef.current?.setListening(on, voiceLevel);
      },
      setThinking(on: boolean) {
        snapshotRef.current.thinking = on;
        primaryRef.current?.setThinking(on);
        outgoingRef.current?.setThinking(on);
      },
      lookAt(x: number, y: number) {
        snapshotRef.current.lookX = x;
        snapshotRef.current.lookY = y;
        primaryRef.current?.lookAt(x, y);
        outgoingRef.current?.lookAt(x, y);
      },
    }),
    [],
  );

  useImperativeHandle(ref, () => proxyDriver, [proxyDriver]);

  const handleEngineReady = useCallback(
    (which: TeacherEngine) => {
      if (which !== displayedEngine) return;
      replayDriverState(primaryRef.current, snapshotRef.current);
      setIncomingReady(true);
      onEngineReady?.(which);
      onReady?.();
      if (clearOutgoingTimer.current !== null) {
        window.clearTimeout(clearOutgoingTimer.current);
      }
      clearOutgoingTimer.current = window.setTimeout(() => {
        setOutgoingEngine(null);
        clearOutgoingTimer.current = null;
      }, 340);
    },
    [displayedEngine, onEngineReady, onReady],
  );

  const handleEngineError = useCallback(
    (which: TeacherEngine, error: Error) => {
      if (!warnedEngines.has(which)) {
        warnedEngines.add(which);
        console.warn(`[tutor] Teacher renderer (${which}) failed to load, falling back.`, error);
      }
      setFailedEngines((prev) => ({ ...prev, [which]: true }));
      onLoadError?.(error);
    },
    [onLoadError],
  );

  const renderEngine = (which: TeacherEngine, isPrimary: boolean) => {
    const targetRef = isPrimary ? primaryRef : outgoingRef;
    if (which === "three") {
      return (
        <ThreeTeacher
          ref={targetRef}
          variant={variant}
          glbUrl={resolvedGlbUrl}
          sceneName={sceneName}
          persona={persona}
          reducedMotion={reducedMotion}
          onEvent={isPrimary ? onEvent : undefined}
          className={className}
          label={label}
          onReady={isPrimary ? () => handleEngineReady("three") : undefined}
          onLoadError={isPrimary ? (err) => handleEngineError("three", err) : undefined}
        />
      );
    }
    if (which === "rive") {
      return (
        <RiveTeacher
          ref={targetRef}
          variant={variant}
          persona={persona}
          reducedMotion={reducedMotion}
          onEvent={isPrimary ? onEvent : undefined}
          className={className}
          label={label}
          onReady={isPrimary ? () => handleEngineReady("rive") : undefined}
          onLowPerformance={isPrimary ? onLowPerformance : undefined}
          onFps={isPrimary ? onFps : undefined}
          onLoadError={isPrimary ? (err) => handleEngineError("rive", err) : undefined}
        />
      );
    }
    return (
      <PlaceholderTeacher
        ref={targetRef}
        persona={persona}
        reducedMotion={reducedMotion}
        onEvent={isPrimary ? onEvent : undefined}
        className={className}
      />
    );
  };

  // Single-layer fast path when not cross-fading and no custom layer classes are needed
  if (!outgoingEngine && !getLayerClassName) {
    return renderEngine(displayedEngine, true);
  }

  const wrapperClass = (which: TeacherEngine) => getLayerClassName?.(which) ?? "absolute inset-0";

  return (
    <>
      {outgoingEngine && outgoingEngine !== displayedEngine && (
        <div
          key={`out-${outgoingEngine}`}
          className={`${wrapperClass(outgoingEngine)} z-[1] transition-opacity duration-300 ${
            incomingReady ? "pointer-events-none opacity-0" : "opacity-100"
          }`}
        >
          {renderEngine(outgoingEngine, false)}
        </div>
      )}
      <div
        key={`in-${displayedEngine}`}
        className={`${wrapperClass(displayedEngine)} z-[2] transition-opacity duration-300 ${
          outgoingEngine && !incomingReady ? "pointer-events-none opacity-0" : "opacity-100"
        }`}
      >
        {renderEngine(displayedEngine, true)}
      </div>
    </>
  );
});
