"use client";

import { CreateOrganization, useOrganizationList } from "@clerk/nextjs";
import Link from "next/link";
import { ArrowRight, Building2, Rocket, Sparkles } from "lucide-react";

export function LaunchAcademyClient() {
  const { userMemberships } = useOrganizationList({
    userMemberships: { infinite: true },
  });
  const hasOrg = (userMemberships?.data?.length ?? 0) > 0;

  return (
    <div className="mx-auto max-w-lg px-4 py-10 md:py-14">
      <div className="mb-8 space-y-3 text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#fd5523]/15 text-[#fd5523]">
          <Rocket className="h-7 w-7" />
        </div>
        <p className="text-[10px] font-black uppercase tracking-[0.28em] text-[#fd5523]">
          Launch Pad
        </p>
        <h1 className="text-2xl font-black tracking-tight text-[#062e39] md:text-3xl">
          Open your academy
        </h1>
        <p className="text-sm leading-relaxed text-slate-600">
          One quick step creates your organization in Clerk. We&apos;ll sync your public academy site
          and studio tools right after — usually under a minute.
        </p>
      </div>

      <ol className="mb-8 space-y-3 rounded-3xl border border-slate-100 bg-slate-50/80 p-5 text-left text-sm text-slate-700">
        <li className="flex gap-3">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#062e39] text-[10px] font-black text-white">
            1
          </span>
          <span>
            <strong className="text-[#062e39]">Name your academy</strong> — this becomes your brand
            across the platform.
          </span>
        </li>
        <li className="flex gap-3">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#062e39] text-[10px] font-black text-white">
            2
          </span>
          <span>
            <strong className="text-[#062e39]">Optional logo</strong> — add it now or later in
            settings.
          </span>
        </li>
        <li className="flex gap-3">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#062e39] text-[10px] font-black text-white">
            3
          </span>
          <span>
            <strong className="text-[#062e39]">Continue</strong> — we&apos;ll drop you into studio to
            publish your first course when you&apos;re ready.
          </span>
        </li>
      </ol>

      <div className="rounded-[2rem] border border-slate-200 bg-white p-4 shadow-lg shadow-slate-200/60">
        <CreateOrganization
          afterCreateOrganizationUrl="/creator/courses"
          appearance={{
            elements: {
              card: "shadow-none border-0 bg-transparent p-0",
              navbar: "hidden",
              headerTitle: "text-[#062e39] font-black text-lg",
              formButtonPrimary:
                "bg-[#fd5523] hover:bg-[#ef4a16] text-sm font-bold rounded-xl",
              formFieldInput: "rounded-xl border-slate-200",
            },
          }}
        />
      </div>

      {hasOrg && (
        <p className="mt-6 text-center text-xs text-slate-500">
          You already belong to an organization.{" "}
          <Link href="/creator/courses" className="font-bold text-[#fd5523] underline-offset-4 hover:underline">
            Go to studio
          </Link>
        </p>
      )}

      <div className="mt-10 flex flex-col items-center gap-4 border-t border-slate-100 pt-8">
        <p className="text-xs text-slate-500">Prefer to finish profile details first?</p>
        <Link
          href="/onboarding?role=company_admin"
          className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-6 py-3 text-sm font-semibold text-[#062e39] shadow-sm transition-colors hover:bg-slate-50"
        >
          <Building2 className="h-4 w-4" />
          Complete profile wizard
          <ArrowRight className="h-4 w-4 opacity-60" />
        </Link>
      </div>

      <div className="mt-8 flex items-start gap-3 rounded-2xl bg-[#fff6ee] p-4 text-xs leading-relaxed text-slate-600">
        <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-[#fd5523]" />
        <span>
          Tip: After your org exists, use{" "}
          <strong className="text-[#062e39]">Organization</strong> in the header to switch academies if
          you join more than one later.
        </span>
      </div>
    </div>
  );
}
