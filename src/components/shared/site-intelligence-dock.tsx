"use client";

import { useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { Bot, Briefcase, Compass, GraduationCap, Sparkles, X } from "lucide-react";

type Suggestion = {
  label: string;
  body: string;
  href: string;
};

const MARKETING_SUGGESTIONS: Suggestion[] = [
  {
    label: "Find your best-fit path",
    body: "Use the workflow audit and outcome-first catalog to start with the fastest ROI.",
    href: "/courses",
  },
  {
    label: "Compare professional tracks",
    body: "See which AI path matches your role, urgency, and workflow constraints.",
    href: "/courses?category=ai-for-business",
  },
];

const CREATOR_SUGGESTIONS: Suggestion[] = [
  {
    label: "Generate a course blueprint",
    body: "Use AI to shape the first-win lesson, workflow stages, and launch positioning.",
    href: "/creator/courses/new",
  },
  {
    label: "Tighten course readiness",
    body: "Review your checklist, curriculum, and learner value story before publishing.",
    href: "/creator/courses",
  },
];

const LEARNER_SUGGESTIONS: Suggestion[] = [
  {
    label: "Return to your lesson workspace",
    body: "Stay focused on the current outcome, prompt patterns, and next practical action.",
    href: "/dashboard",
  },
  {
    label: "Explore another role-focused course",
    body: "Stack adjacent workflows once you have your first quick win in production.",
    href: "/courses",
  },
];

function getContext(pathname: string) {
  if (pathname.startsWith("/creator")) {
    return {
      icon: Briefcase,
      eyebrow: "Studio intelligence",
      title: "AI-assisted course design is active.",
      description:
        "Guide creators toward practical outcomes, faster launches, and stronger first-session value.",
      suggestions: CREATOR_SUGGESTIONS,
    };
  }

  if (pathname.includes("/learn") || pathname.startsWith("/dashboard")) {
    return {
      icon: GraduationCap,
      eyebrow: "Learning intelligence",
      title: "Your workspace is optimized for practical progress.",
      description:
        "Stay anchored on what to apply, what to save, and what to test at work next.",
      suggestions: LEARNER_SUGGESTIONS,
    };
  }

  return {
    icon: Compass,
    eyebrow: "Site intelligence",
    title: "Zed AI is guiding users to faster outcomes.",
    description:
      "Discovery, enrollment, and learning now emphasize workflow fit instead of generic course browsing.",
    suggestions: MARKETING_SUGGESTIONS,
  };
}

export function SiteIntelligenceDock() {
  const pathname = usePathname();
  const [open, setOpen] = useState(true);

  const context = useMemo(() => getContext(pathname), [pathname]);
  const Icon = context.icon;

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed bottom-5 right-5 z-50 flex items-center gap-2 rounded-full border border-blue-200 bg-white/95 px-4 py-2 text-sm font-medium text-slate-900 shadow-lg backdrop-blur"
      >
        <Bot className="h-4 w-4 text-blue-600" />
        Intelligence
      </button>
    );
  }

  return (
    <aside className="pointer-events-none fixed bottom-5 right-5 z-50 hidden w-80 md:block">
      <div className="pointer-events-auto overflow-hidden rounded-3xl border border-slate-200 bg-white/92 shadow-2xl backdrop-blur-xl">
        <div className="border-b border-slate-200 bg-gradient-to-r from-blue-600 to-cyan-500 px-5 py-4 text-white">
          <div className="mb-2 flex items-start justify-between gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/15">
              <Icon className="h-5 w-5" />
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-full bg-white/10 p-1.5 text-white/90 transition-colors hover:bg-white/20"
              aria-label="Close intelligence dock"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-white/70">
            {context.eyebrow}
          </p>
          <h2 className="mt-1 text-lg font-semibold leading-tight">{context.title}</h2>
          <p className="mt-2 text-sm leading-relaxed text-blue-50">{context.description}</p>
        </div>

        <div className="space-y-3 p-4">
          {context.suggestions.map((item) => (
            <Link
              key={item.label}
              href={item.href}
              className="block rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 transition-colors hover:border-blue-200 hover:bg-blue-50/60"
            >
              <div className="mb-1 flex items-center gap-2 text-sm font-semibold text-slate-900">
                <Sparkles className="h-3.5 w-3.5 text-blue-600" />
                {item.label}
              </div>
              <p className="text-sm leading-relaxed text-slate-600">{item.body}</p>
            </Link>
          ))}
        </div>
      </div>
    </aside>
  );
}
