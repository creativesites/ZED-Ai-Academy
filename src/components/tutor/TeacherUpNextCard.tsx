"use client";

import Link from "next/link";
import { ArrowRight, Clock, Play } from "lucide-react";
import { Teacher } from "@/components/tutor/avatar/Teacher";
import { personaPreset } from "@/components/tutor/avatar/persona-presets";
import type { PersonaLook } from "@/components/tutor/avatar/types";
import { useLiteMode } from "@/components/tutor/practice/use-lite-mode";
import type { UpNext } from "@/lib/tutor/up-next";

// "Up next with <Teacher>" (UX spec §3, P1-09). Replaces DailyPlanCard, TutorSpotlightBanner and the academy
// dashboard's three teacher tiles. One filled button, at most two text links, and "See all" to Teacher home.
// Data saver: initials instead of the animated portrait.

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return (parts[0]?.[0] ?? "T").toUpperCase() + (parts[1]?.[0] ?? "").toUpperCase();
}

export function TeacherUpNextCard({
  teacher,
  upNext,
  teacherHomeHref,
  startHref,
  academyName,
}: {
  teacher: { name: string; look?: Partial<PersonaLook>; isDefault: boolean };
  upNext: UpNext;
  /** Teacher home in the learner's academy ("/academy/x/practice" or "/practice"). */
  teacherHomeHref: string;
  /** Where a new learner starts (the academy's courses). */
  startHref: string;
  academyName?: string | null;
}) {
  const [lite] = useLiteMode();
  const { primary, secondary, line } = upNext;
  // Only show a face we know belongs to this teacher: the persona's look, or Tinashe's preset for the default.
  const look: Partial<PersonaLook> | null =
    teacher.look ?? (teacher.isDefault ? personaPreset("tinashe").look : null);

  return (
    <section
      aria-labelledby="up-next-heading"
      className="rounded-3xl border border-slate-200/80 bg-white p-5 shadow-sm sm:p-6"
    >
      <div className="flex items-start gap-3 sm:gap-4">
        <div
          className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-[#062e39] text-sm font-bold text-white sm:h-12 sm:w-12"
          aria-hidden="true"
        >
          {lite || !look ? (
            <span>{initials(teacher.name)}</span>
          ) : (
            <Teacher
              variant="bust"
              persona={look}
              className="h-10 w-10 sm:h-12 sm:w-12"
              label={`${teacher.name}, your teacher`}
            />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <h2 id="up-next-heading" className="text-sm font-bold text-[#062e39] sm:text-base">
            {primary ? `Up next with ${teacher.name}` : `Meet ${teacher.name}`}
          </h2>
          <p className="mt-0.5 text-sm leading-relaxed text-slate-600">
            {primary
              ? line
              : `${teacher.name} is your teacher${academyName ? ` for ${academyName}` : ""}. Start your first lesson and ${teacher.name} will plan what comes next.`}
          </p>
        </div>
      </div>

      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        {primary ? (
          <>
            <Link
              href={primary.href}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#fd5523] px-5 text-sm font-bold text-white shadow-sm transition hover:bg-[#ea4817] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#fd5523]"
            >
              <Play className="h-4 w-4" aria-hidden="true" />
              {primary.label}
            </Link>
            <p className="flex min-w-0 items-center gap-2 text-sm text-slate-600 sm:justify-end">
              <span className="truncate font-semibold text-[#062e39]">{primary.detail}</span>
              {primary.durationMinutes ? (
                <span className="inline-flex shrink-0 items-center gap-1 text-xs text-slate-500">
                  <Clock className="h-3 w-3" aria-hidden="true" />
                  {primary.durationMinutes} min
                </span>
              ) : null}
            </p>
          </>
        ) : (
          <Link
            href={startHref}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#fd5523] px-5 text-sm font-bold text-white shadow-sm transition hover:bg-[#ea4817] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#fd5523]"
          >
            Start your first lesson
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        )}
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-t border-slate-100 pt-3 text-sm">
        {secondary.length > 0 ? (
          <p className="flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-1 text-slate-500">
            <span>Also:</span>
            {secondary.map((action, i) => (
              <span key={action.id} className="inline-flex items-center gap-1.5">
                {i > 0 && <span aria-hidden="true">·</span>}
                <Link
                  href={action.href}
                  className="inline-flex min-h-11 items-center font-semibold text-[#062e39] underline-offset-4 hover:text-[#fd5523] hover:underline sm:min-h-0"
                >
                  {action.kind === "cards" ? action.label : `${action.label}: ${action.detail}`}
                </Link>
              </span>
            ))}
          </p>
        ) : (
          <span />
        )}
        <Link
          href={teacherHomeHref}
          className="inline-flex min-h-11 items-center gap-1 font-semibold text-[#fd5523] underline-offset-4 hover:underline sm:min-h-0"
        >
          See all
          <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
        </Link>
      </div>
    </section>
  );
}
