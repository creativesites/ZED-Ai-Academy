"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  ArrowLeft,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock3,
  History,
  Lock,
  Mic,
  Play,
  Share2,
  Sparkles,
  Trophy,
} from "lucide-react";
import { Teacher } from "@/components/tutor/avatar/Teacher";
import { DEFAULT_PERSONA_LOOK } from "@/components/tutor/avatar/types";
import { toggleShareSessionWithTeacher } from "@/actions/tutor-learner";
import type { LearnerSessionHistoryItem } from "@/lib/tutor/server/learner-overview";
import { Button } from "@/components/ui/button";

const SCORE_LABELS: Record<string, string> = {
  fluency: "Fluency",
  accuracy: "Accuracy",
  vocabulary: "Vocabulary",
  pronunciation: "Pronunciation",
  task: "Goal reached",
};

function averageScore(scores: Record<string, number> | undefined): number | null {
  if (!scores) return null;
  const vals = Object.values(scores).filter((n) => typeof n === "number");
  if (vals.length === 0) return null;
  return Math.round(vals.reduce((a, b) => a + b, 0) / vals.length);
}

export function SpeakingHistoryView({
  initialSessions,
  backHref,
  backLabel = "Back to Teacher's Room",
  sessionBasePath,
}: {
  initialSessions: LearnerSessionHistoryItem[];
  backHref: string;
  backLabel?: string;
  sessionBasePath: string;
}) {
  const sessionHref = (id: string) => `${sessionBasePath.replace(/\/+$/, "")}/${id}`;
  const [sessions, setSessions] = useState<LearnerSessionHistoryItem[]>(initialSessions);
  const [expandedId, setExpandedId] = useState<string | null>(initialSessions[0]?.sessionId ?? null);
  const [isPending, startTransition] = useTransition();

  const totalMinutes = Math.round(
    sessions.reduce((sum, s) => sum + s.learnerSpeakingMs, 0) / 60000,
  );
  const scoredAvgs = sessions
    .map((s) => averageScore(s.report?.scores))
    .filter((n): n is number => n !== null);
  const overallAvg =
    scoredAvgs.length > 0
      ? Math.round(scoredAvgs.reduce((a, b) => a + b, 0) / scoredAvgs.length)
      : null;

  function handleToggleShare(item: LearnerSessionHistoryItem) {
    const nextShared = !item.sharedWithTeacher;
    startTransition(async () => {
      try {
        await toggleShareSessionWithTeacher(item.sessionId, nextShared);
        setSessions((prev) =>
          prev.map((s) =>
            s.sessionId === item.sessionId ? { ...s, sharedWithTeacher: nextShared } : s,
          ),
        );
        toast.success(
          nextShared
            ? "Shared with your academy teachers for feedback"
            : "Session set back to private",
        );
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Could not update sharing");
      }
    });
  }

  return (
    <div className="min-h-screen bg-slate-50 py-8 sm:py-12">
      <div className="container mx-auto max-w-4xl px-4 sm:px-6 space-y-8">
        {/* Header */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <Link
              href={backHref}
              className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-brand-text"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              {backLabel}
            </Link>
            <h1 className="mt-1.5 font-heading text-2xl font-black tracking-tight text-ink sm:text-3xl">
              Speaking History &amp; Feedback Reports
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              Revisit your past conversations, track your scores, review corrections, or share a session with your teacher.
            </p>
          </div>
        </div>

        {/* Summary Strip */}
        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center gap-1.5 text-brand-text">
              <History className="h-4 w-4" />
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Sessions
              </span>
            </div>
            <p className="mt-1 text-2xl font-black text-ink">{sessions.length}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center gap-1.5 text-blue-600">
              <Clock3 className="h-4 w-4" />
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Spoken Time
              </span>
            </div>
            <p className="mt-1 text-2xl font-black text-ink">{totalMinutes} min</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center gap-1.5 text-emerald-600">
              <Trophy className="h-4 w-4" />
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Avg Guidance
              </span>
            </div>
            <p className="mt-1 text-2xl font-black text-ink">
              {overallAvg !== null ? `${overallAvg}%` : "—"}
            </p>
          </div>
        </div>

        {/* Session List */}
        {sessions.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-12 text-center space-y-3">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-soft text-brand-text">
              <Mic className="h-7 w-7" />
            </div>
            <h2 className="text-lg font-black text-ink">No speaking sessions yet</h2>
            <p className="mx-auto max-w-md text-sm text-slate-500">
              Once you finish a conversation with your AI Language Teacher, your full report card, strengths, and corrections will appear here.
            </p>
            <div className="pt-2">
              <Link
                href={backHref}
                className="inline-flex h-11 items-center gap-2 rounded-xl bg-brand px-6 text-xs font-black uppercase tracking-wider text-white shadow-md hover:bg-brand-hover"
              >
                <Sparkles className="h-4 w-4" />
                Start Your First Scene
              </Link>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {sessions.map((item) => {
              const isOpen = expandedId === item.sessionId;
              const avg = averageScore(item.report?.scores);
              const mins = Math.max(1, Math.round(item.learnerSpeakingMs / 60000));
              const isPrivateOrigin = item.origin === "practice" || item.origin === "ask";

              return (
                <article
                  key={item.sessionId}
                  className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm"
                >
                  {/* Row Header */}
                  <button
                    type="button"
                    onClick={() => setExpandedId(isOpen ? null : item.sessionId)}
                    className="flex w-full items-center justify-between gap-4 p-5 text-left transition-colors hover:bg-slate-50/70"
                  >
                    <div className="flex items-center gap-3.5 min-w-0">
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-gradient-to-b from-[#1a1338] to-[#321b4e]">
                        <Teacher
                          variant="bust"
                          persona={item.personaLook ?? DEFAULT_PERSONA_LOOK}
                          className="h-12 w-12"
                          label={item.personaName ?? "AI Teacher"}
                        />
                      </div>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold uppercase text-slate-600">
                            {item.origin}
                          </span>
                          {item.level && (
                            <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-bold text-blue-700">
                              {item.level}
                            </span>
                          )}
                          <span className="text-[11px] text-slate-400">
                            {new Date(item.startedAt).toLocaleDateString()} · ~{mins} min
                          </span>
                        </div>
                        <h2 className="mt-0.5 truncate text-base font-bold text-ink">
                          {item.scenarioTitle}
                        </h2>
                        {item.personaName && (
                          <p className="text-xs text-slate-500">With {item.personaName}</p>
                        )}
                      </div>
                    </div>

                    <div className="flex shrink-0 items-center gap-3">
                      {avg !== null && (
                        <span className="rounded-xl bg-emerald-50 px-3 py-1.5 text-sm font-black text-emerald-700">
                          {avg}%
                        </span>
                      )}
                      {isOpen ? (
                        <ChevronUp className="h-5 w-5 text-slate-400" />
                      ) : (
                        <ChevronDown className="h-5 w-5 text-slate-400" />
                      )}
                    </div>
                  </button>

                  {/* Expanded Report Details */}
                  {isOpen && (
                    <div className="border-t border-slate-100 bg-slate-50/50 p-5 space-y-5">
                      {item.report ? (
                        <>
                          {/* Score Bars */}
                          {Object.keys(item.report.scores).length > 0 && (
                            <div className="grid gap-3 sm:grid-cols-2">
                              {Object.entries(item.report.scores).map(([key, val]) => (
                                <div key={key} className="rounded-xl border border-slate-200 bg-white p-3">
                                  <div className="flex items-center justify-between text-xs font-bold text-slate-700">
                                    <span>{SCORE_LABELS[key] ?? key}</span>
                                    <span className="text-ink">{val}%</span>
                                  </div>
                                  <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100">
                                    <div
                                      className="h-full rounded-full bg-brand"
                                      style={{ width: `${Math.min(100, Math.max(0, val))}%` }}
                                    />
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}

                          {/* Strengths */}
                          {item.report.strengths.length > 0 && (
                            <div className="space-y-2">
                              <h3 className="text-xs font-black uppercase tracking-wider text-emerald-700">
                                What Went Well
                              </h3>
                              <ul className="space-y-1.5">
                                {item.report.strengths.map((st, idx) => (
                                  <li
                                    key={idx}
                                    className="flex items-start gap-2 text-sm text-slate-700"
                                  >
                                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                                    <span>{st}</span>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}

                          {/* Corrections */}
                          {item.report.mistakes.length > 0 && (
                            <div className="space-y-2">
                              <h3 className="text-xs font-black uppercase tracking-wider text-slate-500">
                                Corrections to Review
                              </h3>
                              <ul className="space-y-2">
                                {item.report.mistakes.map((m, idx) => (
                                  <li
                                    key={idx}
                                    className="rounded-xl border border-slate-200 bg-white p-3 text-sm"
                                  >
                                    <div className="flex flex-wrap items-baseline gap-2">
                                      <span className="text-slate-400 line-through">{m.said}</span>
                                      <span className="text-slate-400">→</span>
                                      <span className="font-bold text-ink">{m.correct}</span>
                                      <span className="ml-auto rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold uppercase text-slate-500">
                                        {m.category}
                                      </span>
                                    </div>
                                    {m.note && (
                                      <p className="mt-1 text-xs text-slate-500">{m.note}</p>
                                    )}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </>
                      ) : (
                        <p className="text-xs text-slate-500">
                          No detailed report was saved for this session.
                        </p>
                      )}

                      {/* Footer Actions */}
                      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200/70 pt-4">
                        {isPrivateOrigin ? (
                          <button
                            type="button"
                            disabled={isPending}
                            onClick={() => handleToggleShare(item)}
                            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                          >
                            {item.sharedWithTeacher ? (
                              <>
                                <Share2 className="h-3.5 w-3.5 text-emerald-600" />
                                Shared with teacher (Click to make private)
                              </>
                            ) : (
                              <>
                                <Lock className="h-3.5 w-3.5 text-slate-400" />
                                Private · Share with teacher
                              </>
                            )}
                          </button>
                        ) : (
                          <span className="text-xs text-slate-400">
                            Visible to your course teacher ({item.origin})
                          </span>
                        )}

                        {item.scenarioId && (
                          <Link href={sessionHref(item.scenarioId)}>
                            <Button
                              type="button"
                              size="sm"
                              className="rounded-xl bg-brand text-xs font-bold text-white hover:bg-brand-hover"
                            >
                              <Play className="mr-1.5 h-3.5 w-3.5" />
                              Practise Again
                            </Button>
                          </Link>
                        )}
                      </div>
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
