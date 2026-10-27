"use client";

import { forwardRef, useCallback, useState } from "react";
import { PlaceholderTeacher } from "./PlaceholderTeacher";
import { RiveTeacher } from "./RiveTeacher";
import type { RiveTeacherProps } from "./RiveTeacher";
import type { AvatarDriver } from "./types";

// One component for both renderers. It defaults to Rive and falls back to the placeholder if the .riv
// fails to load, logging the failure once. Callers hold a ref of type AvatarDriver either way.

export type TeacherEngine = "rive" | "placeholder";

export type TeacherProps = RiveTeacherProps & { engine?: TeacherEngine };

let warnedFallback = false;

export const Teacher = forwardRef<AvatarDriver, TeacherProps>(function Teacher(props, ref) {
  const { engine = "rive", variant, onReady, onLowPerformance, onFps, onLoadError, label, persona, reducedMotion, onEvent, className } =
    props;
  const [failed, setFailed] = useState(false);

  const handleLoadError = useCallback(
    (error: Error) => {
      if (!warnedFallback) {
        warnedFallback = true;
        console.warn("[tutor] Rive teacher failed to load, using the placeholder.", error);
      }
      setFailed(true);
      onLoadError?.(error);
    },
    [onLoadError],
  );

  if (engine === "rive" && !failed) {
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
