"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowRight, BookOpen, ClipboardList, FileText, Hand, Lock, Mic, MessageSquareText, Play, Radio, Sparkles } from "lucide-react";
import { PERSONA_PRESETS } from "@/components/tutor/avatar/persona-presets";
import type { TutorApiClient } from "@/components/tutor/practice/api";
import { TutorSession } from "@/components/tutor/practice/TutorSession";
import { DEMO_SCENARIOS, type DemoScenario } from "@/lib/tutor/demo-scenarios";
import { createDemoClient } from "./demoClient";
import { HeroTeacher } from "./HeroTeacher";
import { createScriptedClient } from "./scriptedClient";

// The public ZAI Tutor showcase. Light throughout, like the rest of the marketing site. The only
// colourful surfaces are the painted Rive scenes.

type DemoMode = "watch" | "talk";

const CAST: Record<DemoScenario["key"], { label: string; place: string }> = {
  "zh-tea-house": { label: "Lín Lǎoshī · Mandarin", place: "Tea house" },
  "es-cafe": { label: "Sofía · Spanish", place: "Café in Seville" },
  "fr-boulangerie": { label: "Camille · French", place: "Paris bakery" },
  "health-intake": { label: "Nurse Tendai · English for healthcare", place: "Clinic" },
};

const MODE_CARDS = [
  {
    icon: MessageSquareText,
    title: "Text",
    body: "Type your reply. Good for quiet places, or when the microphone is blocked.",
    badge: null,
  },
  {
    icon: Mic,
    title: "Voice",
    body: "Hold to talk. Your speech is transcribed, and the teacher answers out loud.",
    badge: null,
  },
  {
    icon: Radio,
    title: "Live",
    body: "Real-time conversation with interruptions. Built and in testing.",
    badge: "Coming soon",
  },
] as const;

