"use client";

import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import { RiveScene } from "./RiveScene";
import type { RiveSceneHandle } from "./RiveScene";
import { Teacher } from "./Teacher";
import type { TeacherEngine } from "./Teacher";
import type { AvatarDriver, AvatarEvent, PersonaLook } from "./types";
import type { SceneArtboard } from "@/lib/tutor/rive-driver";

// The teacher with its backdrop: coordinates seamless cross-fade transitions between the Rive 2.5D
// scene + avatar and the Three.js 3D WebGL full-bleed studio, with zero flash or layout pop.

export type TeacherStageHandle = AvatarDriver & { celebrate(): void };

export type TeacherStageProps = {
  engine?: TeacherEngine;
  /** Scene backdrop. Rive draws a 2D artboard; Three.js builds a matching procedural 3D room. */
  scene?: SceneArtboard | null;
  timeOfDay?: number;
  /** Whether the page wants ambient loops. The stage also turns them off after low performance. */
  ambience?: boolean;
  persona?: Partial<PersonaLook>;
  reducedMotion?: boolean;
  onEvent?: (e: AvatarEvent) => void;
  onFps?: (fps: number) => void;
  onLowPerformance?: () => void;
  /** Positioning of the layer that holds the 2D Rive teacher. Defaults to the Practice Room layout. */
  wrapClassName?: string;
  /** Size of the teacher inside its layer. */
  teacherClassName?: string;
  label?: string;
};

const DEFAULT_WRAP = "absolute inset-0 flex items-end justify-center pb-[34%] pt-[14%]";

export const TeacherStage = forwardRef<TeacherStageHandle, TeacherStageProps>(function TeacherStage(props, ref) {
  const {
    engine = "rive",
    scene = null,
    timeOfDay,
    ambience = true,
    persona,
    reducedMotion = false,
    onEvent,
    onFps,
    onLowPerformance,
    wrapClassName = DEFAULT_WRAP,
    teacherClassName = "h-full w-full",
    label,
  } = props;

  const teacherRef = useRef<AvatarDriver>(null);
  const sceneRef = useRef<RiveSceneHandle>(null);
  const [lowPerformance, setLowPerformance] = useState(false);

  // Keep RiveScene mounted underneath while Three.js boots, then fade it out smoothly.
  const [keepRiveScene, setKeepRiveScene] = useState(engine === "rive");
  const [threeVisible, setThreeVisible] = useState(engine === "three");
  const unmountSceneTimer = useRef<number | null>(null);

  useEffect(() => {
    if (engine === "rive") {
      if (unmountSceneTimer.current !== null) {
        window.clearTimeout(unmountSceneTimer.current);
        unmountSceneTimer.current = null;
      }
      setKeepRiveScene(true);
      setThreeVisible(false);
    } else if (engine === "placeholder") {
      setKeepRiveScene(false);
      setThreeVisible(false);
    }
  }, [engine]);

  useEffect(() => {
    return () => {
      if (unmountSceneTimer.current !== null) {
        window.clearTimeout(unmountSceneTimer.current);
      }
    };
  }, []);

  const handleEngineReady = useCallback((readyEngine: TeacherEngine) => {
    if (readyEngine === "three") {
      setThreeVisible(true);
      if (unmountSceneTimer.current !== null) {
        window.clearTimeout(unmountSceneTimer.current);
      }
      unmountSceneTimer.current = window.setTimeout(() => {
        setKeepRiveScene(false);
        unmountSceneTimer.current = null;
      }, 360);
    } else if (readyEngine === "rive") {
      setThreeVisible(false);
      setKeepRiveScene(true);
    }
  }, []);

  const handleLowPerformance = useCallback(() => {
    setLowPerformance(true);
    onLowPerformance?.();
  }, [onLowPerformance]);

  const getLayerClassName = useCallback(
    (which: TeacherEngine) => (which === "three" ? "absolute inset-0" : wrapClassName),
    [wrapClassName],
  );

  // A stable handle that forwards to whichever renderer is mounted, so callers never hold a stale one.
  const handle = useMemo<TeacherStageHandle>(
    () => ({
      playGesture: (name, opts) => teacherRef.current?.playGesture(name, opts),
      setMood: (mood, intensity) => teacherRef.current?.setMood(mood, intensity),
      setViseme: (v) => teacherRef.current?.setViseme(v),
      setSpeaking: (on) => teacherRef.current?.setSpeaking(on),
      setListening: (on, level) => teacherRef.current?.setListening(on, level),
      setThinking: (on) => teacherRef.current?.setThinking(on),
      lookAt: (x, y) => teacherRef.current?.lookAt(x, y),
      celebrate: () => sceneRef.current?.celebrate(),
    }),
    [],
  );
  useImperativeHandle(ref, () => handle, [handle]);

  const showRiveBackdrop = Boolean(scene) && engine !== "placeholder" && (engine === "rive" || keepRiveScene);

  return (
    <>
      {showRiveBackdrop && scene && (
        <div
          className={`pointer-events-none absolute inset-0 z-0 transition-opacity duration-300 ${
            engine === "three" && threeVisible ? "opacity-0" : "opacity-100"
          }`}
        >
          <RiveScene
            ref={sceneRef}
            scene={scene}
            timeOfDay={timeOfDay}
            reducedMotion={reducedMotion}
            ambience={ambience}
            lowPerformance={lowPerformance}
            className="absolute inset-0"
          />
        </div>
      )}
      <Teacher
        ref={teacherRef}
        engine={engine}
        sceneName={scene}
        getLayerClassName={getLayerClassName}
        onEngineReady={handleEngineReady}
        className={teacherClassName}
        persona={persona}
        reducedMotion={reducedMotion}
        onEvent={onEvent}
        onFps={onFps}
        onLowPerformance={handleLowPerformance}
        label={label}
      />
    </>
  );
});
