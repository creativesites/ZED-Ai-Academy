"use client";

import { useEffect, useRef } from "react";
import { PERSONA_PRESETS, type PersonaPresetKey } from "@/components/tutor/avatar/persona-presets";
import { TeacherStage, type TeacherStageHandle } from "@/components/tutor/avatar/TeacherStage";
import { useReducedMotion } from "@/components/tutor/practice/use-reduced-motion";
import { DAYLIGHT_TIME_OF_DAY, type SceneArtboard } from "@/lib/tutor/rive-driver";

// The hero teacher: idles on her scene, and waves once after a short pause. Renders through
// TeacherStage, so the Rive teacher is used with the placeholder as fallback. Reduced motion keeps
// the idle pose and skips the wave.

export type HeroTeacherProps = {
  scene?: SceneArtboard;
  preset?: PersonaPresetKey;
  label?: string;
};

export function HeroTeacher({ scene = "Scene_TeaHouse", preset = "lin", label }: HeroTeacherProps) {
  const ref = useRef<TeacherStageHandle>(null);
  const reducedMotion = useReducedMotion();
  const look = PERSONA_PRESETS.find((p) => p.key === preset)?.look;

  useEffect(() => {
    if (reducedMotion) return;
    const timer = window.setTimeout(() => ref.current?.playGesture("wave"), 900);
    return () => window.clearTimeout(timer);
  }, [reducedMotion]);

  return (
    <div className="relative aspect-[4/5] w-full max-w-[420px] overflow-hidden rounded-[28px] border border-slate-200 bg-[#fff2e9] shadow-[0_24px_60px_rgba(6,46,57,0.16)]">
      <TeacherStage
        ref={ref}
        scene={scene}
        timeOfDay={DAYLIGHT_TIME_OF_DAY}
        persona={look}
        reducedMotion={reducedMotion}
        label={label}
        wrapClassName="absolute inset-0 flex items-end justify-center pb-[6%] pt-[8%]"
        teacherClassName="h-full w-full"
      />
    </div>
  );
}
