"use client";

import { usePathname } from "next/navigation";
import { ArrowRight, CheckCircle, Mic } from "lucide-react";
import { Teacher } from "@/components/tutor/avatar/Teacher";
import { DEFAULT_PERSONA_LOOK } from "@/components/tutor/avatar/types";
import { useLiteMode } from "@/components/tutor/practice/use-lite-mode";
import {
  TUTOR_STYLE_LABELS,
  parseTutorSessionBlock,
  type TutorScenarioView,
} from "@/lib/tutor/tutor-session-block";
import { academyHref, academySlugFromPath } from "@/lib/tutor/academy-href";

// A tutor_session block in the lesson player. Navigates directly to the dedicated full-page
// Practice Room route (no cramped modal overlay), passing lessonId and a back URL so the learner
// returns straight to this lesson when finished.

export function TutorSessionBlock({
  content,
  lessonId,
  origin,
  scenario,
  done,
  isGuest = false,
  academySlug,
}: {
  content: Record<string, unknown>;
  lessonId?: string;
  origin?: "lesson" | "practice";
  /** Undefined when the scenario is missing or not published. */
  scenario: TutorScenarioView | undefined;
  done: boolean;
  isGuest?: boolean;
  /**
   * Slug of the academy that owns the course (null: platform course). Teacher links are built from the
   * course, not from the URL: the lesson player is /courses/[slug]/learn for every academy.
   */
  academySlug?: string | null;
}) {
  const pathname = usePathname();
  // Data saver: the light SVG teacher, so the Rive runtime is never downloaded for this card.
  const [lite] = useLiteMode();
  const block = parseTutorSessionBlock(content);

  if (!block) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-200 p-4 text-sm text-slate-400">
        This teaching session is not set up yet.
      </div>
    );
  }

  const resolvedOrigin = origin ?? (lessonId ? "lesson" : "practice");
  const title = block.title || scenario?.title || "Teaching session";
  const canStart = !!scenario && (resolvedOrigin === "practice" || !!lessonId);
  const persona = scenario?.persona;
  const personaName = persona ? persona.displayName ?? persona.name : null;

  const academy = academySlug !== undefined ? academySlug : academySlugFromPath(pathname);
  const returnPath =
    pathname && lessonId && pathname.endsWith("/learn") ? `${pathname}?lesson=${lessonId}` : pathname;
  const qs = new URLSearchParams();
  if (!isGuest && resolvedOrigin === "lesson" && lessonId) qs.set("lessonId", lessonId);
  if (returnPath) qs.set("back", returnPath);
  const practiceHref = scenario
    ? isGuest
      ? `/try/${scenario.id}${qs.toString() ? `?${qs.toString()}` : ""}`
      : academyHref(academy, `/practice/${scenario.id}${qs.toString() ? `?${qs.toString()}` : ""}`)
    : "#";

  return (
    <section className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-lg sm:rounded-[2rem] sm:shadow-xl">
      <div className="flex flex-col gap-4 p-4 sm:gap-5 sm:p-6 md:p-8">
        <div className="flex items-start gap-3 sm:gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-gradient-to-b from-[#1a1338] to-[#321b4e] shadow-md sm:h-16 sm:w-16 sm:rounded-2xl">
            <Teacher
              variant="bust"
              engine={lite ? "placeholder" : undefined}
              persona={persona?.look ?? DEFAULT_PERSONA_LOOK}
              className="h-12 w-12 sm:h-16 sm:w-16"
              label={personaName ?? "Your teacher"}
            />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-cyan-700 sm:text-[11px]">
              {personaName ? `Teaching session · ${personaName}` : "Teaching session"}
            </p>
            <h3 className="text-base font-bold leading-snug text-ink sm:text-xl">{title}</h3>
          </div>
        </div>

        <div className="-mt-1 flex flex-wrap gap-1.5">
          <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-semibold text-slate-600 sm:text-xs">
            {TUTOR_STYLE_LABELS[block.style]}
          </span>
          {block.required && (
            <span className="rounded-full bg-brand-soft px-2.5 py-0.5 text-[11px] font-semibold text-brand-text sm:text-xs">
              Required
            </span>
          )}
        </div>

        {block.intro && (
          <p className="text-xs leading-relaxed text-slate-600 sm:text-sm">{block.intro}</p>
        )}

        {scenario ? (
          <div className="rounded-xl bg-slate-50 p-3 text-xs text-slate-700 sm:rounded-2xl sm:p-4 sm:text-sm">
            <p className="font-semibold text-slate-800">Your goal</p>
            <p className="mt-1 leading-relaxed">{scenario.goal}</p>
            <p className="mt-2 text-[11px] text-slate-500 sm:text-xs">
              {personaName ? `With ${personaName} · ` : ""}up to {scenario.maxMinutes} minutes
            </p>
          </div>
        ) : (
          <p className="rounded-xl bg-slate-50 p-3 text-xs text-slate-500 sm:rounded-2xl sm:p-4 sm:text-sm">
            This practice is not available right now. Your teacher may need to publish the scenario.
          </p>
        )}

        <div className="flex flex-wrap items-center gap-3">
          {canStart ? (
            // A plain <a>, not next/link: the session page is a full-screen app (audio unlock, Live) and
            // in-app navigation between the lesson and the session left learners on "page not found" until a
            // reload (both forward and on browser Back). A full page load is reliable here.
            <a
              href={practiceHref}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-brand px-5 text-sm font-bold text-white shadow-sm transition hover:bg-brand-hover sm:h-12 sm:rounded-2xl sm:px-6 sm:text-base"
            >
              <Mic className="h-4 w-4 sm:h-5 sm:w-5" />
              {done ? "Go again" : personaName ? `Start with ${personaName}` : "Start session"}
              <ArrowRight className="h-4 w-4" />
            </a>
          ) : (
            <button
              type="button"
              disabled
              className="inline-flex h-11 cursor-not-allowed items-center justify-center gap-2 rounded-xl bg-brand/50 px-5 text-sm font-bold text-white sm:h-12 sm:rounded-2xl sm:px-6 sm:text-base"
            >
              <Mic className="h-4 w-4 sm:h-5 sm:w-5" />
              Start session
            </button>
          )}
          {done && (
            <span className="flex items-center gap-1.5 text-xs font-semibold text-emerald-700 sm:text-sm">
              <CheckCircle className="h-4 w-4" /> Done
            </span>
          )}
        </div>
      </div>
    </section>
  );
}
