"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { CheckCircle, Mic, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TutorSession } from "@/components/tutor/practice/TutorSession";
import {
  TUTOR_STYLE_LABELS,
  parseTutorSessionBlock,
  type TutorScenarioView,
} from "@/lib/tutor/tutor-session-block";

// A tutor_session block in the lesson player. The card shows the scenario; "Start speaking practice"
// opens TutorSession full-screen with origin "lesson". The session row is linked to this lesson and
// scenario, so the player's done state survives a reload (see learn/page.tsx and markLessonComplete).

export function TutorSessionBlock({
  content,
  lessonId,
  scenario,
  done,
  onComplete,
}: {
  content: Record<string, unknown>;
  lessonId?: string;
  /** Undefined when the scenario is missing or not published. */
  scenario: TutorScenarioView | undefined;
  done: boolean;
  onComplete?: (scenarioId: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const block = parseTutorSessionBlock(content);

  if (!block) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-200 p-4 text-sm text-slate-400">
        This speaking practice is not set up yet.
      </div>
    );
  }

  const title = block.title || scenario?.title || "Speaking practice";
  const canStart = !!scenario && !!lessonId;
  const persona = scenario?.persona;
  const personaName = persona ? persona.displayName ?? persona.name : null;

  return (
    <section className="overflow-hidden rounded-[2rem] border border-slate-100 bg-white shadow-xl">
      <div className="flex flex-col gap-6 p-6 md:p-10">
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-cyan-50 text-cyan-700">
            <Mic className="h-6 w-6" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-cyan-700">Speaking practice</p>
            <h3 className="text-xl font-bold leading-snug text-[#062e39]">{title}</h3>
          </div>
        </div>
        <div className="-mt-2 flex flex-wrap gap-2">
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
              {TUTOR_STYLE_LABELS[block.style]}
            </span>
            {block.required && (
              <span className="rounded-full bg-[#fff6ee] px-3 py-1 text-xs font-semibold text-[#fd5523]">Required</span>
            )}
        </div>

        {block.intro && <p className="text-sm leading-relaxed text-slate-600">{block.intro}</p>}

        {scenario ? (
          <div className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-700">
            <p className="font-semibold text-slate-800">Your goal</p>
            <p className="mt-1">{scenario.goal}</p>
            <p className="mt-3 text-xs text-slate-500">
              {personaName ? `With ${personaName} · ` : ""}up to {scenario.maxMinutes} minutes
            </p>
          </div>
        ) : (
          <p className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-500">
            This practice is not available right now. Your teacher may need to publish the scenario.
          </p>
        )}

        <div className="flex flex-wrap items-center gap-4">
          <Button
            type="button"
            disabled={!canStart}
            onClick={() => setOpen(true)}
            className="h-12 rounded-2xl bg-[#fd5523] px-6 text-base font-bold text-white hover:bg-[#ef4a16]"
          >
            <Mic className="mr-2 h-5 w-5" />
            {done ? "Practice again" : "Start speaking practice"}
          </Button>
          {done && (
            <span className="flex items-center gap-2 text-sm font-semibold text-emerald-700">
              <CheckCircle className="h-4 w-4" /> Done
            </span>
          )}
        </div>
      </div>

      {open && scenario && lessonId && typeof document !== "undefined" &&
        createPortal(
          <div className="fixed inset-0 z-[80] flex flex-col bg-[#062e39]" role="dialog" aria-modal="true" aria-label={title}>
            <div className="flex items-center justify-between gap-3 px-4 py-3 text-white">
              <p className="truncate text-sm font-semibold">{title}</p>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/10 hover:bg-white/20"
                aria-label="Close speaking practice"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto">
              <TutorSession
                origin="lesson"
                lessonId={lessonId}
                scenarioId={scenario.id}
                scene={scenario.scene}
                look={persona?.look}
                preview={{
                  teacherName: personaName ?? undefined,
                  title,
                  goal: scenario.goal,
                  maxMinutes: scenario.maxMinutes,
                  modes: scenario.modes,
                }}
                onExit={() => {
                  onComplete?.(scenario.id);
                  setOpen(false);
                }}
              />
            </div>
          </div>,
          document.body,
        )}
    </section>
  );
}
