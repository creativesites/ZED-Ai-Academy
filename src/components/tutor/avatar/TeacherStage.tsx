"use client";

import { forwardRef, useCallback, useImperativeHandle, useMemo, useRef, useState } from "react";
import { RiveScene } from "./RiveScene";
import type { RiveSceneHandle } from "./RiveScene";
import { Teacher } from "./Teacher";
import type { TeacherEngine } from "./Teacher";
import type { AvatarDriver, AvatarEvent, PersonaLook } from "./types";
import type { SceneArtboard } from "@/lib/tutor/rive-driver";

// The teacher with its backdrop: the scene (Rive engine only) behind the teacher. The stage owns the
// ambience decision: when the teacher reports low performance, ambience goes off for the rest of the
// mount. The handle is an AvatarDriver plus celebrate(), which fires the scene's celebrate trigger.

export type TeacherStageHandle = AvatarDriver & { celebrate(): void };

export type TeacherStageProps = {
  engine?: TeacherEngine;
  /** Scene backdrop, Rive engine only. null draws no scene and the page's own background shows. */
  scene?: SceneArtboard | null;
  timeOfDay?: number;
  /** Whether the page wants ambient loops. The stage also turns them off after low performance. */
  ambience?: boolean;
  persona?: Partial<PersonaLook>;
  reducedMotion?: boolean;
  onEvent?: (e: AvatarEvent) => void;
  onFps?: (fps: number) => void;
  onLowPerformance?: () => void;
  /** Positioning of the layer that holds the teacher. Defaults to the Practice Room layout. */
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

  const handleLowPerformance = useCallback(() => {
    setLowPerformance(true);
    onLowPerformance?.();
  }, [onLowPerformance]);

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

  return (
    <>
      {engine === "rive" && scene && (
        <RiveScene
          ref={sceneRef}
          scene={scene}
          timeOfDay={timeOfDay}
          reducedMotion={reducedMotion}
          ambience={ambience}
          lowPerformance={lowPerformance}
          className="absolute inset-0"
        />
      )}
      <div className={wrapClassName}>
        <Teacher
          ref={teacherRef}
          engine={engine}
          className={teacherClassName}
          persona={persona}
          reducedMotion={reducedMotion}
          onEvent={onEvent}
          onFps={onFps}
          onLowPerformance={handleLowPerformance}
          label={label}
        />
      </div>
    </>
  );
});