export function AiTutorShowcase({ signedIn }: { signedIn: boolean }) {
  const [scenarioKey, setScenarioKey] = useState<DemoScenario["key"]>(DEMO_SCENARIOS[0].key);
  const [mode, setMode] = useState<DemoMode>("watch");

  const scenario = DEMO_SCENARIOS.find((s) => s.key === scenarioKey) ?? DEMO_SCENARIOS[0];
  const look = PERSONA_PRESETS.find((p) => p.key === scenario.persona.preset)?.look;
  const cast = CAST[scenario.key];

  // One client per scenario and mode. Practise again inside the session resets it through start().
  const client = useMemo<TutorApiClient>(
    () => (mode === "watch" ? createScriptedClient(scenario.key) : createDemoClient()),
    [mode, scenario.key],
  );

  const talkGated = mode === "talk" && !signedIn;

  return (
    <div className="bg-[#fffaf6] text-[#062e39]">
      {/* Hero */}
      <section className="mx-auto grid max-w-6xl items-center gap-10 px-4 pb-16 pt-28 sm:px-6 md:pt-32 lg:grid-cols-[1.05fr_0.95fr] lg:gap-14 lg:px-8">
        <div>
          <p className="inline-flex items-center gap-2 rounded-full border border-[#fd5523]/25 bg-[#fff2e9] px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-[#fd5523]">
            <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
            ZAI Tutor
          </p>
          <h1 className="mt-5 text-4xl font-extrabold leading-[1.08] tracking-tight sm:text-5xl lg:text-6xl">
            Meet your <span className="text-[#fd5523]">AI teacher</span>
          </h1>
          <p className="mt-5 max-w-xl text-base leading-7 text-slate-600 sm:text-lg">
            Practise out loud with a teacher who listens, corrects gently, shows you the tones and remembers what you
            struggled with.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <a
              href="#demo"
              onClick={() => setMode("watch")}
              className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-[#fd5523] px-6 text-sm font-semibold text-white shadow-[0_16px_34px_rgba(253,85,35,0.3)] transition-all duration-200 hover:-translate-y-0.5 hover:bg-[#ef4a16]"
            >
              <Play className="h-4 w-4" aria-hidden="true" />
              Watch the demo
            </a>
            <a
              href="#demo"
              onClick={() => setMode("talk")}
              className="inline-flex h-12 items-center justify-center gap-2 rounded-full border border-slate-300 bg-white px-6 text-sm font-semibold text-[#062e39] transition-all duration-200 hover:-translate-y-0.5 hover:border-[#062e39]"
            >
              <Mic className="h-4 w-4" aria-hidden="true" />
              Talk to her
            </a>
          </div>
          <p className="mt-4 text-sm text-slate-500">Talking to her needs a free account. Watching does not.</p>
        </div>

        <div className="flex justify-center lg:justify-end">
          <HeroTeacher scene="Scene_TeaHouse" preset="lin" label="Lín Lǎoshī, your Mandarin teacher" />
        </div>
      </section>

      {/* Picker */}
      <section aria-labelledby="pick-heading" className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="max-w-2xl">
          <h2 id="pick-heading" className="text-3xl font-extrabold tracking-tight sm:text-4xl">
            Pick a scene
          </h2>
          <p className="mt-3 text-slate-600">Four short scenes, from a tea house to a clinic. Each runs for up to six minutes.</p>
        </div>

        <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {DEMO_SCENARIOS.map((s) => {
            const selected = s.key === scenario.key;
            const c = CAST[s.key];
            return (
              <button
                key={s.key}
                type="button"
                aria-pressed={selected}
                onClick={() => setScenarioKey(s.key)}
                className={`group flex flex-col rounded-[24px] border bg-white p-4 text-left shadow-[0_18px_40px_rgba(6,46,57,0.08)] transition-all duration-200 hover:-translate-y-0.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#fd5523] ${
                  selected ? "border-[#fd5523] ring-2 ring-[#fd5523]/20" : "border-slate-200"
                }`}
              >
                <div
                  className="relative h-28 w-full overflow-hidden rounded-2xl"
                  style={{ background: `linear-gradient(160deg, ${s.thumb.from} 0%, ${s.thumb.to} 100%)` }}
                  aria-hidden="true"
                >
                  <span className="absolute bottom-2 left-3 rounded-full bg-white/85 px-2.5 py-1 text-[11px] font-semibold text-[#062e39]">
                    {c.place}
                  </span>
                </div>
                <p className="mt-4 text-xs font-semibold uppercase tracking-[0.14em] text-[#fd5523]">{c.label}</p>
                <h3 className="mt-1 text-lg font-bold leading-snug">{s.title}</h3>
                <p className="mt-2 flex-1 text-sm leading-6 text-slate-600">{s.blurb}</p>
                <span className="mt-4 inline-flex w-fit rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
                  {s.level}
                </span>
              </button>
            );
          })}
        </div>
      </section>

      {/* Demo stage */}
      <section id="demo" aria-labelledby="demo-heading" className="scroll-mt-24 mx-auto max-w-6xl px-4 pb-16 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 id="demo-heading" className="text-3xl font-extrabold tracking-tight sm:text-4xl">
              {scenario.title}
            </h2>
            <p className="mt-2 max-w-2xl text-slate-600">{scenario.goal}</p>
          </div>
          <div role="group" aria-label="Demo mode" className="inline-flex w-full rounded-full border border-slate-200 bg-white p-1 sm:w-auto">
            <ModeButton active={mode === "watch"} onClick={() => setMode("watch")}>
              <Play className="h-4 w-4" aria-hidden="true" />
              Watch the demo
            </ModeButton>
            <ModeButton active={mode === "talk"} onClick={() => setMode("talk")}>
              {signedIn ? <Mic className="h-4 w-4" aria-hidden="true" /> : <Lock className="h-4 w-4" aria-hidden="true" />}
              Talk to her
            </ModeButton>
          </div>
        </div>

        <div className="relative mt-6 min-h-[620px] overflow-hidden rounded-[32px] border border-slate-200 bg-white shadow-[0_30px_70px_rgba(6,46,57,0.12)]">
          {talkGated ? (
            <SignInGate />
          ) : (
            <TutorSession
              key={`${mode}-${scenario.key}`}
              origin="practice"
              scenarioId={scenario.key}
              client={client}
              scene={scenario.scene}
              look={look}
              preview={{
                teacherName: scenario.persona.displayName,
                title: scenario.title,
                goal: scenario.goal,
                maxMinutes: scenario.maxMinutes,
                modes: mode === "watch" ? ["text"] : ["voice", "text"],
              }}
            />
          )}
        </div>
        <p className="mt-3 text-center text-xs text-slate-500">
          {mode === "watch"
            ? `Watch mode plays a scripted lesson with ${cast.label.split(" · ")[0]}. The learner lines are scripted, so no account is needed. Turn your sound on.`
            : "Your replies go to the teacher for this demo only. Nothing is saved, and the report is a guide, not a grade."}
        </p>
      </section>

      {/* How it works */}
      <section aria-labelledby="how-heading" className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="max-w-2xl">
          <h2 id="how-heading" className="text-3xl font-extrabold tracking-tight sm:text-4xl">
            How it works
          </h2>
          <p className="mt-3 text-slate-600">Three ways to talk, and a teacher who shows her work.</p>
        </div>

        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {MODE_CARDS.map(({ icon: Icon, title, body, badge }) => (
            <article key={title} className="rounded-[24px] border border-slate-200 bg-white p-6 shadow-[0_18px_40px_rgba(6,46,57,0.06)]">
              <div className="flex items-center justify-between">
                <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#fff2e9] text-[#fd5523]">
                  <Icon className="h-5 w-5" aria-hidden="true" />
                </span>
                {badge ? (
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">{badge}</span>
                ) : null}
              </div>
              <h3 className="mt-5 text-lg font-bold">{title}</h3>
              <p className="mt-2 text-sm leading-6 text-slate-600">{body}</p>
            </article>
          ))}
        </div>

        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <article className="rounded-[24px] border border-slate-200 bg-white p-6 shadow-[0_18px_40px_rgba(6,46,57,0.06)]">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#e9f8f2] text-[#15805f]">
              <Hand className="h-5 w-5" aria-hidden="true" />
            </span>
            <h3 className="mt-5 text-lg font-bold">Gestures and tone tracing</h3>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              She points at the word on the card, nods, and counts on her fingers. For tonal languages she traces each
              tone as a contour, so you can see the rise and the dip.
            </p>
          </article>
          <article className="rounded-[24px] border border-slate-200 bg-white p-6 shadow-[0_18px_40px_rgba(6,46,57,0.06)]">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#eef0ff] text-[#3b47b8]">
              <FileText className="h-5 w-5" aria-hidden="true" />
            </span>
            <h3 className="mt-5 text-lg font-bold">A report card after every session</h3>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Fluency, accuracy, vocabulary and whether you reached the goal, with your top mistakes and one next step.
              Scores are guidance for the learner, not a formal grade.
            </p>
          </article>
        </div>
      </section>

      {/* For academies */}
      <section aria-labelledby="academy-heading" className="mx-auto max-w-6xl px-4 pb-20 sm:px-6 lg:px-8">
        <div className="rounded-[32px] border border-[#fd5523]/15 bg-gradient-to-br from-[#fff2e9] via-white to-[#e9f8f2] p-6 shadow-[0_30px_70px_rgba(6,46,57,0.08)] sm:p-10">
          <div className="grid gap-8 lg:grid-cols-[1fr_0.9fr] lg:items-center">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#fd5523]">For academies</p>
              <h2 id="academy-heading" className="mt-3 text-3xl font-extrabold tracking-tight sm:text-4xl">
                Tutor-led speaking practice, inside your courses
              </h2>
              <ul className="mt-6 space-y-4 text-sm leading-6 text-slate-600">
                <li className="flex gap-3">
                  <BookOpen className="mt-1 h-5 w-5 shrink-0 text-[#fd5523]" aria-hidden="true" />
                  <span>
                    <strong className="text-[#062e39]">Tutor-led lessons.</strong> Attach a teacher scene to a lesson so
                    learners practise what they just read.
                  </span>
                </li>
                <li className="flex gap-3">
                  <Mic className="mt-1 h-5 w-5 shrink-0 text-[#fd5523]" aria-hidden="true" />
                  <span>
                    <strong className="text-[#062e39]">A free Practice Room.</strong> Every learner gets a monthly allowance
                    of free practice minutes.
                  </span>
                </li>
                <li className="flex gap-3">
                  <ClipboardList className="mt-1 h-5 w-5 shrink-0 text-[#fd5523]" aria-hidden="true" />
                  <span>
                    <strong className="text-[#062e39]">A teacher gradebook.</strong> Staff see the reports from lesson and
                    assignment sessions in one place.
                  </span>
                </li>
              </ul>
            </div>
            <div className="rounded-[24px] border border-slate-200 bg-white p-6 shadow-[0_18px_40px_rgba(6,46,57,0.06)]">
              <p className="text-base leading-7 text-slate-600">
                Want the tutor in your academy? We will set up a scene for your courses and walk your team through the
                gradebook.
              </p>
              <Link
                href="/contact"
                className="mt-6 inline-flex h-12 w-full items-center justify-center gap-2 rounded-full bg-[#fd5523] px-6 text-sm font-semibold text-white transition-colors hover:bg-[#ef4a16] sm:w-auto"
              >
                Talk to our team
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

function ModeButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`inline-flex flex-1 items-center justify-center gap-2 rounded-full px-4 py-2.5 text-sm font-semibold transition-colors sm:flex-none ${
        active ? "bg-[#fd5523] text-white shadow-sm" : "text-slate-600 hover:text-[#062e39]"
      }`}
    >
      {children}
    </button>
  );
}

