"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  BookMarked,
  CalendarClock,
  CheckCircle2,
  Clock3,
  Flame,
  History,
  Library,
  MessageSquareText,
  Mic,
  Search,
  Sparkles,
  Trophy,
} from "lucide-react";
import type { LanguageGroup, PracticeLibraryItem } from "@/lib/tutor/practice-library";
import { startableModes } from "@/lib/tutor/practice-library";
import type { LearnerTutorOverview } from "@/lib/tutor/server/learner-overview";
import { Teacher } from "@/components/tutor/avatar/Teacher";
import { DEFAULT_PERSONA_LOOK } from "@/components/tutor/avatar/types";

type PracticeLibraryProps = {
  groups: LanguageGroup[];
  /** Base path for scenario session routes, e.g. "/practice" or "/academy/slug/practice". */
  sessionBasePath: string;
  /** Optional path to the learner's spaced-repetition vocabulary deck. */
  deckHref?: string;
  /** Optional path to the learner's speaking session history & reports. */
  historyHref?: string;
  /** Optional path to "What my teacher knows" (P1-08). */
  aboutMeHref?: string;
  /** Optional learner stats, due deck count, and assigned speaking scenarios. */
  overview?: LearnerTutorOverview;
  /** Where the empty state sends the learner. */
  browseHref: string;
  browseLabel: string;
  heading: string;
  subheading: string;
};

