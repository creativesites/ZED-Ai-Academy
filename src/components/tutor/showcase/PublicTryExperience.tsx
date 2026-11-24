"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight, CheckCircle2, Sparkles } from "lucide-react";
import type {
  CompleteResponse,
  Result,
  StartResponse,
  TurnResponse,
  TutorApiClient,
  TutorStartRequest,
  TutorTurnRequest,
} from "@/components/tutor/practice/api";
import { TutorSession } from "@/components/tutor/practice/TutorSession";
import { parseTutorErrorBody, type TutorFailure } from "@/lib/tutor/client-errors";
import { DEMO_MAX_HISTORY, DEMO_MAX_TUTOR_CHARS, type DemoHistoryEntry } from "@/lib/tutor/demo";
import type { TutorEvent } from "@/lib/tutor/events";
import type { SceneArtboard } from "@/lib/tutor/rive-driver";
import type { TutorPersonaLook } from "@/lib/tutor/tutor-session-block";
import type { TutorReportContent } from "@/lib/tutor/report-model";

type PublicTryExperienceProps = {
  scenarioId: string;
  title: string;
  goal: string;
  maxMinutes: number;
  beats?: Array<{ id: string; goal: string }>;
  scene: SceneArtboard;
  personaName: string;
  personaLanguages: string[];
  look?: Partial<TutorPersonaLook>;
  academy: {
    name: string;
    slug: string;
    logoUrl: string | null;
    primaryColor: string | null;
  };
  backUrl?: string | null;
};

async function callTryApi<T>(url: string, init: RequestInit): Promise<Result<T>> {
  let res: Response;
  try {
    res = await fetch(url, init);
  } catch {
    return { ok: false, failure: { kind: "network" } satisfies TutorFailure };
  }
  const body: unknown = await res.json().catch(() => null);
  if (!res.ok) {
    return { ok: false, failure: { kind: "http", status: res.status, ...parseTutorErrorBody(body) } };
  }
  return { ok: true, data: body as T };
}

function sayText(events: readonly TutorEvent[]): string {
  return events
    .flatMap((e) => (e.type === "say" ? [e.text] : []))
    .join(" ")
    .slice(0, DEMO_MAX_TUTOR_CHARS);
}

function createPublicTryClient(props: PublicTryExperienceProps): TutorApiClient {
  const endpoint = `/api/tutor/try/${props.scenarioId}`;
  let history: DemoHistoryEntry[] = [];
  let startedAt = 0;

  async function exchange(input: TutorTurnRequest | null): Promise<Result<TurnResponse>> {
    const elapsedMs = Math.max(0, Date.now() - startedAt);
    const recent = history.slice(-DEMO_MAX_HISTORY);

    let res: Result<TurnResponse>;
    if (input && input.kind === "audio") {
      const form = new FormData();
      form.append("audio", input.blob, "clip.webm");
      form.append("history", JSON.stringify(recent));
      form.append("elapsedMs", String(elapsedMs));
      res = await callTryApi<TurnResponse>(endpoint, { method: "POST", body: form });
    } else {
      res = await callTryApi<TurnResponse>(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          history: recent,
          elapsedMs,
          ...(input?.kind === "text" ? { text: input.text } : {}),
        }),
      });
    }

    if (!res.ok) return res;
    if (res.data.learnerText) history.push({ role: "learner", text: res.data.learnerText });
    const reply = sayText(res.data.events);
    if (reply) history.push({ role: "tutor", text: reply });
    return res;
  }

  return {
    async start(input: TutorStartRequest): Promise<Result<StartResponse>> {
      history = [];
      startedAt = Date.now();
      const opening = await exchange(null);
      if (!opening.ok) return opening;
      return {
        ok: true,
        data: {
          sessionId: `try-${props.scenarioId}-${startedAt}`,
          mode: input.preferMode === "text" ? "text" : "voice",
          persona: {
            id: "public-try",
            name: props.personaName,
            displayName: props.personaName,
            languages: props.personaLanguages,
          },
          scenario: {
            id: props.scenarioId,
            title: props.title,
            goal: props.goal,
            maxMinutes: props.maxMinutes,
            beats: props.beats?.map((b, i) => ({ id: b.id, label: b.goal.slice(0, 48) || `Step ${i + 1}`, goal: b.goal })),
          },
          openingEvents: opening.data.events,
        },
      };
    },
    async turn(_sessionId: string, input: TutorTurnRequest): Promise<Result<TurnResponse>> {
      return exchange(input);
    },
    async complete(): Promise<Result<CompleteResponse>> {
      return callTryApi<CompleteResponse>(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "report", history: history.slice(-DEMO_MAX_HISTORY) }),
      });
    },
  };
}

