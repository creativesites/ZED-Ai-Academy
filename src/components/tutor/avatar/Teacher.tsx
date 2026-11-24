"use client";

import { forwardRef, useCallback, useState } from "react";
import type { SceneArtboard } from "@/lib/tutor/rive-driver";
import { PlaceholderTeacher } from "./PlaceholderTeacher";
import { RiveTeacher } from "./RiveTeacher";
import type { RiveTeacherProps } from "./RiveTeacher";
import { ThreeTeacher } from "./ThreeTeacher";
import type { AvatarDriver } from "./types";

// One component for all renderers (Rive 2.5D, Three.js 3D WebGL, SVG placeholder).
// Defaults to persona.engine if set, otherwise "rive", and falls back to the placeholder on load error.

export type TeacherEngine = "rive" | "three" | "placeholder";

export type TeacherProps = RiveTeacherProps & {
  engine?: TeacherEngine;
  glbUrl?: string | null;
  sceneName?: SceneArtboard | null;
};

let warnedFallback = false;

export const Teacher = forwardRef<AvatarDriver, TeacherProps>(function Teacher(props, ref) {
  const {
    engine,
    glbUrl,
    sceneName,
    variant,
    onReady,
    onLowPerformance,
    onFps,
    onLoadError,
    label,
    persona,
    reducedMotion,
    onEvent,
    className,
  } = props;
  const [failed, setFailed] = useState(false);

  const resolvedEngine: TeacherEngine = engine ?? persona?.engine ?? "rive";
  const resolvedGlbUrl = glbUrl ?? persona?.glbUrl ?? null;

  const handleLoadError = useCallback(
    (error: Error) => {
      if (!warnedFallback) {
        warnedFallback = true;
        console.warn("[tutor] Teacher renderer failed to load, using the placeholder.", error);
      }
      setFailed(true);
      onLoadError?.(error);
    },
    [onLoadError],
  );

  if (resolvedEngine === "three" && !failed) {
    return (
      <ThreeTeacher
        ref={ref}
        variant={variant}
        glbUrl={resolvedGlbUrl}
        sceneName={sceneName}
        persona={persona}
        reducedMotion={reducedMotion}
        onEvent={onEvent}
        className={className}
        label={label}
        onReady={onReady}
        onLoadError={handleLoadError}
      />
    );
  }

  if (resolvedEngine === "rive" && !failed) {
    return (
      <RiveTeacher
        ref={ref}
        variant={variant}
        persona={persona}
        reducedMotion={reducedMotion}
        onEvent={onEvent}
        className={className}
        label={label}
        onReady={onReady}
        onLowPerformance={onLowPerformance}
        onFps={onFps}
        onLoadError={handleLoadError}
      />
    );
  }

  return <PlaceholderTeacher ref={ref} persona={persona} reducedMotion={reducedMotion} onEvent={onEvent} className={className} />;
});