function SignInGate() {
  const back = encodeURIComponent("/ai-tutor");
  return (
    <div className="flex min-h-[620px] flex-col items-center justify-center gap-5 bg-gradient-to-b from-[#fffaf6] to-[#fff1e6] px-6 py-12 text-center text-[#062e39]">
      <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#fff2e9] text-[#fd5523]">
        <Lock className="h-6 w-6" aria-hidden="true" />
      </span>
      <div className="max-w-md">
        <h3 className="text-2xl font-bold">Sign in to talk with her</h3>
        <p className="mt-3 text-sm leading-6 text-slate-600">
          A free account lets you talk with the teacher. Your conversation stays in this tab and is not saved. You can
          still watch the demo without signing in.
        </p>
      </div>
      <div className="flex w-full max-w-xs flex-col gap-3 sm:flex-row sm:justify-center">
        <Link
          href={`/sign-in?redirect_url=${back}`}
          className="inline-flex h-11 items-center justify-center rounded-full bg-[#fd5523] px-6 text-sm font-bold text-white shadow-[0_14px_30px_rgba(253,85,35,0.28)] hover:bg-[#ef4a16]"
        >
          Sign in
        </Link>
        <Link
          href={`/sign-up?redirect_url=${back}`}
          className="inline-flex h-11 items-center justify-center rounded-full border border-slate-300 bg-white px-6 text-sm font-semibold text-[#062e39] hover:border-[#062e39]"
        >
          Create a free account
        </Link>
      </div>
    </div>
  );
}
