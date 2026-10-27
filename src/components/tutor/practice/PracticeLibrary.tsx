import Link from "next/link";
import { ArrowRight, Clock3, Library, Mic, MessageSquareText } from "lucide-react";
import type { LanguageGroup } from "@/lib/tutor/practice-library";
import { startableModes } from "@/lib/tutor/practice-library";
import type { PracticeLibraryItem } from "@/lib/tutor/practice-library";

// Server-rendered library of scenarios, grouped by language and level. Each card opens a session.

type PracticeLibraryProps = {
  groups: LanguageGroup[];
  /** Path of the session route for one scenario, for example /practice/<id>. */
  sessionHref: (scenarioId: string) => string;
  /** Where the empty state sends the learner. */
  browseHref: string;
  browseLabel: string;
  heading: string;
  subheading: string;
};

export function PracticeLibrary({ groups, sessionHref, browseHref, browseLabel, heading, subheading }: PracticeLibraryProps) {
  const total = groups.reduce((n, g) => n + g.items.length, 0);

  return (
    <div className="bg-slate-50 min-h-screen">
      <div className="container mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-14">
        <header className="mb-8 max-w-2xl space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-blue-600">Practice Room</p>
          <h1 className="font-heading text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">{heading}</h1>
          <p className="text-base text-slate-600">{subheading}</p>
        </header>

        {total === 0 ? (
          <EmptyState browseHref={browseHref} browseLabel={browseLabel} />
        ) : (
          <div className="space-y-12">
            {groups.map((group) => (
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
      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
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
        <p className="line-clamp-3 text-sm leading-relaxed text-slate-600">{item.goal}</p>
        {item.personaName && <p className="text-sm text-slate-500">With {item.personaName}</p>}
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