export function PracticeLibrary({
  groups,
  sessionBasePath,
  deckHref,
  historyHref,
  aboutMeHref,
  overview,
  browseHref,
  browseLabel,
  heading,
  subheading,
}: PracticeLibraryProps) {
  const sessionHref = (id: string) => `${sessionBasePath.replace(/\/+$/, "")}/${id}`;
  const [activeGroup, setActiveGroup] = useState<string>("all");
  const [query, setQuery] = useState("");

  const total = groups.reduce((n, g) => n + g.items.length, 0);

  const visibleGroups = useMemo(() => {
    const q = query.trim().toLowerCase();
    return groups
      .filter((g) => activeGroup === "all" || g.key === activeGroup)
      .map((g) => ({
        ...g,
        items: q
          ? g.items.filter(
              (item) =>
                item.title.toLowerCase().includes(q) ||
                item.goal.toLowerCase().includes(q) ||
                (item.personaName?.toLowerCase().includes(q) ?? false) ||
                (item.level?.toLowerCase().includes(q) ?? false),
            )
          : g.items,
      }))
      .filter((g) => g.items.length > 0);
  }, [groups, activeGroup, query]);

  return (
    <div className="bg-slate-50 min-h-screen">
      <div className="container mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-14 space-y-10">
        {/* Header */}
        <header className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
          <div className="max-w-2xl space-y-2">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#fd5523]">
              Teacher
            </p>
            <h1 className="font-heading text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
              {heading}
            </h1>
            <p className="text-base text-slate-600">{subheading}</p>
          </div>

          {(deckHref || historyHref) && (
            <div className="flex flex-wrap items-center gap-2.5">
              {deckHref && (
                <Link
                  href={deckHref}
                  className="group inline-flex shrink-0 items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm transition hover:border-[#fd5523]/40 hover:shadow-md"
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#fff6ee] text-[#fd5523]">
                    <BookMarked className="h-5 w-5" />
                  </div>
                  <div className="text-left">
                    <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                      Study Deck
                    </p>
                    <p className="text-sm font-bold text-[#062e39]">
                      {overview && overview.deck.dueNow > 0
                        ? `${overview.deck.dueNow} due now`
                        : overview && overview.deck.total > 0
                          ? `${overview.deck.total} cards`
                          : "Active Recall"}
                    </p>
                  </div>
                  <ArrowRight className="h-4 w-4 text-slate-400 transition-transform group-hover:translate-x-0.5 group-hover:text-[#fd5523]" />
                </Link>
              )}

              {historyHref && (
                <Link
                  href={historyHref}
                  className="group inline-flex shrink-0 items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm transition hover:border-blue-300 hover:shadow-md"
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                    <History className="h-5 w-5" />
                  </div>
                  <div className="text-left">
                    <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                      Past Reports
                    </p>
                    <p className="text-sm font-bold text-[#062e39]">
                      {overview && overview.completedSessionsCount > 0
                        ? `${overview.completedSessionsCount} session${overview.completedSessionsCount === 1 ? "" : "s"}`
                        : "History"}
                    </p>
                  </div>
                  <ArrowRight className="h-4 w-4 text-slate-400 transition-transform group-hover:translate-x-0.5 group-hover:text-blue-600" />
                </Link>
              )}

              {aboutMeHref && (
                <Link
                  href={aboutMeHref}
                  className="inline-flex shrink-0 items-center rounded-2xl px-3 py-3 text-sm font-semibold text-slate-600 underline-offset-4 hover:text-[#fd5523] hover:underline"
                >
                  What your teacher knows about you
                </Link>
              )}
            </div>
          )}
        </header>

        {/* Weekly Practice Goal Ring, Streak, XP Tier & Stats */}
        {overview && (
          <section aria-label="Your practice progress" className="grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1.8fr)]">
            {/* Weekly Goal Ring + XP Tier Card */}
            <div className="flex items-center gap-4 rounded-3xl border border-slate-200 bg-gradient-to-br from-[#062e39] via-[#0b3c49] to-[#1a2240] p-5 text-white shadow-md">
              <div className="relative flex h-20 w-20 shrink-0 items-center justify-center">
                <svg className="h-20 w-20 -rotate-90" viewBox="0 0 80 80" aria-hidden="true">
                  <circle
                    cx="40"
                    cy="40"
                    r="33"
                    fill="none"
                    stroke="rgba(255,255,255,0.16)"
                    strokeWidth="7"
                  />
                  <circle
                    cx="40"
                    cy="40"
                    r="33"
                    fill="none"
                    stroke={overview.habits.weeklyGoalMet ? "#34d399" : "#fd5523"}
                    strokeWidth="7"
                    strokeLinecap="round"
                    strokeDasharray={2 * Math.PI * 33}
                    strokeDashoffset={
                      2 * Math.PI * 33 * (1 - overview.habits.weeklyGoalPct / 100)
                    }
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                  <span className="text-base font-black leading-none">
                    {overview.habits.weeklyMinutes}m
                  </span>
                  <span className="mt-0.5 text-[9px] font-bold uppercase tracking-wider text-white/70">
                    / {overview.habits.weeklyGoalMinutes}m
                  </span>
                </div>
              </div>

              <div className="min-w-0 flex-1 space-y-1.5">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="rounded-full bg-white/15 px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-amber-300">
                    Lv.{overview.habits.tier.level} · {overview.habits.tier.title}
                  </span>
                  <span className="text-[11px] font-bold text-white/80">
                    {overview.habits.tier.xp} XP
                  </span>
                </div>
                <p className="text-sm font-bold leading-snug text-white">
                  {overview.habits.nextBestAction.label}
                </p>
                <p className="text-xs leading-snug text-white/75">
                  {overview.habits.nextBestAction.detail}
                </p>
                {overview.habits.nextBestAction.kind === "deck" && deckHref && (
                  <Link
                    href={deckHref}
                    className="mt-1 inline-flex items-center gap-1 text-xs font-bold text-amber-300 hover:underline"
                  >
                    Open Study Deck <ArrowRight className="h-3 w-3" />
                  </Link>
                )}
              </div>
            </div>

            {/* 4 Compact Stat Tiles */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex items-center gap-2 text-[#fd5523]">
                  <Flame className="h-4 w-4" />
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                    Streak
                  </span>
                </div>
                <p className="mt-1.5 text-2xl font-black text-[#062e39]">
                  {overview.streakDays} {overview.streakDays === 1 ? "day" : "days"}
                </p>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex items-center gap-2 text-blue-600">
                  <Clock3 className="h-4 w-4" />
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                    Practice Time
                  </span>
                </div>
                <p className="mt-1.5 text-2xl font-black text-[#062e39]">
                  {overview.totalSpeakingMinutes} min
                </p>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex items-center gap-2 text-emerald-600">
                  <Trophy className="h-4 w-4" />
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                    Sessions
                  </span>
                </div>
                <p className="mt-1.5 text-2xl font-black text-[#062e39]">
                  {overview.completedSessionsCount}
                </p>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex items-center gap-2 text-violet-600">
                  <Sparkles className="h-4 w-4" />
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                    Cards Mastered
                  </span>
                </div>
                <p className="mt-1.5 text-2xl font-black text-[#062e39]">
                  {overview.deck.mastered}
                  {overview.deck.total > 0 && (
                    <span className="ml-1 text-sm font-semibold text-slate-400">
                      / {overview.deck.total}
                    </span>
                  )}
                </p>
              </div>
            </div>
          </section>
        )}

        {/* Assigned by Teacher Shelf */}
        {overview && overview.assignments.length > 0 && (
          <section aria-labelledby="assigned-heading" className="space-y-4">
            <div className="flex items-baseline justify-between gap-4">
              <h2
                id="assigned-heading"
                className="flex items-center gap-2 font-heading text-xl font-bold text-slate-900"
              >
                <CalendarClock className="h-5 w-5 text-[#fd5523]" />
                Assigned by Your Teacher
              </h2>
              <span className="text-xs font-semibold text-slate-500">
                {overview.assignments.filter((a) => !a.completed).length} pending
              </span>
            </div>
            <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {overview.assignments.map((a) => (
                <li key={a.assignmentId}>
                  <Link
                    href={sessionHref(a.scenarioId)}
                    className="group flex h-full flex-col justify-between gap-4 rounded-2xl border-2 border-[#fd5523]/25 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-[#fd5523]/60 hover:shadow-md"
                  >
                    <div className="space-y-3">
                      <div className="flex items-start gap-3">
                        <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-gradient-to-b from-[#1a1338] to-[#321b4e]">
                          <Teacher
                            variant="bust"
                            persona={a.personaLook ?? DEFAULT_PERSONA_LOOK}
                            className="h-12 w-12"
                            label={a.personaName ?? "Animated AI teacher"}
                          />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-1.5">
                            {a.completed ? (
                              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-bold text-emerald-700">
                                <CheckCircle2 className="h-3 w-3" /> Completed
                              </span>
                            ) : (
                              <span className="rounded-full bg-[#fff6ee] px-2 py-0.5 text-[11px] font-bold text-[#fd5523]">
                                Assigned
                              </span>
                            )}
                            {a.dueAt && (
                              <span className="text-[11px] font-medium text-slate-500">
                                Due {new Date(a.dueAt).toLocaleDateString()}
                              </span>
                            )}
                          </div>
                          <h3 className="mt-1 font-heading text-base font-bold text-slate-900">
                            {a.title}
                          </h3>
                        </div>
                      </div>
                      <p className="line-clamp-2 text-xs leading-relaxed text-slate-600">{a.goal}</p>
                    </div>
                    <div className="flex items-center justify-between border-t border-slate-100 pt-3 text-xs font-semibold text-[#fd5523]">
                      <span>{a.personaName ? `With ${a.personaName}` : `Up to ${a.maxMinutes} min`}</span>
                      <span className="inline-flex items-center gap-1">
                        {a.completed ? "Practise again" : "Start now"}
                        <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                      </span>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Filter & Search Bar */}
        {total > 0 && (
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setActiveGroup("all")}
                className={`rounded-full px-3.5 py-1.5 text-xs font-bold transition-colors ${
                  activeGroup === "all"
                    ? "bg-[#062e39] text-white"
                    : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-100"
                }`}
              >
                All ({total})
              </button>
              {groups.map((g) => (
                <button
                  key={g.key}
                  type="button"
                  onClick={() => setActiveGroup(g.key)}
                  className={`rounded-full px-3.5 py-1.5 text-xs font-bold transition-colors ${
                    activeGroup === g.key
                      ? "bg-[#fd5523] text-white"
                      : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-100"
                  }`}
                >
                  {g.label} ({g.items.length})
                </button>
              ))}
            </div>

            <div className="relative w-full sm:w-64">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search scenes or teachers..."
                className="h-10 w-full rounded-xl border border-slate-200 bg-white pl-9 pr-3 text-sm text-slate-800 placeholder:text-slate-400 focus:border-[#fd5523] focus:outline-none focus:ring-2 focus:ring-[#fd5523]/20"
              />
            </div>
          </div>
        )}

        {/* Scenario Groups */}
        {total === 0 ? (
          <EmptyState browseHref={browseHref} browseLabel={browseLabel} />
        ) : visibleGroups.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center">
            <p className="text-sm font-semibold text-slate-700">No scenarios match &ldquo;{query}&rdquo;.</p>
            <button
              type="button"
              onClick={() => {
                setQuery("");
                setActiveGroup("all");
              }}
              className="mt-2 text-xs font-bold text-[#fd5523] hover:underline"
            >
              Clear filters
            </button>
          </div>
        ) : (
          <div className="space-y-12">
            {visibleGroups.map((group) => (
              <section key={group.key} aria-labelledby={`lang-${group.key}`} className="space-y-4">
                <div className="flex items-baseline justify-between gap-4">
                  <h2 id={`lang-${group.key}`} className="font-heading text-xl font-semibold text-slate-900">
                    {group.label}
                  </h2>
                  <span className="text-sm text-slate-500">
                    {group.items.length} {group.items.length === 1 ? "scenario" : "scenarios"}
                  </span>
                </div>
                <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {group.items.map((item) => (
                    <li key={item.id}>
                      <ScenarioCard item={item} href={sessionHref(item.id)} />
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function ScenarioCard({ item, href }: { item: PracticeLibraryItem; href: string }) {
  const modes = startableModes(item.allowedModes);
  return (
    <Link
      href={href}
      className="group flex h-full flex-col justify-between gap-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
    >
      <div className="space-y-3">
        <div className="flex items-start gap-3.5">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-gradient-to-b from-[#1a1338] to-[#321b4e] shadow-sm">
            <Teacher
              variant="bust"
              persona={item.personaLook ?? DEFAULT_PERSONA_LOOK}
              className="h-14 w-14"
              label={item.personaName ?? "Animated AI teacher"}
            />
          </div>
          <div className="min-w-0 flex-1 space-y-1">
            <div className="flex flex-wrap items-center gap-1.5">
              {item.level && (
                <span className="rounded-full border border-blue-100 bg-blue-50 px-2.5 py-0.5 text-xs font-semibold text-blue-700">
                  {item.level}
                </span>
              )}
              {item.visibility === "platform" && (
                <span className="rounded-full border border-slate-200 bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-600">
                  Starter pack
                </span>
              )}
            </div>
            <h3 className="font-heading text-lg font-semibold leading-snug text-slate-900">{item.title}</h3>
          </div>
        </div>
        <p className="line-clamp-3 text-sm leading-relaxed text-slate-600">{item.goal}</p>
        {item.personaName && <p className="text-sm font-medium text-slate-500">With {item.personaName}</p>}
      </div>

      <div className="flex items-center justify-between gap-3 border-t border-slate-100 pt-4">
        <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
          <span className="inline-flex items-center gap-1">
            <Clock3 className="h-3.5 w-3.5" aria-hidden="true" />
            Up to {item.maxMinutes} min
          </span>
          <span className="inline-flex items-center gap-1">
            {modes.includes("voice") ? <Mic className="h-3.5 w-3.5" aria-hidden="true" /> : <MessageSquareText className="h-3.5 w-3.5" aria-hidden="true" />}
            {modes.includes("voice") ? "Voice or text" : "Text"}
          </span>
        </div>
        <span className="inline-flex items-center gap-1 text-sm font-semibold text-blue-600 group-hover:text-blue-500">
          Start
          <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
        </span>
      </div>
    </Link>
  );
}

function EmptyState({ browseHref, browseLabel }: { browseHref: string; browseLabel: string }) {
  return (
    <section
      aria-labelledby="practice-empty-title"
      className="flex max-w-xl flex-col items-start gap-4 rounded-3xl border border-dashed border-slate-300 bg-white px-6 py-10 text-left shadow-sm sm:px-10"
    >
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
        <Library className="h-7 w-7" aria-hidden="true" />
      </div>
      <div className="space-y-2">
        <h2 id="practice-empty-title" className="font-heading text-xl font-semibold text-slate-900">
          No practice scenarios yet
        </h2>
        <p className="text-sm leading-relaxed text-slate-600">
          Teachers publish practice scenarios to the library. When one is ready, it will appear here, grouped by
          language and level, so you can practise speaking whenever you like.
        </p>
      </div>
      <Link
        href={browseHref}
        className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
      >
        {browseLabel}
        <ArrowRight className="h-4 w-4" aria-hidden="true" />
      </Link>
    </section>
  );
}
