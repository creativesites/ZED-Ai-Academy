"use client";

import { useEffect, useRef, useState } from "react";
import { PERSONA_PRESETS, type PersonaPresetKey } from "@/components/tutor/avatar/persona-presets";
import type { TeacherEngine } from "@/components/tutor/avatar/Teacher";
import { TeacherStage, type TeacherStageHandle } from "@/components/tutor/avatar/TeacherStage";
import { useReducedMotion } from "@/components/tutor/practice/use-reduced-motion";
import { DAYLIGHT_TIME_OF_DAY, type SceneArtboard } from "@/lib/tutor/rive-driver";

// The hero teacher: idles on her scene, and waves once after a short pause. Supports toggling
// between Rive 2.5D and Three.js 3D WebGL right in the showcase hero.

export type HeroTeacherProps = {
  scene?: SceneArtboard;
  preset?: PersonaPresetKey;
  label?: string;
  initialEngine?: TeacherEngine;
};

export function HeroTeacher({
  scene = "Scene_TeaHouse",
  preset = "lin",
  label,
  initialEngine = "rive",
}: HeroTeacherProps) {
  const ref = useRef<TeacherStageHandle>(null);
  const reducedMotion = useReducedMotion();
  const [engine, setEngine] = useState<TeacherEngine>(initialEngine);
  const look = PERSONA_PRESETS.find((p) => p.key === preset)?.look;

  useEffect(() => {
    if (reducedMotion) return;
    const timer = window.setTimeout(() => ref.current?.playGesture("wave"), 900);
    return () => window.clearTimeout(timer);
  }, [reducedMotion, engine]);

  return (
    <div className="relative aspect-[4/5] w-full max-w-[420px] overflow-hidden rounded-[28px] border border-slate-200 bg-[#fff2e9] shadow-[0_24px_60px_rgba(6,46,57,0.16)]">
      <TeacherStage
        ref={ref}
        engine={engine}
        scene={scene}
        timeOfDay={DAYLIGHT_TIME_OF_DAY}
        persona={look}
        reducedMotion={reducedMotion}
        label={label}
        wrapClassName="absolute inset-0 flex items-end justify-center pb-[6%] pt-[8%]"
        teacherClassName="h-full w-full"
      />
      <div className="absolute right-3 top-3 z-20 inline-flex rounded-full border border-white/25 bg-black/45 p-0.5 text-[11px] font-bold text-white backdrop-blur-md">
        {(
          [
            { id: "rive", label: "2D Rive" },
            { id: "three", label: "3D WebGL" },
          ] as const
        ).map((opt) => (
          <button
            key={opt.id}
            type="button"
            onClick={() => setEngine(opt.id)}
            onPointerEnter={opt.id === "three" ? () => { void import("three"); } : undefined}
            className={`rounded-full px-2.5 py-1 transition-colors ${
              engine === opt.id ? "bg-[#fd5523] text-white" : "text-white/80 hover:text-white"
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}