export function PublicTryExperience(props: PublicTryExperienceProps) {
  const [completedReport, setCompletedReport] = useState<TutorReportContent | null>(null);
  const client = useMemo(() => createPublicTryClient(props), [props]);

  const joinHref = props.academy.slug
    ? `/academy/${props.academy.slug}`
    : "/sign-up";
  const brandColor = props.academy.primaryColor || "#fd5523";

  if (completedReport) {
    return (
      <div className="flex min-h-[100dvh] flex-col items-center justify-center bg-gradient-to-b from-[#fffaf6] to-[#fff1e6] px-4 py-10">
        <div className="w-full max-w-lg space-y-6 rounded-3xl border border-slate-200 bg-white p-6 text-center shadow-xl sm:p-8">
          <div
            className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl text-white shadow-md"
            style={{ backgroundColor: brandColor }}
          >
            <CheckCircle2 className="h-7 w-7" />
          </div>
          <div className="space-y-2">
            <p className="text-xs font-extrabold uppercase tracking-widest text-[#fd5523]">
              Mini-Lesson Complete
            </p>
            <h1 className="font-heading text-2xl font-black text-[#062e39]">
              Loved learning with {props.personaName}?
            </h1>
            <p className="text-sm leading-relaxed text-slate-600">
              Join <strong className="text-[#062e39]">{props.academy.name}</strong> to unlock full interactive
              lessons, your personal Study Deck, progress tracking, and certificates.
            </p>
          </div>
          <div className="flex flex-col gap-2.5 sm:flex-row sm:justify-center">
            {props.backUrl ? (
              <Link
                href={props.backUrl}
                style={{ backgroundColor: brandColor }}
                className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl px-6 text-sm font-bold text-white shadow-md transition hover:opacity-95"
              >
                <ArrowLeft className="h-4 w-4" />
                Back to Lesson
              </Link>
            ) : (
              <Link
                href={joinHref}
                style={{ backgroundColor: brandColor }}
                className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl px-6 text-sm font-bold text-white shadow-md transition hover:opacity-95"
              >
                Join {props.academy.name}
                <ArrowRight className="h-4 w-4" />
              </Link>
            )}
            <button
              type="button"
              onClick={() => setCompletedReport(null)}
              className="inline-flex h-12 items-center justify-center rounded-2xl border border-slate-200 bg-white px-5 text-sm font-bold text-[#062e39] hover:bg-slate-50"
            >
              Try again
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-[100dvh] flex-col bg-[#fffaf6]">
      {/* Branded Academy Mini-Lesson Conversion Bar */}
      <div className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-200/80 bg-white px-3 py-2 sm:px-5">
        <div className="flex min-w-0 items-center gap-2.5">
          {props.backUrl && (
            <Link
              href={props.backUrl}
              className="inline-flex h-8 shrink-0 items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-3 text-xs font-bold text-[#062e39] transition hover:bg-slate-100"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Back to Lesson</span>
              <span className="sm:hidden">Lesson</span>
            </Link>
          )}
          {props.academy.logoUrl ? (
            <img
              src={props.academy.logoUrl}
              alt={props.academy.name}
              className="h-7 w-7 shrink-0 rounded-lg object-cover"
            />
          ) : (
            <span
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-white"
              style={{ backgroundColor: brandColor }}
            >
              <Sparkles className="h-4 w-4" />
            </span>
          )}
          <div className="min-w-0">
            <p className="truncate text-xs font-extrabold text-[#062e39] sm:text-sm">
              {props.academy.name}
            </p>
            <p className="truncate text-[10px] font-semibold text-slate-500">
              Free interactive AI Teacher preview · no account required
            </p>
          </div>
        </div>

        <Link
          href={joinHref}
          style={{ backgroundColor: brandColor }}
          className="inline-flex h-8 shrink-0 items-center gap-1 rounded-full px-3.5 text-xs font-bold text-white shadow-xs transition hover:opacity-95"
        >
          Join Academy
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>

      <div className="min-h-0 flex-1">
        <TutorSession
          origin="practice"
          scenarioId={props.scenarioId}
          client={client}
          scene={props.scene}
          look={props.look}
          preview={{
            teacherName: props.personaName,
            title: props.title,
            goal: props.goal,
            maxMinutes: props.maxMinutes,
            modes: ["voice", "text"],
          }}
          onExit={(report) => setCompletedReport(report)}
        />
      </div>
    </div>
  );
}
