"use client";

import Link from "next/link";
import { ArrowRight, BookMarked, Flame, History, Mic, Sparkles } from "lucide-react";
import { Teacher } from "@/components/tutor/avatar/Teacher";
import { personaPreset } from "@/components/tutor/avatar/persona-presets";

export function TutorSpotlightBanner({
  practiceHref = "/practice",
  deckHref = "/practice/deck",
  historyHref = "/practice/history",
  showcaseHref = "/ai-tutor",
  streakDays,
  dueCardsCount,
  completedSessionsCount,
  title = "Learn out loud with your animated AI Teacher",
  description = "Practise Mandarin, Spanish, French, or course role-plays with real-time voice feedback, tone trails, and flashcards.",
}: {
  practiceHref?: string;
  deckHref?: string;
  historyHref?: string;
  showcaseHref?: string;
  streakDays?: number;
  dueCardsCount?: number;
  completedSessionsCount?: number;
  title?: string;
  description?: string;
}) {
  const lin = personaPreset("lin");

  return (
    <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-[#062e39] via-[#132842] to-[#2a1745] p-6 text-white shadow-xl sm:p-8">
      <div className="pointer-events-none absolute -right-12 -top-12 h-56 w-56 rounded-full bg-[#fd5523]/20 blur-3xl" />

      <div className="relative z-10 flex flex-col items-start gap-6 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4 sm:gap-5">
          <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-white/15 bg-black/25 shadow-lg sm:h-24 sm:w-24">
            <Teacher
              variant="bust"
              persona={lin.look}
              className="h-20 w-20 sm:h-24 sm:w-24"
              label="Lín Lǎoshī, your animated AI language teacher"
            />
          </div>

          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-0.5 text-[10px] font-black uppercase tracking-widest text-amber-300">
                <Sparkles className="h-3 w-3" />
                ZAI Teacher · Teacher&apos;s Room
              </span>
              {typeof streakDays === "number" && streakDays > 0 && (
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-400/20 px-2.5 py-0.5 text-[10px] font-bold text-amber-200">
                  <Flame className="h-3 w-3" />
                  {streakDays}-day streak
                </span>
              )}
              {typeof dueCardsCount === "number" && dueCardsCount > 0 && (
                <span className="inline-flex items-center gap-1 rounded-full bg-[#fd5523]/30 px-2.5 py-0.5 text-[10px] font-bold text-orange-100">
                  <BookMarked className="h-3 w-3" />
                  {dueCardsCount} flashcards due
                </span>
              )}
            </div>
            <h2 className="text-lg font-black tracking-tight text-white sm:text-xl">{title}</h2>
            <p className="max-w-xl text-xs leading-relaxed text-white/75 sm:text-sm">{description}</p>
          </div>
        </div>

        <div className="flex w-full shrink-0 flex-wrap items-center gap-2.5 sm:w-auto">
          <Link
            href={practiceHref}
            className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-[#fd5523] px-5 py-3 text-xs font-black uppercase tracking-wider text-white shadow-lg shadow-[#fd5523]/25 transition-all hover:bg-[#ea4817] sm:flex-initial"
          >
            <Mic className="h-4 w-4" />
            <span>Open Teacher&apos;s Room</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
          <Link
            href={dueCardsCount && dueCardsCount > 0 ? deckHref : completedSessionsCount && completedSessionsCount > 0 ? historyHref : showcaseHref}
            className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-white/20 bg-white/10 px-4 py-3 text-xs font-bold text-white transition-colors hover:bg-white/20"
          >
            {dueCardsCount && dueCardsCount > 0 ? (
              <>
                <BookMarked className="h-3.5 w-3.5 text-amber-300" />
                <span>Review Deck</span>
              </>
            ) : completedSessionsCount && completedSessionsCount > 0 ? (
              <>
                <History className="h-3.5 w-3.5 text-sky-300" />
                <span>Past Reports</span>
              </>
            ) : (
              <span>Meet the Cast</span>
            )}
          </Link>
        </div>
      </div>
    </div>
  );
}
