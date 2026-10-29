"use client";

import { useState } from "react";
import Link from "next/link";
import { Check, Copy, MessageCircle, Palette, BookOpen, Send, Users, ArrowRight } from "lucide-react";
import { whatsappShareUrl, type GetStartedStep, type GetStartedStepId } from "@/lib/tenants/get-started";
import { cn } from "@/lib/utils";

type GetStartedChecklistProps = {
  slug: string;
  academyName: string;
  joinUrl: string;
  steps: GetStartedStep[];
  /** A draft course to publish, if there is one. */
  draftCourseId: string | null;
  welcome: boolean;
};

const STEP_COPY: Record<GetStartedStepId, { title: string; body: string; icon: typeof Palette }> = {
  branding: { title: "Add your logo and colour", body: "Make the academy look like yours.", icon: Palette },
  course: { title: "Create your first course", body: "Add lessons with videos, notes and quizzes.", icon: BookOpen },
  publish: { title: "Publish it", body: "Students can only see published courses.", icon: Send },
  invite: { title: "Invite your students", body: "Share your join link. Students sign up and land in your classroom.", icon: Users },
};

export function GetStartedChecklist({ slug, academyName, joinUrl, steps, draftCourseId, welcome }: GetStartedChecklistProps) {
  const [copied, setCopied] = useState(false);
  const [copyFailed, setCopyFailed] = useState(false);
  const doneCount = steps.filter((s) => s.done).length;

  const hrefFor: Record<Exclude<GetStartedStepId, "invite">, string> = {
    branding: `/academy/${slug}/admin/settings/site`,
    course: `/academy/${slug}/admin/courses/new`,
    publish: draftCourseId ? `/creator/courses/${draftCourseId}` : `/academy/${slug}/admin/courses`,
  };

  const shareMessage = `Join ${academyName} and start learning with me:`;

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(joinUrl);
      setCopyFailed(false);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      setCopyFailed(true);
    }
  }

  return (
    <section
      aria-labelledby="get-started-title"
      className="mb-8 rounded-[2rem] border border-slate-100 bg-white p-5 shadow-sm sm:p-8"
    >
      <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 id="get-started-title" className="text-xl font-black tracking-tight text-[#062e39] sm:text-2xl">
            {welcome ? `Welcome! ${academyName} is live.` : "Get started"}
          </h2>
          <p className="mt-1 text-sm text-slate-500">Four steps to your first class of students.</p>
        </div>
        <p className="text-sm font-bold text-slate-500" aria-live="polite">
          {doneCount} of {steps.length} done
        </p>
      </div>

      <ol className="space-y-3">
        {steps.map((step, index) => {
          const copy = STEP_COPY[step.id];
          const Icon = copy.icon;
          return (
            <li
              key={step.id}
              className={cn(
                "rounded-2xl border p-4",
                step.done ? "border-emerald-100 bg-emerald-50/50" : "border-slate-100 bg-slate-50/60"
              )}
            >
              <div className="flex items-start gap-3">
                <span
                  className={cn(
                    "flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-black",
                    step.done ? "bg-emerald-500 text-white" : "bg-white text-[#062e39] ring-1 ring-slate-200"
                  )}
                  aria-hidden="true"
                >
                  {step.done ? <Check className="h-4 w-4" /> : index + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <p className={cn("font-bold text-[#062e39]", step.done && "text-emerald-800")}>
                    <span className="sr-only">{step.done ? "Done: " : "To do: "}</span>
                    {copy.title}
                  </p>
                  <p className="mt-0.5 text-sm text-slate-500">{copy.body}</p>

                  {step.id === "invite" ? (
                    <div className="mt-3 space-y-2">
                      <p className="break-all rounded-xl bg-white px-3 py-2 font-mono text-xs text-slate-700 ring-1 ring-slate-200">
                        {joinUrl}
                      </p>
                      <div className="flex flex-col gap-2 sm:flex-row">
                        <button
                          type="button"
                          onClick={copyLink}
                          className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-[#062e39] px-4 text-sm font-bold text-white transition hover:bg-[#0a3f4e]"
                        >
                          {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                          {copied ? "Copied" : "Copy link"}
                        </button>
                        <a
                          href={whatsappShareUrl(shareMessage, joinUrl)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-[#25D366] px-4 text-sm font-bold text-white transition hover:bg-[#1ebe5a]"
                        >
                          <MessageCircle className="h-4 w-4" />
                          Share on WhatsApp
                        </a>
                      </div>
                      <p aria-live="polite" className="text-xs text-slate-500">
                        {copied
                          ? "Link copied. Paste it into your class group."
                          : copyFailed
                            ? "Couldn't copy automatically. Press and hold the link above to copy it."
                            : ""}
                      </p>
                    </div>
                  ) : (
                    !step.done && (
                      <Link
                        href={hrefFor[step.id]}
                        className="mt-3 inline-flex h-11 items-center gap-2 rounded-xl bg-[#fd5523] px-4 text-sm font-bold text-white transition hover:bg-[#ef4a16]"
                      >
                        {step.id === "branding" ? "Open site settings" : step.id === "course" ? "Create a course" : "Open course to publish"}
                        <ArrowRight className="h-4 w-4" />
                      </Link>
                    )
                  )}
                </div>
                <Icon className="hidden h-5 w-5 shrink-0 text-slate-300 sm:block" aria-hidden="true" />
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
